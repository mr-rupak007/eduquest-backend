const nodemailer = require("nodemailer");

const sendEmail = async (to, otp, type = "reset") => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"EDUQUEST" <${process.env.EMAIL_USER}>`,
      to,
      subject: type === "verify"
        ? "Email Verification OTP"
        : "Password Reset OTP",
      html: `
        <div style="font-family:Arial; padding:20px;">
          <h2>
            ${type === "verify"
              ? "📧 Verify Your Email"
              : "🔐 EDUQUEST Password Reset"}
          </h2>
          
          <p>Hello,</p>
          <p>Your OTP code is:</p>
      
          <div style="
            font-size:28px;
            font-weight:bold;
            letter-spacing:4px;
            color:#22c55e;
            margin:20px 0;
          ">
            ${otp}
          </div>
      
          <p>This OTP will expire in <b>5 minutes</b>.</p>
      
          <hr>
      
          <p style="font-size:12px; color:#64748b;">
            If you didn’t request this, ignore this email.
          </p>
        </div>
      `
    });
  } catch (err) {
  console.error("❌ EMAIL ERROR:", err.message);
  console.error(err);
  throw err; // IMPORTANT
}
};

module.exports = sendEmail;