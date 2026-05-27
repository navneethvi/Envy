require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const moviesRouter = require('./routes/movies');
const logsRouter = require('./routes/logs');
const proxyRouter = require('./routes/proxy');
const watchlistRouter = require('./routes/watchlist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/movies', moviesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/watchlist', watchlistRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
