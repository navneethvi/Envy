const express = require('express');
const router = express.Router();
const Spend = require('../models/Spend');
const gmail = require('../services/gmail');
const { parseBmsEmail, isCancellation, getBookingId } = require('../services/bmsParser');
const tmdb = require('../services/tmdb');

// Enrich BMS bookings (which only have a title) with TMDB id + runtime + poster,
// so time-in-theatre and posters work and items become tappable. Idempotent.
async function enrichBmsRecords() {
  const pending = await Spend.find({
    source: 'bms',
    $or: [{ movieId: '' }, { movieId: null }, { runtime: null }],
  });
  const titles = [...new Set(pending.map(s => s.movieTitle).filter(Boolean))];
  let enriched = 0, failed = 0;
  for (const title of titles) {
    try {
      const info = await tmdb.findByTitle(title);
      if (info) {
        await Spend.updateMany(
          { source: 'bms', movieTitle: title },
          { movieId: info.movieId, runtime: info.runtime, posterUrl: info.posterUrl }
        );
        enriched++;
      } else { failed++; }
    } catch { failed++; }
  }
  return { titles: titles.length, enriched, failed };
}

// GET /api/spend — all spend records, newest booking first
router.get('/', async (req, res) => {
  try {
    const items = await Spend.find().sort({ bookingDate: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Gmail OAuth (one-time setup) ─────────────────────────────────────

// GET /api/spend/gmail/status — is the app connected to Gmail?
router.get('/gmail/status', async (req, res) => {
  try {
    res.json({ success: true, ...(await gmail.getStatus()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/spend/auth-url — open this in a browser once to authorize read-only Gmail.
router.get('/auth-url', (req, res) => {
  try {
    res.json({ success: true, url: gmail.getAuthUrl() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/spend/oauth-callback?code=... — Google redirects here after consent.
router.get('/oauth-callback', async (req, res) => {
  try {
    if (req.query.error) return res.status(400).send(`Authorization failed: ${req.query.error}`);
    if (!req.query.code) return res.status(400).send('Missing authorization code.');
    const { email } = await gmail.handleCallback(req.query.code);
    res.send(`<html><body style="font-family:sans-serif;background:#0d0d0d;color:#fff;text-align:center;padding-top:80px">
      <h2>✅ Gmail connected${email ? ` (${email})` : ''}</h2>
      <p>You can close this tab and return to the app, then tap <b>Sync BMS</b>.</p></body></html>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// POST /api/spend/scrape?dryRun=true — read BMS emails, parse, and (unless dryRun) upsert.
router.post('/scrape', async (req, res) => {
  try {
    const dryRun = String(req.query.dryRun) === 'true';
    // Targeted query: transactional subjects only (bookings + cancellations), skipping
    // promo blasts — so we capture every booking AND every refund, not a recency slice.
    const query = 'from:bookmyshow subject:(ticket OR tickets OR booking OR confirmed OR cancel OR cancelled OR cancellation OR refund)';
    const messages = await gmail.fetchBmsEmails({ maxResults: Number(req.query.max) || 400, query });

    // Split bookings from cancellation/refund emails.
    const parsed = [];
    const cancelledBookingIds = new Set();
    const cancelEmailIds = new Set();
    for (const m of messages) {
      if (isCancellation(m)) {
        cancelEmailIds.add(m.id);
        const bid = getBookingId(m);
        if (bid) cancelledBookingIds.add(bid);
      } else {
        const rec = parseBmsEmail(m);
        if (rec) parsed.push(rec);
      }
    }

    if (dryRun) {
      return res.json({
        success: true, dryRun: true, emails: messages.length,
        parsed: parsed.length, cancellations: cancelEmailIds.size,
        cancelledBookingIds: [...cancelledBookingIds], data: parsed,
      });
    }

    let inserted = 0, updated = 0;
    for (const rec of parsed) {
      const existing = await Spend.findOne({ emailId: rec.emailId });
      await Spend.findOneAndUpdate({ emailId: rec.emailId }, rec, { upsert: true, setDefaultsOnInsert: true });
      existing ? updated++ : inserted++;
    }

    // Remove any cancellation/refund emails that an earlier scrape mis-saved as bookings.
    const removed = await Spend.deleteMany({ emailId: { $in: [...cancelEmailIds] } });
    // Mark the original bookings of cancelled shows as refunded (excluded from totals/visits).
    let cancelled = 0;
    if (cancelledBookingIds.size) {
      const r = await Spend.updateMany(
        { source: 'bms', bookingId: { $in: [...cancelledBookingIds] } },
        { status: 'cancelled' }
      );
      cancelled = r.modifiedCount || 0;
    }

    // Enrich any (confirmed) bookings still missing TMDB metadata.
    const enrichment = await enrichBmsRecords();
    const total = await Spend.countDocuments();
    res.json({
      success: true, emails: messages.length, parsed: parsed.length,
      inserted, updated, removedCancellationEmails: removed.deletedCount || 0,
      cancelledBookings: cancelled, total, enrichment,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/spend/enrich — fill in TMDB runtime/poster/id for BMS bookings.
router.post('/enrich', async (req, res) => {
  try {
    res.json({ success: true, ...(await enrichBmsRecords()) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function normalize(body) {
  const { source, amount, currency, movieTitle, venue, bookingDate, seats, bookingId, emailId, movieId } = body;
  return {
    source: source === 'bms' ? 'bms' : 'manual',
    amount: Number(amount),
    currency: currency || 'INR',
    movieTitle: movieTitle || '',
    venue: venue || '',
    bookingDate: bookingDate ? new Date(bookingDate) : new Date(),
    seats: seats || '',
    bookingId: bookingId || '',
    emailId: emailId || '',
    movieId: movieId || '',
  };
}

// Upsert a single record by its strongest available dedupe key.
async function upsertOne(doc) {
  if (doc.emailId) {
    return Spend.findOneAndUpdate({ emailId: doc.emailId }, doc, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  }
  if (doc.bookingId) {
    return Spend.findOneAndUpdate({ bookingId: doc.bookingId }, doc, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  }
  return Spend.create(doc);
}

// POST /api/spend — add one spend (manual ticket or a single parsed booking)
router.post('/', async (req, res) => {
  try {
    if (req.body.amount == null || isNaN(Number(req.body.amount)) || Number(req.body.amount) < 0) {
      return res.status(400).json({ success: false, error: 'A valid amount is required' });
    }
    const item = await upsertOne(normalize(req.body));
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/spend/bulk — seed many records at once (used by the email backfill).
// De-dupes by emailId/bookingId, so it's safe to re-run.
router.post('/bulk', async (req, res) => {
  try {
    const records = Array.isArray(req.body.records) ? req.body.records : [];
    if (!records.length) {
      return res.status(400).json({ success: false, error: 'records array is required' });
    }
    let inserted = 0, updated = 0, skipped = 0;
    for (const raw of records) {
      if (raw.amount == null || isNaN(Number(raw.amount))) { skipped++; continue; }
      const doc = normalize(raw);
      const existing = (doc.emailId && await Spend.findOne({ emailId: doc.emailId }))
        || (doc.bookingId && await Spend.findOne({ bookingId: doc.bookingId }));
      await upsertOne(doc);
      existing ? updated++ : inserted++;
    }
    const total = await Spend.countDocuments();
    res.json({ success: true, inserted, updated, skipped, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/spend/:id
router.delete('/:id', async (req, res) => {
  try {
    await Spend.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
