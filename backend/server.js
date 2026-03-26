require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = allowedOrigins.length
  ? {
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin not allowed by CORS'));
      },
    }
  : { origin: true };

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Loan Management API' });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Mount API routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
// Other API routes
const customersRoutes = require('./routes/customers');
const loansRoutes = require('./routes/loans');
const activitiesRoutes = require('./routes/activities');
const lendersRoutes = require('./routes/lenders');
const usersRoutes = require('./routes/users');

app.use('/api/customers', customersRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/lenders', lendersRoutes);
app.use('/api/users', usersRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ message: err.message });
  }

  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loancrm';
let serverStarted = false;

function startServer() {
  if (!serverStarted) {
    serverStarted = true;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. API is continuing in degraded mode.');
});

startServer();

// Connect to MongoDB without blocking API startup.
mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.warn('Continuing without MongoDB. Lender logins will use demo data until the database is available.');
  });

module.exports = app;
