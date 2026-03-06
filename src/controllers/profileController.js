const pool = require('../config/db');

// ─── CANDIDATE ────────────────────────────────────────────────────────────────

// GET /profile/candidate — Mon profil candidat
const getCandidateProfile = async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Profil non trouvé' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur profil: ' + err.message });
  }
};

// PUT /profile/candidate — Mettre à jour mon profil candidat
const updateCandidateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { first_name, last_name, phone, title, location, bio, photo_url } = req.body;

  try {
    await pool.query(
      `UPDATE candidate_profiles SET
        first_name = COALESCE(?, first_name),
        last_name  = COALESCE(?, last_name),
        phone      = COALESCE(?, phone),
        title      = COALESCE(?, title),
        location   = COALESCE(?, location),
        bio        = COALESCE(?, bio),
        photo_url  = COALESCE(?, photo_url)
       WHERE user_id = ?`,
      [first_name, last_name, phone, title, location, bio, photo_url, userId]
    );
    res.json({ message: 'Profil candidat mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// ─── RECRUITER ────────────────────────────────────────────────────────────────

// GET /profile/recruiter — Mon profil recruteur
const getRecruiterProfile = async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM recruiter_profiles WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Profil non trouvé' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur profil: ' + err.message });
  }
};

// PUT /profile/recruiter — Mettre à jour mon profil recruteur
const updateRecruiterProfile = async (req, res) => {
  const userId = req.user.userId;
  const { company_name, logo_url, description, website, sector } = req.body;

  try {
    await pool.query(
      `UPDATE recruiter_profiles SET
        company_name = COALESCE(?, company_name),
        logo_url     = COALESCE(?, logo_url),
        description  = COALESCE(?, description),
        website      = COALESCE(?, website),
        sector       = COALESCE(?, sector)
       WHERE user_id = ?`,
      [company_name, logo_url, description, website, sector, userId]
    );
    res.json({ message: 'Profil recruteur mis à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// GET /profile/me — Profil selon le rôle (route universelle)
const getMyProfile = async (req, res) => {
  const { userId, role } = req.user;
  try {
    if (role === 'candidate') {
      const [rows] = await pool.query(
        `SELECT u.email, u.role, u.created_at, cp.*
         FROM users u
         LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      return res.json(rows[0]);
    } else if (role === 'recruiter') {
      const [rows] = await pool.query(
        `SELECT u.email, u.role, u.created_at, rp.*
         FROM users u
         LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      return res.json(rows[0]);
    }
    res.json({ userId, role });
  } catch (err) {
    res.status(500).json({ error: 'Erreur profil: ' + err.message });
  }
};

module.exports = {
  getCandidateProfile,
  updateCandidateProfile,
  getRecruiterProfile,
  updateRecruiterProfile,
  getMyProfile
};