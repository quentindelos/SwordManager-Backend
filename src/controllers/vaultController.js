const { VaultItem } = require("../models");
const { logActivity } = require("../utils/activityLogger");

// Persist a new encrypted item to the user's vault
exports.addItem = async (req, res) => {
  try {
    const { type, label, encryptedData, folder } = req.body;

    // Validate that required cryptographic payload is present
    if (!encryptedData) {
      return res.status(400).json({
        error: "ValidationError",
        message: "encryptedData is a required field.",
      });
    }

    // Initialize item ensuring strict multi-tenant context mapping
    const item = await VaultItem.create({
      type: type || "login",
      label: label || "Untitled Item",
      encryptedData,
      folder: folder || null,
      UserId: req.userId,
    });

    await logActivity(req.userId, "item_created", req, item.label);

    return res.status(201).json(item);
  } catch (error) {
    console.error("Add Item Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to add vault item.",
    });
  }
};

// Retrieve all encrypted items linked to the authenticated identity
exports.getItems = async (req, res) => {
  try {
    const items = await VaultItem.findAll({
      where: { UserId: req.userId },
      order: [["updatedAt", "DESC"]],
    });
    return res.json(items);
  } catch (error) {
    console.error("Get Items Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to retrieve vault items.",
    });
  }
};

// Remove an entry from the vault, verifying resource ownership prior to deletion
exports.deleteItem = async (req, res) => {
  try {
    const itemId = req.params.id;

    const item = await VaultItem.findOne({
      where: { id: itemId, UserId: req.userId },
    });

    // Handle instances where the target resource does not exist or access is restricted
    if (!item) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "Vault item not found or unauthorized.",
      });
    }

    const label = item.label;
    await item.destroy();

    await logActivity(req.userId, "item_deleted", req, label);

    return res.json({ message: "Item successfully deleted." });
  } catch (error) {
    console.error("Delete Item Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to delete vault item.",
    });
  }
};

// Update an existing item, restricting scope exclusively to the resource owner
exports.replaceItem = async (req, res) => {
  try {
    const { type, label, encryptedData, folder } = req.body;
    const itemId = req.params.id;

    if (!encryptedData) {
      return res.status(400).json({
        error: "ValidationError",
        message: "encryptedData cannot be empty.",
      });
    }

    // Execute bulk update command gated by implicit multi-tenant filters
    const [updatedRows] = await VaultItem.update(
      { type, label, encryptedData, folder },
      { where: { id: itemId, UserId: req.userId } },
    );

    if (updatedRows === 0) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "Vault item not found or unauthorized.",
      });
    }

    // Query modified entity specifying both entity identifiers to maintain strict transaction context
    const updatedItem = await VaultItem.findOne({
      where: { id: itemId, UserId: req.userId },
    });

    await logActivity(req.userId, "item_updated", req, updatedItem.label);

    return res.json(updatedItem);
  } catch (error) {
    console.error("Update Item Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to modify vault item.",
    });
  }
};
