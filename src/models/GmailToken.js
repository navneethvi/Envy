const mongoose = require('mongoose');

// Single-document store for the app's read-only Gmail refresh token.
// Lets the user authorize once; the backend then mints access tokens on demand.
const gmailTokenSchema = new mongoose.Schema(
  {
    refreshToken: { type: String, required: true },
    email: { type: String, default: '' },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GmailToken', gmailTokenSchema);
