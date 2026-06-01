const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

const SECRET_KEY = process.env.JWT_SECRET;

/**
 * Generates a short-lived JSON Web Token for authenticated sessions
 * @param {string} userId - The unique identifier of the user
 * @returns {string} Signed JWT
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, SECRET_KEY, { expiresIn: "1h" });
};

// Handle new user account creation
exports.register = async (req, res) => {
  try {
    const { email, password, protectedKey } = req.body;

    // Validate request payload completeness before executing cryptographic or database operations
    if (!email || !password || !protectedKey) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Email, password, and protectedKey are required fields.",
      });
    }

    // Hash password using default Argon2id parameters
    const passwordHash = await argon2.hash(password);

    // Normalize and persist user registration data
    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      protectedKey,
    });

    return res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    // Intercept database unique constraint violations to prevent duplicate registrations
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        error: "ConflictError",
        message: "An account with this email address already exists.",
      });
    }

    // Log contextual stack traces internally without exposing server internals to the client
    console.error("Registration Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "An unexpected error occurred during registration.",
    });
  }
};

// Authenticate user credentials and return a session token
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Email and password are required.",
      });
    }

    // Retrieve user identity using normalized criteria
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    // Mitigate account enumeration attacks by returning uniform generic messages for missing identities
    if (!user) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid email or password.",
      });
    }

    // Securely verify incoming secret against stored hash
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid email or password.",
      });
    }

    const token = generateAccessToken(user.id);

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
