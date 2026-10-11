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
