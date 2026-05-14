import express from 'express';

const app = express();
const PORT = 3000;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ALLOWED_ENDPOINTS = new Set(['weather', 'forecast', 'air_pollution']);

app.use(express.static('.'));

app.get('/api/weather', async (req, res) => {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server is missing OPENWEATHER_API_KEY' });
  }

  const { endpoint, q, lat, lon, units } = req.query;

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  const params = new URLSearchParams({ appid: key });
  if (q) params.set('q', q);
  if (lat) params.set('lat', lat);
  if (lon) params.set('lon', lon);
  if (units) params.set('units', units);

  try {
    const upstream = await fetch(`${BASE_URL}/${endpoint}?${params}`);
    const body = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(body);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Local dev server running at http://localhost:${PORT}`);
});
