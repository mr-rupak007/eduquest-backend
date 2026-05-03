const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create-order", paymentController.createOrder);
router.post("/verify", authMiddleware, paymentController.verifyPayment);

module.exports = router;