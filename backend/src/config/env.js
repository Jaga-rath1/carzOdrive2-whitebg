const path = require('path');
// Guarantee loading .env regardless of whether process is started from root or backend directory
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(process.cwd(), 'backend/.env') });
require('dotenv').config();

const DEFAULT_MONGODB_URI = 'mongodb+srv://projects_db_user:7VDK36eARhp1jVex@cluster0.cuqh0hd.mongodb.net/carzOdrive?retryWrites=true&w=majority';
const DEFAULT_PARTNER_MONGODB_URI = 'mongodb+srv://projects_db_user:7VDK36eARhp1jVex@cluster0.cuqh0hd.mongodb.net/carzODrive_Partner?retryWrites=true&w=majority';

const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || DEFAULT_MONGODB_URI,
  partnerMongodbUri: process.env.PARTNER_MONGODB_URI || process.env.MONGODB_URI || DEFAULT_PARTNER_MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '60d',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  backendUrl:
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    `http://localhost:${parseInt(process.env.PORT, 10) || 5000}`,

  cashfree: {
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || '',
    environment: process.env.CASHFREE_ENVIRONMENT || 'sandbox',
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@carzodrive.com',
    password: process.env.SUPER_ADMIN_PASSWORD || '',
    name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'carzodrive',
  },

  email: {
    service: process.env.SMTP_SERVICE || 'gmail',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || process.env.EMAIL_USER || '',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
    from:
      process.env.EMAIL_FROM ||
      'CARZODRIVE Concierge <no-reply@carzodrive.com>',
  },
};

function validateEnv() {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  if (!env.mongodbUri) {
    required.unshift('MONGODB_URI');
  }

  if (env.nodeEnv === 'production') {
    required.push(
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET'
    );
  }

  const missing = required.filter(
    (key) => !process.env[key] || !process.env[key].trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

module.exports = { env, validateEnv };
