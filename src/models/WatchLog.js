const mongoose = require('mongoose');

const watchLogSchema = new mongoose.Schema(
  {
    // movieId works as both TMDB numeric ID and OMDb IMDB ID (tt-prefixed string)
    movieId: { type: String, required: true, unique: true },
    movieTitle: { type: String, required: true },
    posterUrl: { type: String },
    director: { type: String, default: '' },
    releaseYear: { type: String, default: '' },
    rating: { type: Number, min: 0.5, max: 5, required: true },
    review: { type: String, default: '' },
    watchedAt: { type: Date, required: true },
    theaterName: { type: String, default: '' },
    logNumber: { type: Number },
    // Times this movie was watched in a theatre (1 = watched once, no rewatches).
    rewatchCount: { type: Number, default: 1, min: 1 },
    // Movie runtime in minutes — captured at log time, powers time-spent analytics.
    runtime: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WatchLog', watchLogSchema);
