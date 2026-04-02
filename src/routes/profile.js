const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getCandidateProfile,
  updateCandidateProfile,
  getRecruiterProfile,
  updateRecruiterProfile,
  getMyProfile,
  uploadAvatar,      // ← Existe
  deleteAvatar,
  uploadAvatarBase64,
  deleteAvatarBase64        // ← Existe
  // uploadCompanyLogo supprimé car n'existe pas
} = require('../controllers/profileController');
const auth = require('../middlewares/jwtMiddleware');

// Configuration multer pour les avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images sont autorisées'));
  }
};

const uploadAvatarMiddleware = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// Middleware de vérification des rôles
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

// ─── Routes universelles ──────────────────────────────────────────────────────
router.get('/me', auth, getMyProfile);                                      // Profil universel

// ─── Routes candidat ─────────────────────────────────────────────────────────
router.get('/candidate', auth, candidateOnly, getCandidateProfile);         // Profil candidat
router.put('/candidate', auth, candidateOnly, updateCandidateProfile);      // Modifier profil candidat

// ─── Routes recruteur ───────────────────────────────────────────────────────
router.get('/recruiter', auth, recruiterOnly, getRecruiterProfile);         // Profil recruteur
router.put('/recruiter', auth, recruiterOnly, updateRecruiterProfile);      // Modifier profil recruteur

// ─── Routes pour les photos ─────────────────────────────────────────────────
router.post('/avatar', auth, uploadAvatarMiddleware.single('avatar'), uploadAvatar);      // Upload photo
router.post('/avatar-base64', auth, uploadAvatarBase64);                                // Upload photo en base64
router.delete('/avatar', auth, deleteAvatarBase64);  // ← Nouvelle version (base64)                                            // Supprimer photo

module.exports = router;