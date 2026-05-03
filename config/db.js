const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

// 🔥 PROMISE WRAPPER (IMPORTANT)
const promiseDb = db.promise();

module.exports = promiseDb;