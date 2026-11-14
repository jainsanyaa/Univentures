# UniVenture — Backend API

A small REST API for the UniVenture pitching platform. Built with **Express** and
**Node's built-in SQLite** (`node:sqlite`) — no native build step and no external
database to install. Passwords are hashed with bcrypt and sessions use JWTs.

## Requirements

- Node.js 22.5+ (ships with the `node:sqlite` module). Tested on Node 24.

## Setup

```bash
cd server
npm install
npm start          # http://localhost:4000
```

On first start the database file (`univenture.db`) is created and seeded with the
same 12 startups, demo user, requests, and activity the frontend shipped with.

Scripts:

- `npm start` — run the server
- `npm run dev` — run with `--watch` (auto-restart on changes)
- `npm run seed` — seed only if empty
- `npm run seed -- --force` — wipe and reseed

Configuration (all optional — see `.env.example`): `PORT`, `JWT_SECRET`, `DB_PATH`,
`CLIENT_ORIGIN`.

## Demo account

```
email:    ayush@univenture.com
password: password123
```

## API

Auth is a Bearer token: `Authorization: Bearer <token>`. `GET` endpoints are public;
mutations require a token.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | — | Create account → `{ token, user }` |
| POST | `/api/auth/login` | — | Log in → `{ token, user }` |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/users/:id` | — | Public user profile |
| GET | `/api/startups` | optional | List startups (+ `hasVoted`/`isSaved` when authed) |
| GET | `/api/startups/:id` | optional | One startup (increments views) |
| POST | `/api/startups` | ✓ | Create a pitch |
| DELETE | `/api/startups/:id` | ✓ | Delete own pitch |
| POST | `/api/startups/:id/vote` | ✓ | Toggle upvote → `{ votes, hasVoted }` |
| POST | `/api/startups/:id/save` | ✓ | Toggle save → `{ saved, saves }` |
| POST | `/api/startups/:id/comments` | ✓ | Add a comment |
| POST | `/api/startups/:id/apply` | ✓ | Apply for a role (creates a request) |
| GET | `/api/requests` | ✓ | Collaboration requests |
| PATCH | `/api/requests/:id` | ✓ | Update request status |
| GET | `/api/activity` | ✓ | Activity feed |
| GET | `/api/health` | — | Health check |

## Project layout

```
server/
  src/
    index.js      Express app + routes
    db.js         SQLite schema + repository helpers
    seedData.js   Initial data
    seed.js       Standalone seed script
    auth.js       JWT + auth middleware
    config.js     Environment config
```
