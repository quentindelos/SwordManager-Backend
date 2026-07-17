const { ActivityLog } = require("../models");

// Best-effort audit trail write: a logging failure must never break the calling request
const logActivity = async (userId, action, req, detail = null) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip;

    await ActivityLog.create({ UserId: userId, action, ip, detail });
  } catch (error) {
    console.error("Activity Log Error:", error);
  }
};

module.exports = { logActivity };
