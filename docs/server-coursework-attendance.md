# Persistent coursework and attendance

The connected `frontend/learning.html` cabinet now includes assignments,
submissions, feedback, compensation permissions and attendance using the same
expiring server-issued sessions as vocabulary. The separate demo pages retain
their synthetic in-memory behavior. No production API or bot was deployed by
this change; Pages still has an empty API URL and cannot persist records alone.

## Teacher workflow

1. Create an assignment for one or several groups of exactly one course.
   Regular tasks, IMT, checkpoints, extra tasks and compensation are supported.
   Period dates are required, a checkpoint may also have a test date within the
   period. Forms use Moscow time and send explicit timezone offsets to the API.
2. Add target vocabulary, target constructions and criteria. Student texts show
   the existing literal vocabulary and bounded construction checks, plus basic
   correction suggestions. These are review aids, not grammar or AI authorship
   verdicts. The teacher writes and saves feedback for an individual attempt.
3. A compensation assignment must refer to a checkpoint and use a subset of its
   groups. At that checkpoint, mark a student's certificate as checked after
   reviewing it outside the platform. Only that student's access for that
   checkpoint opens. No certificate image or diagnosis is requested or stored.
   Revocation blocks further submissions but preserves previous work/feedback.
4. Add a lesson by group, date/time and topic. A roster contains pseudonyms only.
   Use "Все присутствуют" and adjust exceptions, then save. Unmarked, present,
   late, absent and excused are distinct states. Unmarked never means absent.
   More than one lesson per day is supported; duplicate group/time is rejected.

Students identify themselves by showing their alias in the cabinet. Any mapping
of legal names to aliases stays in the teacher's separate private journal and is
not required by these endpoints or forms. Students see only their own attendance
marks and submissions. An excused attendance mark does not grant compensation;
certificate verification remains an independent action.

## Durable submissions and access

- Students may submit text, an HTTP(S) link or up to three browser-prepared JPEG
  photos (at most 1 MiB each after resizing). Source images are resized and
  rendered through canvas by the existing picker; its JPEG output is checked
  for type, base64 encoding, signature and size. This is not a full image decoder
  or malware scan. Image data is stored with the private submission as JSON,
  not in public Pages assets. Object storage is a later hosting improvement.
- Attempts are append-only, limited to three per task/student by a database
  check and unique keys. Student identity, timestamps and lateness come from the
  session and server clock. Future tasks cannot be submitted; late submissions
  are accepted and explicitly marked late, matching the demo's behavior.
- A client UUID makes an exact retry idempotent. Reusing that UUID for different
  content is rejected. Unique attempt/request constraints protect simultaneous
  requests; PostgreSQL row locks serialize task and checkpoint authorization
  with certificate changes. SQLite also enforces the unique constraints.
- No endpoint edits or deletes an existing attempt. Teacher feedback may be
  revised. Creation/moderation, certificate flags and attendance require admin.
- Authenticated responses have `Cache-Control: no-store`. Unrelated groups
  cannot read tasks/attempts; locked compensation contents are withheld.
  Students cannot enumerate classmates' marks or the certificate roster.

## Migration and validation

Apply `004_homework_attendance` with `python -m alembic upgrade head` using the
intended database configuration. The migration only adds tables and indexes;
it does not recreate the database or import synthetic demo records. Downgrading
removes these new tables and their records, so use a backup before downgrading
a populated database. Prior vocabulary, groups and registrations remain intact.

Verification uses disposable SQLite databases and synthetic identities:

```sh
PYTHONPATH=backend .venv/bin/python -m pytest backend/tests -q
npm test --prefix tests/frontend
```

The browser integration starts the actual migrated API, creates a checkpoint
and compensation, checks certificate gating, submits text and a real prepared
photo, saves feedback and pseudonymous attendance, then restarts the API and
reloads student accounts. It also verifies unrelated group isolation and mobile
widths. Backend tests cover attempt limits/retries/concurrency, date/link/photo
validation, certificate scope/revocation, attendance privacy and atomic batches.

Checkpoint result import, announcements/comments/reactions, production
leaderboards and Telegram homework/notifications remain outside this slice.
Configure HTTPS hosting, backups and the existing secret-backed authentication
before real student use. Beget/mooncampus.ru configuration was not changed.
