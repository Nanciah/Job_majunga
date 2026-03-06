const pool = require('../config/db');

// POST /jobs — Créer une offre (recruiter uniquement)
const createJob = async (req, res) => {
  const recruiterId = req.user.userId;
  const {
    title, description, contract_type, location,
    latitude, longitude, salary_min, salary_max,
    category, skills, expires_at
  } = req.body;

  if (!title || !description || !contract_type)
    return res.status(400).json({ error: 'title, description et contract_type sont requis' });

  try {
    const [result] = await pool.query(
      `INSERT INTO job_offers 
        (recruiter_id, title, description, contract_type, location, latitude, longitude,
         salary_min, salary_max, category, skills, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        recruiterId, title, description, contract_type, location || null,
        latitude || null, longitude || null, salary_min || null, salary_max || null,
        category || null, skills ? JSON.stringify(skills) : null, expires_at || null
      ]
    );
    res.status(201).json({ message: 'Offre créée', jobId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur création: ' + err.message });
  }
};

// GET /jobs — Lister les offres publiées avec filtres
const getJobs = async (req, res) => {
  const { title, location, contract_type, category, status } = req.query;

  let query = `SELECT id, recruiter_id, title, contract_type, location, 
                      salary_min, salary_max, category, status, created_at
               FROM job_offers WHERE 1=1`;
  const params = [];

  // Filtres optionnels
  if (title) { query += ' AND title LIKE ?'; params.push(`%${title}%`); }
  if (location) { query += ' AND location LIKE ?'; params.push(`%${location}%`); }
  if (contract_type) { query += ' AND contract_type = ?'; params.push(contract_type); }
  if (category) { query += ' AND category LIKE ?'; params.push(`%${category}%`); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  else { query += " AND status = 'published'"; } // Par défaut : publiées seulement

  query += ' ORDER BY created_at DESC';

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
    const [rows] = await pool.query('SELECT * FROM job_offers WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ error: 'Offre non trouvée' });

    // Incrémenter le compteur de vues
    await pool.query('UPDATE job_offers SET views_count = views_count + 1 WHERE id = ?', [id]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur détail: ' + err.message });
  }
};

// PUT /jobs/:id — Modifier une offre (recruiter propriétaire uniquement)
const updateJob = async (req, res) => {
  const { id } = req.params;
  const recruiterId = req.user.userId;
  const {
    title, description, contract_type, location,
    latitude, longitude, salary_min, salary_max,
    category, skills, status, expires_at
  } = req.body;

  try {
    // Vérifier que l'offre appartient bien à ce recruteur
    const [rows] = await pool.query(
      'SELECT id FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });

    await pool.query(
      `UPDATE job_offers SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        contract_type = COALESCE(?, contract_type),
        location = COALESCE(?, location),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        salary_min = COALESCE(?, salary_min),
        salary_max = COALESCE(?, salary_max),
        category = COALESCE(?, category),
        skills = COALESCE(?, skills),
        status = COALESCE(?, status),
        expires_at = COALESCE(?, expires_at)
       WHERE id = ?`,
      [
        title, description, contract_type, location,
        latitude, longitude, salary_min, salary_max,
        category, skills ? JSON.stringify(skills) : null,
        status, expires_at, id
      ]
    );
    res.json({ message: 'Offre mise à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// DELETE /jobs/:id — Supprimer une offre (recruiter propriétaire uniquement)
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

module.exports = { createJob, getJobs, getJobById, updateJob, deleteJob };