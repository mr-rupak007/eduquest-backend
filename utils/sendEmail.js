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
      replyTo: process.env.EMAIL_USER,
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
            display:inline-block;
            padding:14px 24px;
            background:#eef2ff;
            border:2px solid #4f46e5;
            border-radius:14px;
          
            font-size:32px;
            font-weight:700;
            letter-spacing:6px;
          
            color:#4f46e5;
          
            margin:20px 0;
          
            box-shadow:0 4px 14px rgba(79,70,229,0.15);
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

const sendWelcomeEmail = async (to, name) => {
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
      replyTo: process.env.EMAIL_USER,
      to,
      subject: "🎉 Welcome to EDUQUEST",

      html: `
        <div style="
          font-family:Arial,sans-serif;
          padding:30px;
          background:#f8fafc;
          color:#111827;
        ">

          <div style="
            max-width:600px;
            margin:auto;
            background:white;
            border-radius:18px;
            padding:35px;
            box-shadow:0 8px 30px rgba(0,0,0,0.08);
          ">

            <h1 style="
              color:#4f46e5;
              margin-bottom:10px;
            ">
              Welcome to EDUQUEST 🚀
            </h1>

            <p style="font-size:16px;">
              Hi <b>${name}</b>,
            </p>

            <p style="
              font-size:15px;
              line-height:1.7;
              color:#374151;
            ">
              Your account has been successfully created.
              We’re excited to have you as part of the EDUQUEST learning community.
            </p>

            <div style="
              margin:30px 0;
              padding:20px;
              background:#eef2ff;
              border-left:4px solid #4f46e5;
              border-radius:12px;
            ">
              <p style="
                margin:0;
                color:#312e81;
                font-weight:600;
              ">
                Start exploring courses, improve your skills,
                and continue your learning journey with EDUQUEST.
              </p>
            </div>

            <p style="
              font-size:14px;
              color:#6b7280;
            ">
              If you have any issues, simply reply to this email.
            </p>

            <hr style="
              margin:25px 0;
              border:none;
              border-top:1px solid #e5e7eb;
            ">

            <p style="
              font-size:12px;
              color:#9ca3af;
              text-align:center;
            ">
              © EDUQUEST • Empowering Learning
            </p>

          </div>
        </div>
      `
    });

  } catch (err) {
    console.error("Welcome email error:", err.message);
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail
};