const axios = require('axios');
const { buildMockList, getMockMovieDetails, searchMockMovies } = require('./mockData');

const IMAGE_BASE = process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p/w500';

function useMock() {
  return !process.env.TMDB_API_KEY || process.env.TMDB_API_KEY === 'your_tmdb_api_key_here';
}

const tmdb = axios.create({
  baseURL: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  params: { api_key: process.env.TMDB_API_KEY, language: 'en-US' },
});

function attachImageUrls(movie) {
  return {
    ...movie,
    poster_url: movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : null,
    backdrop_url: movie.backdrop_path ? `${IMAGE_BASE}${movie.backdrop_path}` : null,
  };
}

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000;

// Priority order: South Indian languages first, then Hindi, then English
const LANGUAGES = ['ml', 'ta', 'te', 'kn', 'hi', 'en'];
const SOUTH_INDIAN = new Set(['ml', 'ta', 'te', 'kn']);
// Keep in sync with NOW_PLAYING_CUTOFF_DAYS on the mobile home screen.
const NOW_PLAYING_WINDOW_DAYS = 45;

async function fetchPage(endpoint, params = {}) {
  const { data } = await tmdb.get(endpoint, { params: { ...params, page: 1 } });
  return data.results;
}

// `buildParams` may be a plain params object, or a (lang) => params function
// when the query needs to differ per language (e.g. a lower vote bar for regional cinema).
async function fetchForLanguages(buildParams) {
  const make = typeof buildParams === 'function' ? buildParams : () => buildParams;
  const pages = await Promise.all(
    LANGUAGES.map(lang =>
      fetchPage('/discover/movie', { ...make(lang), with_original_language: lang })
    )
  );
  // Merge, deduplicate by id, preserve priority order (first occurrence wins)
  const seen = new Set();
  return pages.flat().filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

async function getMoviesForApp() {
  if (useMock()) {
    console.log('[mock] No TMDB_API_KEY set — using mock movie data');
    return buildMockList();
  }

  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yearStart = `${today.getFullYear()}-01-01`;
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const nowPlayingStart = new Date(today);
    nowPlayingStart.setDate(nowPlayingStart.getDate() - NOW_PLAYING_WINDOW_DAYS);
    const nowPlayingStartStr = nowPlayingStart.toISOString().split('T')[0];

    const [upcoming, nowPlaying, releasedThisYear] = await Promise.all([
      fetchForLanguages({
        'primary_release_date.gte': todayStr,
        'primary_release_date.lte': futureDateStr,
        sort_by: 'primary_release_date.asc',
        'vote_count.gte': 0,
      }),
      // Now Playing — the recent theatrical window. South Indian films accrue TMDB
      // votes slowly, so drop the vote bar to 0 and rank them by popularity; otherwise
      // fresh Malayalam/Tamil/Telugu/Kannada releases never surface here.
      fetchForLanguages(lang => ({
        'primary_release_date.gte': nowPlayingStartStr,
        'primary_release_date.lte': todayStr,
        sort_by: SOUTH_INDIAN.has(lang) ? 'popularity.desc' : 'primary_release_date.desc',
        'vote_count.gte': SOUTH_INDIAN.has(lang) ? 0 : 5,
      })),
      // Older catalog from earlier this year — keep a quality bar to avoid noise.
      fetchForLanguages(lang => ({
        'primary_release_date.gte': yearStart,
        'primary_release_date.lte': todayStr,
        sort_by: 'primary_release_date.desc',
        'vote_count.gte': SOUTH_INDIAN.has(lang) ? 1 : 10,
      })),
    ]);

    // Merge the two released buckets — Now Playing first so recent regional films take
    // priority — then dedupe by id (first occurrence wins, preserving language order).
    const releasedSeen = new Set();
    const released = [...nowPlaying, ...releasedThisYear].filter(m => {
      if (releasedSeen.has(m.id)) return false;
      releasedSeen.add(m.id);
      return true;
    });

    const result = [
      ...upcoming.map(m => ({ ...attachImageUrls(m), _status: 'upcoming' })),
      ...released.map(m => ({ ...attachImageUrls(m), _status: 'released' })),
    ];
    _cache = result;
    _cacheTime = now;
    const npCount = nowPlaying.length;
    console.log(`[tmdb] Loaded ${result.length} movies (ml/ta/te/kn/hi/en) · ${npCount} in now-playing window`);
    return result;
  } catch (err) {
    console.warn('[tmdb] Fetch failed (' + err.message + ') — falling back to mock data');
    return buildMockList();
  }
}

async function getMovieDetails(tmdbId) {
  if (useMock()) {
    const movie = getMockMovieDetails(tmdbId);
    if (!movie) throw new Error('Movie not found in mock data');
    return movie;
  }

  const { data } = await tmdb.get(`/movie/${tmdbId}`, {
    params: { append_to_response: 'credits,videos,images' },
  });
  const director = data.credits?.crew?.find(p => p.job === 'Director')?.name || '';
  return { ...attachImageUrls(data), director };
}

// Search the entire TMDB catalog by title (not limited to the curated home lists)
async function searchMovies(query) {
  const q = (query || '').trim();
  if (!q) return [];

  if (useMock()) {
    return searchMockMovies(q);
  }

  try {
    const { data } = await tmdb.get('/search/movie', {
      params: { query: q, include_adult: false, page: 1 },
    });

    const today = new Date().toISOString().split('T')[0];
    return data.results
      // Drop entries with no title or no release date — they're noise in a tracker
      .filter(m => m.title && m.release_date)
      .map(m => ({
        ...attachImageUrls(m),
        _status: m.release_date > today ? 'upcoming' : 'released',
      }));
  } catch (err) {
    console.warn('[tmdb] Search failed (' + err.message + ') — falling back to mock data');
    return searchMockMovies(q);
  }
}

// Strip language tags / certifications from a BMS title before searching TMDB.
function cleanTitle(t) {
  return (t || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(malayalam|tamil|telugu|kannada|hindi|english|4k|3d|imax)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Resolve a movie title to its TMDB id + runtime + poster (best-effort, for BMS enrichment).
async function findByTitle(rawTitle) {
  const title = cleanTitle(rawTitle);
  if (!title) return null;
  const results = await searchMovies(title);
  if (!results.length) return null;

  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = results.find(r => norm(r.title) === norm(title));
  const pick = exact || results[0];

  try {
    const det = await getMovieDetails(pick.id);
    return {
      movieId: String(pick.id),
      runtime: det.runtime || null,
      posterUrl: pick.poster_url || det.poster_url || '',
      title: pick.title,
    };
  } catch {
    return { movieId: String(pick.id), runtime: null, posterUrl: pick.poster_url || '', title: pick.title };
  }
}

module.exports = { getMoviesForApp, getMovieDetails, searchMovies, findByTitle };
