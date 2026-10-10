# University Learning Hub

Private university learning platform for eight teaching groups (~120 students).

## Status

**v0.1.0 — foundation scaffold.** No student data, Google integration or AI processing enabled yet.

## Structure

- `backend/` — FastAPI application and tests
- `bot/` — aiogram entrypoint (placeholder)
- `frontend/` — React app (planned)
- `worker/` — asynchronous processing (planned)
- `docs/` — architecture and security decisions

## Quick start

1. Copy `.env.example` to `.env`, set strong database credentials, and configure `TELEGRAM_BOT_TOKEN` and `ADMIN_TOKEN` securely to enable registration.
2. Run `docker compose up --build`.
3. Visit `http://localhost:8000/health` (should return `{"status":"ok","version":"0.1.0"}`).
4. Run tests with `docker compose run --rm api pytest -q`.

**Never commit** `.env`, student identities, submissions, transcripts, API keys or exported grade sheets.

## Development order

1. Authentication, groups and pseudonymous student identities
2. Assignments, Google Docs templates and submissions
3. Immutable snapshots and separate review copies
4. Teacher review queue, rubrics and penalty ledger
5. Audio/video transcription, AI draft feedback, exports
6. Grammar and spaced-repetition vocabulary

All grading and privacy features must be verified before real student onboarding.

## Registration milestone

See [registration contract and deployment notes](docs/registration.md) for group-bound invitations, server-issued pseudonyms, migration of existing databases, and frontend preview limitations. The connected vocabulary cabinet now has server-side sessions and private review storage; see [server-backed learning](docs/server-learning.md). Homework, announcements and rankings remain browser demos.
