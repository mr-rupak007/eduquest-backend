const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

  const authHeader = req.headers.authorization;

  // 🔥 NO TOKEN → CONTINUE WITHOUT USER
  if (!authHeader) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

  } catch (err) {
     console.log("JWT FAIL:", err.message);
    req.user = null;
  }

  next();
};