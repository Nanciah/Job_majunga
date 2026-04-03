// require('dotenv').config();  // ← COMMENTÉ pour Railway
const express = require('express');
const cors = require('cors');
const app = express();

app.set('trust proxy', 1);  // ← SOLUTION

// TEST DE CONNEXION A LA BASE (avec détails)
app.get('/test-db-simple', async (req, res) => {
    try {
        const envCheck = {
            DB_HOST: process.env.DB_HOST ? '✅ défini' : '❌ manquant',
            DB_USER: process.env.DB_USER ? '✅ défini' : '❌ manquant',
            DB_PASSWORD: process.env.DB_PASSWORD ? '✅ défini' : '❌ manquant',
            DB_NAME: process.env.DB_NAME ? '✅ défini' : '❌ manquant',
            DB_PORT: process.env.DB_PORT ? '✅ défini' : '❌ manquant',
        };
        
        const pool = require('./config/db');
        const [rows] = await pool.query('SELECT 1+1 AS result');
        
        res.json({ 
            success: true, 
            result: rows[0].result,
            env: envCheck
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message,
            code: error.code,
            env: {
                DB_HOST: process.env.DB_HOST ? '✅ défini' : '❌ manquant',
                DB_USER: process.env.DB_USER ? '✅ défini' : '❌ manquant',
                DB_PASSWORD: process.env.DB_PASSWORD ? '✅ défini' : '❌ manquant',
                DB_NAME: process.env.DB_NAME ? '✅ défini' : '❌ manquant',
                DB_PORT: process.env.DB_PORT ? '✅ défini' : '❌ manquant',
            }
        });
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// TEST SIMPLE - sans base de données
app.get('/test-simple', (req, res) => {
    res.json({ message: 'Le serveur fonctionne parfaitement !' });
});

// Routes
const authRouter         = require('./routes/auth');
const jobsRouter         = require('./routes/jobs');
const applicationsRouter = require('./routes/applications');
const profileRouter      = require('./routes/profile');
const cvsRouter          = require('./routes/cvs');
const adminRouter        = require('./routes/admin');

console.log('✅ Routes chargées avec succès');
console.log('Auth router:', authRouter ? 'chargé' : 'non chargé');

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

// Health check pour Railway
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'jobmajunga-api'
    });
});

// Configuration du serveur pour Railway
const port = process.env.PORT || 3000;
const host = '0.0.0.0';

app.listen(port, host, () => {
    console.log(`🚀 Serveur JobMajunga lancé sur http://${host}:${port}`);
    console.log(`📅 Environnement: ${process.env.NODE_ENV || 'development'}`);
});