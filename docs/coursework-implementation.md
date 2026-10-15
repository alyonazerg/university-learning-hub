# Connected coursework: first delivery

Implemented with migration `028_coursework_review`; availability on mooncampus.ru requires deploying the delivery branch. This is the assignment/review/journal foundation, not completion of the entire development roadmap.

## User flow

Teacher → Assignments → Create assignment. Select course, groups and type; optionally choose a teacher-supplied task template. Confirm semester, period, category, maximum, XP and the preliminary AI checkbox. Publication creates a fixed assessment policy; submitted work also stores a snapshot of instructions, targets, rubric and source group. Custom assignments have a single overall criterion. Grammar template rubric splits were not supplied, so no invented component splits are used.

All 18 supplied IMT/extra menu entries are available as templates. IMT and extra are optional: no submission means Not selected, not a debt. Template instructions do not prove live performance. Team contribution statements and presentation slots currently require teacher agreement; automatic shared team submission/reservation is a later stage.

Student → Assignments → text/link/photos or private documents/recordings → Submit work. Three immutable attempts are retained. Text drafts and pending upload references are scoped to the signed-in alias and assignment; the server can restore pending uploads. A failed submission retains input and its request ID. Uploaded files are not submitted until the student confirms the attempt.

Teacher → Review queue → choose the latest attempt → inspect the evidence and private AI suggestion → optionally copy suggestions as a draft → enter every criterion and feedback → Confirm grade or Request revision. Optimistic versions and database locks reject stale/concurrent assessments. An already approved grade can be corrected, not silently erased by requesting revision on that same attempt. When a newer attempt awaits review, the last confirmed award is retained until its replacement is approved. Assessment history is append-only and available to the owner/teacher.

Teacher → Journal; student → My points. The matrix updates when opened and polls every eight seconds while visible. It displays task states, confirmed raw marks, category caps, credited total and separate XP. Category limits use the source-based grammar and Speaking Practice distribution; extra is capped once across the semester, not once per period. Speaking Practice allows at most three positively credited IMTs per period and three positively credited extra projects per semester. A grade correction can release a slot. Zero and pending are distinct.

The journal explicitly covers assignments published with the new policy. Existing standalone idiom IMT collections, anonymous/private-link revision attempts and pre-policy homework remain intact; their marks are not guessed into a semester. Link/import workflows are still needed before calling this a complete historical university journal. Existing grading contracts for revision tests are unchanged. No attendance award or attendance-based credit gate exists; students receive no attendance records.

## Durable AI worker and privacy

Compose runs `coursework-worker` separately from the API, using the existing private `REVISION_AI_API_KEY`, model and base URL. No additional API key is required. A database job is committed atomically with a submission. Claim/lease comparisons prevent two workers from storing results for the same claim; expired five-minute leases recover after interruption. Failed checks require teacher retry, at most three attempts. Saved reviews are not rerun. Queued work already assessed by the teacher is canceled. A crash after an external response but before saving can require another provider request; provider billing is not claimed to be exactly-once.

The worker processes text, TXT, DOCX, text/scanned PDFs and prepared photos. It sends the assignment, criteria, targets and student evidence, not campus identifiers, names from the roster or group lists. Provider output is untrusted: criterion scores are bounded, unknown keys are ignored and live/oral evidence never receives an inferred score. Preliminary results are teacher-only and never publish academic credit. Missing configuration/failures leave submissions available for manual assessment.

Private recordings can be submitted but are not sent for external audio transcription. Links are not fetched. A recording/link without analysable text/photos goes directly to manual review without an unnecessary paid AI request. Other written evidence may still receive feedback for its written criteria.

Files: PDF, DOCX, TXT, MP3, M4A, MP4, WebM and WAV; up to three per attempt, 12 MB each. Larger recordings can be submitted as private links. Ownership is checked for attach/download/delete; downloads use attachment disposition, octet-stream and nosniff. Prepared photos retain their existing limits. Pending uploads are limited to six per student and expire after 24 hours; submitted files are retained with attempts. A 12-upload daily limit bounds storage abuse. Submitted bytes live in private PostgreSQL storage and must be included in normal database backups.

## Records and verification

`homework_tasks.assessment_config`, `homework_submissions.snapshot/review_version`; `coursework_ai_jobs`, `coursework_reviews`, `coursework_credits`, `coursework_attachments`. Academic points are stored as integer hundredths. One current award per student/assignment prevents duplicate points and XP. Changing a grade replaces that current award while preserving history. New assignment XP is included in private profile XP and the voluntarily shared group ranking; attendance remains excluded.

Checks: `backend/tests/test_coursework_review.py`, legacy homework/profile/group tests, and the real browser catalogue → submission → approval → journal → API restart/reload scenario in `tests/frontend/learning-session.test.cjs`. Test records and AI responses are synthetic; no real student work is sent to an external provider by the tests.

Deployment: standard `git pull --ff-only origin sprint-2-registration` and `docker compose -f docker-compose.yml -f compose.beget.yml up -d --build`. Alembic runs in the API; the worker waits for the schema. Check `docker compose -f docker-compose.yml -f compose.beget.yml logs --tail=80 coursework-worker` if jobs stay queued. API shutdown is bounded for open SSE streams; the worker gets time to finish its current provider call before container shutdown.

Next roadmap work: one mastery/review activity for each course; broader games/spaced grammar practice; full KTP workflow; shared team submissions/reservations; explicit linking of legacy results; configurable participation policy and any university export. Do not claim these are implemented by this delivery.
