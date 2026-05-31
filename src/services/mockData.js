// Real movies with public TMDB poster paths — used when TMDB_API_KEY is not set
// Posters served directly from image.tmdb.org (no API key needed for images)

const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

const MOCK_MOVIES = [
  // ── Upcoming (2026) ────────────────────────────────────────────────
  { id: 911430, title: 'F1', release_date: '2026-06-27', director: 'Joseph Kosinski',
    poster_path: '/vqBmyAj0Xm9LnS1xe1MSlMAJyHq.jpg',
    overview: 'Brad Pitt plays a Formula One driver who comes out of retirement to mentor a young teammate.',
    genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }], runtime: null, vote_average: 0 },
  { id: 1136867, title: 'Materialists', release_date: '2026-06-13', director: 'Celine Song',
    poster_path: '/eDo0pNruy0Qgj6BdTyHIR4cxHY8.jpg',
    overview: 'A matchmaker becomes entangled between her ex and a new match.',
    genres: [{ id: 10749, name: 'Romance' }, { id: 35, name: 'Comedy' }], runtime: null, vote_average: 0 },
  { id: 648878, title: 'Eddington', release_date: '2026-07-18', director: 'Ari Aster',
    poster_path: '/4GIqZUgPZ146BhibsPHMHef2nXX.jpg',
    overview: 'A small-town sheriff navigates a fractured America during the COVID-19 pandemic.',
    genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }], runtime: null, vote_average: 0 },
  { id: 912649, title: 'Venom: The Last Dance', release_date: '2026-08-28', director: 'Kelly Marcel',
    poster_path: '/vGXptEdgZIhPg3cGlc7e8sNPC2e.jpg',
    overview: 'Eddie and Venom face their greatest threat yet in the final chapter.',
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }], runtime: null, vote_average: 0 },
  { id: 558449, title: 'Gladiator II', release_date: '2026-09-04', director: 'Ridley Scott',
    poster_path: '/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
    overview: 'Lucius must enter the Colosseum after his home is conquered by tyrannical emperors.',
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }], runtime: null, vote_average: 0 },
  { id: 845781, title: 'Mission: Impossible – The Final Reckoning', release_date: '2026-05-23', director: 'Christopher McQuarrie',
    poster_path: '/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg',
    overview: 'Ethan Hunt faces a rogue AI with the power to rewrite history.',
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }], runtime: 169, vote_average: 0 },
  { id: 552524, title: 'Lilo & Stitch', release_date: '2026-05-23', director: 'Dean Fleischer Camp',
    poster_path: '/ckQzKpQJO4ZQDCN5evdpKcfm7Ys.jpg',
    overview: 'Live-action reimagining of the beloved Disney animated film.',
    genres: [{ id: 35, name: 'Comedy' }, { id: 10751, name: 'Family' }], runtime: null, vote_average: 0 },
  { id: 574475, title: 'Final Destination: Bloodlines', release_date: '2026-05-16', director: 'Zach Lipovsky',
    poster_path: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
    overview: 'A college student is plagued by a recurring vision of a deadly catastrophe.',
    genres: [{ id: 27, name: 'Horror' }, { id: 53, name: 'Thriller' }], runtime: null, vote_average: 0 },

  // ── Released 2026 ──────────────────────────────────────────────────
  { id: 986056, title: 'Thunderbolts*', release_date: '2026-04-30', director: 'Jake Schreier',
    poster_path: '/hqcexYHbiTBfDIdDWxrxPtVndBX.jpg',
    overview: 'A group of Marvel antiheroes and villains are brought together for a government mission.',
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 878, name: 'Science Fiction' }], runtime: 127, vote_average: 7.2 },
  { id: 1087891, title: 'The Amateur', release_date: '2026-04-11', director: 'James Hawes',
    poster_path: '/SNEoUInCa5fAgwuEBMIMBGvkkh.jpg',
    overview: 'A CIA cryptographer takes matters into his own hands after his wife is killed.',
    genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }], runtime: 117, vote_average: 7.0 },
  { id: 950387, title: 'A Minecraft Movie', release_date: '2026-04-04', director: 'Jared Hess',
    poster_path: '/yFHHfHcUgGAxziP1C3lLt0q2T4s.jpg',
    overview: 'Four misfits find themselves struggling in the Overworld.',
    genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 35, name: 'Comedy' }], runtime: 101, vote_average: 6.7 },
  { id: 762509, title: 'Mufasa: The Lion King', release_date: '2026-01-24', director: 'Barry Jenkins',
    poster_path: '/jbOSUAWMGzGL1L4EaUF8K6zYFo7.jpg',
    overview: 'The origin story of Mufasa, a lion cub orphaned after a tragedy.',
    genres: [{ id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' }, { id: 18, name: 'Drama' }], runtime: 118, vote_average: 7.1 },
  { id: 696506, title: 'Mickey 17', release_date: '2026-03-07', director: 'Bong Joon-ho',
    poster_path: '/edKpE9B5qN3e559OuMCLZdW1iBZ.jpg',
    overview: 'An expendable employee gets duplicated and the two must decide who keeps living.',
    genres: [{ id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }, { id: 35, name: 'Comedy' }], runtime: 137, vote_average: 7.0 },
  { id: 1084199, title: 'Companion', release_date: '2026-01-31', director: 'Drew Hancock',
    poster_path: '/oCoTgC3UyWGfyQ9thE10ulWR7bn.jpg',
    overview: 'A romantic getaway turns sinister when the true nature of a perfect partner is revealed.',
    genres: [{ id: 27, name: 'Horror' }, { id: 878, name: 'Science Fiction' }, { id: 53, name: 'Thriller' }], runtime: 100, vote_average: 7.3 },
  { id: 774370, title: 'Dog Man', release_date: '2026-01-31', director: 'Peter Ramsey',
    poster_path: '/89wNiexZdvLQ41OQWIsQy4O6jAQ.jpg',
    overview: 'An animated adventure about a hero who is part dog, part police officer.',
    genres: [{ id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' }, { id: 10751, name: 'Family' }], runtime: 90, vote_average: 7.0 },
  { id: 1205412, title: 'Severance: Into the Severed World', release_date: '2026-03-21', director: 'Ben Stiller',
    poster_path: '/AnI5jipbxwJg942QWy1KIeecMll.jpg',
    overview: 'A feature film set in the world of the acclaimed Apple TV+ series Severance.',
    genres: [{ id: 53, name: 'Thriller' }, { id: 878, name: 'Science Fiction' }], runtime: null, vote_average: 0 },
];

function buildMockList() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yearStart = `${today.getFullYear()}-01-01`;

  const upcoming = MOCK_MOVIES
    .filter(m => m.release_date >= todayStr)
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .map(m => ({ ...m, poster_url: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : null, _status: 'upcoming' }));

  const released = MOCK_MOVIES
    .filter(m => m.release_date >= yearStart && m.release_date < todayStr)
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .map(m => ({ ...m, poster_url: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : null, _status: 'released' }));

  return [...upcoming, ...released];
}

function getMockMovieDetails(tmdbId) {
  const movie = MOCK_MOVIES.find(m => m.id === Number(tmdbId));
  if (!movie) return null;
  return {
    ...movie,
    poster_url: movie.poster_path ? `${IMAGE_BASE}${movie.poster_path}` : null,
  };
}

function searchMockMovies(query) {
  const today = new Date().toISOString().split('T')[0];
  const q = query.trim().toLowerCase();
  return MOCK_MOVIES
    .filter(m => m.title.toLowerCase().includes(q))
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .map(m => ({
      ...m,
      poster_url: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : null,
      _status: m.release_date > today ? 'upcoming' : 'released',
    }));
}

module.exports = { buildMockList, getMockMovieDetails, searchMockMovies };
