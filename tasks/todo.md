# Automate the App Store Connect release (2026-08-17)

Branch: `claude/app-store-whats-new-cmjnec` (PR #140). Goal: create and fill the
1.5.0 App Store version record from the repo, with no hand-copying into the
App Store Connect UI.

## Why this shape

The release copy already exists three times — `lib/config/changelog.ts` (in-app),
`WHATS_NEW.md` (prose) and, until now, nowhere the tooling can read. Anything
that retypes it into App Store Connect adds a fourth copy that drifts. So the
store text becomes DATA in `marketing/aso/metadata.mjs`, `check:aso` validates
it, and the release script sends that exact value to Apple.

`scripts/next-build-number.mjs` already carries a working ES256 JWT client for
the same API. Two implementations of one auth path is the duplication CLAUDE.md
warns about, so the client is extracted and both callers share it.

## Schemas (verified against Apple's docs JSON, not from memory)

- `POST /v1/appStoreVersions` — attrs `versionString` [req], `platform` [req],
  `copyright`, `releaseType`, `earliestReleaseDate`, `reviewType`, `usesIdfa`;
  rels `app` [req], `build`, `appStoreVersionLocalizations`.
- `PATCH /v1/appStoreVersions/{id}` — same attrs minus platform, plus
  `downloadable`; rel `build` is how a build is attached to an existing version.
- `appStoreVersionLocalization` attrs: `locale` [req on create], `whatsNew`,
  `description`, `keywords`, `promotionalText`, `marketingUrl`, `supportUrl`.
  **`whatsNew` lives here, NOT on the version** — the version has no
  `releaseNotes` attribute despite what a summary of the docs claimed.
- Submission is the 3-step flow. `appStoreVersionSubmissions` is deprecated:
  `POST /v1/reviewSubmissions` (rel `app` [req], attr `platform`) →
  `POST /v1/reviewSubmissionItems` (rel `reviewSubmission` [req] +
  `appStoreVersion`) → `PATCH /v1/reviewSubmissions/{id}` `{submitted: true}`.

## Steps

- [x] Verify the request schemas against Apple's documentation JSON API
- [x] `scripts/lib/ascClient.mjs` — credentials, ES256 JWT, request/paginate,
      typed errors, dry-run recording
- [x] Repoint `scripts/next-build-number.mjs` at the shared client without
      changing its stdout contract or its epoch fallback
- [x] `whatsNew` for en-US and es-MX in `marketing/aso/metadata.mjs`
- [x] `check:aso` validates and emits `whatsNew` (Apple's limit is 4000)
- [x] `scripts/asc-release.mjs` — plan/apply/submit, idempotent, dry by default
- [x] npm scripts: `asc:status`, `asc:release`, `asc:release:apply`
- [x] Tests for the pure logic (version ordering, state gating, payload shapes)
- [x] Docs: how to run it, and what it deliberately will not do

## Rules this must hold

- **Dry-run by default.** Nothing mutates without `--apply`. Submitting for
  review needs `--submit` ON TOP of `--apply`, because it is the one step that
  puts the app in front of Apple.
- **Idempotent.** Re-running with the record already correct performs no writes
  and says so.
- **Refuses rather than guesses.** If 1.5.0 does not beat the highest RELEASED
  version, or the version is in a non-editable state, it stops and prints what
  it found.
- **No secrets in output.** The JWT and the .p8 never reach stdout or logs.
