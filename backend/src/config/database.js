const dns = require('dns');

// On Windows / local networks, Node's c-ares DNS resolver frequently throws
// querySrv ECONNREFUSED for MongoDB Atlas mongodb+srv:// URIs using the default router DNS.
// Setting public DNS servers (Google 8.8.8.8, Cloudflare 1.1.1.1) fixes SRV resolution reliably.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Graceful fallback if custom DNS servers are restricted in the current runtime
}

const mongoose = require('mongoose');
const { env } = require('./env');
const logger = require('../utils/logger');

const options = {
  maxPoolSize: 20,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
};

// Partner Database Connection for "Rent Your Car", "Rent Your Bike", and "Driver Registration"
// Sharing the primary cluster connection with useDb('carzodrive_partners', { useCache: true })
// completely eliminates secondary TLS handshakes, SSL record layer failures, and 10000ms buffering timeouts!
const partnerConnection = mongoose.connection.useDb('carzodrive_partners', { useCache: true });

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB primary connection lost. Retrying...');
});

mongoose.connection.on('reconnected', () => {
  logger.success('MongoDB primary connection re-established.');
});

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  try {
    await mongoose.connect(env.mongodbUri, options);
    logger.success(`MongoDB connected successfully to host: ${mongoose.connection.host} [database: ${mongoose.connection.name}]`);
    logger.success(`Dedicated Partner DB connected on shared pool [database: ${partnerConnection.name}]`);
  } catch (err) {
    logger.warn(`Primary MongoDB URI connection issue: ${err.message}. Attempting fallback connection...`);
    try {
      const fallbackUri = 'mongodb+srv://projects_db_user:7VDK36eARhp1jVex@cluster0.cuqh0hd.mongodb.net/carzOdrive?retryWrites=true&w=majority';
      if (env.mongodbUri !== fallbackUri) {
        await mongoose.connect(fallbackUri, options);
        logger.success(`MongoDB connected successfully via fallback cluster: ${mongoose.connection.host} [database: ${mongoose.connection.name}]`);
        return;
      }
    } catch (fallbackErr) {
      logger.error('Fallback cluster attempt also failed:', fallbackErr.message);
    }

    logger.error('MongoDB initial connection error:', err);
    if (env.nodeEnv === 'production') {
      process.exit(1);
    } else {
      logger.warn(`Local development MongoDB notice: retrying connection in background to ${env.mongodbUri}`);
      const retryTimer = setInterval(async () => {
        try {
          if (mongoose.connection.readyState === 1) {
            clearInterval(retryTimer);
            return;
          }
          await mongoose.connect(env.mongodbUri, options);
          clearInterval(retryTimer);
          logger.success(`MongoDB reconnected successfully to host: ${mongoose.connection.host}`);
        } catch (retryErr) {
          logger.warn(`Retrying MongoDB connection: ${retryErr.message}`);
        }
      }, 5000);
      retryTimer.unref();
    }
  }
}

async function checkDBHealth() {
  const state = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const status = states[state] || 'unknown';
  const isHealthy = state === 1;

  if (isHealthy) {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'ok',
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        partnerDatabase: partnerConnection.name,
        partnerStatus: 'connected',
        poolSize: options.maxPoolSize,
      };
    } catch (pingErr) {
      return { status: 'error', message: pingErr.message };
    }
  }

  return { status };
}

module.exports = { connectDB, checkDBHealth, partnerConnection, isDedicatedPartnerUri: false };
