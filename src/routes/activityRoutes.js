const express = require("express");
const router = express.Router();
const activityCtrl = require("../controllers/activityController");
const protect = require("../middleware/authMiddleware");

router.get("/", protect, activityCtrl.getActivity);
router.post("/", protect, activityCtrl.recordEvent);
module.exports = router;
