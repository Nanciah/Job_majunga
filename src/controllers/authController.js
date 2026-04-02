// src/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sendRecruiterRequestEmail } = require('../services/emailService');
const nodemailer = require('nodemailer');

// Configuration email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nanciah05@gmail.com',
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ═══════════════════════════════════════════════════════════════
// 1. INSCRIPTION
// ═══════════════════════════════════════════════════════════════
const register = async (req, res) => {
  const { email, password, role = 'candidate', company_name } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  const validRoles = ['candidate', 'recruiter'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  if (role === 'recruiter' && !company_name)
    return res.status(400).json({ error: 'Nom de l\'entreprise requis' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email déjà utilisé' });

    const hashedPass = await bcrypt.hash(password, 12);

    const status = role === 'recruiter' ? 'pending' : 'active';
    const approvalToken = role === 'recruiter' ? uuidv4() : null;

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role, status, approval_token, company_name) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPass, role, status, approvalToken, company_name || null]
    );

    const userId = result.insertId;

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action_type, description) VALUES (?, ?, ?)',
        [userId, 'register', `Nouvelle inscription : ${email} (${role})`]
      );
    } catch (e) {}

    if (role === 'candidate') {
      await pool.query('INSERT INTO candidate_profiles (user_id) VALUES (?)', [userId]);
    } else if (role === 'recruiter') {
      await pool.query(
        'INSERT INTO recruiter_profiles (user_id, company_name) VALUES (?, ?)',
        [userId, company_name]
      );

      try {
        await sendRecruiterRequestEmail({
          id: userId,
          email,
          company_name,
          approval_token: approvalToken
        });
      } catch (mailErr) {
        console.error('Erreur envoi email:', mailErr.message);
      }

      return res.status(201).json({
        message: 'Demande envoyée ! Votre compte est en attente d\'approbation par l\'administrateur.',
        status: 'pending'
      });
    }

    res.status(201).json({ message: 'Compte créé avec succès', userId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur inscription: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 2. CONNEXION
// ═══════════════════════════════════════════════════════════════
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, role, is_active, status FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Identifiants invalides' });

    const user = rows[0];

    if (!user.is_active)
      return res.status(403).json({ error: 'Compte désactivé' });

    if (user.role === 'recruiter' && user.status === 'pending')
      return res.status(403).json({ error: 'Votre compte est en attente d\'approbation par l\'administrateur.' });

    if (user.role === 'recruiter' && user.status === 'rejected')
      return res.status(403).json({ error: 'Votre demande d\'inscription a été refusée.' });

    if (!await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: 'Identifiants invalides' });

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshToken, expiresAt]
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur connexion: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 3. REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: 'refreshToken requis' });

  try {
    const [rows] = await pool.query(
      `SELECT rt.user_id, u.role FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = ? AND rt.is_revoked = 0 AND rt.expires_at > NOW()`,
      [refreshToken]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Refresh token invalide ou expiré' });

    const accessToken = jwt.sign(
      { userId: rows[0].user_id, role: rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ error: 'Erreur renouvellement: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 4. DÉCONNEXION
// ═══════════════════════════════════════════════════════════════
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: 'refreshToken requis' });

  try {
    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?',
      [refreshToken]
    );
    res.json({ message: 'Déconnecté avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur déconnexion: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 5. MOT DE PASSE OUBLIÉ - Envoyer code
// ═══════════════════════════════════════════════════════════════
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ error: 'Email requis' });

  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.json({ message: 'Si cet email existe, un code a été envoyé.' });

    // Générer code à 6 chiffres
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Sauvegarder le code
    await pool.query(
      `INSERT INTO password_resets (email, code, expires_at) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE code = ?, expires_at = ?`,
      [email, resetCode, expiresAt, resetCode, expiresAt]
    );

    // Envoyer l'email
    await transporter.sendMail({
      from: '"JobMajunga" <nanciah05@gmail.com>',
      to: email,
      subject: 'Code de réinitialisation - JobMajunga',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7C3AED; text-align: center;">JobMajunga</h2>
          <div style="background: #F3E8FF; padding: 30px; border-radius: 16px; text-align: center;">
            <h3 style="color: #1F2937;">Réinitialisation de mot de passe</h3>
            <p style="color: #6B7280;">Votre code de vérification :</p>
            <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
              <p style="font-size: 36px; font-weight: bold; color: #7C3AED; margin: 0; letter-spacing: 8px;">
                ${resetCode}
              </p>
            </div>
            <p style="color: #9CA3AF; font-size: 12px;">Ce code expire dans 15 minutes</p>
          </div>
        </div>
      `,
    });

    res.json({ message: 'Si cet email existe, un code a été envoyé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur envoi: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 6. RÉINITIALISER MOT DE PASSE
// ═══════════════════════════════════════════════════════════════
const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    const [resetRows] = await pool.query(
      'SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > NOW()',
      [email, code]
    );

    if (resetRows.length === 0) {
      return res.status(400).json({ error: 'Code invalide ou expiré' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
    await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur réinitialisation: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// 7. CHANGER MOT DE PASSE (connecté)
// ═══════════════════════════════════════════════════════════════
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  try {
    const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ message: 'Mot de passe changé avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur changement: ' + err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORT (UN SEUL !)
// ═══════════════════════════════════════════════════════════════
module.exports = { 
  register, 
  login, 
  refresh, 
  logout, 
  forgotPassword,
  resetPassword,
  changePassword
};