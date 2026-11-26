const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const claimRoutes = require('./routes/claimRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { UPLOAD_ROOT } = require('./middleware/upload');
const { checkAiHealth } = require('./services/aiServiceClient');

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploaded claim images safely as static assets
app.use('/uploads', express.static(path.resolve(UPLOAD_ROOT)));

app.get('/api/health', async (_req, res) => {
  const aiHealth = await checkAiHealth();
  res.json({
    status: 'ok',
    service: 'vehicle-insurance-fraud-backend',
    timestamp: new Date().toISOString(),
    aiService: aiHealth,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'API endpoint not found.' });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid resource ID format.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal server error.',
  });
});

module.exports = app;
