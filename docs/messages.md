# Campus messages

Teacher Hub and the student Learning Hub share the `Messages` section. Each registered student has a private conversation with the platform teacher. This version does not offer student-to-student or group chats, email delivery or push notifications.

Messages are stored in PostgreSQL (`024_campus_messages`). The API under `/learning/messages` always checks the active session and conversation ownership. Student requests cannot read or write another student's conversation. Teachers can find students by alias and group. `request_id` makes retries idempotent. Message content is plain text and displayed through `textContent`.

The client refreshes unread counts every 15 seconds while the page is visible and conversation contents when Messages is open. Read receipts are set only for incoming messages rendered in the active section. Drafts stay in the browser session; failed requests keep the composed text. Earlier messages can be loaded in batches. Unicode emoji are inserted through the shared `emoji-picker.js` component, also used for IMT feedback.

Relevant checks: `backend/tests/test_messages.py`. Teacher sessions are shared by the current admin role; separate staff identities or permissions require an account model change.
