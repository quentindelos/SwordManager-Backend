if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    // On autorise localhost ET l'IP 127.0.0.1
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
}
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vault', require('./routes/vaultRoutes'));

const start = async () => {
  try {
    await sequelize.sync();
    const port = process.env.PORT || 8080;
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Serveur prêt sur le port ${port}`);
    });
  } catch (e) { console.error(e); }
};

start();
