const express = require('express');
const auth = require('../middlewares/jwtMiddleware'); 
const router = express.Router();
const {
  createJob, getJobs, getJobById, updateJob,
  deleteJob, updateJobStatus, duplicateJob,
  getJobViewers, reactToJob, getJobReactions,
  addComment, getComments, deleteComment
} = require('../controllers/jobController');

// ── Auth optionnel (token pas obligatoire) ──
const authOptional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return next();
  const token = authHeader.split(' ')[1];
  try {
    const jwt = require('jsonwebtoken');
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch { }
  next();
};


// ── Recruteur seulement ──
const recruiterOnly = (req, res, next) => {
  if (req.user.role !== 'recruiter' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Accès réservé aux recruteurs' });
  next();
};

router.get('/',               authOptional, getJobs);
router.get('/:id',            authOptional, getJobById);
router.post('/',              auth, recruiterOnly, createJob);
router.put('/:id',            auth, recruiterOnly, updateJob);
router.delete('/:id',         auth, recruiterOnly, deleteJob);
router.patch('/:id/status',   auth, recruiterOnly, updateJobStatus);
router.post('/:id/duplicate', auth, recruiterOnly, duplicateJob);
router.get('/:id/viewers', auth, recruiterOnly, getJobViewers);
// Réactions
router.post('/:id/react',    auth, reactToJob);
router.get('/:id/reactions', authOptional, getJobReactions);

// Commentaires
router.post('/:id/comments', auth, addComment);
router.get('/:id/comments',  authOptional, getComments);
router.delete('/:id/comments/:commentId', auth, deleteComment);

module.exports = router;