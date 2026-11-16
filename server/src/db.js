// ========================================
// db.js — MongoDB persistence layer (Mongoose)
//
// Exposes small repository helpers that return data already shaped the way
// the frontend expects (string ids, embedded comments/founders, per-user
// flags). All helpers are async — MongoDB access is asynchronous.
// ========================================

import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { User, Startup, Request, Activity } from './models.js';
import { DEMO_USER, STARTUPS, REQUESTS, ACTIVITY } from './seedData.js';

let connected = false;

// Open (or reuse) the connection and seed the database if it is empty.
export async function connectDB() {
  if (connected) return mongoose.connection;
  await mongoose.connect(config.mongoUri, { dbName: config.dbName });
  connected = true;
  await seedIfEmpty();
  return mongoose.connection;
}

// ---------- Seeding ----------

export async function seedIfEmpty() {
  const count = await User.countDocuments();
  if (count > 0) return false;
  await runSeed();
  return true;
}

export async function runSeed() {
  // Demo user
  await User.create({
    _id: DEMO_USER.id,
    name: DEMO_USER.name,
    email: DEMO_USER.email.toLowerCase(),
    passwordHash: bcrypt.hashSync(DEMO_USER.password, 10),
    role: DEMO_USER.role,
    userType: DEMO_USER.userType,
    college: DEMO_USER.college,
    bio: DEMO_USER.bio,
    firm: DEMO_USER.firm,
    investmentRange: DEMO_USER.investmentRange,
    interests: DEMO_USER.interests || [],
    github: DEMO_USER.github,
    linkedin: DEMO_USER.linkedin,
    twitter: DEMO_USER.twitter,
  });

  const votedSet = new Set(DEMO_USER.votedStartups || []);
  const savedSet = new Set(DEMO_USER.savedStartups || []);

  const docs = STARTUPS.map(s => ({
    _id: s.id,
    ownerId: null,
    title: s.title,
    tagline: s.tagline,
    domain: s.domain,
    tags: s.tags || [],
    problem: s.problem,
    solution: s.solution,
    market: s.market,
    traction: s.traction,
    fundingAsk: s.fundingAsk || 0,
    fundingType: s.fundingType,
    marketSize: s.marketSize,
    revenueModel: s.revenueModel,
    votes: s.votes || 0,
    views: s.views || 0,
    saves: s.saves || 0,
    comments: (s.comments || []).map(c => ({
      id: c.id, author: c.author, authorId: null, text: c.text, date: c.date,
    })),
    rolesNeeded: s.rolesNeeded || [],
    founders: s.founders || [],
    contactEmail: s.contactEmail,
    demoVideo: s.demoVideo || '',
    postedAt: s.postedAt,
    isTrending: !!s.isTrending,
    // Seed the demo user's votes/saves so the UI matches the original mock state.
    voters: votedSet.has(s.id) ? [DEMO_USER.id] : [],
    savers: savedSet.has(s.id) ? [DEMO_USER.id] : [],
  }));
  await Startup.insertMany(docs);

  await Request.insertMany(
    REQUESTS.map(r => ({
      _id: r.id,
      personName: r.personName,
      role: r.role,
      pitchTitle: r.pitchTitle,
      pitchId: null,
      fromUserId: null,
      toOwnerId: DEMO_USER.id,
      status: r.status,
      date: r.date,
    }))
  );

  await Activity.insertMany(
    ACTIVITY.map(a => ({
      _id: a.id, type: a.type, text: a.text, time: a.time, icon: a.icon, userId: DEMO_USER.id,
    }))
  );
}

// Wipe every collection (used by `npm run seed --force`).
export async function clearAll() {
  await Promise.all([
    User.deleteMany({}),
    Startup.deleteMany({}),
    Request.deleteMany({}),
    Activity.deleteMany({}),
  ]);
}

// ---------- Mappers ----------

export async function publicUser(user) {
  if (!user) return null;
  // Derive saved/voted startup ids from array membership on the startups.
  const [voted, saved] = await Promise.all([
    Startup.find({ voters: user._id }).select('_id').lean(),
    Startup.find({ savers: user._id }).select('_id').lean(),
  ]);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    userType: user.userType,
    college: user.college,
    bio: user.bio,
    firm: user.firm,
    investmentRange: user.investmentRange,
    interests: user.interests || [],
    github: user.github,
    linkedin: user.linkedin,
    twitter: user.twitter,
    savedStartups: saved.map(s => s._id),
    votedStartups: voted.map(s => s._id),
  };
}

function mapStartup(doc, userId) {
  if (!doc) return null;
  return {
    id: doc._id,
    ownerId: doc.ownerId,
    title: doc.title,
    tagline: doc.tagline,
    domain: doc.domain,
    tags: doc.tags || [],
    problem: doc.problem,
    solution: doc.solution,
    market: doc.market,
    traction: doc.traction,
    fundingAsk: doc.fundingAsk,
    fundingType: doc.fundingType,
    marketSize: doc.marketSize,
    revenueModel: doc.revenueModel,
    votes: doc.votes,
    views: doc.views,
    saves: doc.saves,
    comments: (doc.comments || []).map(c => ({
      id: c.id, author: c.author, text: c.text, date: c.date,
    })),
    rolesNeeded: doc.rolesNeeded || [],
    founders: (doc.founders || []).map(f => ({ name: f.name, college: f.college, role: f.role })),
    contactEmail: doc.contactEmail,
    demoVideo: doc.demoVideo,
    postedAt: doc.postedAt,
    isTrending: !!doc.isTrending,
    hasVoted: userId ? (doc.voters || []).includes(userId) : false,
    isSaved: userId ? (doc.savers || []).includes(userId) : false,
  };
}

// ---------- Users ----------

export function findUserByEmail(email) {
  return User.findOne({ email: String(email).toLowerCase() }).lean();
}

export function findUserById(id) {
  return User.findById(id).lean();
}

export async function createUser(data) {
  const id = 'user-' + randomUUID().slice(0, 8);
  const doc = await User.create({
    _id: id,
    name: data.name,
    email: String(data.email).toLowerCase(),
    passwordHash: bcrypt.hashSync(data.password, 10),
    role: data.role,
    userType: data.userType,
    college: data.college || '',
    bio: data.bio || '',
    firm: data.firm || '',
    investmentRange: data.investmentRange || '',
    interests: data.interests || [],
    github: data.github || '',
    linkedin: data.linkedin || '',
    twitter: data.twitter || '',
  });
  return doc.toObject();
}

export function verifyPassword(userRow, password) {
  return bcrypt.compareSync(password, userRow.passwordHash);
}

// ---------- Startups ----------

// ---------- Query helpers (filter / sort / projection) ----------

const splitCsv = (v) => String(v).split(',').map(s => s.trim()).filter(Boolean);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build a MongoDB filter document from HTTP query params. Each branch below
// maps to a specific operator category from the syllabus:
//   - comparison:  $eq, $in, $gte, $lte
//   - logical:     $and (wrapping the branches), $or (text search)
//   - array:       membership, $all, $elemMatch on arrays of embedded docs
//   - nested:      dot-notation on embedded sub-documents
export function buildStartupFilter(params = {}) {
  const and = [];

  // $eq — exact match on a single domain.
  if (params.domain) and.push({ domain: { $eq: params.domain } });

  // $in — match any of several domains (?domains=EdTech,FinTech).
  if (params.domains) and.push({ domain: { $in: splitCsv(params.domains) } });

  // Array query — tags is a string array. $in = has any tag; $all = has all tags.
  if (params.tags) {
    const t = splitCsv(params.tags);
    and.push(params.tagsMatch === 'all' ? { tags: { $all: t } } : { tags: { $in: t } });
  }

  // Array membership — rolesNeeded contains this element.
  if (params.role) and.push({ rolesNeeded: params.role });

  // $gte / $lte — numeric range on votes.
  const votes = {};
  if (params.minVotes != null && params.minVotes !== '') votes.$gte = Number(params.minVotes);
  if (params.maxVotes != null && params.maxVotes !== '') votes.$lte = Number(params.maxVotes);
  if (Object.keys(votes).length) and.push({ votes });

  // $gte / $lte — numeric range on fundingAsk.
  const funding = {};
  if (params.minFunding != null && params.minFunding !== '') funding.$gte = Number(params.minFunding);
  if (params.maxFunding != null && params.maxFunding !== '') funding.$lte = Number(params.maxFunding);
  if (Object.keys(funding).length) and.push({ fundingAsk: funding });

  // Boolean flag.
  if (params.trending != null && params.trending !== '') {
    and.push({ isTrending: params.trending === 'true' || params.trending === true });
  }

  // Nested / array-of-embedded-documents — founders is an array of sub-docs.
  // $elemMatch finds a startup with ONE founder matching all given criteria.
  if (params.founderCollege || params.founderRole) {
    const em = {};
    if (params.founderCollege) em.college = params.founderCollege;
    if (params.founderRole) em.role = params.founderRole;
    and.push({ founders: { $elemMatch: em } });
  }

  // $or — free-text search across several fields (case-insensitive regex).
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q), 'i');
    and.push({ $or: [{ title: rx }, { tagline: rx }, { problem: rx }, { solution: rx }] });
  }

  // Combine every branch with $and; empty filter matches all documents.
  return and.length ? { $and: and } : {};
}

// Whitelist the fields a client may sort by, then apply asc/desc.
export function buildStartupSort(params = {}) {
  const allowed = new Set(['votes', 'views', 'saves', 'fundingAsk', 'postedAt', 'title']);
  const field = allowed.has(params.sort) ? params.sort : 'postedAt';
  const order = params.order === 'asc' ? 1 : -1;
  return { [field]: order };
}

// Projection — ?fields=title,votes returns only those fields (plus id).
export function buildStartupProjection(params = {}) {
  if (!params.fields) return null;
  const proj = {};
  for (const f of splitCsv(params.fields)) proj[f] = 1;
  return proj;
}

function projectStartup(row) {
  const { _id, ...rest } = row;
  return { id: _id, ...rest };
}

// Filter + sort + paginate (+ optional projection) over the startups collection.
export async function queryStartups(userId, params = {}) {
  const filter = buildStartupFilter(params);
  const sort = buildStartupSort(params);
  const projection = buildStartupProjection(params);

  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 10, 1), 50);
  const page = Math.max(parseInt(params.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    Startup.countDocuments(filter),
    Startup.find(filter, projection || undefined).sort(sort).skip(skip).limit(limit).lean(),
  ]);

  const items = projection ? rows.map(projectStartup) : rows.map(r => mapStartup(r, userId));
  const pages = Math.max(Math.ceil(total / limit), 1);
  return { items, total, page, pages, limit, hasNext: page < pages };
}

// Kept for backward compatibility (simple cursor paging).
export async function listStartups(userId, { limit = 10, cursor = null } = {}) {
  const filter = cursor ? { _id: { $gt: cursor } } : {};
  const rows = await Startup.find(filter).sort({ _id: 1 }).limit(limit + 1).lean();
  const hasNext = rows.length > limit;
  if (hasNext) rows.pop();
  const items = rows.map(r => mapStartup(r, userId));
  const nextCursor = hasNext ? items[items.length - 1].id : null;
  return { items, nextCursor, hasNext };
}

export async function getStartup(id, userId) {
  const row = await Startup.findById(id).lean();
  return mapStartup(row, userId);
}

export async function createStartup(data, ownerId) {
  const id = 'startup-' + randomUUID().slice(0, 8);
  await Startup.create({
    _id: id,
    ownerId,
    title: data.title,
    tagline: data.tagline,
    domain: data.domain,
    tags: data.tags || [],
    problem: data.problem,
    solution: data.solution,
    market: data.market,
    traction: data.traction || 'Early stage — building MVP',
    fundingAsk: Number(data.fundingAsk) || 0,
    fundingType: data.fundingType || 'Equity',
    marketSize: data.marketSize,
    revenueModel: data.revenueModel || 'Other',
    votes: 0,
    views: 0,
    saves: 0,
    comments: [],
    rolesNeeded: data.rolesNeeded || [],
    founders: data.founders || [],
    contactEmail: data.contactEmail,
    demoVideo: data.demoVideo || '',
    postedAt: new Date().toISOString(),
    isTrending: false,
    voters: [],
    savers: [],
  });
  return getStartup(id, ownerId);
}

export async function deleteStartup(id, userId) {
  const row = await Startup.findById(id).lean();
  if (!row) return { ok: false, status: 404 };

  const user = await findUserById(userId);
  const isOwner = row.ownerId === userId;
  const isFounder = user && (row.founders || []).some(f => f.name === user.name);
  if (!isOwner && !isFounder) return { ok: false, status: 403 };

  await Startup.deleteOne({ _id: id });
  return { ok: true };
}

export async function incrementViews(id) {
  await Startup.updateOne({ _id: id }, { $inc: { views: 1 } });
}

export async function toggleVote(id, userId) {
  const startup = await Startup.findById(id);
  if (!startup) return null;
  const hadVoted = startup.voters.includes(userId);
  if (hadVoted) {
    startup.voters = startup.voters.filter(u => u !== userId);
    startup.votes = Math.max(0, startup.votes - 1);
  } else {
    startup.voters.push(userId);
    startup.votes += 1;
  }
  await startup.save();
  return { votes: startup.votes, hasVoted: !hadVoted };
}

export async function toggleSave(id, userId) {
  const startup = await Startup.findById(id);
  if (!startup) return null;
  const hadSaved = startup.savers.includes(userId);
  if (hadSaved) {
    startup.savers = startup.savers.filter(u => u !== userId);
    startup.saves = Math.max(0, startup.saves - 1);
  } else {
    startup.savers.push(userId);
    startup.saves += 1;
  }
  await startup.save();
  return { saved: !hadSaved, saves: startup.saves };
}

export async function addComment(id, { author, authorId, text }) {
  const startup = await Startup.findById(id);
  if (!startup) return null;
  const comment = {
    id: 'c-' + randomUUID().slice(0, 8),
    author,
    authorId: authorId || null,
    text,
    date: new Date().toISOString(),
  };
  startup.comments.push(comment);
  await startup.save();
  const comments = startup.comments.map(c => ({ id: c.id, author: c.author, text: c.text, date: c.date }));
  return { comment: { id: comment.id, author, text, date: comment.date }, comments };
}

// ---------- Requests ----------

export async function listRequests(ownerId) {
  const filter = ownerId ? { $or: [{ toOwnerId: ownerId }, { toOwnerId: null }] } : {};
  const rows = await Request.find(filter).sort({ date: -1 }).lean();
  return rows.map(mapRequest);
}

export async function createRequest(data) {
  const id = 'req-' + randomUUID().slice(0, 8);
  const doc = await Request.create({
    _id: id,
    personName: data.personName,
    role: data.role,
    pitchTitle: data.pitchTitle,
    pitchId: data.pitchId || null,
    fromUserId: data.fromUserId || null,
    toOwnerId: data.toOwnerId || null,
    status: 'pending',
    date: new Date().toISOString().slice(0, 10),
  });
  return mapRequest(doc.toObject());
}

export async function updateRequestStatus(id, status) {
  const doc = await Request.findByIdAndUpdate(id, { status }, { new: true }).lean();
  return mapRequest(doc);
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row._id,
    personName: row.personName,
    role: row.role,
    pitchTitle: row.pitchTitle,
    pitchId: row.pitchId,
    status: row.status,
    date: row.date,
  };
}

// ---------- Activity ----------

export async function listActivity() {
  const rows = await Activity.find({}).lean();
  return rows.map(a => ({ id: a._id, type: a.type, text: a.text, time: a.time, icon: a.icon }));
}
