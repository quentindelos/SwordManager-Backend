const { VaultItem } = require("../models");
const { logActivity } = require("../utils/activityLogger");

// Préfixe utilisé côté client pour représenter un dossier vide (aucune entité "Folder" dédiée)
const FOLDER_PLACEHOLDER_PREFIX = "[Dossier Vide] ";

function isFolderPlaceholder(label) {
  return (label || "").startsWith(FOLDER_PLACEHOLDER_PREFIX);
}

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

    if (isFolderPlaceholder(item.label)) {
      await logActivity(req.userId, "folder_created", req, item.folder);
    } else {
      await logActivity(req.userId, "item_created", req, item.label);
    }

    return res.status(201).json(item);
  } catch (error) {
    console.error("Add Item Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to add vault item.",
    });
  }
};

exports.addBulkItems = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) && items.length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "items must be a non-empty array.",
      });
    }

    const formattedRecords = items.map((item) => ({
      type: item.type || "login",
      label: item.label || "Identifiant importé",
      encryptedData: item.encryptedData,
      folder: item.folder || null,
      UserId: req.userId,
    }));

    const createdItems = await VaultItem.bulkCreate(formattedRecords);

    await logActivity(req.userId, "items_imported", req, `${createdItems.length}`);

    return res.status(201).json({
      message: "Bulk import successful.",
      count: createdItems.length,
    });
  } catch (error) {
    console.error("Add Bulk Items Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to perform bulk import.",
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
    const folder = item.folder;
    await item.destroy();

    if (isFolderPlaceholder(label)) {
      await logActivity(req.userId, "folder_deleted", req, folder);
    } else {
      await logActivity(req.userId, "item_deleted", req, label);
    }

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

    const existingItem = await VaultItem.findOne({
      where: { id: itemId, UserId: req.userId },
    });

    if (!existingItem) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "Vault item not found or unauthorized.",
      });
    }

    const previousFolder = existingItem.folder || null;
    const nextFolder = folder || null;

    // Execute bulk update command gated by implicit multi-tenant filters
    await VaultItem.update(
      { type, label, encryptedData, folder },
      { where: { id: itemId, UserId: req.userId } },
    );

    // Query modified entity specifying both entity identifiers to maintain strict transaction context
    const updatedItem = await VaultItem.findOne({
      where: { id: itemId, UserId: req.userId },
    });

    // Un déplacement entre dossiers est loggé distinctement d'une simple modification
    if (!isFolderPlaceholder(updatedItem.label) && previousFolder !== nextFolder) {
      const fromLabel = previousFolder || "Sans dossier";
      const toLabel = nextFolder || "Sans dossier";
      await logActivity(
        req.userId,
        "item_moved",
        req,
        `${updatedItem.label}: ${fromLabel} -> ${toLabel}`,
      );
    } else {
      await logActivity(req.userId, "item_updated", req, updatedItem.label);
    }

    return res.json(updatedItem);
  } catch (error) {
    console.error("Update Item Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to modify vault item.",
    });
  }
};
