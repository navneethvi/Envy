const express = require('express');
const router = express.Router();
const Watchlist = require('../models/Watchlist');

router.get('/', async (req, res) => {
  try {
    const items = await Watchlist.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { movieId, movieTitle, posterUrl, releaseDate } = req.body;
    const item = await Watchlist.findOneAndUpdate(
      { movieId },
      { movieId, movieTitle, posterUrl, releaseDate },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Watchlist.findOneAndDelete({ movieId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
