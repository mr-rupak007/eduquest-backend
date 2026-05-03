const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/authMiddleware");
const db = require("../config/db");

// 🔒 Admin check middleware
function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only" });
    }
    next();
}

// ================= EARNINGS =================
router.get("/earnings", auth, adminOnly, adminController.getEarnings);

// ================= DELETE USER =================
router.delete("/users/:id", auth, adminOnly, (req, res) => {
    const userId = req.params.id;

    db.query("DELETE FROM users WHERE id=?", [userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Delete failed" });
        }

        res.json({ message: "User deleted" });
    });
});

// ================= BLOCK / UNBLOCK USER =================
router.put("/users/block/:id", auth, adminOnly, (req, res) => {
    const userId = req.params.id;

    db.query(
        "UPDATE users SET is_blocked = NOT is_blocked WHERE id=?",
        [userId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Update failed" });
            }

            res.json({ message: "User status updated" });
        }
    );
});

module.exports = router;