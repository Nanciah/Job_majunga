require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRouter        = require('./routes/auth');
const jobsRouter        = require('./routes/jobs');
const applicationsRouter = require('./routes/applications');
const profileRouter     = require('./routes/profile');

app.use('/auth',         authRouter);
app.use('/jobs',         jobsRouter);
app.use('/applications', applicationsRouter);
app.use('/profile',      profileRouter);

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

app.get('/', (req, res) => res.send('JobMajunga Backend OK'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Serveur lancé sur port ${port}`));