const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  passwordHash: { type: DataTypes.TEXT, allowNull: false },
  protectedKey: { type: DataTypes.TEXT, allowNull: false }
});

const VaultItem = sequelize.define('VaultItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  type: { type: DataTypes.STRING, defaultValue: 'login' },
  label: { type: DataTypes.STRING },
  encryptedData: { type: DataTypes.TEXT, allowNull: false },
  folder: { type: DataTypes.STRING }
});

User.hasMany(VaultItem, { onDelete: 'CASCADE' });
VaultItem.belongsTo(User);

module.exports = { User, VaultItem, sequelize };