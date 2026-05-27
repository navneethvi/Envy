const axios = require('axios');
const { buildMockList, getMockMovieDetails } = require('./mockData');

function useMock() {
  return !process.env.OMDB_API_KEY || process.env.OMDB_API_KEY === 'your_omdb_api_key_here';
}

const client = axios.create({ baseURL: 'https://www.omdbapi.com' });

function omdbGet(params) {
  return client.get('/', { params: { ...params, apikey: process.env.OMDB_API_KEY } }).then(r => r.data);
}

// Curated list of major 2025–2026 movies for OMDb lookup.
// OMDb's ?t= does exact-title matching; year narrows it down.
const CURATED = [
  // ── Released 2025 ──────────────────────────────────────────────────
  { title: 'Dog Man',                                   year: '2025' },
  { title: 'Captain America: Brave New World',          year: '2025' },
  { title: 'Companion',                                 year: '2025' },
  { title: 'Mufasa: The Lion King',                     year: '2024' },
  { title: 'Paddington in Peru',                        year: '2024' },
  { title: 'Mickey 17',                                 year: '2025' },
  { title: 'The Amateur',                               year: '2025' },
  { title: 'Warfare',                                   year: '2025' },
  { title: 'Sinners',                                   year: '2025' },
  { title: 'A Minecraft Movie',                         year: '2025' },
  { title: 'Thunderbolts',                              year: '2025' },
  { title: 'Final Destination: Bloodlines',             year: '2025' },
  { title: 'Mission: Impossible - The Final Reckoning', year: '2025' },
  { title: 'Lilo & Stitch',                             year: '2025' },
  { title: 'How to Train Your Dragon',                  year: '2025' },
  { title: 'F1',                                        year: '2025' },
  { title: '28 Years Later',                            year: '2025' },
  { title: 'Jurassic World Rebirth',                    year: '2025' },
  { title: 'Superman',                                  year: '2025' },
  { title: 'The Fantastic Four: First Steps',           year: '2025' },
  { title: 'Zootopia 2',                                year: '2025' },
  { title: 'Avatar: Fire and Ash',                      year: '2025' },
  // ── 2026 ──────────────────────────────────────────────────────────
  { title: 'Eddington',                                 year: '2026' },
  { title: 'Materialists',                              year: '2026' },
];

// ── Parsers ──────────────────────────────────────────────────────────

// "26 Apr 2019" → "2019-04-26"
function parseDate(released) {
  if (!released || released === 'N/A') return null;
  try {
    const d = new Date(released);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

// "169 min" → 169
function parseRuntime(rt) {
  if (!rt || rt === 'N/A') return null;
  const m = rt.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

// "Action, Adventure, Drama" → [{id, name}, ...]
function parseGenres(genre) {
  if (!genre || genre === 'N/A') return [];
  return genre.split(', ').map((name, i) => ({ id: i + 1, name }));
}

function normalize(data, internalId) {
  return {
    id: internalId ?? data.imdbID,
    imdbID: data.imdbID,
    title: data.Title,
    release_date: parseDate(data.Released),
    overview: data.Plot !== 'N/A' ? data.Plot : '',
    director: data.Director !== 'N/A' ? data.Director.split(', ')[0] : '',
    runtime: parseRuntime(data.Runtime),
    vote_average: data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : 0,
    genres: parseGenres(data.Genre),
    poster_url: (data.Poster && data.Poster !== 'N/A') ? data.Poster : null,
    backdrop_url: null,
  };
}

// ── In-memory cache (refreshed every 6 hours) ────────────────────────
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000;

async function fetchAllFromOmdb() {
  const results = await Promise.allSettled(
    CURATED.map(({ title, year }) =>
      omdbGet({ t: title, y: year, plot: 'full' })
    )
  );

  const movies = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.Response === 'True') {
      const data = r.value;
      const releaseDate = parseDate(data.Released);
      if (releaseDate) {
        movies.push(normalize(data, data.imdbID));
      } else {
        console.warn(`[omdb] No parsed date for "${data.Title}"`);
      }
    } else {
      console.warn(`[omdb] Not found: "${CURATED[i].title} (${CURATED[i].year})"`);
    }
  });

  return movies;
}

function sortMovies(movies) {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = movies
    .filter(m => m.release_date >= today)
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .map(m => ({ ...m, _status: 'upcoming' }));

  const released = movies
    .filter(m => m.release_date < today)
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .map(m => ({ ...m, _status: 'released' }));

  return [...upcoming, ...released];
}

// ── Public API ───────────────────────────────────────────────────────

async function getMoviesForApp() {
  if (useMock()) {
    console.log('[mock] No OMDB_API_KEY set — using mock movie data');
    return buildMockList();
  }

  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  console.log('[omdb] Fetching movie list from OMDb...');
  try {
    const movies = await fetchAllFromOmdb();

    if (movies.length === 0) {
      console.warn('[omdb] API returned 0 movies (key may not be activated) — falling back to mock data');
      return buildMockList();
    }

    const sorted = sortMovies(movies);
    _cache = sorted;
    _cacheTime = now;
    console.log(`[omdb] Loaded ${sorted.length} movies (${sorted.filter(m => m._status === 'upcoming').length} upcoming)`);
    return sorted;
  } catch (err) {
    console.warn('[omdb] Fetch failed (' + err.message + ') — falling back to mock data');
    return buildMockList();
  }
}

async function getMovieDetails(id) {
  if (useMock()) {
    const mock = getMockMovieDetails(id);
    if (!mock) throw new Error('Movie not found');
    return mock;
  }

  try {
    // Numeric id = mock TMDB id (mock mode), tt-prefixed = OMDb IMDB id
    const params = String(id).startsWith('tt')
      ? { i: id, plot: 'full' }
      : { t: getMockMovieDetails(id)?.title, plot: 'full' };

    const { data } = await client.get('/', {
      params: { ...params, apikey: process.env.OMDB_API_KEY },
    });

    if (data.Response === 'False') throw new Error('Not found in OMDb');
    return { ...normalize(data, id), _status: null };
  } catch {
    const mock = getMockMovieDetails(id);
    if (!mock) throw new Error('Movie not found');
    return mock;
  }
}

module.exports = { getMoviesForApp, getMovieDetails };
