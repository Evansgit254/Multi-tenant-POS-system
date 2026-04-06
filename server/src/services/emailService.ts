import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

/**
 * Initializes a nodemailer transport.
 * Priority: Real SMTP (via env vars) → Ethereal test account (dev fallback).
 */
const initializeTransporter = async () => {
  if (transporter) return transporter;

  // If real SMTP credentials are provided, use them (production mode)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`[MAILER] 🚀 Using real SMTP via ${process.env.SMTP_HOST}`);
    return transporter;
  }

  // Fallback: Ethereal test account for local dev
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('[MAILER] ⚠️  SMTP credentials not set. Using Ethereal test account:', testAccount.user);
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    return transporter;
  } catch (err) {
    console.error('[MAILER] Critical failure generating Ethereal credentials:', err);
    throw err;
  }
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const mailer = await initializeTransporter();
    const info = await mailer.sendMail({
      from: `"ServePoint" <${process.env.SMTP_FROM ?? 'noreply@servepoint.app'}>`,
      to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[MAILER] ✅ Email sent to ${to}`);
    if (previewUrl) console.log(`[MAILER] 🔗 Preview: ${previewUrl}`);
    return info;
  } catch (err) {
    console.error(`[MAILER] Failed to send to ${to}:`, err);
    throw err;
  }
};
