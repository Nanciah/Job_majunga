const express = require('express');
const router = express.Router();
const {
  applyToJob, getMyApplications, getJobApplications,
  updateApplicationStatus, updateApplicationNotes, scheduleInterview,
  getApplicationDetails,
  updateCoverLetter,   
  getCoverLetter       
} = require('../controllers/applicationController');
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

router.post('/', auth, candidateOnly, applyToJob);
router.get('/me', auth, candidateOnly, getMyApplications);
router.get('/job/:jobId', auth, recruiterOnly, getJobApplications);
router.get('/:id', auth, recruiterOnly, getApplicationDetails); 
router.put('/:id/status', auth, recruiterOnly, updateApplicationStatus);
router.patch('/:id/notes', auth, recruiterOnly, updateApplicationNotes);
router.patch('/:id/interview', auth, recruiterOnly, scheduleInterview);

// ============================================================
// ROUTES POUR LA LETTRE DE MOTIVATION
// ============================================================
router.put('/:id/cover-letter', auth, candidateOnly, updateCoverLetter);
router.get('/:id/cover-letter', auth, candidateOnly, getCoverLetter);

module.exports = router;