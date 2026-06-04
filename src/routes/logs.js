const express = require('express');
const router = express.Router();
const WatchLog = require('../models/WatchLog');

// GET /api/logs — all watch logs, newest watched first
router.get('/', async (req, res) => {
  try {
    const logs = await WatchLog.find().sort({ watchedAt: -1 });
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/logs/:movieId — update rewatch count, runtime, genres or releaseYear.
// Used by the rewatch stepper and by the profile screen's analytics backfill.
router.patch('/:movieId', async (req, res) => {
  try {
    const { rewatchCount, runtime, genres, releaseYear } = req.body;
    const update = {};
    if (rewatchCount != null) {
      if (rewatchCount < 1) {
        return res.status(400).json({ success: false, error: 'rewatchCount must be at least 1' });
      }
      update.rewatchCount = rewatchCount;
    }
    if (runtime != null) update.runtime = runtime;
    if (Array.isArray(genres)) update.genres = genres;
    if (releaseYear != null && releaseYear !== '') update.releaseYear = releaseYear;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: 'Nothing to update' });
    }

    const log = await WatchLog.findOneAndUpdate(
      { movieId: req.params.movieId },
      update,
      { returnDocument: 'after' }
    );
    if (!log) return res.status(404).json({ success: false, error: 'Log not found' });

    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/logs/:id — remove a watch log by its _id.
router.delete('/:id', async (req, res) => {
  try {
    const log = await WatchLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: 'Log not found' });
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
