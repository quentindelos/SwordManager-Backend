const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

router.post("/register", authCtrl.register);
router.post("/login/2fa", authCtrl.login2FA);
router.post("/login", authCtrl.login);
router.post("/2fa/setup", protect, authCtrl.twoFaSetup);
router.post("/2fa/verify", protect, authCtrl.twoFaVerify);
router.delete("/2fa", protect, authCtrl.twoFaDisable);
router.post("/2fa/recover", protect, authCtrl.loginWithBackupCode);
module.exports = router;