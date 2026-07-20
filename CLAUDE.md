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

## Save format

- **Canonical `STATE_VERSION = 23`** — single source of truth in
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
