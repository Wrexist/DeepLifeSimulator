# DeepLife Simulator — project notes

## Releases / TestFlight

**Always bump the app version before cutting a new TestFlight/EAS build.**

- Edit `version` in `package.json` so every build shows a clearly newer number
  than the last one shipped to TestFlight.
- The displayed app version and iOS `CFBundleShortVersionString` are derived from
  `package.json` via `app.config.js` — that one field is the single source of truth.
- The iOS build number / Android `versionCode` come from the `BUILD_NUMBER` env
  var at EAS build time (`app.config.js`), not from a committed file, so it does
  not need a code change.
- The actual TestFlight/EAS build is triggered by the owner; the version bump is
  the part done in the repo beforehand.

### The App Store version and the binary version are DIFFERENT numbers — on purpose

The store product page shows the **App Store Connect version record** (1.3.5 live,
1.4.0 next). The binary reports `CFBundleShortVersionString` from `package.json`
(2.5.x). They have never matched, and every release since 1.2.7 shipped that way:
1.2.7 shipped on a 2.2.7 binary, 1.3.1 on 2.5.0, 1.3.5 on 2.5.x.

**Do not "fix" the mismatch by raising the App Store Connect version to match the
binary.** Apple's validator does not compare the two — the only rule is that each
store version beats the last released one. But store version numbers can only ever
increase, so setting the record to 2.5.x is a one-way door that permanently
abandons the 1.x line.

- App Store Connect version record → what users see. Must beat the last release.
- `package.json` version → TestFlight, crash reports, in-app version display.
  Must keep climbing so builds stay distinguishable.

Cost of the split: support tickets and analytics report the 2.5.x number while the
store says 1.4.0. Known and accepted.

### Privacy manifest (iOS) — reads as metadata, rejects like a build break

`expo.ios.privacyManifests` in `app.config.js` is validated by Apple *after* upload,
so a mistake costs a full build + TestFlight processing round trip and parks the
version in **Invalid Binary**. `NSPrivacyTracking: true` with an absent or empty
`NSPrivacyTrackingDomains` is rejected as ITMS-91064 — an empty array is not a fix.
And domains listed there are blocked by iOS whenever ATT is denied, so listing
Google's ad domains silently zeroes out ad revenue. Tracking is declared by the
AdMob/Firebase SDK manifests instead; see the comment in `app.config.js`.
`scripts/preflight-check.js` §5b enforces this before a build starts.

### Purpose strings (iOS) — pass upload, fail review, take the IAPs down with them

Every `NS*UsageDescription` is scanned by App Review *after* the build is
accepted, so a weak one costs a full review cycle instead of failing at upload.
It also returns the whole submission: each attached IAP and subscription comes
back marked "Rejected" even though nothing is wrong with them — resubmit them
with the next build.

The one purpose string this app ships is `NSUserTrackingUsageDescription`,
written by the `expo-tracking-transparency` plugin in `app.config.js`. Expo's
documentation boilerplate ("This identifier will be used to deliver personalized
ads to you.") was rejected as a placeholder: it names the resource but never says
what the app does with it, which is the same shape as Apple's own failing
examples ("App needs microphone access"). A passing string needs both halves —
the use, and a **concrete example** of the result. `scripts/preflight-check.js`
§5c fails the build on known boilerplate, strings under 60 characters, and
strings with no verb of use; it reads both `ios.infoPlist` and the plugin options
that become purpose strings at prebuild time, so add a row to its
`PLUGIN_PURPOSE_OPTIONS` table whenever a plugin that writes one is installed.

## Save format

- **Canonical `STATE_VERSION = 26`** — single source of truth in
  `contexts/game/initialState.ts` (aliased as `CURRENT_STATE_VERSION` in
  `utils/saveMigrations.ts`). Keep `DEV.md` / `WORKFLOW.md` in sync when it bumps.
- Any field added to `initialState.ts` must ship in the same change with (a) a
  migration in `utils/saveMigrations.ts` that bumps `STATE_VERSION`, and (c)
  inclusion in `__tests__/helpers/createTestGameState.ts`. Adding a field without
  bumping the version is the "GameState drift" the weekly audit (Hard Rule #3)
  exists to catch.
- The (b) backfill step — set a value in the migration and mirror it in
  `repairGameState` (`utils/saveValidation.ts`) for partial saves — applies to
  fields with a **concrete stored default** (`[]`, `false`, `0`, an object).
  Fields whose default is `undefined` (an absent key already equals the default,
  e.g. `ambitionId`) need no backfill: still bump the version, but don't write
  the key. This is why v23 backfills `luxuryItems` / `ambitionCompletedMilestones`
  / `ambitionRewardClaimed` but intentionally omits `ambitionId`.
- **v24 adds `luxuryHoldings`** — per-item luxury state, an additive SIDECAR
  keyed by the same ids as `luxuryItems`, which stays the ownership source of
  truth. Both the migration and `repairGameState` backfill a holding for every
  already-owned id. When adding a repair, remember it must set `repaired = true`:
  the repaired clone is only written back onto the caller's object when that flag
  is set, so a backfill without it is computed and then silently discarded.
