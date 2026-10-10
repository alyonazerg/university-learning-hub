# Frontend

Static mobile registration page deployed from this directory by GitHub Pages.
Current default is a public preview; it does not create student accounts.

See [registration setup and API contract](../docs/registration.md) for the
server-backed flow, secure configuration and limitations. UI tests live outside
this directory in `tests/frontend/`, so they are not included in Pages artifacts.
The teacher demonstration dashboard is in `admin.html`; see
[teacher preview notes](../docs/teacher-preview.md). A separate authenticated vocabulary cabinet is in `learning.html`; the demo
role switch is not used for server-backed access.

The end-to-end synthetic homework demonstration is in `homework.html`.
See [homework preview notes](../docs/homework-preview.md) for the role switch,
submission attempts, feedback, timezone and persistence limitations.

Vocabulary, emergent words, cards, streaks, team rankings and local photo previews:
[vocabulary.html](vocabulary.html), with [demo boundaries](../docs/learning-preview.md).
Telegram/Beget prerequisites are documented in
[hosting-and-telegram.md](../docs/hosting-and-telegram.md).

Local board-photo OCR requires generated assets:

```sh
npm ci --prefix frontend --ignore-scripts
npm run build --prefix frontend
npm ci --prefix tests/frontend
npm test --prefix tests/frontend
```

Recognition runs locally in the browser with same-origin English/Russian models.
It creates reviewable text drafts. The teacher-bot card format is implemented;
LLM authoring is not connected. The generated `frontend/ocr/` folder is ignored in Git and
built by Pages/Docker. Student editor appointments remain synthetic UI state.

See [server-backed learning](../docs/server-learning.md) for `learning.html`,
API configuration, server roles, persistent vocabulary and review progress. The
public Pages configuration has no API URL and explicitly disables connected login.
