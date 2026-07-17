const { ActivityLog } = require("../models");
const { logActivity } = require("../utils/activityLogger");

// Retrieve the authenticated user's recent account activity, newest first
exports.getActivity = async (req, res) => {
  try {
    const logs = await ActivityLog.findAll({
      where: { UserId: req.userId },
      order: [["createdAt", "DESC"]],
      limit: 100,
    });
    return res.json(logs);
  } catch (error) {
    console.error("Get Activity Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to retrieve activity log.",
    });
  }
};

// Record a client-side-only event (e.g. password copied/revealed) that has no other backend trace
exports.recordEvent = async (req, res) => {
  try {
    const { action, detail } = req.body;

    const allowedActions = [
      "password_copied",
      "password_revealed",
      "logout",
      "logout_auto",
    ];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Unsupported activity action.",
      });
    }

    await logActivity(req.userId, action, req, detail || null);
    return res.status(201).json({ message: "Event recorded." });
  } catch (error) {
    console.error("Record Event Error:", error);
    return res.status(500).json({
      error: "InternalServerError",
      message: "Failed to record activity event.",
    });
  }
};
