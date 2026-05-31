const mongoose = require('mongoose');

const spendSchema = new mongoose.Schema(
  {
    // Where the spend came from: parsed from a BookMyShow email, or entered by hand.
    source: { type: String, enum: ['bms', 'manual'], default: 'manual' },
    // 'cancelled' bookings were refunded — excluded from spend totals and visits.
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    movieTitle: { type: String, default: '' },
    venue: { type: String, default: '' },
    bookingDate: { type: Date, required: true },
    seats: { type: String, default: '' },
    // BMS booking reference, used for de-duplication of re-scraped emails.
    bookingId: { type: String, default: '' },
    // Gmail message id — the strongest dedupe key for email-sourced spend.
    emailId: { type: String, default: '' },
    // Optional link to a logged movie (TMDB id) for non-BMS / in-app entries.
    movieId: { type: String, default: '' },
    // Enriched from TMDB (by title) for BMS bookings: powers time-in-theatre + posters.
    runtime: { type: Number, default: null },
    posterUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

// emailId (Gmail message id) is the reliable dedupe key — sparse-unique so re-running
// a scrape never double-counts, while manual entries (no emailId) stay unconstrained.
// bookingId is NOT unique: BMS parsing of it is best-effort and a booking can recur.
spendSchema.index({ emailId: 1 }, { unique: true, sparse: true });
spendSchema.index({ bookingId: 1 }, { sparse: true });

module.exports = mongoose.model('Spend', spendSchema);
