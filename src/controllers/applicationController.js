const pool = require('../config/db');



// POST /applications — Postuler à une offre (candidate uniquement)
const applyToJob = async (req, res) => {
  const candidateId = req.user.userId;
  const { job_offer_id, cv_id, cover_letter } = req.body;

  if (!job_offer_id)
    return res.status(400).json({ error: 'job_offer_id est requis' });

  try {
    // Vérifier que l'offre existe et est publiée
    const [job] = await pool.query(
      "SELECT id FROM job_offers WHERE id = ? AND status = 'published'",
      [job_offer_id]
    );
    if (job.length === 0)
      return res.status(404).json({ error: 'Offre non trouvée ou non publiée' });

    // Vérifier que le candidat n'a pas déjà postulé
    const [existing] = await pool.query(
      'SELECT id FROM applications WHERE candidate_id = ? AND job_offer_id = ?',
      [candidateId, job_offer_id]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: 'Vous avez déjà postulé à cette offre' });

    // cv_id : utiliser celui fourni ou NULL si non obligatoire en BDD
    const [result] = await pool.query(
      'INSERT INTO applications (candidate_id, job_offer_id, cv_id, cover_letter, status) VALUES (?, ?, ?, ?, "sent")',
      [candidateId, job_offer_id, cv_id || null, cover_letter || null]
    );

    res.status(201).json({ message: 'Candidature envoyée', applicationId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur candidature: ' + err.message });
  }
};

// GET /applications/me — Mes candidatures (candidate)
const getMyApplications = async (req, res) => {
  const candidateId = req.user.userId;

  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.applied_at, a.interview_date,
              j.title, j.location, j.contract_type
       FROM applications a
       JOIN job_offers j ON j.id = a.job_offer_id
       WHERE a.candidate_id = ?
       ORDER BY a.applied_at DESC`,
      [candidateId]
    );
    res.json({ total: rows.length, applications: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur liste: ' + err.message });
  }
};

// GET /jobs/:id/applications — Candidatures reçues pour une offre (recruiter)
const getJobApplications = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;
  
  console.log('=== getJobApplications ===');
  console.log('id reçu:', id);
  console.log('recruiterId du token:', recruiterId);

  try {
    const [job] = await pool.query(
      'SELECT id FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );

    if (job.length === 0) {
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.applied_at, a.cover_letter, a.interview_date,
              a.recruiter_notes, a.interview_notes,
              u.id as candidate_id,
              u.email as candidate_email,
              cp.first_name,
              cp.last_name,
              cp.phone,
              cp.title,
              cp.location,
              cp.bio,
              cp.skills,
              cp.experience_years,
              cp.education,
              cp.linkedin_url,
              cp.github_url,
              cp.photo_base64,
              cv.id as cv_id,
              cv.title as cv_title
       FROM applications a
       JOIN users u ON u.id = a.candidate_id
       LEFT JOIN candidate_profiles cp ON cp.user_id = a.candidate_id
       LEFT JOIN cvs cv ON cv.id = a.cv_id
       WHERE a.job_offer_id = ?
       ORDER BY a.applied_at DESC`,
      [id]
    );
    
    console.log(`📊 Candidatures trouvées: ${rows.length}`);
    res.json({ total: rows.length, applications: rows });
  } catch (err) {
    console.error('Erreur getJobApplications:', err);
    res.status(500).json({ error: 'Erreur liste candidatures: ' + err.message });
  }
};

// PUT /applications/:id/status — Changer le statut (recruiter)
const updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;
  const { status, recruiter_notes, interview_date } = req.body;

  const validStatuses = ['sent', 'viewed', 'reviewing', 'interview', 'accepted', 'rejected'];
  if (!status || !validStatuses.includes(status))
    return res.status(400).json({ error: 'Statut invalide. Valeurs: ' + validStatuses.join(', ') });

  try {
    const [rows] = await pool.query(
      `SELECT a.id FROM applications a
       JOIN job_offers j ON j.id = a.job_offer_id
       WHERE a.id = ? AND j.recruiter_id = ?`,
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Candidature non trouvée ou accès refusé' });

    await pool.query(
      `UPDATE applications SET
        status = ?,
        recruiter_notes = COALESCE(?, recruiter_notes),
        interview_date = COALESCE(?, interview_date)
       WHERE id = ?`,
      [status, recruiter_notes || null, interview_date || null, id]
    );

    res.json({ message: 'Statut mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// PATCH /applications/:id/notes
const updateApplicationNotes = async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const recruiterId = req.user.userId;

  try {
    const [rows] = await pool.query(
      `SELECT a.id FROM applications a
       JOIN job_offers j ON a.job_offer_id = j.id
       WHERE a.id = ? AND j.recruiter_id = ?`,
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Candidature non trouvée ou accès refusé' });

    await pool.query('UPDATE applications SET recruiter_notes = ? WHERE id = ?', [notes, id]);
    res.json({ message: 'Notes mises à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

// PATCH /applications/:id/interview
const scheduleInterview = async (req, res) => {
  const { id } = req.params;
  const { interview_date, interview_notes } = req.body;
  const recruiterId = req.user.userId;

  try {
    const [rows] = await pool.query(
      `SELECT a.id FROM applications a
       JOIN job_offers j ON a.job_offer_id = j.id
       WHERE a.id = ? AND j.recruiter_id = ?`,
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Candidature non trouvée ou accès refusé' });

    await pool.query(
      `UPDATE applications 
       SET interview_date = ?, interview_notes = ?, status = 'interview' 
       WHERE id = ?`,
      [interview_date, interview_notes, id]
    );
    res.json({ message: 'Entretien planifié' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur: ' + err.message });
  }
};

// GET /applications/:id — Détail d'une candidature (recruiter)
const getApplicationDetails = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;

  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.applied_at, a.cover_letter, a.interview_date,
              a.recruiter_notes, a.interview_notes,
              u.id as candidate_id,
              u.email as candidate_email,
              cp.first_name,
              cp.last_name,
              cp.phone,
              cp.title,
              cp.location,
              cp.bio,
              cp.skills,
              cp.experience_years,
              cp.education,
              cp.birth_date,
              cp.linkedin_url,
              cp.github_url,
              cp.photo_base64,
              cv.id as cv_id,
              cv.title as cv_title,
              cv.photo_base64 as cv_photo_base64,
              cv.template_id as cv_template_id,
              cv.color_theme as cv_color_theme,
              j.title as job_title,
              j.recruiter_id
       FROM applications a
       JOIN users u ON u.id = a.candidate_id
       LEFT JOIN candidate_profiles cp ON cp.user_id = a.candidate_id
       LEFT JOIN cvs cv ON cv.id = a.cv_id
       LEFT JOIN job_offers j ON j.id = a.job_offer_id
       WHERE a.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Candidature non trouvée' });
    }
    
    const app = rows[0];
    
    if (app.recruiter_id !== recruiterId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    res.json(app);
  } catch (err) {
    console.error('Erreur getApplicationDetails:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des détails: ' + err.message });
  }
};

// ============================================================
// FONCTION 1 : Mettre à jour la lettre de motivation
// ============================================================
const updateCoverLetter = async (req, res) => {
  // Récupère l'ID de la candidature depuis l'URL
  const { id } = req.params;
  
  // Récupère l'ID du candidat connecté (via le token JWT)
  const candidateId = req.user.userId;
  
  // Récupère le contenu de la lettre envoyé par le frontend
  const { cover_letter, cover_letter_html } = req.body;

  try {
    // 1. Vérifier que la candidature appartient bien au candidat
    //    (Sécurité : un candidat ne peut modifier que ses propres candidatures)
    const [rows] = await pool.query(
      'SELECT id FROM applications WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    
    // Si la candidature n'existe pas ou n'appartient pas au candidat
    if (rows.length === 0) {
      return res.status(403).json({ 
        error: 'Candidature non trouvée ou accès refusé' 
      });
    }

    // 2. Mettre à jour la lettre de motivation
    await pool.query(
      `UPDATE applications 
       SET cover_letter = ?, 
           cover_letter_html = ?, 
           cover_letter_updated_at = NOW() 
       WHERE id = ?`,
      [cover_letter, cover_letter_html, id]
    );

    // 3. Retourner un message de succès
    res.json({ 
      message: 'Lettre de motivation mise à jour avec succès',
      updated_at: new Date()
    });
    
  } catch (err) {
    console.error('Erreur updateCoverLetter:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de la lettre de motivation' 
    });
  }
};

// ============================================================
// FONCTION 2 : Récupérer la lettre de motivation
// ============================================================
const getCoverLetter = async (req, res) => {
  // Récupère l'ID de la candidature depuis l'URL
  const { id } = req.params;
  
  // Récupère l'ID du candidat connecté
  const candidateId = req.user.userId;

  try {
    // Récupère la lettre de motivation de la candidature
    const [rows] = await pool.query(
      `SELECT cover_letter, cover_letter_html, cover_letter_updated_at 
       FROM applications 
       WHERE id = ? AND candidate_id = ?`,
      [id, candidateId]
    );
    
    // Si la candidature n'existe pas
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Candidature non trouvée' 
      });
    }

    // Retourne la lettre de motivation
    res.json(rows[0]);
    
  } catch (err) {
    console.error('Erreur getCoverLetter:', err);
    res.status(500).json({ 
      error: 'Erreur lors du chargement de la lettre de motivation' 
    });
  }
};

module.exports = {
  applyToJob, 
  getMyApplications, 
  getJobApplications,
  updateApplicationStatus, 
  updateApplicationNotes, 
  scheduleInterview, 
  getApplicationDetails,
  updateCoverLetter,   
  getCoverLetter       
};