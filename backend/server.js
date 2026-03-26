require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const shouldUseInMemoryDb = process.env.USE_IN_MEMORY_DB === 'true';
let activeDatabaseMode = 'disconnected';
let inMemoryMongoServer = null;

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
    databaseMode: activeDatabaseMode,
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
const enquiriesRoutes = require('./routes/enquiries');
const leadsRoutes = require('./routes/leads');
const usersRoutes = require('./routes/users');

app.use('/api/customers', customersRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/lenders', lendersRoutes);
app.use('/api/enquiries', enquiriesRoutes);
app.use('/api/leads', leadsRoutes);
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
const MONGODB_URI = process.env.MONGODB_URI || '';
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
  if (activeDatabaseMode === 'disconnected') {
    activeDatabaseMode = shouldUseInMemoryDb ? 'memory' : 'external';
  }
  console.log('Connected to MongoDB');
});

mongoose.connection.on('disconnected', () => {
  if (mongoose.connection.readyState !== 1) {
    activeDatabaseMode = 'disconnected';
  }
  console.warn('MongoDB disconnected. API is continuing in degraded mode.');
});

async function connectInMemoryMongo(reason) {
  if (inMemoryMongoServer) {
    return;
  }

  const { MongoMemoryServer } = require('mongodb-memory-server');
  inMemoryMongoServer = await MongoMemoryServer.create();
  const inMemoryUri = inMemoryMongoServer.getUri();
  activeDatabaseMode = 'memory';
  console.warn(`${reason}. Starting an in-memory MongoDB for local development.`);
  await mongoose.connect(inMemoryUri, { serverSelectionTimeoutMS: 5000 });
}

async function connectMongo() {
  if (shouldUseInMemoryDb) {
    await connectInMemoryMongo('USE_IN_MEMORY_DB is enabled');
    return;
  }

  if (!MONGODB_URI) {
    if (isProduction) {
      console.warn('MONGODB_URI is not configured. Continuing without MongoDB.');
      return;
    }

    await connectInMemoryMongo('MONGODB_URI is not configured');
    return;
  }

  try {
    activeDatabaseMode = 'external';
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    console.error('MongoDB connection error:', error.message);

    if (!isProduction) {
      await connectInMemoryMongo('External MongoDB connection failed');
      return;
    }

    activeDatabaseMode = 'disconnected';
    console.warn('Continuing without MongoDB. Lender logins will use demo data until the database is available.');
  }
}

async function cleanupInMemoryMongo() {
  if (inMemoryMongoServer) {
    await inMemoryMongoServer.stop();
    inMemoryMongoServer = null;
  }
}

if (!isTest) {
  startServer();
}

connectMongo();

process.on('SIGINT', async () => {
  await cleanupInMemoryMongo();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanupInMemoryMongo();
  process.exit(0);
});

module.exports = app;
