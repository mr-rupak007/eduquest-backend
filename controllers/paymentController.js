const razorpay = require("../config/razorpay");
const crypto = require("crypto");
const db = require("../config/db");

// =======================
// CREATE ORDER
// =======================
exports.createOrder = async (req, res) => {
  try {
    const { amount, courseId } = req.body;

    if (!amount || !courseId) {
      return res.status(400).json({ error: "Missing amount or courseId" });
    }

    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({ order });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order failed" });
  }
};

// =======================
// VERIFY PAYMENT
// =======================
exports.verifyPayment = (req, res) => {
  const userId = req.user.id;

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    courseId
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false });
  }

  db.query(
    "SELECT price FROM courses WHERE id=?",
    [courseId],
    (err, courseResult) => {

      if (err) {
        console.error(err);
        return res.status(500).json({ message: "DB error" });
      }

      if (!courseResult.length) {
        return res.status(404).json({ message: "Course not found" });
      }

      // ✅ FIXED: define totalAmount
      const totalAmount = courseResult[0].price;

      db.query(
        "SELECT commission_percent FROM settings LIMIT 1",
        (err2, result) => {

          if (err2) {
            console.error(err2);
            return res.status(500).json({ message: "Commission error" });
          }

          const percent = result[0]?.commission_percent || 0;

          const adminCommission = Math.floor((totalAmount * percent) / 100);
          const teacherEarning = totalAmount - adminCommission;

          db.query(
            `INSERT INTO payments 
            (user_id, course_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, admin_commission, teacher_earning, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId,
              courseId,
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              totalAmount,
              adminCommission,
              teacherEarning,
              "success"
            ],
            (err3) => {

              if (err3) {
                console.error(err3);
                return res.status(500).json({ message: "Payment save failed" });
              }

              db.query(
                "INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)",
                [userId, courseId],
                (err4) => {

                  if (err4) {
                    console.error(err4);
                    return res.status(500).json({ message: "Enroll failed" });
                  }

                  res.json({ success: true });
                }
              );

            }
          );

        }
      );

    }
  );
};

exports.getAdminCommissionChart = (req, res) => {
  db.query(
    `SELECT 
       DATE(created_at) as date,
       SUM(amount * 0.1) as adminCommission
     FROM payments
     WHERE status = 'success'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    (err, rows) => {
      if (err) {
        console.error("CHART ERROR:", err);
        return res.status(500).json({ message: "Error" });
      }

      res.json(rows);
    }
  );
};