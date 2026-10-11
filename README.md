# University Learning Hub

Private university learning platform for eight teaching groups (~120 students).

## Status

**Current development handoff (12 October 2026):** connected cabinet and revision tests use server-backed records; optional AI essay review is teacher-confirmed. Read [the platform development brief](docs/platform-development-brief.md) and [the Moon Campus skill](.agents/skills/moon-campus/SKILL.md) before changes. Deployment status must be checked separately.

## Structure

- `backend/` — FastAPI application and tests
- `bot/` — aiogram entrypoint (placeholder)
- `frontend/` — static HTML/CSS/JavaScript cabinet and public tests
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

See [registration contract and deployment notes](docs/registration.md) for group-bound invitations, server-issued pseudonyms, migration of existing databases, and frontend preview limitations. The connected vocabulary cabinet now has server-side sessions and private review storage; see [server-backed learning](docs/server-learning.md). The connected cabinet also saves assignments, submissions, compensation access and pseudonymous attendance; see [server coursework and attendance](docs/server-coursework-attendance.md). Announcements and rankings remain browser demos.

For an optional separate API on a Beget VPS while retaining Pages, see [Beget launch instructions](docs/beget-launch.md).
