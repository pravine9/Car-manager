/**
 * Local dev server: serves static files and proxies DVLA vehicle lookup.
 * API key is read from environment (e.g. .env) and never sent to the frontend.
 *
 * Run: DVLA_API_KEY=your_key node server.js
 * Or with .env: node server.js
 */
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DVLA_API_KEY = process.env.DVLA_API_KEY;

// Static files (index.html, styles.css, *.js, etc.)
app.use(express.static(path.join(__dirname)));

// JSON body for API
app.use(express.json());

// Pretty URL for the standalone bulk page
app.get('/bulk', (req, res) => {
  res.sendFile(path.join(__dirname, 'bulk.html'));
});

// Proxy: POST /api/vehicle-lookup -> DVLA VES API
app.post('/api/vehicle-lookup', async (req, res) => {
  if (!DVLA_API_KEY || !DVLA_API_KEY.trim()) {
    return res.status(503).json({ error: 'DVLA API key not configured. Set DVLA_API_KEY in .env or environment.' });
  }
  const registrationNumber = req.body && req.body.registrationNumber;
  if (!registrationNumber || typeof registrationNumber !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid registrationNumber' });
  }
  const normalized = registrationNumber.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) {
    return res.status(400).json({ error: 'Invalid registration number' });
  }
  try {
    const dvlaRes = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DVLA_API_KEY.trim(),
      },
      body: JSON.stringify({ registrationNumber: normalized }),
    });
    const data = await dvlaRes.json().catch(() => ({}));
    res.status(dvlaRes.status).json(data);
  } catch (err) {
    console.error('DVLA proxy error:', err);
    res.status(502).json({ error: 'Failed to reach DVLA API' });
  }
});

app.listen(PORT, () => {
  console.log(`Car Tools server at http://localhost:${PORT}`);
  if (!DVLA_API_KEY || !DVLA_API_KEY.trim()) {
    console.warn('DVLA_API_KEY not set — "Look up from DVLA" will not work until you add it to .env');
  }
});
