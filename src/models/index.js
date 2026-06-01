const sequelize = require("../config/database");
const { DataTypes } = require("sequelize");

// User Account Schema Definition
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Master-key-derived encryption key wrapping material
    protectedKey: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    // Automatically includes and manages createdAt and updatedAt fields
    timestamps: true,
  },
);

// Vault Entry Schema Definition (Encrypted user items)
const VaultItem = sequelize.define(
  "VaultItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: "login",
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Untitled Item",
    },
    // Base64 or Hex encoded client-side encrypted payload
    encryptedData: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    folder: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    // Database-level index on the foreign key to optimize user lookup queries
    indexes: [
      {
        fields: ["UserId"],
      },
    ],
  },
);

// One-to-Many Relationship Definition (User -> VaultItems)
User.hasMany(VaultItem, {
  foreignKey: {
    name: "UserId",
    allowNull: false,
  },
  onDelete: "CASCADE", // Cascades deletion of all vault items if a user account is deleted
});

VaultItem.belongsTo(User, {
  foreignKey: {
    name: "UserId",
    allowNull: false,
  },
});

module.exports = { User, VaultItem, sequelize };
