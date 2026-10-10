# Server-backed vocabulary cabinet

`frontend/learning.html` is a separate connected cabinet. `admin.html`,
`homework.html` and `vocabulary.html` retain their synthetic, memory-only demos.
The connected cabinet never falls back to pretending that a database write worked.
Pages currently has an empty API URL, so login and persistence controls there are
explicitly disabled. No API has been deployed, no Beget migration has occurred,
and the project Telegram bot is not configured.

## Implemented and tested

- Group creation with a name and exactly one `speech` or `grammar` course.
- Administrator login using the existing server-only `ADMIN_TOKEN` bootstrap key.
  This initial implementation has one administrator authority, not multiple
  independently provisioned teacher accounts or per-teacher group ownership.
- Registered students log in with Telegram-signed Mini App data or signed Login
  Widget data via the API. The cabinet UI currently supports Mini App entry.
  Unregistered, inactive students and inactive groups cannot enter.
- Random bearer sessions expire in eight hours. The database stores SHA-256
  hashes, never plaintext credentials. Role and student identity come from the
  server record, not request fields or a role selector. Logout revokes the session.
- Named vocabulary lists belong to exactly one group and inherit its course.
  Each card has a stable UUID, full teacher-bot fields and validated size/type
  limits. Ordinary students can propose simple emergent vocabulary. Appointed
  editors can propose full cards; exactly one editor per group is stored in the
  database. Replacement/revocation is checked on every creation request.
- Student proposals remain pending. Only their author and the administrator can
  see them before approval. A teacher can review all card fields and correct a
  pending draft, then approve it for group study. Published decks cannot be
  rewritten through the draft endpoint, preserving stable cards and progress.
- Students see only their own group's approved cards and their own progress.
  Four ratings use server-computed due dates (initial Again 10 minutes, Hard
  1 day, Good 3 days, Easy 7 days; subsequent intervals follow the documented
  demo algorithm in learning-preview.md). Browser dates, XP and student IDs
  cannot be supplied to override server values.
- Progress and XP events commit together. A unique student/card/day event limits
  activity XP to one per card per Moscow day. Conditional versioned updates and
  unique keys prevent duplicate/concurrent ratings from rescheduling or farming.
  Streak is computed in Europe/Moscow. Academic grades are not involved.
- Profile/group responses contain aliases and stable public student UUIDs only,
  with no legal names, Telegram IDs or private grades. The identity registry
  remains a separate existing administrator endpoint.

## Local run and deployment configuration

Use the existing Python environment and repository checkout. From the repository
root, run backend commands with the backend import path, or change into backend:

```sh
cd backend
../.venv/bin/python -m alembic upgrade head
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Set `DATABASE_URL` to the intended persistent database before migration/startup.
SQLite files are suitable for local development; the existing Docker deployment
uses PostgreSQL and the named `pgdata` volume. Apply revision `003_learning` to an
existing database; it preserves earlier records and assigns existing groups to
`speech`. Confirm each legacy group's actual course before real use. Do not
initialize the learning database by silently dropping/recreating existing tables.

Configure `ADMIN_TOKEN` and `TELEGRAM_BOT_TOKEN` through the server's secret
configuration, never frontend files or chat. The administrator key can be entered
into the password field only after the trusted API URL is configured. The field
is cleared immediately after submission. The short-lived returned bearer token
stays in page memory, not localStorage/sessionStorage or URLs. Refreshing the page
requires signing in again; vocabulary/progress remain in the database. This avoids
storing credentials persistently in the public static application.

Set `window.MOON_CAMPUS_API_BASE` in `frontend/config.js` to the deployed HTTPS API
origin. HTTP loopback is accepted for local tests only. Userinfo/query/fragment
URLs are rejected. Set backend `CORS_ORIGINS` to the exact frontend origins that
will access it, including `https://alyonazerg.github.io` if using Pages previews.
The server allows Authorization, Content-Type and GET/POST/PUT preflight requests.
A trusted HTTPS host for FastAPI/database and a project bot are still needed to
activate this on the public site. No provider account or paid API was connected.

The static Pages artifact includes only the frontend assets; it cannot run
FastAPI, Alembic or PostgreSQL. Backend keys/database exports are never added to
that artifact. The nginx Dockerfile includes the connected cabinet assets too.
A Docker build of this change was not run; the migration and real API were
validated directly with the existing Python environment.

## Scope still pending

Production homework, submissions, announcements, checkpoint results, media,
compensation access, leaderboards, Telegram notifications and AI authoring are
not connected to this database slice yet. OCR stays in the separate demo page;
handwriting is unreliable and is not an AI card generator. Existing in-memory
prototypes are not uploaded or automatically migrated into a real student account.
Multiple teacher identities, sign-in rate limiting at the HTTPS gateway, backups
and media storage must be configured for a real deployment. Session storage is
not a replacement for those hosting prerequisites.

## Verification

```sh
PYTHONPATH=backend .venv/bin/python -m pytest backend/tests -q
npm test --prefix tests/frontend
```

Backend: 20 tests, including real Alembic upgrade/downgrade on an isolated legacy
SQLite database, session hashing/expiry/logout, group isolation, editor revocation,
moderation/correction, atomic validation, server-time schedules, daily XP and
concurrent-review protection. No test uses a development/production database.

Frontend: 39 tests. Three new browser integrations run an actual migrated FastAPI
server with synthetic records, not mocked API responses. They check the disabled
unconfigured state, teacher list creation, student review, independent accounts,
mobile bounds, durable progress after a page reload and server process restart,
editor assignment, correction/approval and course-specific group creation. Only
Telegram SDK/initData and the configured local API URL are synthetic test inputs.
