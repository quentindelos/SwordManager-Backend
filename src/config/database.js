const { Sequelize } = require('sequelize');

const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',

    // Restrict SQL statement logging exclusively to development environments
    logging: isProduction ? false : console.log,

    // Connection Pool Infrastructure Management
    pool: {
      max: isProduction ? 20 : 5, // Concurrent database connection ceiling
      min: 0, // Absolute floor for active connection retention
      acquire: 30000, // Maximum lifetime threshold (ms) for establishing connection handshakes
      idle: 10000, // Inactivity timeout window (ms) prior to sweeping connection instances
    },

    // Global model defaults
    define: {
      // Force database engine hooks to consistently maintain metadata timestamps
      timestamps: true,
    },
  },
);

module.exports = sequelize;
