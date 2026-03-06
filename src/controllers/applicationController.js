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

  try {
    const [job] = await pool.query(
      'SELECT id FROM job_offers WHERE id = ? AND recruiter_id = ?',
      [id, recruiterId]
    );
    if (job.length === 0)
      return res.status(403).json({ error: 'Offre non trouvée ou accès refusé' });

    const [rows] = await pool.query(
      `SELECT a.id, a.status, a.applied_at, a.cover_letter, a.interview_date,
              u.email, cp.first_name, cp.last_name
       FROM applications a
       JOIN users u ON u.id = a.candidate_id
       LEFT JOIN candidate_profiles cp ON cp.user_id = a.candidate_id
       WHERE a.job_offer_id = ?
       ORDER BY a.applied_at DESC`,
      [id]
    );
    res.json({ total: rows.length, applications: rows });
  } catch (err) {
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

module.exports = { applyToJob, getMyApplications, getJobApplications, updateApplicationStatus };