const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.sendRegisterOtp = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  db.query(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, result) => {
      if (err) {
        console.error("SELECT ERROR:", err);
        return res.status(500).json({ message: "DB error" });
      }

      // 🔥 CASE 1: EMAIL EXISTS & VERIFIED → BLOCK
      if (result.length > 0 && result[0].is_verified) {
        return res.status(400).json({
          message: "Email already registered ❌"
        });
      }

      // 🔥 GENERATE OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expire = Math.floor(Date.now() / 1000) + 300;
      const hashedOtp = await bcrypt.hash(otp, 10);

      // ================= UPDATE FLOW =================
      if (result.length > 0) {
        db.query(
          "UPDATE users SET otp_code=?, otp_expire=? WHERE email=?",
          [hashedOtp, expire, email],
          async (err2) => {
            if (err2) {
              console.error("UPDATE ERROR:", err2);
              return res.status(500).json({ message: "OTP update failed" });
            }

            await sendEmail(email, otp, "verify");
            return res.json({ message: "OTP sent 📧" });
          }
        );
      }

      // ================= INSERT FLOW =================
      else {
        db.query(
          "INSERT INTO users (name, email, otp_code, otp_expire, is_verified) VALUES (?, ?, ?, ?, FALSE)",
          [
            email.split("@")[0],
            email,
            hashedOtp,
            expire
          ],
          async (err2) => {
            if (err2) {
              console.error("INSERT ERROR:", err2);
              return res.status(500).json({ message: "OTP save failed" });
            }

            await sendEmail(email, otp, "verify");
            return res.json({ message: "OTP sent 📧" });
          }
        );
      }
    }
  );
};

// REGISTER
exports.register = async (req, res) => {
  const { name, email, mobile, password, role, age, location } = req.body;

  if (!name || !email || !mobile || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    // 🔐 HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      (err, users) => {

        if (err) {
          console.error("DB ERROR:", err);
          return res.status(500).json({ message: "DB error" });
        }

        if (!users || users.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const user = users[0];

        // 🔥 MUST be verified first
        if (!user.is_verified) {
          return res.status(400).json({
            message: "Verify OTP first"
          });
        }

        // 🔥 UPDATE existing user
        db.query(
          `UPDATE users 
           SET name=?, mobile=?, password=?, role=?, age=?, location=? 
           WHERE email=?`,
          [
            name,
            mobile,
            hashedPassword, // ✅ FIXED (was plain password)
            role || "student",
            age || null,
            location || null,
            email
          ],
          (err2) => {

            if (err2) {
              console.error("UPDATE ERROR:", err2);
              return res.status(500).json({ message: "Update failed" });
            }

            // ✅ SEND WELCOME EMAIL
            sendWelcomeEmail(email, name);

            return res.json({ message: "Registered successfully" });
          }
        );
      }
    );

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// LOGIN
exports.login = (req, res) => {

  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ message: "Enter credentials" });
  }

  db.query(
    "SELECT * FROM users WHERE mobile = ? OR email = ?",
    [mobile, mobile],
    (err, users) => {

      if (err) {
        console.error("LOGIN DB ERROR:", err);
        return res.status(500).json({ message: "DB error" });
      }

      if (!users || users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = users[0];

      if (!user.password) {
        return res.status(400).json({
          message: "Complete registration first"
        });
      }

      // 🔐 PASSWORD CHECK
      bcrypt.compare(password, user.password, (err, isMatch) => {

        if (err) {
          return res.status(500).json({ message: "Error comparing password" });
        }

        if (!isMatch) {
          return res.status(400).json({
            message: "Invalid password"
          });
        }

        // 🔥 JWT TOKEN (ONLY PLACE RESPONSE HAPPENS)
        const token = jwt.sign(
          { id: user.id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            age: user.age,
            location: user.location,
            role: user.role,
        
            // 👨‍🏫 Teacher profile fields
            subject: user.subject,
            specialization: user.specialization,
            occupation: user.occupation
          }
        });
      });
    }
  );
};


// ================= GET ALL USERS =================
exports.getAllUsers = (req, res) => {

  db.query(
    "SELECT id, name, email, mobile, role, is_blocked FROM users",
    (err, data) => {

      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error fetching users" });
      }

      res.json(data);
    }
  );
};


// ================= DELETE USER =================
exports.deleteUser = (req, res) => {

  const userId = req.params.id;

  // 🔥 ADMIN CHECK
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin only action"
    });
  }

  // ❌ PREVENT SELF DELETE
  if (req.user.id == userId) {
    return res.status(400).json({
      message: "You cannot delete yourself"
    });
  }

  db.query(
    "DELETE FROM users WHERE id = ?",
    [userId],
    (err, result) => {

      if (err) {
        console.error("DELETE ERROR:", err);
        return res.status(500).json({ message: "Delete failed" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    }
  );
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;

  const {
    name,
    email,
    mobile,
    age,
    location,
    password,
    subject,
    specialization,
    occupation
  } = req.body;

  try {
    let fields = [];
    let values = [];

    if (name) {
      fields.push("name=?");
      values.push(name);
    }

    if (email) {
      fields.push("email=?");
      values.push(email);
    }

    if (mobile) {
      fields.push("mobile=?");
      values.push(mobile);
    }

    if (age) {
      fields.push("age=?");
      values.push(age);
    }

    if (location) {
      fields.push("location=?");
      values.push(location);
    }

    if (subject) {
      fields.push("subject=?");
      values.push(subject);
    }

    if (specialization) {
      fields.push("specialization=?");
      values.push(specialization);
    }

    if (occupation) {
      fields.push("occupation=?");
      values.push(occupation);
    }

    if (password && password.trim() !== "") {
      const hashed = await bcrypt.hash(password, 10);
      fields.push("password=?");
      values.push(hashed);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const query = `UPDATE users SET ${fields.join(", ")} WHERE id=?`;
    values.push(userId);

    db.query(query, values, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Update failed" });
      }

      // 🔥 FETCH UPDATED USER
      db.query("SELECT * FROM users WHERE id = ?", [userId], (err2, result) => {
        if (err2) {
          console.error(err2);
          return res.status(500).json({ message: "Fetch failed" });
        }

        res.json({
          message: "Profile updated successfully",
          user: result[0]
        });
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const crypto = require("crypto");

// SEND OTP
const { sendEmail, sendWelcomeEmail } = require("../utils/sendEmail");

exports.forgotPassword = async (req, res) => {

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }

  if (!email.includes("@")) {
    return res.status(400).json({
      message: "Please enter your registered email"
    });
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, result) => {

      if (err) {
        console.error("SELECT ERROR:", err);
        return res.status(500).json({ message: "DB error" });
      }

      if (!result || result.length === 0) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      const user = result[0];

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expire = Math.floor(Date.now() / 1000) + 300;

      try {
        const hashedOtp = await bcrypt.hash(otp, 10);

        db.query(
          "UPDATE users SET reset_otp=?, reset_expire=? WHERE id=?",
          [hashedOtp, expire, user.id],
          async (err2) => {

            if (err2) {
              console.error("OTP SAVE ERROR:", err2);
              return res.status(500).json({ message: "OTP save failed" });
            }

            await sendEmail(email, otp, "reset");

            res.json({ message: "OTP sent to your email" });
          }
        );

      } catch (error) {
        console.error("HASH ERROR:", error);
        return res.status(500).json({ message: "OTP failed" });
      }
    }
  );
};


// VERIFY OTP + RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "All fields required" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, result) => {

      if (err) {
        console.error("SELECT ERROR:", err);
        return res.status(500).json({ message: "DB error" });
      }

      if (!result || result.length === 0) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const user = result[0];

      if (!user.reset_otp) {
        return res.status(400).json({ message: "No OTP found" });
      }

      const isMatch = await bcrypt.compare(otp, user.reset_otp);

      if (!isMatch) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      if (Math.floor(Date.now() / 1000) > user.reset_expire) {
        return res.status(400).json({ message: "OTP expired" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);

      db.query(
        "UPDATE users SET password=?, reset_otp=NULL, reset_expire=NULL WHERE id=?",
        [hashed, user.id],
        (err2) => {

          if (err2) return res.status(500).json({ message: "Reset failed" });

          res.json({ message: "Password reset successful" });
        }
      );
    }
  );
};

exports.verifyRegisterOtp = (req, res) => {
  const { email, otp } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, result) => {

      if (err) {
        return res.status(500).json({ message: "DB error" });
      }

      if (!result.length) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = result[0];

      if (!user.otp_code || !user.otp_expire) {
        return res.status(400).json({ message: "No OTP found" });
      }

      if (user.otp_expire < Math.floor(Date.now() / 1000)) {
        return res.status(400).json({ message: "OTP expired" });
      }

      const match = await bcrypt.compare(otp, user.otp_code);

      if (!match) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // ✅ OTP VERIFIED → clear it + mark verified
      db.query(
        "UPDATE users SET otp_code=NULL, otp_expire=NULL, is_verified=TRUE WHERE email=?",
        [email]
      );

      res.json({ message: "OTP verified ✅" });
    }
  );
};