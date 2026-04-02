const express = require('express');
const cors = require('cors');
require('dotenv').config();
console.log('SHOPWARE_URL:', process.env.SHOPWARE_URL);
console.log('SHOPWARE_ACCESS_KEY vorhanden:', !!process.env.SHOPWARE_ACCESS_KEY);
console.log('RESEND KEY:', process.env.RESEND_API_KEY);
const { Resend } = require('resend');

async function fetchProductAvailability(productId) {
  console.log('Prüfe Produkt bei Shopware:', productId);
  console.log('Mit URL:', `${process.env.SHOPWARE_URL}/store-api/product/${productId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${process.env.SHOPWARE_URL}/store-api/product/${productId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'sw-access-key': process.env.SHOPWARE_ACCESS_KEY,
      },
      body: JSON.stringify({
        includes: {
          product: ['id', 'availableStock', 'available'],
        },
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    console.log('Shopware Status:', response.status);
    console.log('Shopware Antwort:', text);

    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(data?.errors?.[0]?.detail || 'Produkt konnte nicht geprüft werden.');
    }

    return {
      available: Boolean(data?.product?.available),
      availableStock: Number(data?.product?.availableStock || 0),
    };
  } finally {
    clearTimeout(timeout);
  }
}

const app = express();

app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

// Speicher, später durch Datenbank ersetzen
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
      productImage: req.body.productImage || '',
      productUrl: req.body.productUrl || '',
      createdAt: new Date(),
      notified: false,
    });

    console.log('Neue Anfrage:', {
      email: normalizedEmail,
      productId,
      productName,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
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

async function checkBackInStock() {
  if (!requests.length) return;

  console.log('Prüfe Verfügbarkeiten...');

  for (const entry of requests) {
    if (entry.notified) continue;

    try {
      const { available, availableStock } = await fetchProductAvailability(entry.productId);

      const isAvailable = available && availableStock > 0;

      if (!isAvailable) continue;

      await resend.emails.send({
  from: 'onboarding@resend.dev',
  to: entry.email,
  subject: `${entry.productName || 'Dein gewünschter Artikel'} ist wieder verfügbar`,
  html: `
    <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px 16px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #ececec;">
        ${
          entry.productImage
            ? `<img src="${entry.productImage}" alt="${entry.productName || 'Produkt'}" style="width: 100%; display: block; background: #fafafa;" />`
            : ''
        }

        <div style="padding: 28px 24px;">
          <p style="margin: 0 0 10px; font-size: 13px; letter-spacing: 0.4px; color: #8a8a8a; text-transform: uppercase;">
            Sunride
          </p>

          <h1 style="margin: 0 0 14px; font-size: 24px; line-height: 1.3; color: #111111;">
            Dein gewünschter Artikel ist wieder verfügbar
          </h1>

          <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.6; color: #4b5563;">
            Gute Nachrichten. Der Artikel <strong>${entry.productName || 'Dein gewünschtes Produkt'}</strong> ist ab sofort wieder erhältlich.
          </p>

          ${
            entry.productUrl
              ? `<a href="${entry.productUrl}" style="display: inline-block; background: #111111; color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-size: 15px; font-weight: 700;">
                  Jetzt zum Produkt
                </a>`
              : ''
          }

          <p style="margin: 22px 0 0; font-size: 13px; line-height: 1.6; color: #8a8a8a;">
            Diese Benachrichtigung wurde einmalig versendet.
          </p>
        </div>
      </div>
    </div>
  `,
});

      entry.notified = true;

      console.log('Mail gesendet an:', entry.email);
    } catch (error) {
      console.error('Fehler beim Versand:', error);
    }
  }
}

// läuft alle 60 Sekunden
console.log('Intervall für Back in Stock wurde gestartet');
setInterval(checkBackInStock, 60000);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});