# Vocabulary, media and progress demonstration

Open `/preview/vocabulary.html`, linked from groups/homework. All users, words and
scores are synthetic. Everything is browser memory and resets on reload. No
production student data may be entered. This is not authentication or durable SRS.

Teachers prepare named target lists with source/presentation labels. Paste one
`word; meaning; example` per line, or import UTF-8 TXT/semicolon-delimited CSV up to
100 KB (15,000 characters, 100 entries). Blank/case-equivalent words are deduplicated.
No automatic extraction from an arbitrary PPTX/PDF is implemented. When the user
attaches a presentation, its candidate vocabulary must be reviewed before import.
Following the homework link in teacher mode passes target lists once via
sessionStorage; the assignment selector filters them by course and copies words
into the editable target-vocabulary field. Assignment limits remain enforced.

Students can propose emergent vocabulary with meanings and examples. Proposals
are visible as pending and cannot enter shared flashcards until the teacher
approves them. The synthetic student belongs to group 01, speech practice.

The confirmed teacher-bot format starts with an English definition and a Show
button. The answer includes expression, transcription, synonyms, antonyms,
collocations and an example with the expression highlighted. Russian meaning is
revealed separately and resets for the next card. Simple legacy word lists have
no definition, so their front explicitly asks for the expression's translation.
Four ratings show their actual next interval: Again 10 minutes; initial Hard,
Good and Easy are 1, 3 and 7 days. Subsequent intervals multiply the previous
interval by 1.2, 2 and 3 respectively, rounded and capped at 365 days. Again resets
the interval and reinforcement; Hard preserves reinforcement; Good/Easy advance
it by one. This is a transparent demo algorithm, not a reconstruction of the
old bot's scheduler from one screenshot. Three successful Good/Easy reviews
without an Again mark a word as reinforced. The progress
summary displays reinforced words, activity count and streak in Europe/Moscow.
A streak remains active until the day after the last review; duplicate days do
not increase it. One XP per word/card/day rewards activity, not academic grades.
Premature duplicate clicks cannot reschedule the word or create another XP event.
Server authority, canonical word IDs across lists, persistence, caps and a proper
XP ledger remain necessary before using this with real students.

Within-group demo rankings show opted-in aliases; the current student starts
opted out. Their own progress remains available. Cross-group rows contain only
team labels and normalized activity, with a minimum three participants; no other
group's aliases, personal marks or memberships are rendered. Synthetic histories
are explicitly labelled. Only an all-time demo period is currently implemented.
The complete production policy remains in profiles-and-leaderboards.md.

Homework/announcement comments accept up to three JPG/PNG/WebP photos of at most
5 MB each. A canvas re-encodes them as JPEG previews up to 1280 px, discarding source
metadata; invalid images/SVG are rejected. Photos are never uploaded in Pages.
A photo-only homework attempt is possible; original text/photo snapshots and
fingerprints are retained separately per attempt. OCR of submitted homework is not implemented.
Student comments are projected only within their group; teacher comments reach
the post audience. Server enforcement remains necessary.
Pending image preparation prevents submission, and invalid files require replacing
or clearing the selection. Unsubmitted photos reset if the page is rerendered.

Moon Campus mood faces express joy, sadness, anxiety, tiredness, curiosity and
pride, alongside the original lunar/botanical/support emotes. They render locally
in comments, work and feedback and are available as reactions. Emote tokens are
literal text during vocabulary/construction analysis, not evidence of grammar.

Verification: `npm test --prefix tests/frontend` includes 39 tests, with vocabulary
handoff, moderation, SRS/streak boundaries, ranking privacy, mobile bounds and
photo attachments/rejection. Offline Telegram contract checks are separate:
`python -m unittest bot.test_contracts`.

## Assigned card editors and board-photo OCR

A teacher can appoint exactly one demo student per group as a card editor. A new
appointment replaces the previous one; no appointment means teacher-only photo
processing. Other students retain manual emergent-word proposals. This is a UI
demonstration, not server-side authorization. Production editor assignment must
be checked on every draft/generation request, with group isolation and revocation.

Board-photo OCR is genuinely implemented with Tesseract.js 6.0.1, local English
and Russian trained data and same-origin WebAssembly workers. No photo is posted
to an API, AI provider, CDN or Telegram. Models download once from the Pages site
and may be cached by the library; images and extracted drafts are not persisted.
Handwriting, glare and multi-column boards are unreliable; review remains mandatory.
One JPEG/PNG/WebP up to 5 MB is decoded/re-encoded locally, resized to 1280 px and
shown as a preview. Recognized text must be edited before copying into the list,
then saved separately. Role changes clear board drafts; in-flight results are
discarded if the role/appointment changes. Recognition has a 90-second timeout.

OCR does not generate translations, pronunciation or examples. The teacher-bot card format is now confirmed and implemented from the supplied
screenshots. A full-card JSON array can be pasted or imported (same 15,000-character
limit), with a sample button for teachers/appointed editors. Supported fields are
`term`, `meaning`, `definition`, `transcription`, `synonyms`, `antonyms`,
`collocations`, `example`. Definition/term/meaning are required; optional arrays
accept up to 10 strings each. Types and field lengths are checked atomically;
case-equivalent expressions are deduplicated and rendering uses text nodes.
Other students retain simple emergent-list proposals. Full drafts by student
editors still require teacher approval. Authors may import a reviewed externally
prepared AI draft, but there is no configured LLM or one-click generation here. No paid AI API is connected. Do not describe plain
OCR/list parsing as AI card authoring. The eventual authoring flow should use the
confirmed card schema, editable drafts and teacher approval of student work.

Assets come from exact versions and npm lockfile integrity checks, with licenses
and language source notes retained. Generated frontend/ocr is ignored, not checked
into Git. Reproduce with `npm ci --prefix frontend --ignore-scripts` followed by
`npm run build --prefix frontend`. Pages builds them before uploading only static
web assets; node_modules, lockfiles and build scripts are not published. The nginx
Dockerfile uses a separate Node build stage for the same assets.

`npm test --prefix tests/frontend` builds OCR assets via pretest (runtime packages
must be installed first), then exercises real OCR on a synthetic board image,
editor replacement/group isolation, draft review and existing learning workflows.
The OCR integration test uses the actual worker/models, not a mocked recognizer.

## Connected cabinet

The separate `learning.html` implements server-backed vocabulary rather than
saving demo state. See [server-learning.md](server-learning.md) for the tested
flow and current deployment prerequisites. The Pages API URL remains empty.
