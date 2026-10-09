# Frontend

Static mobile registration page deployed from this directory by GitHub Pages.
Current default is a public preview; it does not create student accounts.

See [registration setup and API contract](../docs/registration.md) for the
server-backed flow, secure configuration and limitations. UI tests live outside
this directory in `tests/frontend/`, so they are not included in Pages artifacts.
The teacher demonstration dashboard is in `admin.html`; see
[teacher preview notes](../docs/teacher-preview.md). Authenticated teacher access
and React/TypeScript profiles are subsequent milestones.

The end-to-end synthetic homework demonstration is in `homework.html`.
See [homework preview notes](../docs/homework-preview.md) for the role switch,
submission attempts, feedback, timezone and persistence limitations.
