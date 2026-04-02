const pool = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

// ─── CANDIDATE ────────────────────────────────────────────────────────────────

// GET /profile/candidate — Mon profil candidat
const getCandidateProfile = async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await pool.query(
      `SELECT cp.*, u.email, u.created_at 
       FROM candidate_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.user_id = ?`,
      [userId]
    );
    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO candidate_profiles (user_id) VALUES (?)',
        [userId]
      );
      const [newRows] = await pool.query(
        `SELECT cp.*, u.email, u.created_at 
         FROM candidate_profiles cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.user_id = ?`,
        [userId]
      );
      return res.json(newRows[0]);
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur profil: ' + err.message });
  }
};

// PUT /profile/candidate — Mettre à jour mon profil candidat
const updateCandidateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { 
    first_name, last_name, phone, title, location, bio, photo_url,
    skills, experience_years, education, birth_date,
    linkedin_url, github_url
  } = req.body;

  try {
    const [existing] = await pool.query(
      'SELECT user_id FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );
    
    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO candidate_profiles 
         (user_id, first_name, last_name, phone, title, location, bio, photo_url,
          skills, experience_years, education, birth_date, linkedin_url, github_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [userId, first_name, last_name, phone, title, location, bio, photo_url,
         skills, experience_years, education, birth_date, linkedin_url, github_url]
      );
    } else {
      await pool.query(
        `UPDATE candidate_profiles SET
          first_name = COALESCE(?, first_name),
          last_name  = COALESCE(?, last_name),
          phone      = COALESCE(?, phone),
          title      = COALESCE(?, title),
          location   = COALESCE(?, location),
          bio        = COALESCE(?, bio),
          photo_url  = COALESCE(?, photo_url),
          skills     = COALESCE(?, skills),
          experience_years = COALESCE(?, experience_years),
          education  = COALESCE(?, education),
          birth_date = COALESCE(?, birth_date),
          linkedin_url = COALESCE(?, linkedin_url),
          github_url = COALESCE(?, github_url),
          updated_at = NOW()
         WHERE user_id = ?`,
        [first_name, last_name, phone, title, location, bio, photo_url,
         skills, experience_years, education, birth_date, 
         linkedin_url, github_url, userId]
      );
    }
    res.json({ message: 'Profil candidat mis à jour avec succès' });
  } catch (err) {
    console.error('Erreur updateCandidateProfile:', err);
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// Upload de photo de profil
const uploadAvatar = async (req, res) => {
  const userId = req.user.userId;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Aucune image fournie' });
  }
  
  try {
    const photoUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Récupérer l'ancienne photo
    const [old] = await pool.query(
      'SELECT photo_url FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );
    
    if (old[0]?.photo_url) {
      const oldPath = path.join(__dirname, '../../uploads/avatars', path.basename(old[0].photo_url));
      try { await fs.unlink(oldPath); } catch (e) {}
    }
    
    await pool.query(
      'UPDATE candidate_profiles SET photo_url = ?, updated_at = NOW() WHERE user_id = ?',
      [photoUrl, userId]
    );
    
    res.json({
      message: 'Photo mise à jour avec succès',
      photoUrl: photoUrl
    });
  } catch (err) {
    console.error('Erreur uploadAvatar:', err);
    res.status(500).json({ error: 'Erreur lors de l\'upload: ' + err.message });
  }
};

// Supprimer la photo de profil
const deleteAvatar = async (req, res) => {
  const userId = req.user.userId;
  
  try {
    const [rows] = await pool.query(
      'SELECT photo_url FROM candidate_profiles WHERE user_id = ?',
      [userId]
    );
    
    const oldPhotoUrl = rows[0]?.photo_url;
    
    if (oldPhotoUrl) {
      const filePath = path.join(__dirname, '../../uploads/avatars', path.basename(oldPhotoUrl));
      try { await fs.unlink(filePath); } catch (e) {}
    }
    
    await pool.query(
      'UPDATE candidate_profiles SET photo_url = NULL WHERE user_id = ?',
      [userId]
    );
    
    res.json({ message: 'Photo supprimée avec succès' });
  } catch (err) {
    console.error('Erreur deleteAvatar:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression: ' + err.message });
  }
};

// GET /profile/me — Profil selon le rôle
const getMyProfile = async (req, res) => {
  const { userId, role } = req.user;
  try {
    if (role === 'candidate') {
      const [rows] = await pool.query(
        `SELECT u.id, u.email, u.role, u.created_at,
                cp.first_name, cp.last_name, cp.phone, cp.title, cp.location, cp.bio,
                cp.photo_base64, cp.photo_mime_type, 
                cp.skills, cp.experience_years, cp.education, cp.birth_date,
                cp.linkedin_url, cp.github_url
         FROM users u
         LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      const data = rows[0];
      res.json({
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
          createdAt: data.created_at
        },
        profile: {
          firstName: data.first_name || '',
          lastName: data.last_name || '',
          phone: data.phone || '',
          title: data.title || '',
          location: data.location || '',
          bio: data.bio || '',
          photoBase64: data.photo_base64,        
          photoMimeType: data.photo_mime_type,    
          skills: data.skills || '',
          experienceYears: data.experience_years || 0,
          education: data.education || '',
          birthDate: data.birth_date,
          linkedinUrl: data.linkedin_url || '',
          githubUrl: data.github_url || ''
        }
      });
    } else if (role === 'recruiter') {
      const [rows] = await pool.query(
        `SELECT u.id, u.email, u.role, u.created_at,
                rp.company_name, rp.logo_url, rp.description, rp.website, rp.sector
         FROM users u
         LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      const data = rows[0];
      res.json({
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
          createdAt: data.created_at
        },
        profile: {
          companyName: data.company_name || '',
          logoUrl: data.logo_url || '',
          description: data.description || '',
          website: data.website || '',
          sector: data.sector || ''
        }
      });
    } else {
      res.json({ userId, role });
    }
  } catch (err) {
    console.error('Erreur getMyProfile:', err);
    res.status(500).json({ error: 'Erreur profil: ' + err.message });
  }
};

const deleteAvatarBase64 = async (req, res) => {
  const userId = req.user.userId;
  
  try {
    await pool.query(
      `UPDATE candidate_profiles SET 
        photo_base64 = NULL,
        photo_mime_type = NULL,
        updated_at = NOW() 
       WHERE user_id = ?`,
      [userId]
    );
    
    res.json({ message: 'Photo supprimée avec succès' });
  } catch (err) {
    console.error('Erreur deleteAvatarBase64:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression: ' + err.message });
  }
};

// ─── RECRUITER ────────────────────────────────────────────────────────────────

const getRecruiterProfile = async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM recruiter_profiles WHERE user_id = ?',
      [userId]
    );
    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO recruiter_profiles (user_id) VALUES (?)',
        [userId]
      );
      const [newRows] = await pool.query(
        'SELECT * FROM recruiter_profiles WHERE user_id = ?',
        [userId]
      );
      return res.json(newRows[0]);
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur profil: ' + err.message });
  }
};

const updateRecruiterProfile = async (req, res) => {
  const userId = req.user.userId;
  const { company_name, logo_url, description, website, sector } = req.body;

  try {
    const [existing] = await pool.query(
      'SELECT user_id FROM recruiter_profiles WHERE user_id = ?',
      [userId]
    );
    
    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO recruiter_profiles 
         (user_id, company_name, logo_url, description, website, sector)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, company_name, logo_url, description, website, sector]
      );
    } else {
      await pool.query(
        `UPDATE recruiter_profiles SET
          company_name = COALESCE(?, company_name),
          logo_url     = COALESCE(?, logo_url),
          description  = COALESCE(?, description),
          website      = COALESCE(?, website),
          sector       = COALESCE(?, sector)
         WHERE user_id = ?`,
        [company_name, logo_url, description, website, sector, userId]
      );
    }
    res.json({ message: 'Profil recruteur mis à jour avec succès' });
  } catch (err) {
    console.error('Erreur updateRecruiterProfile:', err);
    res.status(500).json({ error: 'Erreur mise à jour: ' + err.message });
  }
};

// Upload photo en base64 (pour web)
const uploadAvatarBase64 = async (req, res) => {
  const userId = req.user.userId;
  const { photo, mimeType } = req.body;
  
  if (!photo) {
    return res.status(400).json({ error: 'Aucune photo fournie' });
  }
  
  try {
    // Stocker directement en base64 dans la table candidate_profiles
    await pool.query(
      `UPDATE candidate_profiles SET 
        photo_base64 = ?,
        photo_mime_type = ?,
        updated_at = NOW() 
       WHERE user_id = ?`,
      [photo, mimeType, userId]
    );
    
    res.json({
      message: 'Photo mise à jour avec succès',
      photoBase64: photo,
      photoMimeType: mimeType
    });
  } catch (err) {
    console.error('Erreur uploadAvatarBase64:', err);
    res.status(500).json({ error: 'Erreur lors de l\'upload: ' + err.message });
  }
};

module.exports = {
   getCandidateProfile,
  updateCandidateProfile,
  getRecruiterProfile,
  updateRecruiterProfile,
  getMyProfile,
  uploadAvatar,
  deleteAvatar,
  uploadAvatarBase64,      
  deleteAvatarBase64  
};