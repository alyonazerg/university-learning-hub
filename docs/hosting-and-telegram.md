# Hosting and Telegram integration

The user currently keeps mooncampus.ru at Beget and explicitly does not want a
migration yet. Continue publishing the branch preview via GitHub Pages. No DNS,
hosting purchase, token request, real bot message or production deployment was
performed. There is currently no project bot.

## Future Beget VPS/VDS deployment

The repository has portable FastAPI/PostgreSQL/nginx Docker services; there is no
GitHub Pages lock-in. Choose a VPS/VDS supporting Docker and long-running Python
processes, rather than static/shared hosting alone. Retain mooncampus.ru, put
nginx/Caddy with HTTPS in front, route API requests to FastAPI, and keep PostgreSQL
private. Provide secrets in server environment settings. Preserve Alembic upgrade
history and test a backup restore before cutover. Photo storage must be private,
outside frontend/public directories, with authenticated access, re-encoding,
size limits, backup and retention. Add bot/worker services when implemented.
Publish a concrete staging result before agreeing to a production DNS cutover.
The current Compose file is a development basis, not a finished production stack.

## Bot prerequisites and implementation boundary

`bot/contracts.py` implements and tests only offline message/notification payload
contracts. It does not poll Telegram, send requests, subscribe users, download
media, save homework or run an outbox. A bot and live backend are prerequisites.
Never put a bot token in frontend/config.js, Pages or a chat message.

Create the project bot with BotFather when ready. Students must start it and
explicitly subscribe to notifications; bots cannot initiate conversations with
students who have never started them. Bind sender IDs to existing registered
students on the backend; never display those IDs in UI/public payloads.
Use authenticated long polling or a webhook validated with Telegram's secret
header, and process each update once. No webhook endpoint currently exists.

Publishing an authenticated teacher post must persist its audience and an outbox
event in the same database transaction. A worker checks membership/subscription
again, sends generic new-post notifications with an authenticated site link,
handles unsubscribe/blocked users, bounded retry/429 and event-recipient dedupe.
Do not put private grades, work contents or student identity in notification text.
No notifications originate from static demo buttons.

For bot homework: list authorized tasks, save the chosen task in server state,
accept text/photos only in a private chat from the registered sender, and verify
group membership. The offline envelope uses public student/task IDs and a stable
source key for idempotency; Telegram file IDs stay private. Album pieces must be
collected as one draft, shown for confirmation, then downloaded through Telegram,
validated/re-encoded, and committed as an immutable submission with the same
transactional three-attempt rules as web submissions. A download/commit failure
must not consume an attempt or return a false acknowledgement. Production storage,
role/session authorization, bot runtime, shared task/submission APIs and durable
outbox are still outstanding; the contracts deliberately do not pretend to save
or deliver anything.
