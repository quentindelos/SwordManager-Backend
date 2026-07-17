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

// Activity Log Schema Definition (Account audit trail)
const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // e.g. "login", "item_created", "item_updated", "item_deleted", "password_copied", "password_revealed"
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Optional human-readable context, e.g. the label of the affected vault item
    detail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    updatedAt: false,
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

// One-to-Many Relationship Definition (User -> ActivityLogs)
User.hasMany(ActivityLog, {
  foreignKey: {
    name: "UserId",
    allowNull: false,
  },
  onDelete: "CASCADE",
});

ActivityLog.belongsTo(User, {
  foreignKey: {
    name: "UserId",
    allowNull: false,
  },
});

module.exports = { User, VaultItem, ActivityLog, sequelize };
