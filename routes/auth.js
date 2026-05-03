const express = require("express");
const router = express.Router();
const { 
  register, 
  login, 
  getAllUsers, 
  deleteUser, 
  updateProfile,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");
const { 
  sendRegisterOtp,
   verifyRegisterOtp
} = require("../controllers/authController");


router.post("/send-otp", sendRegisterOtp);
router.post("/verify-otp", verifyRegisterOtp);
router.post("/register", register);
router.post("/login", login);
router.get("/users", getAllUsers);
router.delete("/user/:id", auth, deleteUser);
router.put("/update", auth, updateProfile);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/check", (req, res) => {
  res.send("AUTH ROUTE WORKING");
});
module.exports = router;