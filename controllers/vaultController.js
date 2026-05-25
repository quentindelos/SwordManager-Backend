const { VaultItem } = require('../models');

exports.addItem = async (req, res) => {
  try {
    const { type, label, encryptedData, folder } = req.body;
    const item = await VaultItem.create({
      type, label, encryptedData, folder, UserId: req.userId
    });
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};

exports.getItems = async (req, res) => {
  const items = await VaultItem.findAll({ where: { UserId: req.userId } });
  res.json(items);
};

exports.deleteItem = async (req, res) => {
  await VaultItem.destroy({ where: { id: req.params.id, UserId: req.userId } });
  res.json({ message: "Supprimé" });
};