// ========================================
// config.js — Environment configuration with sensible defaults
// ========================================

import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'univenture-dev-secret-change-me',
  tokenExpiry: '7d',
  // MongoDB connection string (MongoDB Atlas). Set MONGODB_URI in server/.env.
  // Falls back to a local MongoDB instance for offline development.
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/univenture',
  // Name of the database to use inside the cluster.
  dbName: process.env.MONGODB_DB || 'univenture',
  // Allowed CORS origins. Vite dev server defaults to 5173; we allow a couple
  // of common ports so the frontend works without extra setup.
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};
