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

Flashcards reveal meanings/examples before self-assessment. Remembered words are
scheduled after 1, 3, 7 and 14 days; forgotten words return after 10 minutes.
Three consecutive successful reviews mark a word as reinforced. The progress
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
fingerprints are retained separately per attempt. OCR is not implemented.
Student comments are projected only within their group; teacher comments reach
the post audience. Server enforcement remains necessary.
Pending image preparation prevents submission, and invalid files require replacing
or clearing the selection. Unsubmitted photos reset if the page is rerendered.

Moon Campus mood faces express joy, sadness, anxiety, tiredness, curiosity and
pride, alongside the original lunar/botanical/support emotes. They render locally
in comments, work and feedback and are available as reactions. Emote tokens are
literal text during vocabulary/construction analysis, not evidence of grammar.

Verification: `npm test --prefix tests/frontend` includes 30 tests, with vocabulary
handoff, moderation, SRS/streak boundaries, ranking privacy, mobile bounds and
photo attachments/rejection. Offline Telegram contract checks are separate:
`python -m unittest bot.test_contracts`.
