const express = require('express');
const router = express.Router();
const { getMoviesForApp, getMovieDetails } = require('../services/tmdb');
const WatchLog = require('../models/WatchLog');

// GET /api/movies
router.get('/', async (req, res) => {
  try {
    const movies = await getMoviesForApp();
    res.json({ success: true, count: movies.length, data: movies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/movies/:id
router.get('/:id', async (req, res) => {
  try {
    const movie = await getMovieDetails(req.params.id);
    const log = await WatchLog.findOne({ movieId: req.params.id });
    res.json({ success: true, data: movie, watchLog: log || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/movies/:id/log
router.post('/:id/log', async (req, res) => {
  try {
    const { rating, review, watchedAt, theaterName, movieTitle, posterUrl, director, releaseYear } = req.body;
    const movieId = req.params.id;

    if (!rating || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0) {
      return res.status(400).json({ success: false, error: 'Rating must be 0.5–5 in half-star increments' });
    }
    if (!watchedAt) {
      return res.status(400).json({ success: false, error: 'watchedAt is required' });
    }

    const existing = await WatchLog.findOne({ movieId });
    let logNumber = existing?.logNumber;
    if (!logNumber) {
      logNumber = (await WatchLog.countDocuments()) + 1;
    }

    const log = await WatchLog.findOneAndUpdate(
      { movieId },
      { movieId, movieTitle, posterUrl, director, releaseYear, rating, review, watchedAt: new Date(watchedAt), theaterName, logNumber },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/movies/:id/log
router.delete('/:id/log', async (req, res) => {
  try {
    await WatchLog.findOneAndDelete({ movieId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
