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

module.exports = router;
