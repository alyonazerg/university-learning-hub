# Revision Tests

Students use the same `/revision-test.html` entry link, select a group, then an open test. Vocabulary is filtered by group. Existing attempts retain the content snapshot with which they started. Teacher content changes affect new attempts.

After submission, the receipt shows the Attempt ID. In the teacher cabinet, select Revision Tests and View results / Refresh results. An expanded student row shows the attempt ID, Moscow start/submission time, Speaking assessment and Essay review. Written score is vocabulary/grammar /80 plus the teacher's essay mark /20. Speaking /20 is reported separately. A submission can be awaiting assessment while still being submitted. Multiple attempts may have the same student name. Find a specific attempt opens the matching test by receipt ID.

## Speaking procedure

Call submitted students individually; they reveal the individual question and answer immediately for 60–90 seconds. After two students from the same group complete their individual answers, tell those two to open the dialogue. The two ready attempts are paired in readiness order. They have one minute of preparation and speak for 2–3 minutes. Written tests need not finish simultaneously. For an odd participant, expand the student row and use Pair with teacher, then enter the speaking score.

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
