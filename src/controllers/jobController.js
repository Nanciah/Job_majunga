const pool = require('../config/db');
const { sendEmail } = require('../services/emailService');
const { geocodeAddress } = require('../services/geocodeService');

// POST /jobs — Créer une offre (avec géocodage automatique)
const createJob = async (req, res) => {
  const recruiterId = req.user.userId;
  const {
    title, description, contract_type, location,
    salary_min, salary_max, category, skills, expires_at
  } = req.body;

  if (!title || !description || !contract_type)
    return res.status(400).json({ error: 'title, description et contract_type sont requis' });

  try {
    // ✅ GÉOCODAGE AUTOMATIQUE
    let latitude = null;
    let longitude = null;
    
    if (location && location.trim() !== '') {
      const geocodeResult = await geocodeAddress(location);
      latitude = geocodeResult.lat;
      longitude = geocodeResult.lng;
      
      if (latitude && longitude) {
        console.log(`📍 Coordonnées trouvées pour "${location}": ${latitude}, ${longitude}`);
      } else {
        console.log(`⚠️ Impossible de géocoder "${location}"`);
      }
    }

    const [recruiterRows] = await pool.query(
      'SELECT email, company_name FROM users WHERE id = ?', [recruiterId]
    );
    const recruiter = recruiterRows[0];

    const [result] = await pool.query(
      `INSERT INTO job_offers 
        (recruiter_id, title, description, contract_type, location, latitude, longitude,
         salary_min, salary_max, category, skills, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)`,
      [
        recruiterId, title, description, contract_type, location || null,
        latitude, longitude, salary_min || null, salary_max || null,
        category || null, skills ? JSON.stringify(skills) : null, expires_at || null
      ]
    );

    const jobId = result.insertId;
    const approveUrl = `${process.env.BASE_URL}/admin/jobs/${jobId}/approve`;
    const rejectUrl  = `${process.env.BASE_URL}/admin/jobs/${jobId}/reject`;

    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'nanciah05@gmail.com',
      subject: `📋 Nouvelle offre à approuver — ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7C3AED, #2563EB); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">JobMajunga</h1>
            <p style="color: rgba(255,255,255,0.8);">Nouvelle offre en attente d'approbation</p>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1e293b;">📋 ${title}</h2>
            <p><strong>Entreprise :</strong> ${recruiter?.company_name ?? 'Non précisé'}</p>
            <p><strong>Recruteur :</strong> ${recruiter?.email}</p>
            <p><strong>Contrat :</strong> ${contract_type}</p>
            <p><strong>Lieu :</strong> ${location || 'Non précisé'}</p>
            ${latitude && longitude ? `<p><strong>📍 Coordonnées :</strong> ${latitude}, ${longitude}</p>` : ''}
            <p><strong>Salaire :</strong> ${salary_min ? salary_min + '€ - ' + salary_max + '€' : 'Non précisé'}</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
            <p><strong>Description :</strong></p>
            <p style="color: #475569;">${description}</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
            <div style="text-align: center; margin-top: 20px;">
              <a href="${approveUrl}" style="background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-right: 10px;">
                ✅ Approuver l'offre
              </a>
              <a href="${rejectUrl}" style="background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                ❌ Rejeter l'offre
              </a>
            </div>
          </div>
        </div>
      `
    });

    await pool.query(
      'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
      [recruiterId, 'job_created', `Offre créée en attente d'approbation: ${title}`]
    );

    res.status(201).json({ 
      message: "Offre soumise pour approbation.", 
      jobId,
      location: location,
      coordinates: { lat: latitude, lng: longitude }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur création: ' + err.message });
  }
};

// GET /jobs — Lister les offres (filtrées selon le rôle)
const getJobs = async (req, res) => {
  const { title, location, contract_type, category, status, search } = req.query;
  const userId   = req.user?.userId;
  const userRole = req.user?.role;

  let query = `SELECT j.id, j.recruiter_id, j.title, j.contract_type, j.location, 
                      j.salary_min, j.salary_max, j.category, j.status, j.created_at,
                      u.company_name
               FROM job_offers j
               LEFT JOIN users u ON j.recruiter_id = u.id
               WHERE 1=1`;
  const params = [];

  if (userRole === 'recruiter') {
    // Recruteur → ses offres seulement
    query += ' AND j.recruiter_id = ?';
    params.push(userId);
  } else if (userRole === 'candidate' || !userRole) {
    // Candidat ou non connecté → publiées seulement
    query += " AND j.status = 'published'";
  }
  // Admin → tout sans filtre

  if (search)        { query += ' AND (j.title LIKE ? OR j.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (title)         { query += ' AND j.title LIKE ?';      params.push(`%${title}%`); }
  if (location)      { query += ' AND j.location LIKE ?';   params.push(`%${location}%`); }
  if (contract_type) { query += ' AND j.contract_type = ?'; params.push(contract_type); }
  if (category)      { query += ' AND j.category LIKE ?';   params.push(`%${category}%`); }
  if (status && userRole === 'recruiter') {
    query += ' AND j.status = ?';
    params.push(status);
  }

  query += ' ORDER BY j.created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    res.json({ total: rows.length, jobs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur liste: ' + err.message });
  }
};

// GET /jobs/:id — Détail d'une offre
const getJobById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT j.*, u.company_name 
       FROM job_offers j 
       LEFT JOIN users u ON j.recruiter_id = u.id 
       WHERE j.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Offre non trouvée' });

    // Incrémenter le compteur
    await pool.query('UPDATE job_offers SET views_count = views_count + 1 WHERE id = ?', [id]);

    // Enregistrer qui a regardé
    const viewerId = req.user?.userId ?? null;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await pool.query(
      'INSERT INTO job_views (job_id, user_id, ip_address) VALUES (?, ?, ?)',
      [id, viewerId, ip]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur détail: ' + err.message });
  }
};

// PUT /jobs/:id — Modifier une offre (avec géocodage automatique)
const updateJob = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;
  const {
    title, description, contract_type, location,
    salary_min, salary_max, category, skills, expires_at
  } = req.body;

  try {
    // Vérifier que l'offre appartient au recruteur
    const [rows] = await pool.query(
      'SELECT id FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });

    // ✅ GÉOCODAGE AUTOMATIQUE
    let latitude = null;
    let longitude = null;
    
    if (location && location.trim() !== '') {
      const geocodeResult = await geocodeAddress(location);
      latitude = geocodeResult.lat;
      longitude = geocodeResult.lng;
    }

    // Récupérer infos recruteur pour l'email
    const [recruiterRows] = await pool.query(
      'SELECT email, company_name FROM users WHERE id = ?', [recruiterId]
    );
    const recruiter = recruiterRows[0];

    // Mettre à jour l'offre
    await pool.query(
      `UPDATE job_offers SET
        title         = COALESCE(?, title),
        description   = COALESCE(?, description),
        contract_type = COALESCE(?, contract_type),
        location      = COALESCE(?, location),
        latitude      = COALESCE(?, latitude),
        longitude     = COALESCE(?, longitude),
        salary_min    = COALESCE(?, salary_min),
        salary_max    = COALESCE(?, salary_max),
        category      = COALESCE(?, category),
        skills        = COALESCE(?, skills),
        status        = 'pending_approval',
        expires_at    = COALESCE(?, expires_at)
       WHERE id = ?`,
      [
        title, description, contract_type, location,
        latitude, longitude, salary_min, salary_max,
        category, skills ? JSON.stringify(skills) : null,
        expires_at, id
      ]
    );

    // Récupérer le titre final de l'offre pour l'email
    const [updatedRows] = await pool.query(
      'SELECT title FROM job_offers WHERE id = ?', [id]
    );
    const finalTitle = updatedRows[0]?.title ?? 'Sans titre';

    // Envoyer email à l'admin
    const approveUrl = `${process.env.BASE_URL}/admin/jobs/${id}/approve`;
    const rejectUrl  = `${process.env.BASE_URL}/admin/jobs/${id}/reject`;

    await sendEmail({
      to: process.env.ADMIN_EMAIL || 'nanciah05@gmail.com',
      subject: `📋 Offre modifiée à approuver — ${finalTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7C3AED, #2563EB); 
                      padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">JobMajunga</h1>
            <p style="color: rgba(255,255,255,0.8);">
              Offre modifiée en attente d'approbation
            </p>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1e293b;">📋 ${finalTitle}</h2>
            <p><strong>Entreprise :</strong> ${recruiter?.company_name ?? 'Non précisé'}</p>
            <p><strong>Recruteur :</strong> ${recruiter?.email}</p>
            <p><strong>Contrat :</strong> ${contract_type}</p>
            <p><strong>Lieu :</strong> ${location || 'Non précisé'}</p>
            ${latitude && longitude ? `<p><strong>📍 Coordonnées :</strong> ${latitude}, ${longitude}</p>` : ''}
            <p><strong>Salaire :</strong> ${salary_min ? salary_min + ' - ' + salary_max + ' Ar' : 'Non précisé'}</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
            <p><strong>Description :</strong></p>
            <p style="color: #475569;">${description}</p>
            <hr style="border: 1px solid #e2e8f0; margin: 20px 0;">
            <div style="text-align: center; margin-top: 20px;">
              <a href="${approveUrl}" 
                 style="background: #16a34a; color: white; padding: 14px 28px; 
                        border-radius: 8px; text-decoration: none; font-weight: bold; 
                        margin-right: 10px;">
                ✅ Approuver l'offre
              </a>
              <a href="${rejectUrl}" 
                 style="background: #dc2626; color: white; padding: 14px 28px; 
                        border-radius: 8px; text-decoration: none; font-weight: bold;">
                ❌ Rejeter l'offre
              </a>
            </div>
            <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; text-align: center;">
              Vous pouvez aussi gérer cette offre depuis le dashboard Admin.
            </p>
          </div>
        </div>
      `
    });

    // Log
    await pool.query(
      'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
      [recruiterId, 'job_updated', `Offre modifiée et soumise pour approbation: ${finalTitle}`]
    );

    res.json({ 
      message: "Offre mise à jour et soumise pour approbation. L'admin recevra un email.",
      location: location,
      coordinates: { lat: latitude, lng: longitude }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// DELETE /jobs/:id
const deleteJob = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;

  try {
    const [rows] = await pool.query(
      'SELECT id FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });

    await pool.query('DELETE FROM job_offers WHERE id = ?', [id]);
    res.json({ message: 'Offre supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression: ' + err.message });
  }
};

// PATCH /jobs/:id/status
const updateJobStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const recruiterId = req.user.userId;

  const validStatuses = ['draft', 'archived'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Statut invalide — seul draft et archived sont autorisés' });

  try {
    const [rows] = await pool.query(
      'SELECT id FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });

    await pool.query('UPDATE job_offers SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Statut mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

// GET /jobs/:id/viewers — Qui a regardé l'offre
const getJobViewers = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT
        u.id as user_id,
        u.email,
        COALESCE(CONCAT(cp.first_name, ' ', cp.last_name), u.email) as full_name,
        COALESCE(jv.viewed_at, a.applied_at) as viewed_at,
        CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as has_applied
       FROM (
         SELECT user_id, viewed_at, job_id FROM job_views WHERE job_id = ?
         UNION
         SELECT candidate_id as user_id, applied_at as viewed_at, job_offer_id as job_id
         FROM applications WHERE job_offer_id = ?
       ) combined
       LEFT JOIN users u ON combined.user_id = u.id
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       LEFT JOIN applications a ON a.candidate_id = u.id AND a.job_offer_id = ?
       ORDER BY viewed_at DESC`,
      [id, id, id]
    );
    res.json({ total: rows.length, viewers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /jobs/:id/duplicate
const duplicateJob = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;

  try {
    const [rows] = await pool.query(
      'SELECT * FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });

    const job = rows[0];

    const [result] = await pool.query(
      `INSERT INTO job_offers
        (recruiter_id, title, description, contract_type, location,
         salary_min, salary_max, category, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        recruiterId, job.title + ' (copie)', job.description,
        job.contract_type, job.location, job.salary_min,
        job.salary_max, job.category, job.skills
      ]
    );

    res.status(201).json({ 
      message: 'Offre dupliquée en brouillon. Modifiez-la avant de soumettre.',
      jobId: result.insertId 
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

// POST /jobs/:id/react
const reactToJob = async (req, res) => {
  const { id } = req.params;
  const { reaction_type } = req.body;
  const userId = req.user.userId;

  const valid = ['like', 'interested', 'motivated'];
  if (!valid.includes(reaction_type))
    return res.status(400).json({ error: 'Réaction invalide' });

  try {
    const [existing] = await pool.query(
      'SELECT id, reaction_type FROM job_reactions WHERE job_id = ? AND user_id = ?',
      [id, userId]
    );

    if (existing.length > 0) {
      if (existing[0].reaction_type === reaction_type) {
        await pool.query('DELETE FROM job_reactions WHERE job_id = ? AND user_id = ?',
          [id, userId]);
        return res.json({ message: 'Réaction retirée', action: 'removed' });
      } else {
        await pool.query(
          'UPDATE job_reactions SET reaction_type = ? WHERE job_id = ? AND user_id = ?',
          [reaction_type, id, userId]
        );
        return res.json({ message: 'Réaction mise à jour', action: 'updated' });
      }
    }

    await pool.query(
      'INSERT INTO job_reactions (job_id, user_id, reaction_type) VALUES (?, ?, ?)',
      [id, userId, reaction_type]
    );
    res.json({ message: 'Réaction ajoutée', action: 'added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /jobs/:id/reactions
const getJobReactions = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  try {
    const [counts] = await pool.query(
      `SELECT reaction_type, COUNT(*) as count
       FROM job_reactions WHERE job_id = ?
       GROUP BY reaction_type`,
      [id]
    );

    let userReaction = null;
    if (userId) {
      const [mine] = await pool.query(
        'SELECT reaction_type FROM job_reactions WHERE job_id = ? AND user_id = ?',
        [id, userId]
      );
      if (mine.length > 0) userReaction = mine[0].reaction_type;
    }

    res.json({ reactions: counts, user_reaction: userReaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /jobs/:id/comments
const addComment = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  if (!content?.trim())
    return res.status(400).json({ error: 'Commentaire vide' });

  try {
    const [result] = await pool.query(
      'INSERT INTO job_comments (job_id, user_id, content) VALUES (?, ?, ?)',
      [id, userId, content.trim()]
    );

    const [newComment] = await pool.query(
      `SELECT jc.id, jc.content, jc.created_at,
              u.email,
              COALESCE(CONCAT(cp.first_name, ' ', cp.last_name), u.email) as author_name
       FROM job_comments jc
       JOIN users u ON jc.user_id = u.id
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE jc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ message: 'Commentaire ajouté', comment: newComment[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /jobs/:id/comments
const getComments = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT jc.id, jc.content, jc.created_at, jc.user_id,
              u.email,
              COALESCE(CONCAT(cp.first_name, ' ', cp.last_name), u.email) as author_name
       FROM job_comments jc
       JOIN users u ON jc.user_id = u.id
       LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
       WHERE jc.job_id = ?
       ORDER BY jc.created_at ASC`,
      [id]
    );
    res.json({ total: rows.length, comments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /jobs/:id/comments/:commentId
const deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;
  try {
    await pool.query(
      'DELETE FROM job_comments WHERE id = ? AND user_id = ?',
      [commentId, userId]
    );
    res.json({ message: 'Commentaire supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ UN SEUL module.exports à la fin — avec TOUTES les fonctions
module.exports = {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  updateJobStatus,
  duplicateJob,
  getJobViewers,
  reactToJob,
  getJobReactions,
  addComment,
  getComments,
  deleteComment
};