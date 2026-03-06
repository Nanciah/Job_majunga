const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// ─── CVS ──────────────────────────────────────────────────────────────────────

// POST /cvs — Créer un CV
const createCV = async (req, res) => {
  const candidateId = req.user.userId;
  const { title, template_id, color_theme } = req.body;

  if (!title)
    return res.status(400).json({ error: 'title est requis' });

  try {
    const [result] = await pool.query(
      `INSERT INTO cvs (candidate_id, title, template_id, color_theme, is_public)
       VALUES (?, ?, ?, ?, 0)`,
      [candidateId, title, template_id || 'classic', color_theme || '#2563EB']
    );
    res.status(201).json({ message: 'CV créé', cvId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur création CV: ' + err.message });
  }
};

// GET /cvs — Mes CVs
const getMyCVs = async (req, res) => {
  const candidateId = req.user.userId;
  try {
    const [rows] = await pool.query(
      'SELECT id, title, template_id, color_theme, is_public, created_at FROM cvs WHERE candidate_id = ? ORDER BY created_at DESC',
      [candidateId]
    );
    res.json({ total: rows.length, cvs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur liste CVs: ' + err.message });
  }
};

// GET /cvs/:id — Détail d'un CV avec ses sections
const getCVById = async (req, res) => {
  const { id } = req.params;
  const candidateId = req.user.userId;

  try {
    const [cvRows] = await pool.query(
      'SELECT * FROM cvs WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    if (cvRows.length === 0)
      return res.status(404).json({ error: 'CV non trouvé' });

    const [sections] = await pool.query(
      'SELECT * FROM cv_sections WHERE cv_id = ? ORDER BY display_order ASC',
      [id]
    );

    res.json({ ...cvRows[0], sections });
  } catch (err) {
    res.status(500).json({ error: 'Erreur détail CV: ' + err.message });
  }
};

// PUT /cvs/:id — Modifier un CV
const updateCV = async (req, res) => {
  const { id } = req.params;
  const candidateId = req.user.userId;
  const { title, template_id, color_theme, is_public } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT id, is_public, public_token FROM cvs WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'CV non trouvé' });

    // Générer un token public si on rend le CV public
    let public_token = rows[0].public_token;
    if (is_public && !public_token) {
      public_token = uuidv4();
    }

    await pool.query(
      `UPDATE cvs SET
        title        = COALESCE(?, title),
        template_id  = COALESCE(?, template_id),
        color_theme  = COALESCE(?, color_theme),
        is_public    = COALESCE(?, is_public),
        public_token = ?
       WHERE id = ?`,
      [title, template_id, color_theme, is_public !== undefined ? is_public : null, public_token, id]
    );

    res.json({ message: 'CV mis à jour', public_token: is_public ? public_token : null });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour CV: ' + err.message });
  }
};

// DELETE /cvs/:id — Supprimer un CV
const deleteCV = async (req, res) => {
  const { id } = req.params;
  const candidateId = req.user.userId;

  try {
    const [rows] = await pool.query(
      'SELECT id FROM cvs WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'CV non trouvé' });

    await pool.query('DELETE FROM cvs WHERE id = ?', [id]);
    res.json({ message: 'CV supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression CV: ' + err.message });
  }
};

// GET /cvs/public/:token — Voir un CV public (sans auth)
const getPublicCV = async (req, res) => {
  const { token } = req.params;
  try {
    const [cvRows] = await pool.query(
      'SELECT * FROM cvs WHERE public_token = ? AND is_public = 1',
      [token]
    );
    if (cvRows.length === 0)
      return res.status(404).json({ error: 'CV non trouvé ou non public' });

    const [sections] = await pool.query(
      'SELECT * FROM cv_sections WHERE cv_id = ? AND is_visible = 1 ORDER BY display_order ASC',
      [cvRows[0].id]
    );

    res.json({ ...cvRows[0], sections });
  } catch (err) {
    res.status(500).json({ error: 'Erreur CV public: ' + err.message });
  }
};

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

// POST /cvs/:id/sections — Ajouter une section
const addSection = async (req, res) => {
  const { id } = req.params;
  const candidateId = req.user.userId;
  const { section_type, content, display_order } = req.body;

  const validTypes = ['summary', 'experience', 'education', 'skills', 'languages', 'certifications', 'projects', 'interests'];
  if (!section_type || !validTypes.includes(section_type))
    return res.status(400).json({ error: 'section_type invalide. Valeurs: ' + validTypes.join(', ') });

  if (!content)
    return res.status(400).json({ error: 'content est requis' });

  try {
    const [cv] = await pool.query(
      'SELECT id FROM cvs WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    if (cv.length === 0)
      return res.status(404).json({ error: 'CV non trouvé' });

    const [result] = await pool.query(
      'INSERT INTO cv_sections (cv_id, section_type, content, display_order) VALUES (?, ?, ?, ?)',
      [id, section_type, JSON.stringify(content), display_order || 0]
    );
    res.status(201).json({ message: 'Section ajoutée', sectionId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur ajout section: ' + err.message });
  }
};

// PUT /cvs/:id/sections/:sectionId — Modifier une section
const updateSection = async (req, res) => {
  const { id, sectionId } = req.params;
  const candidateId = req.user.userId;
  const { content, display_order, is_visible } = req.body;

  try {
    const [cv] = await pool.query(
      'SELECT id FROM cvs WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    if (cv.length === 0)
      return res.status(404).json({ error: 'CV non trouvé' });

    await pool.query(
      `UPDATE cv_sections SET
        content       = COALESCE(?, content),
        display_order = COALESCE(?, display_order),
        is_visible    = COALESCE(?, is_visible)
       WHERE id = ? AND cv_id = ?`,
      [content ? JSON.stringify(content) : null, display_order, is_visible !== undefined ? is_visible : null, sectionId, id]
    );
    res.json({ message: 'Section mise à jour' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour section: ' + err.message });
  }
};

// DELETE /cvs/:id/sections/:sectionId — Supprimer une section
const deleteSection = async (req, res) => {
  const { id, sectionId } = req.params;
  const candidateId = req.user.userId;

  try {
    const [cv] = await pool.query(
      'SELECT id FROM cvs WHERE id = ? AND candidate_id = ?',
      [id, candidateId]
    );
    if (cv.length === 0)
      return res.status(404).json({ error: 'CV non trouvé' });

    await pool.query('DELETE FROM cv_sections WHERE id = ? AND cv_id = ?', [sectionId, id]);
    res.json({ message: 'Section supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression section: ' + err.message });
  }
};

module.exports = {
  createCV, getMyCVs, getCVById, updateCV, deleteCV, getPublicCV,
  addSection, updateSection, deleteSection
};