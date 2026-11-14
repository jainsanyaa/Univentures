// ========================================
// auth.js — JWT issuing and auth middleware
// ========================================

import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { findUserById } from './db.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.tokenExpiry });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

// Attaches req.user / req.userId when a valid token is present; otherwise 401.
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Attaches req.user / req.userId when present, but never blocks the request.
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = findUserById(payload.sub);
      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    } catch {
      // Ignore bad tokens for optional routes.
    }
  }
  next();
}
