const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(express.json()); // Parse JSON bodies
app.use(helmet()); // Headers sécurité (slide 7.2)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 })); // Limite globale 200 req/15min (slide 7.2)

// Route test basique
app.get('/', (req, res) => res.send('JobMajunga Backend OK - Prêt pour API REST !'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Serveur lancé sur port ${port}`));