# Moon Campus development plan · 15 October 2026

This is a development backlog, not a statement that the learning engine or official semester rating is implemented. Existing code must be audited before reusing it. Teacher confirms final academic marks. UI remains English.

## Foundation and group management

Groups have editable name, course (Speaking Practice / English Grammar) and membership. Teacher can transfer students, pause and restore access. Paused accounts remain available in the roster. Transfers revoke former editor privileges and sessions; account identifiers, saved submissions and marks remain unchanged. Historical task/group snapshots are not rewritten. Students join via verified invitations. Current model has one current group per account; simultaneous enrollment in multiple courses requires a separate enrollment model.

## Calendar and thematic planning (KTP)

KTP is required for both courses and each group/semester. Audit the existing lesson/topic planning, weekly schedule and topic-import modules before extending them; their presence does not mean a complete KTP workflow exists.

- Create manually or import a table; provide a clear template and preview validation before saving.
- Rows contain planned date, topic/unit, learning goals, hours/type of lesson, materials, assigned homework/practice, IMT/extra work and assessment checkpoints.
- Connect grammar topics and lexical sets to the mastery engine, and link each row to the actual assignment rather than duplicating its content and marks.
- Copy a semester plan/template to another group, previewing that group's schedule, holidays and date differences. Reusing an assignment template must not copy students' attempts or marks.
- Reschedule a lesson or the remaining plan with a preview of affected deadlines. Do not silently move existing test dates, active assignments or student submissions.
- Keep planned and actual dates/topics separately; support taught, postponed and canceled states. Attendance and participation awards link to the actual lesson and cannot be duplicated by rescheduling.
- Teacher view covers plan completion, overdue topics and upcoming assessments; students see the published plan and their associated tasks. Support draft/published versions and a printable/exportable KTP.
- An optional AI draft can suggest a structure from teacher-provided materials; teacher reviews it before publication. Do not invent textbook units, holidays or an official program.

## Learning and mastery — required for both courses

- First-year grammar: topic explanation, initial diagnostic, controlled exercises, independent application, spaced review and delayed mastery checks.
- Second-year Speaking Practice: vocabulary/expressions, recall of meaning and form, contextual choice, spelling/reconstruction, matching/classification games and independent use in a new context; spaced review.
- Track mastery for individual topics/items: not started, learning, due for review, needs practice, mastered. Completing a game once is not sufficient evidence of durable mastery. Keep accuracy, hints, attempts, last practice, review due date and performance on delayed checks.
- A teacher dashboard shows topics/items needing help, group coverage, overdue reviews and improvement. A student sees the next useful practice rather than a long undifferentiated list of exercises.
- Each activity has TWO explicit scoring policies: official academic credit and platform XP. Learning practice can contribute to both, under different rules. Teacher configures eligibility, caps, hint/retry effects and semester limits. First-pass performance and improvement should both be distinguishable.
- Official credit has a ledger of awards/corrections linked to evidence and policy version. Teacher approval or an explicitly configured auto-award rule is required. Unreviewed credit is pending, not zero. Do not change grades from later policy edits.
- XP rewards verifiable participation, improvement and scheduled review. Limit repeated rewards; identical/replayed events cannot award twice. Do not award unlimited XP for repeating the easiest exercise. Student ranking is opt-in; academic marks stay private.
- Exercise content/version is frozen for a started attempt. Submission retries are idempotent; preserve answers during network failure. Randomize suitable tasks without making unrelated prompts or changing the answer after submission.

## Work submission and review

Common engine for all IMT types, semester extra tasks and homework; separate templates/rubrics for grammar and Speaking Practice. Each template defines input formats, deadlines, attempts, maximum mark and semester contribution.

Lifecycle: assigned → draft → submitted → AI queued → teacher review → graded / revision requested → resubmitted. Lateness is a separate flag. Keep every submitted version and teacher comment. AI proposals do not publish final marks automatically.

Persistent AI job queue with progress, safe retries, clear failures and deduplication of paid processing. Unified teacher queue: original evidence next to rubric/proposal, editable marks/comments, approve/request revision and move to next. Support text, documents and handwritten photos as appropriate to each task.

## Attendance, journal and semester rating

Attendance awards participation credit according to the teacher's policy because all attendees are questioned. Bulk attendance entry; individual correction, lateness, excused absence, canceled lessons and make-up handling. Repeating save never doubles credit.

One official semester journal aggregates homework, IMT, extra work, attendance/participation, approved learning-practice credit and tests. Explain each total with its source; preserve audit history and export. No formula or weight is assumed until the teacher supplies the course rules. Keep XP separate from this academic total.

## Tests and research

Grammar Lab-style and review/revision tests: question bank, versions, timers, autosave, immediate/delayed feedback policies. Experiment settings cover conditions, preview, randomization, consent and telemetry. Freeze the conditions of started attempts. Separate educational analytics from research exports; honor consent and distinguish missing/ungraded from zero.

## Communication, achievements and pilot

Task-specific comment threads, attachments/replies, group announcements with read status, notification controls and Telegram delivery diagnostics. Achievements reward steady learning, delayed retention, improvement and successful revisions, not only high scores.

Invite two students from each group to the focus group, with varied devices and technical confidence. Use practice activities excluded from real marks. Test login, profile, task discovery, upload, AI/review statuses, revision, interrupted tests, learning games, delayed review, point explanations, messages and screenshot bug reports. Classify bugs, confusing flows and suggestions separately. Fix access/data-loss/incorrect-credit issues before wider rollout.

## Delivery sequence

1. Stabilize group management and core mobile flows; audit existing features.
2. Confirm assignment inventory, KTP structure, official scoring policies and learning-practice contribution for each course.
3. Deliver one end-to-end submission/review task and one mastery/review activity for each course, including both ledgers.
4. Pilot with the focus group; repair critical problems and verify backup restoration.
5. Expand KTP, task templates, practice games and semester journal; add attendance credit.
6. Expand test/experiment controls, analytics, achievements and PWA.

Decision inputs still needed: assignment lists/rubrics; semester caps/weights; which grammar topics and lexical sets to start with; what counts as mastery; how practice/hints/retries contribute to academic credit and XP.
