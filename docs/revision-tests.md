# Revision Tests

Students use the same `/revision-test.html` entry link, select a group, then an open test. Vocabulary is filtered by group. Existing attempts retain the content snapshot with which they started. Teacher content changes affect new attempts.

After submission, the receipt shows the Attempt ID. In the teacher cabinet, select Revision Tests and View results / Refresh results. An expanded student row shows the attempt ID, Moscow start/submission time, Speaking assessment and Essay review. Written score is vocabulary/grammar /80 plus the teacher's essay mark /20. Speaking /20 is reported separately. A submission can be awaiting assessment while still being submitted. Multiple attempts may have the same student name. Find a specific attempt opens the matching test by receipt ID.

## Speaking procedure

Call submitted students individually; they reveal the individual question and answer immediately for 60–90 seconds. In Results → Speaking, choose the second submitted student from the same group and assign the dialogue after both individual answers. Both students get the same situation with roles A/B. Each opens the card when instructed. Once both cards are open, a shared timer gives 30 seconds to read, then 60 seconds to prepare, then 2–3 minutes to speak. For an odd participant, choose Teacher as partner. Written tests need not finish simultaneously.

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

Essay grading uses Content, Organisation, Grammar, Vocabulary (each 0–5). Speaking uses Task fulfilment/interaction, Fluency/coherence, Vocabulary, Grammar, Pronunciation (each 0–4). The server validates complete breakdowns and derives the total; old total-only marks remain readable without invented criterion scores. Criteria are included in private student results and exports.

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
