# Profiles, avatars and leaderboards — approved product requirements

Status: product requirements for implementation in a subsequent sprint, not yet implemented.

## Teacher identity
- Teacher public display name: **✦ Lunar Thyme**; Telegram username: `@lunarthyme`.
- Reserve the name and distinguish teacher role via authorization, never nickname matching.

## Student profiles
- Every student has a pseudonym, chosen avatar, optional English-only biography and privacy settings.
- Onboarding presents a curated gallery of attractive botanical, lunar, floral, woodland and whimsical avatars. Default implementation should use an approved pre-generated asset pack, not costly per-student image generation. Optional AI custom avatar generation can be introduced later with explicit moderation, quota and consent.
- Students can change avatars, but uploads and generation must reject identifiable photos and abusive imagery under the pseudonymous learning policy.
- Bio is optional, English-only, editable, length-limited (suggest 160 characters); use language detection and supportive correction prompts, with teacher moderation/reporting. Do not send bios to a paid LLM by default.
- Public student profile exposes pseudonym, avatar, bio, optional XP/badges and public ranking opt-in only. Never legal name, Telegram handle, university ID or private grades.

## Leaderboards
- Within-group student rankings, and between-group rankings.
- Weekly, monthly and all-time periods; timezone and reset boundaries must be defined.
- XP must be independent from academic grade/BRС. Award only for verifiable learning activity; cap repetitive SRS farming, duplicate attempts and other abuse.
- Group competition must normalize by eligible active members and use a minimum participation threshold; avoid ranking small groups unfairly. Record scoring policy versions and event ledger for audit.
- Opt-out from public individual leaderboards; opted-out students can see their own XP and private rank, while teachers retain authorized analytics.
- Show aliases only, not names; avoid exposing membership or private data across groups.
- Reward steady progress and improvement, not only top performers. Consider achievement badges and personal-best milestones.
- Design for accessibility and reduced social pressure: no punitive public 'bottom students' displays.

## Suggested schema additions (implement through Alembic when scheduled)
- `profile_settings(user_id, avatar_asset_id, bio_en, show_in_leaderboard, show_profile, updated_at)`
- `avatar_assets(id, key, theme, asset_uri, is_active, moderation_status)`
- `xp_events(id, user_id, group_id, source_type, source_id, points, policy_version, occurred_at, idempotency_key)`
- `xp_policy_versions(version, effective_from, rules_json)`
- `leaderboard_periods(id, kind, starts_at, ends_at, timezone)`
- `leaderboard_snapshots(id, period_id, scope, group_id, subject_id, score, rank, generated_at)`

## Acceptance tests
- English-only bio validation and edit; no compulsory AI processing.
- Only approved avatar assets can be selected.
- Teacher display name reserved.
- Idempotent XP events, anti-farming caps, period boundaries and stable rank ordering.
- Group average correctly normalizes participation and excludes opted-out public individual rows without corrupting group statistics.
- Cross-group student API cannot disclose protected student identity, grade or private group membership.

Implementation order: finish Sprint 1 auth/roles/pseudonyms first; then profile/avatar gallery and XP ledger; then leaderboard UI.
