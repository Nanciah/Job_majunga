const express = require('express');
const router = express.Router();
const { createJob, getJobs, getJobById, updateJob, deleteJob } = require('../controllers/jobController');
const auth = require('../middlewares/jwtMiddleware');

// Middleware pour vérifier le rôle recruiter
const recruiterOnly = (req, res, next) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès réservé aux recruteurs' });
  next();
};

router.get('/', getJobs);                              // Public
router.get('/:id', getJobById);                        // Public
router.post('/', auth, recruiterOnly, createJob);      // Recruiter uniquement
router.put('/:id', auth, recruiterOnly, updateJob);    // Recruiter propriétaire
router.delete('/:id', auth, recruiterOnly, deleteJob); // Recruiter propriétaire

module.exports = router;