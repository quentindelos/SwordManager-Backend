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

exports.replaceItem = async (req, res) => {
  try {
    const { type, label, encryptedData, folder } = req.body;
    const itemId = req.params.id;

    // On met à jour les champs de l'élément qui correspond à l'ID et à l'utilisateur
    const [updatedRows] = await VaultItem.update(
      { type, label, encryptedData, folder },
      { where: { id: itemId, UserId: req.userId } }
    );

    // Si aucune ligne n'a été modifiée, c'est que l'item n'existe pas ou n'appartient pas à l'utilisateur
    if (updatedRows === 0) {
      return res.status(404).json({ error: "Élément introuvable ou non autorisé" });
    }

    // Optionnel : On récupère l'élément mis à jour pour le renvoyer au client
    const updatedItem = await VaultItem.findByPk(itemId);
    res.json(updatedItem);

  } catch (e) {
    res.status(500).json({ error: "Erreur lors de la modification" });
  }
};