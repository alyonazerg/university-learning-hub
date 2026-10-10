# Group schedule and calendar thematic planning

The connected cabinet has separate schedule and thematic-plan sections. Teachers
choose a group; students only receive their own group's entries. No legal names
or new identity mapping are introduced. Dates are entered/displayed in Moscow
time and stored as UTC. All changes require an authenticated administrator.

- Add a weekly weekday/time over an inclusive period (at most one year). The
  browser previews the model by generating concrete dates; the API persists
  those lesson entries atomically. Add another weekday separately. These are
  dated lessons, not rules which silently create new lessons later.
- Prepare individual topics or paste up to 120 topics, one per line. Dates may
  be omitted. Each entry has a number, duration in minutes, type, room/location,
  objectives, materials, target vocabulary and target constructions.
- Edit topics and dates, or mark a topic completed. Overlapping dated lessons
  within one group are rejected, including duplicates and conflicts inside a
  bulk request. Adjacent lessons are allowed. Different groups may share a time.
- Create/open an attendance journal from a dated entry. Repeated clicks return
  the same journal and preserve marks. Once linked, the date and topic cannot be
  rewritten; other planning fields remain editable. An existing journal with a
  different topic is not silently adopted or overwritten.
- Plain materials text and links are rendered as text. File imports/PDF parsing,
  automatically linked homework and public subscription calendars are outside
  this change. Cancel an unjournaled lesson by clearing its date; its topic stays
  in the plan. No deletion endpoint or automatic student grading is introduced.

Migration `005_lesson_planning` adds only a table/index; prior data stays intact.
The new frontend tolerates an old server's missing `/learning/plans` endpoint
while keeping login and the rest of the cabinet functional. After publication,
update the Beget checkout and rebuild the API; startup applies the migration:

```sh
cd /opt/moon-campus
git pull --ff-only
docker compose -f docker-compose.yml -f compose.beget.yml up -d --build
```

Tests cover UTC/Moscow weekly dates, private read access, administrator-only
changes, atomic overlap validation, undated topics, journal idempotency,
migration roundtrip and persistence through server restart. Browser checks
measure panel/button spacing and horizontal bounds at 320, 390 and 1280 pixels.
