// Vercel Serverless function to send reservation emails via SMTP (Gmail)
// Required environment variables:
// - SMTP_USER       : your Gmail address (e.g., you@gmail.com)
// - SMTP_PASS       : app password (recommended) or SMTP password
// - SMTP_HOST       : SMTP host (optional, default smtp.gmail.com)
// - SMTP_PORT       : SMTP port (optional, default 587)
// - RECIPIENT_EMAIL : email address that receives reservation notifications
// - SENDER_EMAIL    : From address to show in emails (e.g., "Gató <you@gmail.com>")

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let body = req.body;
  // If body-parser didn't run (raw), try to collect raw body
  if (!body || Object.keys(body).length === 0) {
    try {
      const buf = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
      const text = buf.toString();
      body = text ? JSON.parse(text) : {};
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
  }

  const { name, phone, email, date, duration, timeslot } = body;
  if (!name || !phone || !email || !date || !timeslot) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Basic email validation
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' });
  }

  // You can either set credentials via Vercel environment variables (recommended)
  // or hard-code them below by filling DEFAULTS. Hard-coding credentials is
  // convenient for quick testing but is NOT recommended for production.
  const DEFAULTS = {
    // Example placeholders - replace with real values if you want to hard-code here
    SMTP_USER: 'muhammadrayyan70@gmail.com', // your Gmail address
    SMTP_PASS: 'pwuaitigkpbyokzu', // e.g. 'app-password'
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    RECIPIENT_EMAIL: 'muhammadrayyan70@gmail.com', // messages will be sent to your Gmail
    SENDER_EMAIL: 'Gató <muhammadrayyan70@gmail.com>' // From: header shown to recipients
  };

  const SMTP_USER = process.env.SMTP_USER || DEFAULTS.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS || DEFAULTS.SMTP_PASS;
  const SMTP_HOST = process.env.SMTP_HOST || DEFAULTS.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : DEFAULTS.SMTP_PORT;
  const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || DEFAULTS.RECIPIENT_EMAIL;
  const SENDER_EMAIL = process.env.SENDER_EMAIL || DEFAULTS.SENDER_EMAIL || SMTP_USER;

  if (!SMTP_USER || !SMTP_PASS || !RECIPIENT_EMAIL || !SENDER_EMAIL) {
    return res.status(500).json({ success: false, error: 'Server not configured. Missing SMTP or email settings. Set env vars or fill DEFAULTS in the function (not recommended for production).' });
  }

  // Format the timeslot into readable local time if possible
  let slotReadable = timeslot;
  try {
    const dt = new Date(timeslot);
    if (!isNaN(dt.getTime())) {
      const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
      slotReadable = dt.toLocaleString('en-GB', opts);
    }
  } catch (e) {
    // keep raw
  }

  const subject = `New reservation from ${name} on ${date} @ ${slotReadable}`;
  const message = `You have a new reservation request:\n\n` +
    `Name: ${name}\n` +
    `Phone: ${phone}\n` +
    `Email: ${email}\n` +
    `Date: ${date}\n` +
    `Start: ${slotReadable}\n` +
    `Duration (minutes): ${duration || ''}\n\n` +
    `-- End of message --\n`;

  // Use nodemailer to send via SMTP
  try {
    // lazy-require nodemailer inside the function
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    const mailOptions = {
      from: SENDER_EMAIL,
      to: RECIPIENT_EMAIL,
      replyTo: `${name} <${email}>`,
      subject,
      text: message
    };

    const info = await transporter.sendMail(mailOptions);
    // nodemailer returns an info object; we'll treat any successful send as success
    return res.status(200).json({ success: true, info });
  } catch (err) {
    // return error with message for debugging (don't leak secrets)
    return res.status(500).json({ success: false, error: err.message || 'Failed to send email' });
  }
}
