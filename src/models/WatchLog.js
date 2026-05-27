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
  },
  { timestamps: true }
);

module.exports = mongoose.model('WatchLog', watchLogSchema);
