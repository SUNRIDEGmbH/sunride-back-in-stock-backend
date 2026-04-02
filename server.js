const express = require('express');
const cors = require('cors');
require('dotenv').config();
console.log('RESEND KEY:', process.env.RESEND_API_KEY);
const { Resend } = require('resend');

const app = express();

app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

// Speicher (später ersetzen wir das durch Datenbank)
let requests = [];

app.post('/back-in-stock', async (req, res) => {
  try {
    const { email, productId, productName } = req.body;

    if (!email || !productId) {
      return res.status(400).json({
        message: 'Fehlende Daten',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingRequest = requests.find(
      (entry) =>
        entry.email === normalizedEmail &&
        entry.productId === productId &&
        entry.notified === false
    );

    if (existingRequest) {
      return res.json({
        success: true,
        alreadyExists: true,
      });
    }

    requests.push({
      email: normalizedEmail,
      productId,
      productName,
      createdAt: new Date(),
      notified: false,
    });

    console.log('Neue Anfrage:', { email, productId, productName });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      message: 'Fehler beim Speichern',
    });
  }
});

// TEST ROUTE FÜR MAILVERSAND
app.get('/test-mail', async (req, res) => {
  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'corinna@sunride.eu',
      subject: 'Test Mail Sunride',
      html: '<p>Mail funktioniert</p>',
    });

    console.log('Resend Erfolg:', result);
    res.json(result);
  } catch (error) {
    console.error('Resend Fehler:', error);
    res.status(500).json({
      message: 'Fehler beim Senden',
      error: error?.message || error,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});