// Vercel Serverless Function for DVLA Vehicle Lookup
// This acts as a proxy to keep the API key secret and handle CORS.

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { registrationNumber } = req.body;
  const apiKey = process.env.DVLA_API_KEY;

  if (!registrationNumber) {
    return res.status(400).json({ error: 'registrationNumber is required' });
  }

  if (!apiKey) {
    console.error('DVLA_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const dvlaResponse = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({ registrationNumber })
    });

    if (!dvlaResponse.ok) {
      const errorData = await dvlaResponse.json().catch(() => ({}));
      return res.status(dvlaResponse.status).json({
        error: 'DVLA API error',
        details: errorData
      });
    }

    const data = await dvlaResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
