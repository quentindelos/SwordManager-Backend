const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { generateSecret, generate, verify, generateURI } = require("otplib");
const QRCode = require("qrcode");
const { User } = require("../models");
const { logActivity } = require("../utils/activityLogger");

const SECRET_KEY = process.env.JWT_SECRET;

/**
 * Generates a short-lived JSON Web Token for authenticated sessions
 * @param {string} userId - The unique identifier of the user
 * @returns {string} Signed JWT
 */
const generateAccessToken = (userId, isBackupAuth = false) => {
  return jwt.sign({ id: userId, isBackupAuth }, SECRET_KEY, { expiresIn: "1h" });
};

// Handle new user account creation
exports.register = async (req, res) => {
  try {
    const { email, password, protectedKey } = req.body;

    if (!email || !password || !protectedKey) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Email, password, and protectedKey are required fields.",
      });
    }

    const passwordHash = await argon2.hash(password);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      protectedKey,
    });

    return res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "ConflictError",
        message: "An account with this email address already exists.",
      });
    }

    console.error("Registration Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "An unexpected error occurred during registration.",
    });
  }
};

// ÉTAPE 1 DU LOGIN : Vérification des identifiants classiques
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid email or password.",
      });
    }

    if (user.isTwoFactorEnabled) {
      // On génère un token très court (3 minutes) qui prouve que le mot de passe est bon
      const preAuthToken = jwt.sign(
        { id: user.id, isPasswordValidated: true }, 
        SECRET_KEY, 
        { expiresIn: "3m" }
      );

      return res.json({
        requires2FA: true,
        preAuthToken: preAuthToken // On envoie ce jeton temporaire au frontend
      });
    }

    // Si pas de 2FA, session directe
    const token = generateAccessToken(user.id);
    await logActivity(user.id, "login", req);

    return res.json({
      token,
      protectedKey: user.protectedKey,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "An unexpected error occurred during login.",
    });
  }
};

// 🛠️ ÉTAPE 2 DU LOGIN : Validation du code à 6 chiffres si le 2FA est actif
exports.login2FA = async (req, res) => {
  try {
    const { preAuthToken, token } = req.body;

    if (!preAuthToken || !token) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Pre-auth token and 2FA token are required.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, SECRET_KEY);
    } catch (err) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "2FA session expired or invalid. Please re-enter your password.",
      });
    }

    const user = await User.findByPk(decoded.id);

    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid 2FA session.",
      });
    }

    // Vérification du code à 6 chiffres (TOTP)
    const checkResult = await verify({ token, secret: user.twoFactorSecret });

    if (!checkResult.valid) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid 2FA code.",
      });
    }

    const accessToken = generateAccessToken(user.id);
    await logActivity(user.id, "login", req);

    return res.json({
      token: accessToken,
      protectedKey: user.protectedKey,
    });
  } catch (error) {
    console.error("Login 2FA Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "An unexpected error occurred during 2FA verification.",
    });
  }
};

// Configuration initiale du 2FA (génère le QR Code)
exports.twoFaSetup = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);

    if (!user) {
      return res.status(404).json({ error: "NotFoundError", message: "User not found." });
    }

    // Fonctionne parfaitement maintenant car l'objet 'authenticator' possède ces méthodes
    const secret = generateSecret();
    const uri = generateURI({
      issuer: "SwordManager",
      label: user.email,
      secret,
    });

    user.twoFactorSecret = secret;
    await user.save();

    await logActivity(user.id, "2fa_setup_initiated", req);

    const qrCodeImageUrl = await QRCode.toDataURL(uri);

    return res.json({
      qrCode: qrCodeImageUrl,
      secret: secret
    });
  } catch (error) {
    console.error("2fa Setup Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "An unexpected error occurred during 2FA setup.",
    });
  }
};

// Confirmation du code pour ACTIVER définitivement le 2FA
exports.twoFaVerify = async (req, res) => {
  try {
    const { token } = req.body; 
    const user = await User.findByPk(req.userId);

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: "ValidationError", message: "2FA setup was not initiated." });
    }

    const resultCheck = await verify({ token, secret: user.twoFactorSecret });
    if (!resultCheck.valid) {
      return res.status(400).json({ error: "ValidationError", message: "Invalid 2FA code." });
    }

    // --- SÉCURITÉ : GÉNÉRATION DES CODES DE SECOURS ---
    const plainBackupCodes = [];
    const hashedBackupCodes = [];

    for (let i = 0; i < 10; i++) {
      // Génère un code au format XXXX-XXXX-XXXX
      const code = Math.random().toString(36).substring(2, 6) + "-" +
                   Math.random().toString(36).substring(2, 6) + "-" +
                   Math.random().toString(36).substring(2, 6);
      
      plainBackupCodes.push(code.toUpperCase());
      const hashedCode = await argon2.hash(code.toUpperCase());
      hashedBackupCodes.push(hashedCode);
    }

    user.isTwoFactorEnabled = true;
    user.backupCodes = hashedBackupCodes; // Stockage sécurisé
    await user.save();

    await logActivity(user.id, "2fa_enabled", req);

    // On renvoie les codes en clair uniquement ICI au client
    return res.json({ 
      message: "2FA successfully enabled!",
      backupCodes: plainBackupCodes 
    });
  } catch (error) {
    console.error("Login 2fa Verify Error:", error);
    return res.status(500).json({ error: "InternalServerError", message: "An unexpected error occurred." });
  }
};

exports.twoFaDisable = async (req, res) => {
  try {
    const { token } = req.body || {};
    const user = await User.findByPk(req.userId);

    if (!user || !user.isTwoFactorEnabled) {
      return res.status(400).json({ 
        error: "ValidationError", 
        message: "2FA is not enabled for this account." 
      });
    }

    // CAS 1 : Détection automatique via le token JWT (Authentifié par Backup Code)
    if (req.isBackupAuth) {
      // Pas besoin de token TOTP
      // Le fait d'avoir req.isBackupAuth = true valide l'action directement.
      console.log(`Bypass 2FA deletion for user ${user.id} (authenticated via backup code)`);
    } 
    // CAS 2 : Connexion classique, on exige toujours le code TOTP standard à 6 chiffres
    else {
      if (!token) {
        return res.status(400).json({ 
          error: "ValidationError", 
          message: "2FA token is required to disable 2FA." 
        });
      }

      const resultCheck = await verify({ token, secret: user.twoFactorSecret });
      if (!resultCheck.valid) {
        return res.status(400).json({ error: "ValidationError", message: "Invalid 2FA code." });
      }
    }

    // Réinitialisation complète de la sécurité 2FA pour les deux cas
    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.backupCodes = null; // On nettoie les codes de secours pour qu'ils ne soient plus utilisables
    await user.save();

    await logActivity(user.id, "2fa_disabled", req);

    return res.json({ message: "2FA successfully disabled." });
  } catch (error) {
    console.error("2fa Disable Error:", error);
    return res.status(500).json({ error: "InternalServerError", message: "An error occurred." });
  }
};

exports.loginWithBackupCode = async (req, res) => {
  try {
    const { backupCode } = req.body;

    // Le middleware a déjà validé le token et extrait req.userId
    const userId = req.userId; 

    if (!backupCode) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Backup code is required.",
      });
    }

    const user = await User.findByPk(userId);
    if (!user || !user.isTwoFactorEnabled || !user.backupCodes) {
      return res.status(401).json({ 
        error: "AuthenticationError", 
        message: "Invalid session or 2FA is not enabled." 
      });
    }

    // Vérifier si le code fourni correspond à un des codes hachés en BDD
    const upperCaseCode = backupCode.toUpperCase().trim();
    let matchedIndex = -1;

    for (let i = 0; i < user.backupCodes.length; i++) {
      const match = await argon2.verify(user.backupCodes[i], upperCaseCode);
      if (match) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      return res.status(401).json({ error: "AuthenticationError", message: "Invalid backup code." });
    }

    // Le code est bon ! On le supprime (Usage unique)
    const updatedBackupCodes = [...user.backupCodes];
    updatedBackupCodes.splice(matchedIndex, 1);
    user.backupCodes = updatedBackupCodes;
    await user.save();

    // Génération du token final avec "isBackupAuth = true"
    const accessToken = generateAccessToken(user.id, true);
    await logActivity(user.id, "login_via_backup_code", req);

    return res.json({
      token: accessToken,
      protectedKey: user.protectedKey,
      isBackupAuth: true
    });
  } catch (error) {
    console.error("Backup Code Login Error:", error);
    return res.status(500).json({ error: "InternalServerError", message: "An error occurred." });
  }
};