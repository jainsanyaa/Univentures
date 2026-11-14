// ========================================
// seed.js — Standalone seeding script
// Usage: npm run seed        (seeds only if the DB is empty)
//        npm run seed --force (wipes and reseeds)
// ========================================

import { getDb, seedIfEmpty, runSeed } from './db.js';

const force = process.argv.includes('--force');
const db = getDb();

if (force) {
  for (const table of ['activity', 'requests', 'saves', 'votes', 'comments', 'startups', 'users']) {
    db.exec(`DELETE FROM ${table};`);
  }
  runSeed();
  console.log('Database wiped and reseeded.');
} else {
  const seeded = seedIfEmpty();
  console.log(seeded ? 'Database seeded.' : 'Database already had data — nothing to do.');
}
