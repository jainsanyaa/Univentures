// ========================================
// config.js — Environment configuration with sensible defaults
// ========================================

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'univenture-dev-secret-change-me',
  tokenExpiry: '7d',
  dbPath: process.env.DB_PATH
    ? resolve(serverRoot, process.env.DB_PATH)
    : resolve(serverRoot, 'univenture.db'),
  // Allowed CORS origins. Vite dev server defaults to 5173; we allow a couple
  // of common ports so the frontend works without extra setup.
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
};
