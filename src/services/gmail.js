const { google } = require('googleapis');
const GmailToken = require('../models/GmailToken');

// Read-only — the app can never modify or send mail, only read it.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Gmail search query: any sender whose address/domain contains "bookmyshow".
const BMS_QUERY = 'from:bookmyshow';

function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in .env');
  }
  const redirect = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/spend/oauth-callback';
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirect);
}

// Step 1 of setup — the consent URL the user opens once in a browser.
function getAuthUrl() {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',   // ask for a refresh token
    prompt: 'consent',        // force a refresh token even on re-consent
    scope: SCOPES,
  });
}

// Step 2 — exchange the ?code= from the redirect for tokens and persist the refresh token.
async function handleCallback(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and re-authorize.');
  }
  client.setCredentials(tokens);

  let email = '';
  try {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    email = profile.data.emailAddress || '';
  } catch { /* non-fatal */ }

  await GmailToken.findOneAndUpdate(
    {},
    { refreshToken: tokens.refresh_token, email, connectedAt: new Date() },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return { email };
}

async function getStatus() {
  const tok = await GmailToken.findOne();
  return tok ? { connected: true, email: tok.email, connectedAt: tok.connectedAt } : { connected: false };
}

async function authorizedClient() {
  const tok = await GmailToken.findOne();
  if (!tok?.refreshToken) {
    throw new Error('Gmail not connected. Open /api/spend/auth-url and authorize first.');
  }
  const client = oauthClient();
  client.setCredentials({ refresh_token: tok.refreshToken });
  return client;
}

// Decode a base64url Gmail body part to a UTF-8 string.
function decodePart(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

// Walk the MIME tree, collecting text/plain (preferred) and text/html bodies.
function extractBodies(payload) {
  let text = '';
  let html = '';
  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || '';
    if (mime === 'text/plain' && part.body?.data) text += decodePart(part.body.data);
    else if (mime === 'text/html' && part.body?.data) html += decodePart(part.body.data);
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return { text, html };
}

function headerValue(headers, name) {
  const h = (headers || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

function normalizeMessage(msg) {
  const headers = msg.payload?.headers || [];
  const { text, html } = extractBodies(msg.payload);
  return {
    id: msg.id,
    subject: headerValue(headers, 'Subject'),
    from: headerValue(headers, 'From'),
    date: headerValue(headers, 'Date'),
    internalDate: msg.internalDate ? new Date(Number(msg.internalDate)) : null,
    snippet: msg.snippet || '',
    text,
    html,
  };
}

// Fetch BookMyShow booking emails (paginated, capped).
async function fetchBmsEmails({ maxResults = 250, query } = {}) {
  const auth = await authorizedClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const q = query || BMS_QUERY;

  const ids = [];
  let pageToken;
  do {
    const { data } = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100, pageToken });
    (data.messages || []).forEach(m => ids.push(m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < maxResults);

  const messages = [];
  for (const id of ids.slice(0, maxResults)) {
    try {
      const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      messages.push(normalizeMessage(data));
    } catch { /* skip unreadable message */ }
  }
  return messages;
}

module.exports = { getAuthUrl, handleCallback, getStatus, fetchBmsEmails, BMS_QUERY };
