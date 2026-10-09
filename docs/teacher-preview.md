# Teacher dashboard preview

Public review page: `frontend/admin.html`, deployed under `/preview/admin.html`.
This is a synthetic demonstration, not authenticated access to the administrator
API. The banner and teacher role label explicitly identify demo mode.

The initial fixture contains eight groups with fifteen planned student places
each: 96 synthetic registered aliases and 24 pending places. No legal names,
Telegram IDs, grades, real invitations or credentials are included. The page
makes no API requests and does not write browser storage. Refreshing resets it.

Implemented interactions:

- Select or search groups; on mobile, selecting a group brings its details into view.
- Search aliases and filter registered or pending places in the selected group.
- Create a demonstration group, with trimmed names and case-insensitive duplicate
  validation. Names are rendered as text, never interpreted as HTML.
- Create and copy a `DEMO-` invitation code. These codes cannot register accounts;
  the page labels this limitation. Inviting into an empty group adds a pending place.
- Keep each group's latest demo invitation while moving between groups.
- Open student registration through the navigation link.

No confidential identity-registry UI, grades, assignments or student-progress
analytics are supplied by this preview. The progress bar measures registration,
not learning achievement. Real administrative access requires server-enforced
teacher authentication and role management before connecting private records.

Validation: `npm ci --prefix tests/frontend` then `npm test --prefix tests/frontend`.
Eight browser tests cover registration plus teacher groups, search/status filters,
duplicate names, HTML-injection resistance, demo invitations, reset behaviour,
absence of API writes, iPhone viewport layouts and keyboard dialog controls.
