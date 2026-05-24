require('dotenv').config(); // Charge les variables du fichier .env en local
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    // On autorise localhost ET l'IP 127.0.0.1
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://www.swordmanager.cloud', 'https://swordmanager.cloud'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
}
app.use(express.json());

// Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/vault', require('./routes/vaultRoutes'));

// Middleware
app.use(cors()); // Active le CORS pour permettre au frontend d'appeler l'API
app.use(express.json());

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

// Test de connexion à la base de données au démarrage
pool.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.stack);
  } else {
    console.log('Connecté à la base de données PostgreSQL avec succès');
  }
});

// Route de test
app.get('/status', (req, res) => {
  res.json({ status: 'OK', message: 'Le backend SwordManager fonctionne !' });
});

// Exemple de route API
app.get('/api/data', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()'); // Simple test requête
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Démarrage du serveur sur le port imposé par Cloud Run ou 8080 par défaut
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Serveur backend lancé sur le port ${port}`);
});
