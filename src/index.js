if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://www.swordmanager.cloud', 'https://swordmanager.cloud'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/vault', require('./routes/vaultRoutes'));

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connexion à la base de données réussie.');
    
    await sequelize.sync();
    
    const port = process.env.PORT || 8080;
    app.listen(port, '0.0.0.0', () => {
      console.log(`Serveur prêt sur le port ${port}`);
    });
  } catch (e) { 
    console.error('Erreur critique de base de données:', e);
    process.exit(1); 
  }
};

start();
