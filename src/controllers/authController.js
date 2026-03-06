const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Inscription
const register = async (req, res) => {
  const { email, password, role = 'candidate' } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  const validRoles = ['candidate', 'recruiter', 'admin'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Rôle invalide' });

  try {
    // Vérifie si email déjà utilisé
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ error: 'Email déjà utilisé' });

    const hashedPass = await bcrypt.hash(password, 12);
    // ✅ Colonne correcte : password_hash (pas "password")
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, hashedPass, role]
    );

    const userId = result.insertId;

    // Crée le profil associé au rôle
    if (role === 'candidate') {
      await pool.query('INSERT INTO candidate_profiles (user_id) VALUES (?)', [userId]);
    } else if (role === 'recruiter') {
      await pool.query('INSERT INTO recruiter_profiles (user_id) VALUES (?)', [userId]);
    }

    res.status(201).json({ message: 'Compte créé avec succès', userId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur inscription: ' + err.message });
  }
};

// Connexion
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    // ✅ Colonne correcte : password_hash
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, role, is_active FROM users WHERE email = ?',
      [email]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Identifiants invalides' });

    const user = rows[0];

    if (!user.is_active)
      return res.status(403).json({ error: 'Compte désactivé' });

    if (!await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: 'Identifiants invalides' });

    // ✅ userId (pas "id") pour cohérence avec jwtMiddleware
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

// Renouvellement du token
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

// Déconnexion
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: 'refreshToken requis' });

  try {
    // ✅ Révocation (is_revoked) plutôt que suppression, pour traçabilité
    await pool.query(
      'UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?',
      [refreshToken]
    );
    res.json({ message: 'Déconnecté avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur déconnexion: ' + err.message });
  }
};

// Mot de passe oublié
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ error: 'Email requis' });

  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    // Réponse identique que l'email existe ou non (sécurité anti-enumération)
    if (rows.length === 0)
      return res.json({ message: 'Si cet email existe, un lien a été envoyé.' });

    const tempToken = uuidv4();
    // TODO Sprint 5 : envoyer par email via Nodemailer
    console.log(`[forgotPassword] Token pour ${email}: ${tempToken}`);

    res.json({ message: 'Si cet email existe, un lien a été envoyé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur récupération: ' + err.message });
  }
};

module.exports = { register, login, refresh, logout, forgotPassword };