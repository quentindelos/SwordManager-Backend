const express = require('express');
const router = express.Router();
const vaultCtrl = require('../controllers/vaultController');
const protect = require('../middleware/authMiddleware');

router.get('/', protect, vaultCtrl.getItems);
router.post('/', protect, vaultCtrl.addItem);
router.delete('/:id', protect, vaultCtrl.deleteItem);
module.exports = router;