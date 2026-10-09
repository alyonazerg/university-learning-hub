# Registration milestone

Implemented in `sprint-2-registration`; not deployed or merged into main.

## Contract

Registration no longer accepts an arbitrary Telegram ID, legal name or pseudonym.
A verified Telegram identity and a single-use group invitation are required.
The server issues a two-word pseudonym from 575 curated combinations, excluding
`Lunar Thyme`. PostgreSQL uniqueness constraints prevent duplicate accounts,
reservations and assigned aliases. One pending reservation per Telegram account
expires after five minutes; requesting another invalidates the previous token.
The finite pool reports exhaustion instead of recycling assigned aliases.

The teacher creates groups using `POST /groups`, then creates personal invitations
with `POST /admin/groups/{group_id}/invitations`. Both require `X-Admin-Token`.
Invitations last seven days, are stored as SHA-256 digests and can be consumed only
once. Treat the returned token as a private bearer credential; share it individually,
not in a public group or repository. An invitation grants membership in its group
only. Group representatives cannot use administrator endpoints.

The client calls:

1. `POST /auth/telegram/pseudonym` with `invitation_token` and either Mini App
   `init_data` or signed Telegram Login Widget `telegram_data`.
2. `POST /auth/telegram/register` with the same authentication and invitation,
   plus the returned `pseudonym_token`.

Telegram signatures and timestamps are checked server-side (maximum age five
minutes; future timestamps and duplicate initData parameters are rejected).
The Telegram ID is extracted from verified data, never trusted as a separate
client field. Without `TELEGRAM_BOT_TOKEN`, registration returns 503 rather than
accepting unauthenticated accounts. Telegram IDs remain private database fields.
Registration responses contain only a stable `public_id` UUID, pseudonym and group.
No identity-registry entry is created from registration data. Existing confidential
identity mappings are preserved. Admin identity responses reference public UUIDs.

`GET /admin/groups` is restricted to administrators and contains group labels,
student UUIDs and aliases; it excludes legal names, Telegram IDs and grades.
The existing confidential registry stays behind administrator authentication.
Do not put administrator tokens into a frontend or localStorage.

## Database and startup

Configure `DATABASE_URL`, `TELEGRAM_BOT_TOKEN` and `ADMIN_TOKEN` securely on the
backend. CORS defaults to `https://mooncampus.ru` and `http://localhost:8080`;
`CORS_ORIGINS` can override these using a JSON list. Never disable Telegram checks
for production. No paid APIs are required.

From `backend/`, run `../.venv/bin/python -m alembic upgrade head` before starting
Uvicorn. The Docker image does this automatically before starting the API.
Migration `002_registration` adds UUIDs to existing students without changing
aliases or identity records, plus invitation and reservation tables. It does not
renumber the existing internal integer foreign keys. The app no longer creates
schema on import; migrations own schema changes.

An old database created by the former `create_all` scaffold can have tables but
no Alembic version. Do not blindly stamp it or delete its data. Back it up, compare
its schema with migration `001_sprint1`, and stamp that revision only after confirming
it matches; then upgrade to head. Downgrading 002 removes UUIDs, invitations and
reservations, so it is for disposable verification or a reviewed rollback only.

## Frontend

All shipped assets are in `frontend/`. GitHub Pages serves static files; it cannot
host FastAPI or PostgreSQL. Until an HTTPS backend is deployed and
`frontend/config.js` is configured, the page is explicitly a preview. It allows
trying aliases without repeating them in the current page session, but it cannot
reserve names globally. Preview mode never enables registration or writes records.

Set `MOON_CAMPUS_API_BASE` in `frontend/config.js` to the HTTPS API origin after
deployment. Never add secrets. The page uses the official Telegram WebApp SDK.
For registration, it needs authenticated Mini App initData and either
`#invite=<private token>` or the Mini App's invitation `start_param`. Fragments are
not sent to the static HTTP server; do not put invitation tokens in query strings.
The public website outside Telegram remains a preview; a standalone browser
Telegram-login flow and a post-registration student session are subsequent work.

The page has no free-text identity fields, uses textContent for server aliases,
announces updates to assistive technology, supports keyboard focus and iPhone safe
areas, and disables submission while a request is pending or a reservation expired.
It shows success only after the backend confirms registration. HTTP error states
and timeouts offer recovery without displaying internal identifiers.

## Validation

- `cd backend && ../.venv/bin/python -m pytest -q`: isolated synthetic records;
  tests always replace DATABASE_URL with a temporary SQLite database.
- `npm ci --prefix tests/frontend` then `npm test --prefix tests/frontend`:
  browser tests require Chromium at `/usr/bin/chromium`, or `CHROMIUM_PATH`.
  These tests emulate iPhone viewports in Chromium; they are not a Safari-device test.
- Migration upgrade, schema comparison (`alembic check`), downgrade and re-upgrade
  verified on disposable SQLite and PostgreSQL 16 databases; PostgreSQL verification
  also preserved a synthetic legacy student and exercised registration.
- Concurrent PostgreSQL registrations with the same invitation admitted exactly
  one account. A real Chromium → FastAPI → PostgreSQL browser smoke check also
  verified the registration flow and CORS. Docker startup and schema readiness
  were checked with a fresh, disposable Compose database.
- The cloud build used verified host-downloaded wheels offline, as build-container
  DNS is unavailable in this environment; no TLS verification was disabled.

Not implemented in this change: full role/session management, authenticated administrator UI,
assignments, submissions, grades, React/TypeScript migration, avatars, biographies,
XP, leaderboards, worker, Google integration. Keep these as subsequent milestones.
Existing accounts are preserved; their login/session flow is also subsequent work.
The Pages workflow deploys pushes to `main` only. Review and approval are required
before merging or publishing this branch to the live site.

## Pages review publication

The Pages workflow runs on frontend/workflow pushes to `sprint-2-registration`
and can also be manually dispatched from that branch.
For a branch dispatch it combines the latest `main` frontend at the site root
with registration and the synthetic teacher dashboard under `/preview/`. It does not merge
code into `main`. A subsequent normal
`main` deployment replaces the whole Pages artifact and can remove this preview.
GitHub Pages environment branch rules must permit the branch before deployment.
Check the workflow outcome and live `/preview/` response before claiming publication.
GitHub Pages hosts this static preview only; registration still needs the backend.
