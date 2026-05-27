const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const SECRET_KEY = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { email, password, protectedKey } = req.body;
    const hash = await argon2.hash(password); // Argon2id par défaut
    const user = await User.create({ email, passwordHash: hash, protectedKey });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (e) {
    res.status(400).json({ error: "Utilisateur déjà existant" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (user && await argon2.verify(user.passwordHash, password)) {
    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1d' });
    res.json({ token, protectedKey: user.protectedKey });
  } else {
    res.status(401).json({ error: "Identifiants invalides" });
  }
};