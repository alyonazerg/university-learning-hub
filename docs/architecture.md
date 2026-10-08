# Architecture decisions

- Independent private repository and database; no shared storage with existing bots.
- Student identities are pseudonymised, **not anonymised**.
- Legal names live in a separately restricted identity registry.
- Google Docs are copied into a separate teacher-review document without source comments or revision history; personal details inside content may still reveal identity.
- Store immutable submission snapshots with hashes before acknowledging a submission.
- Max 3 attempts per assignment; enforce transactionally.
- Two grading modes: simple score and rubric.
- Late penalty: 20% per day, exact calculation basis pending teacher confirmation. Do not silently implement either interpretation.
- AI grading is a draft unless an explicitly approved deterministic auto-grade policy applies.
- Files, voice, audio, images and video require private storage, retention rules and explicit processing approval before launch.
- No student data may be placed in GitHub or logs.
