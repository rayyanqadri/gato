// Vercel Serverless function to send reservation emails via SendGrid
// Required environment variables:
// - SENDGRID_API_KEY : your SendGrid API key
// - RECIPIENT_EMAIL  : email address that receives reservation notifications
// - SENDER_EMAIL     : verified sender email (From) configured in SendGrid

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

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;
  const SENDER_EMAIL = process.env.SENDER_EMAIL;

  if (!SENDGRID_API_KEY || !RECIPIENT_EMAIL || !SENDER_EMAIL) {
    return res.status(500).json({ success: false, error: 'Server not configured. Missing SendGrid or email env vars.' });
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

  const payload = {
    personalizations: [
      {
        to: [{ email: RECIPIENT_EMAIL }],
        subject
      }
    ],
    from: { email: SENDER_EMAIL, name: 'Gató Reservations' },
    reply_to: { email, name },
    content: [
      { type: 'text/plain', value: message }
    ]
  };

  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (resp.status === 202) {
      return res.status(200).json({ success: true });
    } else {
      const text = await resp.text();
      return res.status(500).json({ success: false, error: `SendGrid error: ${resp.status} ${text}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
}
