const db = require("../config/db");

exports.getEarnings = (req, res) => {

  db.query(
    `SELECT 
      SUM(amount) AS totalRevenue
     FROM payments
     WHERE status='success'`,
    (err, result) => {

      if (err) {
        console.error("EARNINGS ERROR:", err);
        return res.status(500).json({ message: "Error" });
      }

      const total = result[0].totalRevenue || 0;

      // 👉 simple split logic (optional)
      const adminCut = total * 0.1;     // 10%
      const teacherCut = total * 0.9;   // 90%

      res.json({
        totalRevenue: total,
        adminEarning: adminCut,
        teacherPayout: teacherCut
      });
    }
  );
};