const db = require("./config/db");
const bcrypt = require("bcrypt");

async function createAdmin() {
  try {
    const name = "Admin";
    const email = "admin@example.com";
    const mobile = "9999999999";
    const plainPassword = "admin123";

    // 🔐 hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // 🔍 check if already exists
    db.query(
      "SELECT * FROM users WHERE email = ? OR mobile = ?",
      [email, mobile],
      async (err, result) => {

        if (err) {
          console.error("DB ERROR:", err);
          return;
        }

        if (result.length > 0) {
          console.log("⚠️ Admin already exists");
          return;
        }

        // ✅ insert admin
        db.query(
          `INSERT INTO users 
          (name, email, mobile, password, role, age, location) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [name, email, mobile, hashedPassword, "admin", 25, "India"],
          (err2) => {
            if (err2) {
              console.error("Insert error:", err2);
              return;
            }

            console.log("✅ Admin created successfully");
            console.log("📧 Email:", email);
            console.log("🔑 Password:", plainPassword);
          }
        );
      }
    );

  } catch (err) {
    console.error("Error:", err);
  }
}

createAdmin();