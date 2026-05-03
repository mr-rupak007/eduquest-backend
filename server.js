require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");

// routes
const courseRoutes = require("./routes/courses");
const authRoutes = require("./routes/auth");
const enrollRoutes = require("./routes/enrollments");
const commentRoutes = require("./routes/comments");
const paymentRoutes = require("./routes/payment");

const app = express();

// ================= MIDDLEWARE =================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://checkout.razorpay.com",
          "https://cdn.razorpay.com",   // ✅ ADD THIS
          "https://cdn.socket.io",
          "https://cdn.jsdelivr.net"
        ],

        scriptSrcAttr: ["'unsafe-inline'"],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        connectSrc: [
          "'self'",
          "ws:",
          "wss:",
          "https://api.razorpay.com",
          "https://lumberjack.razorpay.com", // ✅ ADD THIS
          "https://cdn.socket.io",
          "https://cdn.jsdelivr.net"
        ],

        frameSrc: [
          "'self'",
          "https://checkout.razorpay.com",
          "https://api.razorpay.com"   // ✅ ADD THIS
        ],

        objectSrc: ["'none'"]
      }
    }
  })
);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// ================= API ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enroll", enrollRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", require("./routes/admin"));

// ================= STATIC FILES =================
app.use("/uploads", express.static("uploads"));

// 🔥 Absolute safe path (fix for Render)
const frontendPath = path.join(__dirname, "frontend");

// Serve static frontend
app.use(express.static(frontendPath));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});



app.get("/debug-db", async (req, res) => {
  try {
    const [rows] = await db.query("SHOW TABLES");
    res.json(rows);
  } catch (err) {
    console.error("DEBUG ERROR:", err);
    res.status(500).json(err.message);
  }
});



// ================= FALLBACK (SAFE SPA HANDLING) =================
app.use((req, res, next) => {
  // ❗ IMPORTANT: do NOT override API routes
  if (req.originalUrl.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(frontendPath, "index.html"));
});


// ================= SERVER =================
const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// ================= SOCKET =================
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*"
  }
});

// make io accessible in routes
app.set("io", io);

// socket connection
io.on("connection", (socket) => {

  // 🔐 optional: remove in production
  if (process.env.NODE_ENV !== "production") {
    console.log("User connected:", socket.id);
  }

  socket.on("joinCourse", (courseId) => {
    socket.join(`course_${courseId}`);
  });

  socket.on("leaveCourse", (courseId) => {
    socket.leave(`course_${courseId}`);
  });

});

// ================= START =================
server.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});