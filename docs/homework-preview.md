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
records, work or grades. No data is written to an API or durable storage. A one-time sessionStorage handoff carries only synthetic group IDs, names and course assignments when navigating from the dashboard; homework reads and deletes it.
There are no academic scores, grade exports, AI feedback, real student sessions,
private file storage or enforced server-side permissions in this demonstration.
The data projections are UI examples, not a security boundary. A production version
must authorize roles and group membership on the server and transactionally enforce
attempt limits, retain immutable snapshots and protect submissions/feedback.

## Verification

`npm test --prefix tests/frontend` runs 36 tests (28 browser checks and eight model/text-analysis unit checks), including thirteen homework
checks: the complete role-switch cycle; cross-group/other-student exclusion; attempt
limits, duplicate handling and immutable versions; safe document links and literal
text; Moscow deadlines and late labels; mobile layouts and keyboard dialogs.
The existing registration and teacher dashboard checks remain included.
Pages publication includes only static web assets and preserves the current main
frontend at the site root. No merge into `main` is performed by publication.

## Courses and text review

Every group has exactly one course: «Практика речи» or «Грамматика (иностранный язык)».
The dashboard allows naming, renaming and selecting a course. Its assignment link
passes the synthetic catalog once to the homework page. Direct visits and reloads
restore the initial fixtures. This is not a shared production database.
Tasks inherit their group’s course; course filters separate the assignment lists.
Learning scores and per-course progress charts are not yet implemented.

Assignments accept comma-, semicolon- or newline-separated target words/phrases.
Text attempts immediately show exact-form coverage with case/NFKC normalization,
complete-word boundaries and whitespace-separated phrase matching. Inflections,
synonyms and contextual correctness require a teacher. Links are not analysed.
Rule-based hints cover missing vocabulary, lowercase English I, repeated spaces,
spaces before punctuation and a possible missing final punctuation mark. They
are suggestions, not a full grammar checker. Original submissions stay unchanged.
Teachers explicitly add hints to an editable comment and publish it separately.

No AI authorship detector or probability score is provided: text alone cannot
reliably establish AI use. Discussing a work and comparing its attempts can help
a teacher investigate, without an automatic accusation or academic penalty.
No paid APIs or remote text-processing requests are used.

## Multiple audiences, IMT and announcements

A single task has a groupIds audience and one course. The mobile-friendly checkbox
selector accepts multiple groups of that course; a student's attempts and feedback
stay individual and version-specific. Teachers can filter by group/course/type.
Task types are regular, IMT, checkpoint («Срез») and Extra task. Start/deadline,
period label and criteria are editable; IMT suggests 30 days, without fixing the
semester calendar or the number of periods. Text submission before the start is
rejected. Late handling and the existing three-attempt limit are unchanged.

Speech_Practice_IMT.pdf is an illustrative reference, not application instructions.
Three optional editable examples summarize its essay/oral defense, shadowing and
vocabulary mind-map tasks. The source PDF and its September/October dates are
not published. The sample's 2 points/task, 6 points/period, three chosen tasks and
limited quiz slot are not global rules. IMT task-choice limits, sign-up slots,
oral-check completion and configurable scoring need a later authenticated backend
implementation. Current criteria can describe these conditions but do not enforce
them. The user's usual 3 grammar periods / 2 second-year speech periods remain
planning defaults, not hard-coded restrictions.

Constructions are separate newline-delimited templates. A literal phrase or
ellipsis (... / …) with 1–12 intervening words may match a text; input is matched as tokens with bounded gaps, never executed as a user regex. Labels such as “Present Perfect” are not grammar recognizers.
Semantic/grammatical correctness, inflections and complex syntax need teacher
review. Missing template hints can be added to draft feedback, not automatically
published or applied to submitted text.

Teachers publish announcements for selected groups, including across courses.
Students see announcements addressed to their group. Original local SVG emotes
(:moon:, :sprout:, :spark:) render in announcements, submitted texts and feedback;
pickers insert tokens with the input's length limit. Unknown tokens and HTML-like
text remain literal. Task/announcement reactions toggle once per emote and demo
viewer, with accessible pressed state and counts. All state resets on reload,
with no outbound message, API write or notification. These UI projections still
provide no production authorization boundary.

Photo comments/submissions, mood emotes, vocabulary-list handoff and personal task status are documented in learning-preview.md.

## Checkpoint periods, results and compensation

Checkpoint creation has separate study start/end, test timestamp and submission
deadline (all Moscow). The test date may fall outside the study period. Historical
checkpoints are allowed for entering completed results; other task deadlines must
remain in the future. End of period must follow its start.

Teachers enter a synthetic student's result/maximum and attach up to three photos,
or save photos alone while the result is still pending,
or import semicolon-separated `alias;score;maximum` TXT/CSV up to 100 KB/200 rows.
The small assessment roster contains two synthetic students per group. Import
validates the complete batch before modifying results; unknown aliases, repeats,
missing/invalid numeric values and scores outside [0,maximum] reject the batch.
CSV updates retain attached photos. Students see only their own result/photos,
without the teacher import UI. Results are academic records separate from XP.

Compensation tasks reference a specific checkpoint and a subset of its groups,
with the same course. The teacher checks «справка за этот период проверена» for a
student on that checkpoint. No certificate file, diagnosis or medical narrative
is collected. This grants eligibility only for that student/period; it does not
permit compensation for another period. Without eligibility the task is hidden
unless the student already has a submission, in which case old versions/feedback
remain visible with the submission form locked. Eligibility is checked again
before acknowledging a new attempt. Revocation never deletes earlier versions.
The normal three-attempt limit and text/photo/link submissions still apply.

These are memory-only synthetic demonstrations, not production access controls.
Before real use, checkpoint/results/compensation and media must be stored privately
and authorized on the server. Suggested clearance record: student ID, checkpoint
ID, approved-by/at, revoked-at; no medical attachment. Period changes require
clearance review. Server transactions must enforce eligibility, attempt limits
and immutable history for web and Telegram submissions alike. Do not enter real
results or health information into publicly hosted Pages demos.
