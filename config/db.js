const mysql = require("mysql2");

// 🔥 USE CONNECTION POOL (IMPORTANT)
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

// optional test
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ DB connection failed:", err);
  } else {
    console.log("✅ MySQL Connected (Pool)");
    connection.release();
  }
});

module.exports = db;