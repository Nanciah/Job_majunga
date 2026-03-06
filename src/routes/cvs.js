const express = require('express');
const router = express.Router();
const {
  createCV, getMyCVs, getCVById, updateCV, deleteCV, getPublicCV,
  addSection, updateSection, deleteSection
} = require('../controllers/cvController');
const auth = require('../middlewares/jwtMiddleware');

const candidateOnly = (req, res, next) => {
  if (req.user.role !== 'candidate')
    return res.status(403).json({ error: 'Accès réservé aux candidats' });
  next();
};

// CVs
router.get('/public/:token', getPublicCV);                          // Public, sans auth
router.get('/', auth, candidateOnly, getMyCVs);                     // Mes CVs
router.post('/', auth, candidateOnly, createCV);                    // Créer un CV
router.get('/:id', auth, candidateOnly, getCVById);                 // Détail CV + sections
router.put('/:id', auth, candidateOnly, updateCV);                  // Modifier CV
router.delete('/:id', auth, candidateOnly, deleteCV);               // Supprimer CV

// Sections
router.post('/:id/sections', auth, candidateOnly, addSection);                      // Ajouter section
router.put('/:id/sections/:sectionId', auth, candidateOnly, updateSection);         // Modifier section
router.delete('/:id/sections/:sectionId', auth, candidateOnly, deleteSection);      // Supprimer section

module.exports = router;