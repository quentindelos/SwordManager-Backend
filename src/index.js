require('dotenv').config();
const express = require('express');
const { Sequelize } = require('sequelize');
const cors = require('cors');

const app = express();
app.use(cors({
    // On autorise localhost ET l'IP 127.0.0.1
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://www.swordmanager.cloud', 'https://swordmanager.cloud'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/vault', require('./routes/vaultRoutes'));

// Middleware
app.use(cors());
app.use(express.json());

// Initialisation de Sequelize avec les variables d'environnement
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432,
    logging: false // Désactive les logs SQL dans la console (plus propre)
  }
);

// Test de connexion
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à PostgreSQL réussie avec Sequelize !');
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
  }
})();

// Route de santé
app.get('/status', (req, res) => res.json({ status: 'OK' }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Serveur lancé sur le port ${port}`));
