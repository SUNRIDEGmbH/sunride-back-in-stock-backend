const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Speichert Anfragen im Speicher (für Start)
let requests = [];

app.post('/back-in-stock', async (req, res) => {
  try {
    const { email, productId, productName } = req.body;

    if (!email || !productId) {
      return res.status(400).json({
        message: 'Fehlende Daten',
      });
    }

    requests.push({
      email,
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});