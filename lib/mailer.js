import nodemailer from 'nodemailer';

// Create a nodemailer transporter using Gmail SMTP when credentials are provided.
// Export a single async function `sendMail` that other modules can import.
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    throw new Error('Gmail transporter not configured (GMAIL_USER / GMAIL_PASS missing)');
  }

  const info = await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html,
  });

  return info;
}

export default sendMail;
