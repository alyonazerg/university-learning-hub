# Reviewed autumn 2026 schedule import

The Schedule section contains an import preset built from the user's reviewed visible worksheets. This is a confirmed preset, not a general Excel/PDF parser. Hidden worksheets are excluded. Grammar: 150, 151, 154. Speaking practice: 213–217. The corrected ABOVE Friday grammar lesson for 151 is 14:20–16:00. ABOVE speaking practice for 217 is Monday 16:00–17:30 and Friday 12:40–14:10.

Default period is 12 October through 29 December 2026 inclusive (148 lessons). The start date is editable. Dates/times use Moscow time. The 14:20–16:00 slots are 100 minutes, as written in the source. Other slots are 90 minutes.

Weeks are initialized from the supplied PDF: 31 August 2026 is ABOVE, alternating weekly. Review week calendar allows ABOVE, BELOW or no lessons. Holidays are not inferred. These choices are converted to concrete lesson dates when imported; this feature does not yet provide a separately persisted academic calendar or recurring schedule editor.

Preview groups and lessons checks existing group names/courses, overlaps and duplicates without creating records. Confirm import revalidates and commits all groups/lessons atomically. Matching active groups are reused. Same-time, same-duration ordinary lessons are kept with all teacher edits and attendance. Other overlapping lessons, inactive groups or course mismatches stop the import. The two authenticated endpoints are /learning/schedule-import/preview and /learning/schedule-import/apply. No schema migration is needed.

Deploy on the Beget VPS:

```bash
cd /opt/moon-campus
git pull --ff-only
docker compose -f docker-compose.yml -f compose.beget.yml up -d --build
```

Then refresh https://mooncampus.ru/learning.html and open Schedule → Import reviewed autumn 2026 schedule. Review dates and weekly exceptions, preview and confirm. Generic lesson topics are placeholders for the teaching plan, not inferred lesson content.


## Semester teaching plan and calendar export

The default reviewed period is 12 September–29 December 2026. Grammar groups 150, 151 and 154 each receive 18 numbered plan entries. The exceptional shared 12 September block (12:00–15:00 Moscow time) counts as lessons 1–2; two 90-minute planning entries are a bookkeeping subdivision, not a claim about the actual break time. Calendar export combines them into one shared event. Regular grammar starts on 16 September for 154 and 18 September for 150/151.

Full-class checkpoints replace existing class slots: lesson 8 on 19 October, lesson 13 on 25 November (154) or 27 November (150/151), lesson 17 on 23 December (154) or 25 December (150/151), and credit on lesson 18, 28 December. Tests 2 and 3 are proposed dates and remain editable in the teaching plan. Objectives contain the three topic blocks from the supplied rating plan. The importer upgrades untouched generic placeholders, preserves completed or teacher-edited lessons and journals, and previews upgrade counts.

Download Google Calendar (.ics) exports the currently reviewed week calendar with biweekly RRULE series, EXDATE exclusions for changed or cancelled weeks, and RECURRENCE-ID overrides for checkpoints. The checked-in calendars/moon-campus-autumn-2026.ics is the initial full-semester version for all eight groups. Dates are encoded in UTC; Moscow is UTC+3 throughout this semester. Importing a file is not live synchronization: subsequent edits on the platform do not update previously imported Google events.


## Lesson-topic files

Teaching plan → Import lesson topics accepts UTF-8 CSV (comma/semicolon), XLS and XLSX, up to 2 MB and 120 rows. Uses the first visible worksheet. Required headers: position, topic; optional: kind, date, time, duration_minutes, objectives, materials. Dates use YYYY-MM-DD and Moscow HH:MM times; Excel date/time cells are supported. Kinds: lesson/test/imt/extra. Assessment Tests are normalized to 90 minutes.

Existing positions are updated, new positions added; duplicate positions and conflicts reject the whole import. Blank optional cells preserve values, dates and completion status. Preview performs no writes. Confirmation revalidates and commits all selected groups atomically. Linked attendance dates/topics remain protected. The suggested 18-lesson grammar file can be applied to one group or 150/151/154 together, without replacing dates. The first seven topics follow the teacher's retrospective sequence and upcoming IMT-1 quiz; future pronoun/numeral and adjective/adverb allocation is a proposal.
