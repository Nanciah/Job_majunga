const express = require('express');
const router = express.Router();
const {
  applyToJob,
  getMyApplications,
  updateApplicationStatus
} = require('../controllers/applicationController');
const auth = require('../middlewares/jwtMiddleware');

// Middleware candidat uniquement
const candidateOnly = (req, res, next) => {
  if (req.user.role !== 'candidate')
    return res.status(403).json({ error: 'Accès réservé aux candidats' });
  next();
};

// Middleware recruteur uniquement
const recruiterOnly = (req, res, next) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès réservé aux recruteurs' });
  next();
};

router.post('/', auth, candidateOnly, applyToJob);                         // Postuler
router.get('/me', auth, candidateOnly, getMyApplications);                 // Mes candidatures
router.put('/:id/status', auth, recruiterOnly, updateApplicationStatus);   // Changer statut

module.exports = router;