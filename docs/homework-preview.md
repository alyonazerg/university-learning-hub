# Homework workflow demonstration

Review page: `/preview/homework.html`. The same page switches between the teacher
and the synthetic student **Silver Fern**, a member of group 01. Opening
`homework.html?role=student` selects the student demonstration initially.
The role switch is explicitly a demonstration control, not authentication.

## Review the complete cycle

1. In teacher mode, create a task for group 01 with instructions and a future deadline.
2. Switch to student mode and submit fictional text or a document link.
3. Return to teacher mode, select that task, and review **Silver Fern**'s submission.
4. Save a comment and switch back to student mode to see it on the same attempt.

The initial fixture also includes a fictional submission from **Silver Willow**.
That submission and its feedback are not displayed in Silver Fern's student view.
Teacher-created tasks for other groups are excluded from this student's task list.

## Implemented behaviour

- Task creation with title, instructions, one of eight synthetic groups and deadline.
- Explicit Moscow time for deadline input and display, independent of browser timezone.
- Student projection limited to their assigned group's tasks and their own attempts.
- Up to three attempts per student/task; duplicate versions do not consume attempts.
- Browser-memory snapshots: content, type, timestamp, SHA-256 fingerprint and lateness
  are fixed before acknowledging a submitted attempt. A resubmission adds a version
  without replacing an earlier one. Feedback is stored separately per attempt.
- Teacher review of all submitted attempts, with editable textual feedback.
- A new attempt does not inherit the previous attempt's feedback or reviewed status.
- HTTPS-only document links, rejecting embedded usernames/passwords. Links are never
  fetched by the demonstration; they open only when explicitly clicked, with
  `noopener noreferrer`. No Google API, paid API or document-copy process is enabled.
- Late submissions are accepted and labelled, without applying an academic penalty.
  The 20% policy's calculation basis remains unresolved in `architecture.md`.
- Unsent drafts survive role/task switching in the current page session. Submission
  state, drafts, tasks and feedback reset when the page reloads or is reopened.
- Text is rendered literally, including HTML-like content; no raw HTML insertion.

## Boundaries

Everything uses synthetic data and browser memory only. Do not enter real student
records, work or grades. No data is written to an API or browser persistent storage.
There are no academic scores, grade exports, AI feedback, real student sessions,
private file storage or enforced server-side permissions in this demonstration.
The data projections are UI examples, not a security boundary. A production version
must authorize roles and group membership on the server and transactionally enforce
attempt limits, retain immutable snapshots and protect submissions/feedback.

## Verification

`npm test --prefix tests/frontend` runs 14 browser tests, including six homework
checks: the complete role-switch cycle; cross-group/other-student exclusion; attempt
limits, duplicate handling and immutable versions; safe document links and literal
text; Moscow deadlines and late labels; mobile layouts and keyboard dialogs.
The existing registration and teacher dashboard checks remain included.
Pages publication includes only static web assets and preserves the current main
frontend at the site root. No merge into `main` is performed by publication.
