const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  movieId:    { type: String, required: true, unique: true },
  movieTitle: { type: String, required: true },
  posterUrl:  { type: String, default: null },
  releaseDate:{ type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Watchlist', schema);
