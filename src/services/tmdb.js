const axios = require('axios');
const { buildMockList, getMockMovieDetails } = require('./mockData');

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

async function fetchPage(endpoint, params = {}) {
  const { data } = await tmdb.get(endpoint, { params: { ...params, page: 1 } });
  return data.results;
}

async function fetchForLanguages(baseParams) {
  const pages = await Promise.all(
    LANGUAGES.map(lang =>
      fetchPage('/discover/movie', { ...baseParams, with_original_language: lang })
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

    const [upcoming, releasedThisYear] = await Promise.all([
      fetchForLanguages({
        'primary_release_date.gte': todayStr,
        'primary_release_date.lte': futureDateStr,
        sort_by: 'primary_release_date.asc',
        'vote_count.gte': 0,
      }),
      fetchForLanguages({
        'primary_release_date.gte': yearStart,
        'primary_release_date.lte': todayStr,
        sort_by: 'primary_release_date.desc',
        'vote_count.gte': 10,
      }),
    ]);

    const result = [
      ...upcoming.map(m => ({ ...attachImageUrls(m), _status: 'upcoming' })),
      ...releasedThisYear.map(m => ({ ...attachImageUrls(m), _status: 'released' })),
    ];
    _cache = result;
    _cacheTime = now;
    console.log(`[tmdb] Loaded ${result.length} movies (ml/ta/te/kn/hi/en)`);
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

module.exports = { getMoviesForApp, getMovieDetails };
