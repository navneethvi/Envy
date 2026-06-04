// Parser for BookMyShow booking-confirmation emails.
// Calibrated against real emails — the booking block is consistently:
//   Booking ID PRCC0000766647
//   <Movie> (UA16+)
//   11:30am | Sun, 31 May, 2026
//   <Cinema>: <Location>(SCREEN n)
// Use the scrape endpoint's dryRun mode to verify before committing.

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|tr|table|br|li|h[1-6]|span|td)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ' '; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ' '; } })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function toNumber(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseLabelledAmount(text) {
  const labelled = [
    /(?:total amount paid|amount paid|order total|grand total|total payable|you paid|net amount|booking amount|ticket amount|amount)\s*[:\-]?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\(total\)|paid)/i,
  ];
  for (const re of labelled) {
    const m = text.match(re);
    if (m) { const n = toNumber(m[1]); if (n != null) return n; }
  }
  return null;
}

function parseMaxAmount(text) {
  const all = [...text.matchAll(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi)]
    .map(m => toNumber(m[1]))
    .filter(n => n != null && n >= 20 && n <= 100000);
  return all.length ? Math.max(...all) : null;
}

function isBookingEmail(text, bookingId) {
  if (bookingId) return true;
  const s = text.toLowerCase();
  return /booking confirmed|booking is confirmed|booking id|your ticket|m-?ticket|e-?ticket|tickets?\s+(?:for|booked|confirmed)/.test(s);
}

// "Sun, 31 May, 2026" / "31 May 2026" → Date (the actual showtime)
function parseShowDate(text) {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (mon == null) return null;
  const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[1]), 6, 0, 0)); // noon-ish IST
  return isNaN(d.getTime()) ? null : d;
}

function parseBookingId(text) {
  // Labelled form: "Booking ID / Booking Ref / Booking No : PRCC0000694061"
  let m = text.match(/booking\s*(?:id|ref(?:erence)?|no\.?)?\s*[:\-#]?\s*([A-Z]{2,}[A-Z0-9]{4,})/i);
  if (m) return m[1].toUpperCase();
  // Fallback: a bare BMS reference token (letters + 8+ digits, e.g. PRCC0000694061)
  // anywhere in the email. Refund/cancellation emails often drop the "Booking ID"
  // label but still quote the reference, so this is what lets a refund match its booking.
  m = text.match(/\b([A-Z]{3,5}\d{8,})\b/);
  return m ? m[1].toUpperCase() : '';
}

// Best-effort seat extraction. Anchored on a "seat(s)" label to avoid matching the
// venue/screen text — captures labels like "G7, G8" or a plain ticket count.
function parseSeats(text) {
  const labelled = text.match(
    /seat(?:\s*nos?)?(?:\(s\))?s?\s*[:\-]?\s*((?:[A-Z]{1,2}[-\s]?\d{1,3})(?:\s*[,&]\s*[A-Z]{1,2}[-\s]?\d{1,3})*)/i
  );
  if (labelled) {
    return labelled[1].replace(/\s*[,&]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  }
  const count = text.match(/(\d+)\s*(?:tickets?|seats?)\b/i);
  if (count && Number(count[1]) > 0 && Number(count[1]) <= 30) return count[1];
  return '';
}

function stripCert(s) {
  return s.replace(/\s*\((?:U\/?A?\d*\+?|A|U|PG(?:-13)?|UA\d*\+?)\)\s*$/i, '').trim();
}

// Line-based extraction anchored on the showtime line.
function parseMovieVenue(lines) {
  const timeIdx = lines.findIndex(l => /\d{1,2}:\d{2}\s*(am|pm)/i.test(l));
  let movieTitle = '';
  let venue = '';

  if (timeIdx > 0) {
    // Movie = the meaningful line just above the showtime, skipping noise.
    for (let i = timeIdx - 1; i >= 0 && i >= timeIdx - 4; i--) {
      const l = lines[i];
      if (!l) continue;
      if (/booking id|your booking|bookmyshow|confirmed/i.test(l)) continue;
      movieTitle = stripCert(l);
      break;
    }
    // Venue = the line after the date line that follows the showtime.
    for (let i = timeIdx; i < lines.length && i <= timeIdx + 4; i++) {
      if (/\d{4}/.test(lines[i]) && /[A-Za-z]{3,9}/.test(lines[i]) && /:|\(screen|cinema|pvr|inox|cinepolis|carnival|miraj|mall/i.test(lines[i + 1] || '')) {
        venue = (lines[i + 1] || '').trim();
        break;
      }
    }
    // Fallback: any nearby line that names a cinema/screen.
    if (!venue) {
      for (let i = timeIdx; i < lines.length && i <= timeIdx + 5; i++) {
        if (/:.*\(screen|cinema|pvr|inox|cinepolis|carnival|miraj|:\s*\w+\(/i.test(lines[i])) { venue = lines[i].trim(); break; }
      }
    }
  }
  return { movieTitle, venue: venue.replace(/\s+/g, ' ').slice(0, 120) };
}

// BMS sometimes ships HTML inside the text/plain part, so always strip if it looks like HTML.
function messageText(msg) {
  const rawHtml = (msg.html && msg.html.length > 40) ? msg.html : '';
  const rawText = msg.text || '';
  let text;
  if (rawHtml) text = htmlToText(rawHtml);
  else text = /<[a-z][\s\S]*?>/i.test(rawText) ? htmlToText(rawText) : rawText;
  if ((!text || text.length < 30) && msg.snippet) text = msg.snippet;
  return text;
}

// A cancellation / refund email (NOT a booking). The subject is the reliable signal —
// "BookMyShow Cancellation Refund", "BookMyShow Refund". (Booking emails only mention
// "cancellation policy" in the footer body, never in the subject.)
function isCancellation(msg) {
  return /\b(cancel|cancelled|cancellation|refund)\b/i.test(msg.subject || '');
}

// Booking reference (PRCC...) — used to match a cancellation back to its booking.
function getBookingId(msg) {
  return parseBookingId(messageText(msg));
}

function parseBmsEmail(msg) {
  // Never treat a cancellation/refund email as a booking.
  if (isCancellation(msg)) return null;

  const text = messageText(msg);
  const haystack = `${msg.subject}\n${text}`;
  const bookingId = parseBookingId(text);

  let amount = parseLabelledAmount(haystack);
  if (amount == null && isBookingEmail(haystack, bookingId)) amount = parseMaxAmount(haystack);
  if (amount == null) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const { movieTitle, venue } = parseMovieVenue(lines);

  const bookingDate = parseShowDate(text) || msg.internalDate || (msg.date ? new Date(msg.date) : new Date());

  return {
    source: 'bms',
    amount,
    currency: 'INR',
    movieTitle,
    venue,
    bookingDate,
    seats: parseSeats(haystack),
    bookingId,
    emailId: msg.id,
    status: 'confirmed',
  };
}

module.exports = { parseBmsEmail, htmlToText, isCancellation, getBookingId };
