const db = require("../config/db");

exports.getEarnings = (req, res) => {

  db.query(
    `SELECT 
      SUM(amount) AS totalRevenue,
      SUM(admin_commission) AS adminEarning,
      SUM(teacher_earning) AS teacherPayout
     FROM payments
     WHERE status='success'`,
    (err, result) => {

      if (err) return res.status(500).json({ message: "Error" });

      res.json(result[0]);
    }
  );
};