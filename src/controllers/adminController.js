// src/controllers/adminController.js
const pool = require('../config/db');
const { sendApprovalEmail, sendRejectionEmail, sendEmail } = require('../services/emailService');

// GET /admin/users
const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, role, status, company_name, created_at 
       FROM users ORDER BY created_at DESC`
    );
    res.json({ total: rows.length, users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/users/pending
const getPendingRecruiters = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, role, status, company_name, created_at 
       FROM users WHERE status = 'pending' AND role = 'recruiter'
       ORDER BY created_at DESC`
    );
    res.json({ total: rows.length, users: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/users/:id/approve — via email
const approveUserByToken = async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND approval_token = ?',
      [id, token]
    );
    if (rows.length === 0)
      return res.status(400).send('<h2>❌ Lien invalide ou expiré</h2>');

    const user = rows[0];
    await pool.query(
      'UPDATE users SET status = ?, approval_token = NULL WHERE id = ?',
      ['active', id]
    );
    await pool.query(
      'UPDATE recruiter_profiles SET company_name = ? WHERE user_id = ?',
      [user.company_name, id]
    );
    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [id, 'approved', `Compte approuvé via email : ${user.email} (${user.company_name})`]
      );
    } catch (e) {}

    await sendApprovalEmail(user.email, user.company_name || 'Votre entreprise');
    res.send(`
      <div style="font-family:Arial;max-width:500px;margin:50px auto;text-align:center;">
        <h1 style="color:#16A34A;">✅ Compte approuvé !</h1>
        <p>Le compte <strong>${user.email}</strong> a été activé avec succès.</p>
        <p>Un email de confirmation a été envoyé au recruteur.</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('<h2>Erreur serveur</h2>');
  }
};

// GET /admin/users/:id/reject — via email
const rejectUserByToken = async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND approval_token = ?',
      [id, token]
    );
    if (rows.length === 0)
      return res.status(400).send('<h2>❌ Lien invalide ou expiré</h2>');

    const user = rows[0];
    await pool.query(
      'UPDATE users SET status = ?, approval_token = NULL WHERE id = ?',
      ['rejected', id]
    );
    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [id, 'rejected', `Compte refusé via email : ${user.email} (${user.company_name})`]
      );
    } catch (e) {}

    await sendRejectionEmail(user.email, user.company_name || 'Votre entreprise');
    res.send(`
      <div style="font-family:Arial;max-width:500px;margin:50px auto;text-align:center;">
        <h1 style="color:#DC2626;">❌ Compte refusé</h1>
        <p>Le compte <strong>${user.email}</strong> a été refusé.</p>
        <p>Un email de notification a été envoyé au recruteur.</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('<h2>Erreur serveur</h2>');
  }
};

// PATCH /admin/users/:id/approve — depuis l'app
const approveUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const user = rows[0];
    await pool.query(
      'UPDATE users SET status = ?, approval_token = NULL WHERE id = ?',
      ['active', id]
    );
    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [id, 'approved', `Compte approuvé : ${user.email} (${user.company_name})`]
      );
    } catch (e) {}

    await sendApprovalEmail(user.email, user.company_name || 'Votre entreprise');
    res.json({ message: 'Compte approuvé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /admin/users/:id/reject — depuis l'app
const rejectUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const user = rows[0];
    await pool.query(
      'UPDATE users SET status = ?, approval_token = NULL WHERE id = ?',
      ['rejected', id]
    );
    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [id, 'rejected', `Compte refusé : ${user.email} (${user.company_name})`]
      );
    } catch (e) {}

    await sendRejectionEmail(user.email, user.company_name || 'Votre entreprise');
    res.json({ message: 'Compte refusé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/stats
const getStats = async (req, res) => {
  try {
    const [[users]]        = await pool.query('SELECT COUNT(*) as total FROM users WHERE status = "active"');
    const [[recruiters]]   = await pool.query('SELECT COUNT(*) as total FROM users WHERE role = "recruiter" AND status = "active"');
    const [[candidates]]   = await pool.query('SELECT COUNT(*) as total FROM users WHERE role = "candidate"');
    const [[jobs]]         = await pool.query('SELECT COUNT(*) as total FROM job_offers WHERE status = "published"');
    const [[applications]] = await pool.query('SELECT COUNT(*) as total FROM applications');
    const [[pending]]      = await pool.query('SELECT COUNT(*) as total FROM users WHERE status = "pending"');
    const [[pendingJobs]]  = await pool.query('SELECT COUNT(*) as total FROM job_offers WHERE status = "pending_approval"');
    const [[interviews]]   = await pool.query('SELECT COUNT(*) as total FROM applications WHERE status = "interview"');
    const [[accepted]]     = await pool.query('SELECT COUNT(*) as total FROM applications WHERE status = "accepted"');

    res.json({
      activeUsers:       users.total,
      recruiters:        recruiters.total,
      candidates:        candidates.total,
      publishedJobs:     jobs.total,
      totalApplications: applications.total,
      pendingRecruiters: pending.total,
      pendingJobs:       pendingJobs.total,
      interviews:        interviews.total,
      accepted:          accepted.total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/jobs
const getAllJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.id, j.title, j.status, j.location, j.created_at,
              u.email as recruiter_email, u.company_name
       FROM job_offers j
       JOIN users u ON u.id = j.recruiter_id
       ORDER BY j.created_at DESC`
    );
    res.json({ total: rows.length, jobs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/jobs/pending — offres en attente d'approbation
const getPendingJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.id, j.title, j.description, j.contract_type,
              j.location, j.salary_min, j.salary_max, j.created_at,
              u.email as recruiter_email, u.company_name
       FROM job_offers j
       JOIN users u ON u.id = j.recruiter_id
       WHERE j.status = 'pending_approval'
       ORDER BY j.created_at DESC`
    );
    res.json({ total: rows.length, jobs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/jobs/:id/approve — via email
const approveJobByEmail = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT j.*, u.email as recruiter_email, u.company_name
       FROM job_offers j JOIN users u ON j.recruiter_id = u.id
       WHERE j.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).send('<h2>❌ Offre non trouvée</h2>');

    const job = rows[0];
    await pool.query(
      'UPDATE job_offers SET status = ? WHERE id = ?',
      ['published', id]
    );

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [job.recruiter_id, 'job_approved', `Offre approuvée via email : ${job.title}`]
      );
    } catch (e) {}

    // Notifier le recruteur
    await sendEmail({
      to: job.recruiter_email,
      subject: `✅ Votre offre "${job.title}" a été approuvée`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">✅ Offre approuvée !</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Bonjour <strong>${job.company_name}</strong>,</p>
            <p>Votre offre <strong>"${job.title}"</strong> a été approuvée et est maintenant visible par les candidats.</p>
            <p style="color: #64748b;">Connectez-vous à votre espace recruteur pour gérer les candidatures.</p>
          </div>
        </div>
      `
    });

    res.send(`
      <div style="font-family:Arial;max-width:500px;margin:50px auto;text-align:center;">
        <h1 style="color:#16A34A;">✅ Offre approuvée !</h1>
        <p>L'offre <strong>"${job.title}"</strong> de ${job.company_name} est maintenant publiée.</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('<h2>Erreur serveur</h2>');
  }
};

// GET /admin/jobs/:id/reject — via email
const rejectJobByEmail = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT j.*, u.email as recruiter_email, u.company_name
       FROM job_offers j JOIN users u ON j.recruiter_id = u.id
       WHERE j.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).send('<h2>❌ Offre non trouvée</h2>');

    const job = rows[0];
    await pool.query(
      'UPDATE job_offers SET status = ? WHERE id = ?',
      ['rejected', id]
    );

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [job.recruiter_id, 'job_rejected', `Offre refusée via email : ${job.title}`]
      );
    } catch (e) {}

    // Notifier le recruteur
    await sendEmail({
      to: job.recruiter_email,
      subject: `❌ Votre offre "${job.title}" a été refusée`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">❌ Offre refusée</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Bonjour <strong>${job.company_name}</strong>,</p>
            <p>Votre offre <strong>"${job.title}"</strong> n'a pas été approuvée.</p>
            <p>Veuillez modifier votre offre et la soumettre à nouveau.</p>
          </div>
        </div>
      `
    });

    res.send(`
      <div style="font-family:Arial;max-width:500px;margin:50px auto;text-align:center;">
        <h1 style="color:#DC2626;">❌ Offre refusée</h1>
        <p>L'offre <strong>"${job.title}"</strong> de ${job.company_name} a été refusée.</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('<h2>Erreur serveur</h2>');
  }
};

// PATCH /admin/jobs/:id/approve — depuis l'app
const approveJob = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT j.*, u.email as recruiter_email, u.company_name
       FROM job_offers j JOIN users u ON j.recruiter_id = u.id
       WHERE j.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Offre non trouvée' });

    const job = rows[0];
    await pool.query('UPDATE job_offers SET status = ? WHERE id = ?', ['published', id]);

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [job.recruiter_id, 'job_approved', `Offre approuvée : ${job.title}`]
      );
    } catch (e) {}

    await sendEmail({
      to: job.recruiter_email,
      subject: `✅ Votre offre "${job.title}" a été approuvée`,
      html: `<p>Bonjour ${job.company_name}, votre offre <strong>${job.title}</strong> est maintenant publiée !</p>`
    });

    res.json({ message: 'Offre approuvée et publiée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /admin/jobs/:id/reject — depuis l'app
const rejectJob = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT j.*, u.email as recruiter_email, u.company_name
       FROM job_offers j JOIN users u ON j.recruiter_id = u.id
       WHERE j.id = ?`,
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Offre non trouvée' });

    const job = rows[0];
    await pool.query('UPDATE job_offers SET status = ? WHERE id = ?', ['rejected', id]);

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [job.recruiter_id, 'job_rejected', `Offre refusée : ${job.title}`]
      );
    } catch (e) {}

    await sendEmail({
      to: job.recruiter_email,
      subject: `❌ Votre offre "${job.title}" a été refusée`,
      html: `<p>Bonjour ${job.company_name}, votre offre <strong>${job.title}</strong> n'a pas été approuvée. Veuillez la modifier et la soumettre à nouveau.</p>`
    });

    res.json({ message: 'Offre refusée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /admin/logs
const getLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT al.id, al.action_type, al.description,
              u.email as user_email, al.created_at
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 200`
    );
    res.json({ total: rows.length, logs: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllUsers, getPendingRecruiters,
  approveUserByToken, rejectUserByToken,
  approveUser, rejectUser,
  getStats, getAllJobs, getPendingJobs,
  approveJobByEmail, rejectJobByEmail,
  approveJob, rejectJob,
  getLogs
};