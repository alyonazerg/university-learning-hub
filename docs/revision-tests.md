# Revision Tests

Students use the same `/revision-test.html` entry link, select a group, then an open test. Vocabulary is filtered by group. Existing attempts retain the content snapshot with which they started. Teacher content changes affect new attempts.

After submission, the receipt shows the Attempt ID. In the teacher cabinet, select Revision Tests and View results / Refresh results. An expanded student row shows the attempt ID, Moscow start/submission time, Speaking assessment and Essay review. Written score is vocabulary/grammar /80 plus the teacher's essay mark /20. Speaking /20 is reported separately. A submission can be awaiting assessment while still being submitted. Multiple attempts may have the same student name. Find a specific attempt opens the matching test by receipt ID.

## Speaking procedure

Call submitted students individually; they reveal the individual question and answer immediately for 60–90 seconds. Save all four individual criteria for each participant, then use Results → Pair students to select two assessed students in the same group. Both receive the same situation and only their own role A or B, filtered on the server. Each opens the card when instructed. Once both cards are open, a shared timer gives 30 seconds to read, then 60 seconds to prepare, then 2–3 minutes to speak. For an odd participant, choose Teacher as partner. Written tests need not finish simultaneously.

## Essay review with AI

On the VPS, edit `/opt/moon-campus/.env` privately (never paste a key into chat or commit it):

```dotenv
REVISION_AI_API_KEY=your_private_key
REVISION_AI_MODEL=gpt-4.1-mini
REVISION_AI_BASE_URL=https://api.openai.com/v1
```

An OpenAI-compatible provider can use its own base URL and model. Recreate the API service after changing the environment. In a submitted student row, Essay review → Check essay with AI generates a provisional breakdown for content, organisation, grammar and vocabulary, each /5. Use AI suggestion fills the teacher's form, but Save essay grade is required for a final written result. Student submission never waits for an AI call. Only the level, chosen essay topic and essay text are sent; the API payload does not include the student's name, roster or group.

## Research export

Research CSV / Excel includes consenting submissions only; teaching export includes all students. Exports distinguish test/unit/group/condition and chosen essay topic, start/submission time, lexical/grammatical accuracy, item answers, accepted answers, first-input reaction times, per-item completion times, field input-event counts and visits, whole-test duration, essay duration/input events, connection interruptions and known offline duration, page resumes, word count and type/token counts, vocabulary occurrences and teacher usage judgments, provisional AI score, final essay mark and separate speaking score/partner attempt ID.

Reaction and item durations are client-observed elapsed times, not laboratory measures of processing speed. Gaps, page resumes and offline periods can affect them. Input-event counts measure field interactions, not individual keystrokes or substantive edits. Offline duration counts intervals observed while the tab was open. Old attempts may lack new metrics; missing data must not be treated as a measured zero. Research withdrawal clears recorded item/research timing and excludes the attempt from research exports; academic answers and marks remain.

## Student results and rating

The whole revision test contributes at most **3 rating points**. The retained analytical marks are vocabulary/grammar 80, essay 20, and speaking 20. The final rating is `(controlled + essay + speaking) / 120 × 3`, rounded to two decimals. It remains pending until both teacher assessments are saved. This calculated contribution is shown and exported; it does not automatically modify a separate institutional rating ledger.

Students can copy a private result link after submission and refresh it later to see current essay and speaking marks and teacher feedback. The capability token is in the URL fragment, not the request URL, and is sent only in the API Authorization header. Anyone holding that link can read the result: students should keep it private. The fragment is removed from the address bar after loading and the credential is retained locally for refresh.

The student learning hub has **My results**. Its list is stored on the current browser, independently of the student's platform account; it is not cross-device account synchronisation. On a different device, students can paste their complete private link into My results or open it directly. Losing both browser storage and the private link requires teacher support; the public entry link never lists personal results.

## Criterion grading and semester plan

Essay grading uses Content, Organisation, Grammar, Vocabulary (each 0–5). Individual speaking uses Vocabulary, Grammar, Coherence, Content (each 0–5); dialogue uses Vocabulary, Grammar, Coherence, Communication strategies (each 0–5). Older five-criterion assessments remain stored as legacy evidence. The server validates complete breakdowns and derives the total; old total-only marks remain readable without invented criterion scores. Criteria are included in private student results and exports.

RT1 covers Unit 7, RT2 Unit 8 (first assessment), RT3 Unit 9, Final RT Units 7–9 (second assessment), each worth up to 3 rating points. Choosing a semester stage in the draft editor fills the unit and title. No future questions or fixed dates are fabricated. Migration 012 labels the untouched default Unit 7 tests RT1; custom titles and existing attempts are preserved.

## RT1 contextual recognition update

All vocabulary, collocation and group-specific vocabulary items now provide five options, testing context, meaning or natural usage rather than unsupported recall. Website grammar items retain their format. Paper versions use 20 A–E questions with eight lexical/collocation, eight grammar and four group-specific items, plus a separate essay. The fixed ZipGrade answer sheet is unchanged. Both printable archives contain the updated papers and password-protected teacher keys. Previously begun attempts retain their material snapshot; untouched old defaults in copied tests and unbegun attempts are updated by migration 014. Separate administration formats must still be retained for analysis.

## Research choice display

Consent is selected once, before the test. There is no repeated withdrawal button on the preview, question, essay or receipt screens. Students may ask the teacher to withdraw consent. The teacher action is inside Research data and answers, with confirmation; it preserves academic answers and marks, clears timing data and excludes the attempt from research exports. The protected teacher endpoint requires administrator access.

## Familiar alternatives and full grammar constructions

Unit 7 lexical alternatives use taught shared vocabulary or full examples of the same target word/expression. This prevents simply selecting the sole familiar word among unrelated distractors. C1 online grammar requires the whole construction or a sentence rewrite, with mixed noun/pronoun subjects. Grammatical ordinary subject–verb order is also accepted for optional place-fronting cases. Paper grammar keeps A–E but tests complete constructions. Migration 015 updates untouched previous defaults and unbegun snapshots while preserving teacher edits and begun attempts. Copy detection in essays includes option sentences as well as question text.

## Current speaking administration

Dialogue assignment is controlled by the teacher, rather than automatically pairing whichever students finish together. Printed situations can also be distributed in person with the same 30-second reading and one-minute preparation allowance.

Current speaking grading has two sets of four criteria, each 0–5: Vocabulary, Grammar, Coherence, and Content for the individual answer; Vocabulary, Grammar, Coherence, and Communication strategies for the dialogue. The speaking mark is the average of the two /20 totals. Prior five-criterion marks remain readable and are not redistributed automatically.

AI rubric requires evidence for every mark. Keyboard-mashing responses without any vowel-bearing English token receive a provisional zero locally, without an external AI request; other nonsense is explicitly covered in the model rubric. Meaningful short responses are assessed on actual evidence, not a mechanical word-count penalty. Existing AI suggestions require rerunning the review to update; teacher-confirmed marks are not overwritten automatically.

## Dashboard and AI evidence

Teacher navigation separates Tests, Results, Analytics and Settings. Results shows one selected student's work with Essay, Speaking, Answers and Research views. Pending marks are not zeros. Analytics can aggregate the selected test or all tests and show groups or all groups, section means and lowest-scoring tasks with sample counts. It counts attempts, not unique students; differing levels, formats and versions remain descriptive comparisons.

AI receives the attempt's group-filtered target words and grammar notes, returns exact essay quotations and provisional quality labels, and counts distinct correctly used lexical units and grammar constructions. Three naturally correct lexical units are strong evidence for a high vocabulary mark, not an automatic full mark. The teacher confirms all grading; quotations absent from the essay and unknown lexical targets are discarded. An AI review rerun does not change final teacher marks by itself.

## Essay integrity controls

The start page and essay screen disclose independent writing without AI, paste/drop blocking and browser activity recording. Paste, beforeinput-from-paste and drop are blocked in the essay field. Ordinary typing, mobile keyboard input and autocorrection remain available. JavaScript controls are bypassable and do not detect external AI authorship.

Academic integrity metrics are retained regardless of optional research consent: paste/drop attempt counts, page-hide/focus-loss counts, accumulated away duration, reload count, viewport width/touch flag and the last 50 timestamped events. They contain no clipboard contents, keystrokes, screenshots or other-app contents. They persist in local drafts through weak connectivity and are submitted with the test. Student actions are client-reported and incomplete; phone calls, notifications, OS switching and accessibility tools can produce similar events. No score penalty or cheating conclusion is inferred automatically. Research exports still filter out non-consenting students.

Essay and speaking totals are whole points out of 20, rounded to the nearest integer with .5 rounded up. Speaking first averages the individual and dialogue marks, then rounds once. Criterion evidence stays unchanged. Rating remains calculated to two decimal places out of 3.

Individual and dialogue grades can be saved separately. Missing parts remain awaiting assessment; the speaking total and final rating are pending until both are marked. Results → Manage attempt allows permanent deletion with confirmation; the counterpart keeps academic grades but its dialogue assignment is released. Deleted private result links stop working.

The student receipt keeps submission status, final rating and speaking actions visible. Section marks, feedback, criterion breakdown and private-link tools are grouped under Result details; speaking instructions are collapsed.

Preview research tracking is teacher-only and available for consenting students in experimental and control groups. The target list comes from the immutable attempt preview, matched to that attempt's taught vocabulary; verified grammar examples must actually occur in the preview. Default Unit 7 examples cover gerunds (B2) and place-fronting inversion (C1). Custom previews support explicit label/example metadata in the editor. Essay highlights and automatic lexical suggestions are provisional detection, not proof of correct use, independent production or causality. Teacher checklists separately record observed use in essay, individual answer and dialogue, with notes for accuracy, copying and examples. Saved empty checklists mean reviewed/no observed units; absent checklists mean not reviewed. Save observations only works without grades; grading can save them alongside marks. Regrading retains observations; consent withdrawal removes them. Research exports include preview targets, exposure condition and observations. Grade inputs accept whole criterion marks and block wheel/spinner changes. Legacy criterion evidence stays stored until a teacher explicitly resaves grades.

Teacher marking uses compact criterion rows with whole-point inputs. Individual and dialogue forms sit in two columns on desktop and stack on narrow screens. Answers have a bordered table. Analytics uses descriptive bands: below 50% red, 50–74% amber, 75%+ green, unassessed grey; the percentages remain visible. Teacher access works from another browser through learning.html with the same access key; saved records live on the server.

Attempt lifecycle: a new attempt requires a nonblank normalised name and an explicit boolean research choice. A saved browser attempt now shows its student identity and waits for Continue my saved attempt; Start a new attempt returns to blank identity/consent fields without deleting the old server record. Deleted/revoked attempts fail every protected API call, clear matching browser drafts/results and show Attempt unavailable. Visible online pages check status every 30 seconds and on focus; deletion cannot be detected while offline, but deleted work cannot be saved or submitted to the server. Teacher login stores only the expiring session token in sessionStorage, not the access key, so reloads preserve sign-in during the eight-hour session. Logout and invalid/expired sessions clear it; closing the tab ends browser persistence. Paper essay topic choices now match website topics in all group DOCX, A5 DOCX/PDF and A4 duplex PDFs.

Results → Pair students lets the teacher select a group and two submitted participants by name, with individual marks and short attempt identifiers visible. The second selector excludes the first participant; already assigned students are excluded. Teacher remains available for an odd participant. After pairing, Speaking shows both dialogue grading cards side by side on desktop, stacked on mobile, with one Save both dialogue grades action. Each participant retains separate criteria, feedback and observations; the server validates reciprocal pairing and saves both marks in one transaction. Individual marks remain separate.

Student dialogue responses contain the common situation and only that student's A/B task; the counterpart's role is removed on the server, including the oral status response. Both partners still share the reading/preparation timer. Unit 7 C1 strike a chord now tests contextual meaning rather than its preposition, including paper group 213/214 question 7. Migration 017 updates untouched defaults and unbegun attempts while preserving teacher edits and already begun work. Paper answer letters are unchanged.

The downloadable paper pack is reduced to 11 files: five group question DOCX, two book-specific A4 duplex essay PDFs, one official ZipGrade PDF, one teacher instruction DOCX and two encrypted teacher key files. Group 213/215 question files contain the preview after the participation choice; declining students skip it and remain excluded from research. Teachers separate and collect the preview page before releasing questions. Standalone previews, duplicate question papers, alternative essay layouts and speaking banks remain individually available outside this streamlined archive.

Individual grading is now mandatory before dialogue assignment: save all four individual criteria for each student, then choose the two assessed students under Pair students. The server also enforces this for pairing, teacher dialogue and legacy unlock actions. Assigning the pair opens Speaking with both dialogue grading cards; the saved individual mark is tucked into an edit section. Unassigned students see only individual grading. The pairing panel has extra padding and vertical spacing between selectors, action and student list.

Student speaking progress is restored from server grades: once the individual criteria are marked (including a zero), the public oral response sets individual_completed and omits the individual question. Reloading shows Individual answer completed and proceeds straight to the dialogue action. Paired/previously teacher-confirmed legacy answers also remain completed. A marked dialogue shows Dialogue completed rather than reopening its card.

Existing dialogue grades remain visible even when a legacy individual subtotal is absent: assigned pairs always show both dialogue assessment cards. A retained single dialogue mark is also shown after an assignment has been released. The individual-first requirement gates new assignment only; it does not hide existing dialogue evidence.

Completed student speaking now uses a compact green completion panel without empty question cards or upcoming-dialogue instructions. Result criteria are ordered and grouped separately for Essay, Individual answer and Dialogue, retaining legacy criteria in their own group. Return-link controls have a separated footer with spacing; criteria cards stack on mobile.

Compact paper layout (12 October 2026): all twelve existing question DOCX use A4, 11.5 mm vertical / 12.5 mm horizontal margins, Arial 11 pt, single spacing, compact option spacing and whole-question keep chains. Only the separate experimental preview page break remains; section breaks that wasted paper are removed. Rendered main papers are 4 pages for 213/215 including preview, and 3 pages for 214/216/217 (previously 7/5). Question wording, options, consent and four essay topics are unchanged. `scripts/compact_revision_papers.py` reapplies formatting; verify rendered pagination after content edits. The two original 11-file packs retain editable DOCX. `Revision-Unit-7-Compact-PDF-Pack.zip` is a separate 11-file print-ready equivalent with question PDFs instead of DOCX; official answer form, duplex essay sheets and encrypted keys retain their formats. No duplicate question formats inside a pack. Print questions A4 at 100%; separate/collect preview before test questions. Essay duplex remains landscape with short-edge flip.

Material audit 12 October: migration 018 contextualises remaining collocation defaults, semantic uses of resemble/raised the bar and supplies explicit subjects in six C1 grammar gaps. Begun snapshots and teacher edits are preserved. Regrade only imports current accepted answers when prompt, choices and groups still match the attempted item; changed material versions keep their original key. API CORS now permits authenticated browser DELETE. See platform-audit-2026-10-12.md for live/read-only checks, local verification and UX priorities.

Teacher-as-partner dialogues: Speaking shows the assigned situation and both tasks, with Student A identified as the learner and Student B explicitly identified as the teacher. The public learner response still contains only its own role. Student receipts thank the learner at the end of the written test, and say Test completed once Speaking is assessed. Shared action-feedback.js adds pending spinners, duplicate-click blocking and a live success/error notice to connected-cabinet and revision-page save/refresh actions, including after a rerender removes the original button. Reduced motion is respected; failures never show successful saving.

Student writing/speaking instructions and all paper question/essay sheets explicitly ask for naturally appropriate vocabulary and grammar constructions studied in the student's group. AI essay assessment uses a supportive, moderately generous classroom rubric: reward communicated ideas and understandable attempts, tolerate occasional minor errors, prefer the higher defensible borderline integer, avoid double deductions and fixed bonuses. Nonsense remains zero, teacher confirmation remains required. Feedback recognises actual strengths and proposes achievable improvements. Up to three language_errors are checked against the essay and appended as parenthesised original → correction examples; invented quotations are discarded. Existing suggestions need a rerun; confirmed teacher marks are not changed automatically.

Essay reload preservation: restore the matching local draft immediately after fetching a saved attempt, before showing the identity/resume screen. Otherwise repeated reloads/focus events on that screen can overwrite newer device text with stale server state. Draft writes also read the current essay field and topic selector to retain visible values through unload/IME/autofill timing. Regression coverage reloads three times before Continue, with server PUT unavailable and an older server essay, and confirms exact multiline text and topic on return. Same-browser local storage is required; an offline page reload may need connectivity to reopen, but it must not erase the retained draft.
