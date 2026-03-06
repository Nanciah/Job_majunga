const express = require('express');
const router = express.Router();
const {
  getCandidateProfile,
  updateCandidateProfile,
  getRecruiterProfile,
  updateRecruiterProfile,
  getMyProfile
} = require('../controllers/profileController');
const auth = require('../middlewares/jwtMiddleware');

const candidateOnly = (req, res, next) => {
  if (req.user.role !== 'candidate')
    return res.status(403).json({ error: 'Accès réservé aux candidats' });
  next();
};

const recruiterOnly = (req, res, next) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès réservé aux recruteurs' });
  next();
};

router.get('/me', auth, getMyProfile);                                      // Profil universel
router.get('/candidate', auth, candidateOnly, getCandidateProfile);         // Profil candidat
router.put('/candidate', auth, candidateOnly, updateCandidateProfile);      // Modifier profil candidat
router.get('/recruiter', auth, recruiterOnly, getRecruiterProfile);         // Profil recruteur
router.put('/recruiter', auth, recruiterOnly, updateRecruiterProfile);      // Modifier profil recruteur

module.exports = router;