const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Validate the presence and schema of the Authorization header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "AccessDenied",
      message: "Access denied. No token provided or invalid format.",
    });
  }

  // Extract the raw token string from the Bearer payload
  const token = authHeader.split(" ")[1];

  try {
    // Validate signature and integrity against the system environment secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Contextually bind the identity to the request object for downstream controllers
    req.userId = decoded.id;
    req.isBackupAuth = decoded.isBackupAuth || false;
    next();
  } catch (err) {
    // Handle expired tokens explicitly to facilitate client-side session management or rotation
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "TokenExpired",
        message: "Your session has expired. Please log in again.",
      });
    }

    // Catch malformed, untrusted, or tampered signatures
    return res.status(401).json({
      error: "InvalidToken",
      message: "Authentication failed. Token is invalid.",
    });
  }
};
