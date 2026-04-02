// src/routes/admin.js
const express = require('express');
const router = express.Router();
const {
  getAllUsers, getPendingRecruiters,
  approveUserByToken, rejectUserByToken,
  approveUser, rejectUser,
  getStats, getAllJobs, getPendingJobs,
  approveJobByEmail, rejectJobByEmail,
  approveJob, rejectJob,
  getLogs
} = require('../controllers/adminController');
const auth = require('../middlewares/jwtMiddleware');

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  next();
};

// ── Routes publiques (via email) ──────────────────────────
router.get('/users/:id/approve', approveUserByToken);
router.get('/users/:id/reject',  rejectUserByToken);
router.get('/jobs/:id/approve',  approveJobByEmail);
router.get('/jobs/:id/reject',   rejectJobByEmail);

// ── Routes protégées ──────────────────────────────────────
router.get('/stats',               auth, adminOnly, getStats);

// Utilisateurs
router.get('/users',               auth, adminOnly, getAllUsers);
router.get('/users/pending',       auth, adminOnly, getPendingRecruiters);
router.patch('/users/:id/approve', auth, adminOnly, approveUser);
router.patch('/users/:id/reject',  auth, adminOnly, rejectUser);

// Offres
router.get('/jobs',                auth, adminOnly, getAllJobs);
router.get('/jobs/pending',        auth, adminOnly, getPendingJobs);
router.patch('/jobs/:id/approve',  auth, adminOnly, approveJob);
router.patch('/jobs/:id/reject',   auth, adminOnly, rejectJob);

// Logs
router.get('/logs',                auth, adminOnly, getLogs);

module.exports = router;