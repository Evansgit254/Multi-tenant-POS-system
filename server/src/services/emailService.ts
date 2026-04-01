import nodemailer from 'nodemailer';

// In a real production app, we would use strict environment variables for SendGrid or AWS SES.
// Because we are iterating iteratively, we use Ethereal Email (a free testing service by Nodemailer)
// which intercepts physical outbound emails and returns a browser URL to preview the HTML.
let transporter: nodemailer.Transporter | null = null;

const initializeTransporter = async () => {
  if (transporter) return transporter;

  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('[MAILER] Generated Ethereal Test Account:', testAccount.user);

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
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
      from: '"ServePoint System" <noreply@servepoint.app>',
      to,
      subject,
      html,
    });

    // This URL is printed to the terminal so the user can literally click it to see the email
    console.log(`[MAILER] ✅ EMAIL DISPATCHED to ${to}`);
    console.log(`[MAILER] 🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    return info;
  } catch (err) {
    console.error(`[MAILER] Failed to dispatch email to ${to}:`, err);
    throw err;
  }
};
