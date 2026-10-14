# Bug reporting

All top-level HTML pages load `bug-report.js`. The shared `Report a bug` button opens a form for title, description, steps, expected behaviour and one PNG/JPEG/WebP screenshot (up to 5 MB). Reports can be sent before login. The path and selected browser metadata are attached; URL queries and fragments are discarded so invitation and attempt tokens are not collected.

Reports are stored in PostgreSQL by migration `023_bug_reports`; screenshots are private database attachments. A receipt token lets the reporter check status using `My reported issues` in the same browser. Receipt tokens are stored locally, never in source control. Queue, screenshots, assignment, comments and workflow changes require the existing teacher/admin session.

Teacher Hub → Bug reports supports search and status filters, priorities, assignee, comments and activity history. Statuses: New → Triaged → In progress → Resolved → Closed. Issue keys use `MC-0001`. This is an internal queue; there is no connection to Jira or automatic developer notification.

Relevant checks: `backend/tests/test_bugs.py`. API routes are under `/learning/bugs`. Issue submission is multipart; queue updates are PUT. The backend limits submission frequency and rejects executable image formats such as SVG. New pages must load the shared script and Dockerfile must continue to include the CSS and JS.
