// ========================================
// db.js — SQLite persistence layer (Node's built-in node:sqlite)
//
// Exposes small repository helpers that return data already shaped
// the way the frontend expects (camelCase, parsed JSON, per-user flags).
// ========================================

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { DEMO_USER, STARTUPS, REQUESTS, ACTIVITY } from './seedData.js';

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(config.dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema();
    seedIfEmpty();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT,
      user_type TEXT,
      college TEXT,
      bio TEXT,
      firm TEXT,
      investment_range TEXT,
      interests TEXT DEFAULT '[]',
      github TEXT DEFAULT '',
      linkedin TEXT DEFAULT '',
      twitter TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS startups (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      title TEXT NOT NULL,
      tagline TEXT,
      domain TEXT,
      tags TEXT DEFAULT '[]',
      problem TEXT,
      solution TEXT,
      market TEXT,
      traction TEXT,
      funding_ask INTEGER DEFAULT 0,
      funding_type TEXT,
      market_size TEXT,
      revenue_model TEXT,
      votes INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      roles_needed TEXT DEFAULT '[]',
      founders TEXT DEFAULT '[]',
      contact_email TEXT,
      demo_video TEXT DEFAULT '',
      posted_at TEXT NOT NULL,
      is_trending INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      startup_id TEXT NOT NULL,
      author TEXT NOT NULL,
      author_id TEXT,
      text TEXT NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      startup_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (startup_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS saves (
      startup_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (startup_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      person_name TEXT NOT NULL,
      role TEXT,
      pitch_title TEXT,
      pitch_id TEXT,
      from_user_id TEXT,
      to_owner_id TEXT,
      status TEXT DEFAULT 'pending',
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      type TEXT,
      text TEXT,
      time TEXT,
      icon TEXT,
      user_id TEXT
    );
  `);
}

// ---------- Seeding ----------

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (row.n > 0) return false;
  runSeed();
  return true;
}

export function runSeed() {
  const tx = db.prepare('SELECT 1'); // noop to ensure db ready
  tx.get();

  // Demo user
  const passwordHash = bcrypt.hashSync(DEMO_USER.password, 10);
  db.prepare(`
    INSERT OR REPLACE INTO users
      (id, name, email, password_hash, role, user_type, college, bio, firm,
       investment_range, interests, github, linkedin, twitter, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    DEMO_USER.id, DEMO_USER.name, DEMO_USER.email, passwordHash, DEMO_USER.role,
    DEMO_USER.userType, DEMO_USER.college, DEMO_USER.bio, DEMO_USER.firm,
    DEMO_USER.investmentRange, JSON.stringify(DEMO_USER.interests || []),
    DEMO_USER.github, DEMO_USER.linkedin, DEMO_USER.twitter, new Date().toISOString()
  );

  const insertStartup = db.prepare(`
    INSERT INTO startups
      (id, owner_id, title, tagline, domain, tags, problem, solution, market,
       traction, funding_ask, funding_type, market_size, revenue_model, votes,
       views, saves, roles_needed, founders, contact_email, demo_video,
       posted_at, is_trending)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertComment = db.prepare(
    'INSERT INTO comments (id, startup_id, author, author_id, text, date) VALUES (?,?,?,?,?,?)'
  );

  for (const s of STARTUPS) {
    insertStartup.run(
      s.id, null, s.title, s.tagline, s.domain, JSON.stringify(s.tags || []),
      s.problem, s.solution, s.market, s.traction, s.fundingAsk || 0, s.fundingType,
      s.marketSize, s.revenueModel, s.votes || 0, s.views || 0, s.saves || 0,
      JSON.stringify(s.rolesNeeded || []), JSON.stringify(s.founders || []),
      s.contactEmail, s.demoVideo || '', s.postedAt, s.isTrending ? 1 : 0
    );
    for (const c of s.comments || []) {
      insertComment.run(c.id, s.id, c.author, null, c.text, c.date);
    }
  }

  // Demo user's votes / saves so the UI reflects the original mock state.
  const insertVote = db.prepare('INSERT OR IGNORE INTO votes (startup_id, user_id) VALUES (?,?)');
  const insertSave = db.prepare('INSERT OR IGNORE INTO saves (startup_id, user_id) VALUES (?,?)');
  for (const id of DEMO_USER.votedStartups || []) insertVote.run(id, DEMO_USER.id);
  for (const id of DEMO_USER.savedStartups || []) insertSave.run(id, DEMO_USER.id);

  const insertRequest = db.prepare(`
    INSERT INTO requests (id, person_name, role, pitch_title, pitch_id, from_user_id, to_owner_id, status, date)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  for (const r of REQUESTS) {
    insertRequest.run(r.id, r.personName, r.role, r.pitchTitle, null, null, DEMO_USER.id, r.status, r.date);
  }

  const insertActivity = db.prepare(
    'INSERT INTO activity (id, type, text, time, icon, user_id) VALUES (?,?,?,?,?,?)'
  );
  for (const a of ACTIVITY) {
    insertActivity.run(a.id, a.type, a.text, a.time, a.icon, DEMO_USER.id);
  }
}

// ---------- Mappers ----------

export function publicUser(row) {
  if (!row) return null;
  const saved = getDb().prepare('SELECT startup_id FROM saves WHERE user_id = ?').all(row.id);
  const voted = getDb().prepare('SELECT startup_id FROM votes WHERE user_id = ?').all(row.id);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    userType: row.user_type,
    college: row.college,
    bio: row.bio,
    firm: row.firm,
    investmentRange: row.investment_range,
    interests: safeParse(row.interests, []),
    github: row.github,
    linkedin: row.linkedin,
    twitter: row.twitter,
    savedStartups: saved.map(r => r.startup_id),
    votedStartups: voted.map(r => r.startup_id),
  };
}

function rowToStartup(row, { votedSet, savedSet } = {}) {
  const comments = getDb()
    .prepare('SELECT id, author, text, date FROM comments WHERE startup_id = ? ORDER BY date ASC')
    .all(row.id);
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    tagline: row.tagline,
    domain: row.domain,
    tags: safeParse(row.tags, []),
    problem: row.problem,
    solution: row.solution,
    market: row.market,
    traction: row.traction,
    fundingAsk: row.funding_ask,
    fundingType: row.funding_type,
    marketSize: row.market_size,
    revenueModel: row.revenue_model,
    votes: row.votes,
    views: row.views,
    saves: row.saves,
    comments,
    rolesNeeded: safeParse(row.roles_needed, []),
    founders: safeParse(row.founders, []),
    contactEmail: row.contact_email,
    demoVideo: row.demo_video,
    postedAt: row.posted_at,
    isTrending: !!row.is_trending,
    hasVoted: votedSet ? votedSet.has(row.id) : false,
    isSaved: savedSet ? savedSet.has(row.id) : false,
  };
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

// ---------- Users ----------

export function findUserByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createUser(data) {
  const id = 'user-' + randomUUID().slice(0, 8);
  const passwordHash = bcrypt.hashSync(data.password, 10);
  getDb().prepare(`
    INSERT INTO users
      (id, name, email, password_hash, role, user_type, college, bio, firm,
       investment_range, interests, github, linkedin, twitter, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.name, data.email, passwordHash, data.role, data.userType,
    data.college || '', data.bio || '', data.firm || '', data.investmentRange || '',
    JSON.stringify(data.interests || []), data.github || '', data.linkedin || '',
    data.twitter || '', new Date().toISOString()
  );
  return findUserById(id);
}

export function verifyPassword(userRow, password) {
  return bcrypt.compareSync(password, userRow.password_hash);
}

// ---------- Startups ----------

function userFlagSets(userId) {
  if (!userId) return { votedSet: new Set(), savedSet: new Set() };
  const voted = getDb().prepare('SELECT startup_id FROM votes WHERE user_id = ?').all(userId);
  const saved = getDb().prepare('SELECT startup_id FROM saves WHERE user_id = ?').all(userId);
  return {
    votedSet: new Set(voted.map(r => r.startup_id)),
    savedSet: new Set(saved.map(r => r.startup_id)),
  };
}

export function listStartups(userId, { limit = 10, cursor = null } = {}) {
  const d = getDb();
  const sets = userFlagSets(userId);

  const rows = cursor
    ? d.prepare('SELECT * FROM startups WHERE id > ? ORDER BY id ASC LIMIT ?').all(cursor, limit + 1)
    : d.prepare('SELECT * FROM startups ORDER BY id ASC LIMIT ?').all(limit + 1);

  const hasNext = rows.length > limit;
  if (hasNext) rows.pop();

  const items = rows.map(r => rowToStartup(r, sets));
  const nextCursor = hasNext ? items[items.length - 1].id : null;

  return { items, nextCursor, hasNext };
}

export function getStartup(id, userId) {
  const row = getDb().prepare('SELECT * FROM startups WHERE id = ?').get(id);
  if (!row) return null;
  return rowToStartup(row, userFlagSets(userId));
}

export function createStartup(data, ownerId) {
  const id = 'startup-' + randomUUID().slice(0, 8);
  getDb().prepare(`
    INSERT INTO startups
      (id, owner_id, title, tagline, domain, tags, problem, solution, market,
       traction, funding_ask, funding_type, market_size, revenue_model, votes,
       views, saves, roles_needed, founders, contact_email, demo_video,
       posted_at, is_trending)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, ownerId, data.title, data.tagline, data.domain, JSON.stringify(data.tags || []),
    data.problem, data.solution, data.market, data.traction || 'Early stage — building MVP',
    Number(data.fundingAsk) || 0, data.fundingType || 'Equity', data.marketSize,
    data.revenueModel || 'Other', 0, 0, 0, JSON.stringify(data.rolesNeeded || []),
    JSON.stringify(data.founders || []), data.contactEmail, data.demoVideo || '',
    new Date().toISOString(), 0
  );
  return getStartup(id, ownerId);
}

export function deleteStartup(id, userId) {
  const row = getDb().prepare('SELECT * FROM startups WHERE id = ?').get(id);
  if (!row) return { ok: false, status: 404 };

  const user = findUserById(userId);
  const founders = safeParse(row.founders, []);
  const isOwner = row.owner_id === userId;
  const isFounder = user && founders.some(f => f.name === user.name);
  if (!isOwner && !isFounder) return { ok: false, status: 403 };

  const d = getDb();
  d.prepare('DELETE FROM comments WHERE startup_id = ?').run(id);
  d.prepare('DELETE FROM votes WHERE startup_id = ?').run(id);
  d.prepare('DELETE FROM saves WHERE startup_id = ?').run(id);
  d.prepare('DELETE FROM startups WHERE id = ?').run(id);
  return { ok: true };
}

export function incrementViews(id) {
  getDb().prepare('UPDATE startups SET views = views + 1 WHERE id = ?').run(id);
}

export function toggleVote(id, userId) {
  const d = getDb();
  const startup = d.prepare('SELECT votes FROM startups WHERE id = ?').get(id);
  if (!startup) return null;
  const existing = d.prepare('SELECT 1 FROM votes WHERE startup_id = ? AND user_id = ?').get(id, userId);
  if (existing) {
    d.prepare('DELETE FROM votes WHERE startup_id = ? AND user_id = ?').run(id, userId);
    d.prepare('UPDATE startups SET votes = MAX(0, votes - 1) WHERE id = ?').run(id);
  } else {
    d.prepare('INSERT INTO votes (startup_id, user_id) VALUES (?,?)').run(id, userId);
    d.prepare('UPDATE startups SET votes = votes + 1 WHERE id = ?').run(id);
  }
  const votes = d.prepare('SELECT votes FROM startups WHERE id = ?').get(id).votes;
  return { votes, hasVoted: !existing };
}

export function toggleSave(id, userId) {
  const d = getDb();
  const startup = d.prepare('SELECT saves FROM startups WHERE id = ?').get(id);
  if (!startup) return null;
  const existing = d.prepare('SELECT 1 FROM saves WHERE startup_id = ? AND user_id = ?').get(id, userId);
  if (existing) {
    d.prepare('DELETE FROM saves WHERE startup_id = ? AND user_id = ?').run(id, userId);
    d.prepare('UPDATE startups SET saves = MAX(0, saves - 1) WHERE id = ?').run(id);
  } else {
    d.prepare('INSERT INTO saves (startup_id, user_id) VALUES (?,?)').run(id, userId);
    d.prepare('UPDATE startups SET saves = saves + 1 WHERE id = ?').run(id);
  }
  const saves = d.prepare('SELECT saves FROM startups WHERE id = ?').get(id).saves;
  return { saved: !existing, saves };
}

export function addComment(id, { author, authorId, text }) {
  const d = getDb();
  const startup = d.prepare('SELECT 1 FROM startups WHERE id = ?').get(id);
  if (!startup) return null;
  const comment = { id: 'c-' + randomUUID().slice(0, 8), author, text, date: new Date().toISOString() };
  d.prepare('INSERT INTO comments (id, startup_id, author, author_id, text, date) VALUES (?,?,?,?,?,?)')
    .run(comment.id, id, author, authorId || null, text, comment.date);
  const comments = d.prepare('SELECT id, author, text, date FROM comments WHERE startup_id = ? ORDER BY date ASC').all(id);
  return { comment, comments };
}

// ---------- Requests ----------

export function listRequests(ownerId) {
  const d = getDb();
  const rows = ownerId
    ? d.prepare('SELECT * FROM requests WHERE to_owner_id = ? OR to_owner_id IS NULL ORDER BY date DESC').all(ownerId)
    : d.prepare('SELECT * FROM requests ORDER BY date DESC').all();
  return rows.map(mapRequest);
}

export function createRequest(data) {
  const id = 'req-' + randomUUID().slice(0, 8);
  getDb().prepare(`
    INSERT INTO requests (id, person_name, role, pitch_title, pitch_id, from_user_id, to_owner_id, status, date)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.personName, data.role, data.pitchTitle, data.pitchId || null,
    data.fromUserId || null, data.toOwnerId || null, 'pending',
    new Date().toISOString().slice(0, 10)
  );
  return mapRequest(getDb().prepare('SELECT * FROM requests WHERE id = ?').get(id));
}

export function updateRequestStatus(id, status) {
  const d = getDb();
  const existing = d.prepare('SELECT * FROM requests WHERE id = ?').get(id);
  if (!existing) return null;
  d.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, id);
  return mapRequest(d.prepare('SELECT * FROM requests WHERE id = ?').get(id));
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    personName: row.person_name,
    role: row.role,
    pitchTitle: row.pitch_title,
    pitchId: row.pitch_id,
    status: row.status,
    date: row.date,
  };
}

// ---------- Activity ----------

export function listActivity() {
  const rows = getDb().prepare('SELECT id, type, text, time, icon FROM activity').all();
  return rows;
}
