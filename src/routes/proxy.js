const express = require('express');
const router = express.Router();
const axios = require('axios');

const ALLOWED_HOSTS = ['image.tmdb.org', 'm.media-amazon.com'];

// Proxy movie poster images to avoid CORS issues when capturing canvas on web
router.get('/image', async (req, res) => {
  const { url } = req.query;
  let hostname;
  try { hostname = new URL(url).hostname; } catch { hostname = ''; }
  if (!url || !ALLOWED_HOSTS.includes(hostname)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch image' });
  }
});

module.exports = router;
