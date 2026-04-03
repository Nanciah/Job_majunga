require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
// TEST SIMPLE - SANS BASE DE DONNEES
app.get('/test-simple', (req, res) => {
    res.json({ message: 'Le serveur fonctionne parfaitement !' });
});

// TEST DE CONNEXION A LA BASE
app.get('/test-db-simple', async (req, res) => {
    try {
        const pool = require('./config/db');
        const [rows] = await pool.query('SELECT 1+1 AS result');
        res.json({ success: true, result: rows[0].result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
const authRouter         = require('./routes/auth');
const jobsRouter         = require('./routes/jobs');
const applicationsRouter = require('./routes/applications');
const profileRouter      = require('./routes/profile');
const cvsRouter          = require('./routes/cvs');
const adminRouter        = require('./routes/admin');

app.use('/auth',         authRouter);
app.use('/jobs',         jobsRouter);
app.use('/applications', applicationsRouter);
app.use('/profile',      profileRouter);
app.use('/cvs',          cvsRouter);
app.use('/admin',        adminRouter);

// Candidatures d'une offre spécifique (recruiter)
const { getJobApplications } = require('./controllers/applicationController');
const auth = require('./middlewares/jwtMiddleware');
app.get('/jobs/:id/applications', auth, getJobApplications);

// Test DB
const pool = require('./config/db');
app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, role FROM users');
    res.json(rows);
  } catch (err) {
    res.status(500).send('Erreur DB: ' + err.message);
  }
});

// Routes de base
app.get('/', (req, res) => res.send('JobMajunga Backend OK'));

// ➕ Health check pour Railway (optionnel mais recommandé)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'jobmajunga-api'
    });
});

// Configuration du serveur pour Railway
const port = process.env.PORT || 3000;
const host = '0.0.0.0';  // ⬅️ Nécessaire pour Railway

app.listen(port, host, () => {  // ⬅️ host ajouté ici
    console.log(`🚀 Serveur JobMajunga lancé sur http://${host}:${port}`);
    console.log(`📅 Environnement: ${process.env.NODE_ENV || 'development'}`);
});