# Lessons Learned

<!-- Updated after every correction. Reviewed at the start of each session. -->

## Patterns to Watch For

### 2026-06-15 - UI render tests did NOT need a jest-expo host — just gaps in the existing RN mock

- What was believed: `__tests__/integration/gameFlow.test.tsx` and `screenImports.test.ts` both stated render
  tests were "deferred until a jest-expo / native test host is configured," so the project shipped with
  **0 `render()` tests across 254 components** — the biggest durability gap (per the 2026-06-15 roadmap).
- What was actually true: `react-test-renderer@19.1.0` is already installed, and `jest.setup.js` already mocks
  `react-native` to string-tag host components. So `TestRenderer.create(<Screen/>)` works in the existing
  ts-jest/node env — screens just hit a few **mock gaps** that threw, not a fundamental host limitation.
- The specific gaps (all additive fixes to `jest.setup.js`): (1) `Animated.View`/`Text`/etc. were missing →
  `usePressableScale`'s `<Animated.View>` was `undefined` ("Element type is invalid"); (2) `Animated.sequence`/
  `parallel` returned objects without `.stop()` → crash on unmount when a component stops an entrance anim;
  (3) `ActivityIndicator`/`ImageBackground`/`BackHandler` not mocked; (4) `react-native-safe-area-context` +
  `@react-navigation/native` not mocked; (5) Expo native `.js` modules (e.g. `expo-constants`) ship ESM that
  ts-jest (ts/tsx-only transform) can't parse → mock them.
- Rule: to add render coverage in a ts-jest/string-mocked RN project, use `react-test-renderer` directly and
  fill mock gaps reactively (run → read the throw → mock → repeat). Keep mocks ADDITIVE in `jest.setup.js`
  (new keys only) so the existing suite is unaffected, and always re-run the FULL suite after touching shared
  setup. Note the limitation: this renders each screen's own subtree, so it catches undefined-component /
  bad-import / Animated-misuse / provider-cycle crashes — but NOT navigator-level version-skew crashes (see
  the 2026-06-10 entry); those still need a real navigator mount.

### 2026-06-10 - The onboarding "Element type is invalid: undefined" was a @react-navigation version skew, NOT a screen module

- What went wrong: every prior fix for the launch crash (anchor `unstable_settings`, lazy `SettingsModal`, leaf-context imports, OTA disable) chased the wrong root cause. The real bug: `@react-navigation/native-stack@7.15.1` (pulled transitively by `expo-router`) imports `NavigationProvider` from `@react-navigation/native` and renders it as the OUTER element of every screen's `SceneView`. The peer dep is `@react-navigation/native@^7.2.4`, but `package.json` pinned `^7.0.14` and the lockfile froze `@react-navigation/native` at `7.1.17` — a version that does NOT export `NavigationProvider`. So `NavigationProvider` was `undefined`, and the FIRST native-stack mounted (the `(onboarding)` Stack, since the root is `<Slot>` and tabs use bottom-tabs) crashed with "Element type is invalid: …got: undefined" at `SceneView`. npm only *warns* on violated peer deps, so the bundle built fine and crashed only at render.
- Why it hid: it is a runtime JSX-type failure from a named import, not a missing default export. Every route module's `default` export is a valid component (verified by evaluating the real production bundle) — so module-load smoke tests, the bundle build, and JS render tests all pass. It only manifests in a real render of the navigator. The OTA-update bug masked it for ~20 builds (a stale published bundle ran instead of each new embedded one), so the crash was never actually exercised until `updates.enabled=false` (OTA-OFF-1).
- How it was proven: built the production bundle with `npx expo export:embed --dev false` and grepped — OLD bundle had `NavigationProvider` only as import references with NO `Object.defineProperty(e,"NavigationProvider",…)` export definition; after bumping `@react-navigation/native` to `^7.2.4` (resolves 7.3.0, core 7.19.0) the export definition is present.
- Rule: when a screen/navigator crashes with "Element type is invalid: …got: undefined" and EVERY route module has a valid default export, suspect a `@react-navigation` (or other native-UI lib) **version skew** — a child package importing a binding the resolved parent version doesn't export yet. Check `npm ls @react-navigation/native @react-navigation/native-stack @react-navigation/core` and every native-stack/bottom-tabs peer dep; align them (prefer `npx expo install --fix` on SDK bumps). Don't trust "it builds" — peer-dep violations are warnings, not errors.


### 2026-05-27 - Onboarding perk boosts can exceed bounded stat ranges

- What went wrong: permanent `lucky_charm` applied its `+5 happiness` boost on top of an initial `happiness` value of 100, creating `stats.happiness = 105`. Onboarding validation correctly rejected the generated save, so starting a life failed at the final Perks step.
- Pattern: additive onboarding bonuses share the same 0-100 stat bounds as gameplay stats; validation catches overflow after construction, but the builder must preserve invariants up front.
- Rule: when constructing a new `GameState`, clamp bounded stats (`health`, `happiness`, `energy`, `fitness`, `reputation`) at the builder boundary. Keep `money`/`gems` non-negative and unbounded by the 0-100 clamp.

### 2026-03-09 - Device Classifier Drift (iPhone Pro Max vs iPad)

- What went wrong: `isIPad()` used a height-only threshold (`height > 926`), so newer/taller Pro Max iPhones were treated as iPads.
- Pattern: height-only platform classification breaks as new phone form factors exceed older limits.
- Rule: use shortest-side tablet detection (`Math.min(width, height) >= 768`) for iPad checks, and derive iPhone checks from `!isIPad()` instead of hardcoded height caps.

### 2026-03-09 - Onboarding Name Regeneration Overwrite

- What went wrong: `Customize` could auto-regenerate names on screen entry when `lastAutoGeneratedSex` was `null`, overwriting existing user names after navigation.
- Pattern: regeneration logic that relies on previous auto-generated metadata must explicitly guard for "no auto-generated history" and partial manual edits.
- Rule: only regenerate on sex change when an auto-generated sex exists and both name fields are populated; clear auto-generated markers as soon as the user manually edits identity fields.

### 2026-04-20 - Corrupt GitHub Actions YAML from unfinished merges

- What went wrong: `.github/workflows/eas-build.yml` contained stray branch-name lines (`main`, feature branch tokens) between YAML keys, producing invalid workflow syntax.
- Pattern: merge conflicts or partial paste into workflow files without validating with a YAML parse or `gh workflow` view.
- Rule: after any edit to `.github/workflows/*.yml`, parse locally and confirm the workflow appears in GitHub’s Actions tab without errors.

### 2026-04-20 - Full GameProvider tests in Node Jest

- What went wrong: `__tests__/integration/gameFlow.test.tsx` could not mount `GameProvider` under `@testing-library/react-native` with the repo’s `jest.setup.js` RN string mocks; `useGame()` never ran and assertions saw `null` context.
- Pattern: integration tests that need the full provider tree belong in a native test host (`jest-expo`) or should be narrowed to pure bootstrap checks that run in Node.
- Rule: keep Node Jest integration files limited to deterministic imports (`initialGameState`, pure helpers); defer RTL-heavy flows until the Jest environment matches React Native.

### 2026-05-13 - week vs weeksLived strikes again (socialMedia / MiningActions)

- What went wrong: Two files still used the 1-4 cyclic `state.week` where the math needed the monotonic `state.weeksLived`:
  - `lib/social/socialMedia.ts:397` computed `weeksSinceLastPost = state.week - lastPostWeek` while `lastPostWeek` was correctly written as `weeksLived` at the call sites. Result: `weeksSinceLastPost` was always negative, follower decay never fired, engagement-rate math was wrong.
  - `lib/social/socialMedia.ts:623` used `state.week` as fallback for the per-content-type cooldown key, which would trigger a year-long lockout once the cycle repeated.
  - `contexts/game/actions/MiningActions.ts:606` recorded mining-history entries with `week: prev.week`, corrupting time-ordering in any history-display UI.
  - `contexts/game/actions/MiningActions.ts:370` stored staking `startWeek: prev.week` (the absolute counter was set on the adjacent `startAbsoluteWeek` field, but the inconsistency was a trap for the legacy fallback in `claimStakingRewards`).
- Pattern: Phase B sweep caught most week→weeksLived sites but missed read-side bugs where the write side had already been migrated. The asymmetry hides the bug because the field name `lastPostWeek` *looks* correct on both sides.
- Rule: whenever a field is named `*Week`, grep BOTH writes AND reads against the cyclic-vs-absolute axis. If the writer uses `weeksLived`, every reader must compare against `weeksLived` (not `state.week`). Treat `state.week` as a UI-display value only — never compare it against any stored field.

### 2026-05-29 - The `updatedAt` bumper turned every no-op setState into a full re-render

- What went wrong: `GameStateProvider.wrappedSetGameState` always bumped `updatedAt` and returned a fresh top-level object, even when the inner updater returned `prev` unchanged (e.g. an action rejecting an overdraw). Every consumer with `useMemo([gameState])` recomputed on every rejected action, cascading into a whole-app re-render storm that produced "Maximum update depth exceeded" warnings.
- Pattern: a "version bumper" middleware that runs *after* the inner updater inevitably re-renders the no-op case, defeating the action-level `return prev` idiom.
- Rule: in any wrapper around `setState`, short-circuit on identity (`if (newState === prev) return prev`) before applying any derived field updates. And: **never** add a top-level "always changes" field unless the contract requires it (clock fields can usually live in a `useRef`, not state).

### 2026-05-29 - In-place `repairGameState` broke React memo invalidation

- What went wrong: `repairGameState(state)` mutated `state.stats`, `state.banking` etc. in place. Callers did `{...prev}` to give React a new top-level ref, but every nested ref was unchanged — selectors keyed on `gameState.banking` saw the same object identity and silently skipped renders, leaving the UI showing stale data after a "successful" repair. Looked exactly like a frozen UI.
- Pattern: any function that's expected to "return new state" needs to actually replace nested object references, not just mutate fields inside them. Shallow spreading at the top doesn't help if the caller's memo selectors are keyed on nested objects.
- Rule: when a repair / migration / normalization function needs to keep the same top-level reference for caller-API compatibility, do the work on a `structuredClone` of the input and then copy the clone's *top-level keys* back onto the original. That preserves the outer ref (caller untouched) while giving every nested object a new identity (React's referential equality machinery wakes up).

### 2026-05-13 - Variables assigned inside setGameState updater, read outside

- What went wrong: `DatingActions.ts fileDivorce` declared `immediatePaymentApplied`, `divorceDebtCreated`, `forcedStockLiquidationPaid`, `forcedPropertyLiquidationPaid` at outer scope, assigned them inside a `setGameState(prev => {…})` updater, then read them after the call to format the log line and the user-facing divorce summary message. React batches/defers functional updaters, so the read sees the initial values (0) — the user sees "$0 immediate payment" in the divorce modal.
- Pattern: any state mutator whose result is also needed synchronously (for logs, returned messages, analytics) must compute the derived values OUTSIDE the updater. The updater should only assemble the new state from precomputed values.
- Rule: never use a `setGameState(prev => {…})` updater to assign closure-scoped variables that are read by code following the `setGameState` call. Compute audit/return values against the action's `gameState` snapshot first, then call `setGameState` with the precomputed objects. Reserve `prev` inside the updater only for spread-merging fields that other actions might touch concurrently (typically `prev.dailySummary`, `prev.family`, etc).

### 2026-05-30 - REVERTED: React.lazy() inside an expo-router screen crashes production iOS

- What went wrong: round 6 converted `app/(tabs)/computer.tsx` (17 sub-apps) and `app/(tabs)/mobile.tsx` (8 sub-apps) from eager `import X from '…'` to `const X = lazy(() => import('…'))` with a `<Suspense>` fallback. Type-check and the local Jest suite passed clean. The EAS-built iOS production bundle then crashed at app launch with `Element type is invalid: expected a string … but got: undefined` inside the root navigator — the "Router Initialization Error" screen.
- Pattern: expo-router scans every `app/**/*.tsx` file at boot to register routes. That import walk wakes up the lazy wrappers' module identities even though the wrapped chunks haven't been rendered yet. In the minified Hermes production bundle, at least one of those dynamic `import('…')` chains resolves through a path where the `.default` export is not unwrapped — or one of the transitive imports under a `lazy()` chunk is itself undefined — and React throws at the navigator render. Dev mode and JS tests don't reproduce this; only the production Hermes bundle does.
- Rule: do NOT use `React.lazy(() => import('…'))` for components that an expo-router screen references at module top (the `apps[activeApp]` map pattern). If code-splitting is needed, defer the load via an explicit `require()` inside a `useEffect` AFTER mount, and gate the import behind an error boundary that surfaces failures with a useful message. Eager imports are the safe default for any component the router will see during boot.
- Guardrail in place: [__tests__/startup/screenImports.test.ts](../__tests__/startup/screenImports.test.ts) asserts every `(tabs)/*.tsx` file has a `export default` AND that `computer.tsx` + `mobile.tsx` contain no `React.lazy(() => import(…))` patterns. CI will block any future regression.

### 2026-05-30 - work.tsx crashes on `gameState.items.find` when arrays missing

- What went wrong: `app/(tabs)/work.tsx` had 12 direct `.find()` calls on `gameState.items`, `gameState.darkWebItems`, and `gameState.educations` with no `|| []` guard. When a save loaded that had been migrated incompletely (rare path) or where `repairGameState` hadn't backfilled the array, the Work tab crashed immediately on render with `Cannot read property 'find' of undefined`.
- Pattern: even when `initialState.ts` declares an array field, older saves and edge-case migrations can leave it undefined. Component code that treats those as always-present is one bad save away from crashing.
- Rule: any read of `gameState.<arrayField>.find/.filter/.map/.length` in a render path must defensively guard with `(gameState.<arrayField> || [])` (or, equivalently, optional chaining when only a boolean is needed). The repair pipeline is a backstop, not a guarantee.

### 2026-05-30 - Don't trust an audit-agent's "file:line is broken" claim without re-reading the code

- What went wrong: a parallel performance audit asserted that `wrappedSetGameState` was regressing the May 29 `updatedAt`-bumper lesson and that the AppState listener / autosave interval had no cleanup. Direct reading of `contexts/game/GameStateContext.tsx:46-58` showed the identity short-circuit IS in place; `GameActionsContext.tsx:3710-3712` and `:3784-3787` both have working cleanup. The agent skimmed and got it wrong.
- Pattern: agents pattern-match aggressively; their "this is broken" claims often have a kernel of truth (the function shape is suspicious) without the verification that would distinguish "buggy" from "already fixed". Acting on those claims without re-reading wastes a fix slot and can re-introduce bugs.
- Rule: before applying any audit-flagged fix to load-bearing code (state providers, save pipeline, week tick), open the cited file at the cited lines and confirm the bug exists *as described*. If the code already does the right thing, mark the finding REJECTED with the line evidence in the report. Don't just edit because an agent said so.

### 2026-06-09 - Converted hook landed below an early return (rules-of-hooks)

- What went wrong: migrating `OfflineIndicator` to `useGameSelector`, the original `useGame()` call sat above the `if (isOnline && pendingActions === 0) return null;` guard, but the *derived value* it replaced (`isDarkMode`) sat below it. Mechanically converting the derived line into a hook call put a hook after a conditional return. Type-check and the full Jest suite both passed — only `eslint react-hooks/rules-of-hooks` caught it.
- Pattern: cast/hook migrations that convert a plain expression into a hook call can silently move a hook below an early return. Tests don't exercise the divergent-render-order path, so the suite stays green.
- Rule: after any migration that introduces hook calls into an existing component, run `npx eslint <files> --quiet` before committing — never rely on type-check + tests alone. Place all new selector hooks in the component's existing hook block at the top, not at the site of the expression they replace.

### 2026-06-09 - `useGameState().setGameState` reintroduces the full-state subscription

- What went wrong: Batch 4 migrated `GemsStoreModal` to slice selectors but took `setGameState` from `useGameState()`. That hook subscribes to the whole `GameStateContext`, so the component still re-rendered on every state mutation — the migration looked complete but delivered zero isolation. Caught one batch later while planning TopStatsBar.
- Pattern: in a selector migration, ANY remaining hook that consumes the full-state context (useGame, useGameState, useGameData-with-state) silently negates the win. The component compiles, tests pass, and the re-render behavior is unchanged.
- Rule: migrated components must get write access from `useSetGameState()` (store-backed, stable, no subscription) and actions from the split action hooks (`useMoneyActions()`, `useGameActions()`, …) — never from `useGame()`/`useGameState()`. Verification: after migrating, grep the file for `useGame(`/`useGameState(` — both must be absent.

### 2026-06-09 - Local type-check passed while CI failed: stale incremental tsbuildinfo

- What went wrong: PR #7 CI failed `tsc -p tsconfig.typecheck.json` with 5 TS18048 errors (`sm`/`pol`/`dw` possibly undefined in PulseApp.tsx and milestones.ts) that every local `npm run type-check` run during the session reported clean. Deleting `*.tsbuildinfo` and re-running locally reproduced all 5 — the incremental cache had skipped re-checking those files after the cast-removal edits changed inference in their dependencies.
- Pattern: `tsc --noEmit` with incremental state can return green for files whose *types changed transitively* (e.g. a `: any` local removed in one file tightens inference in another). CI always runs cold, so the divergence only shows after push.
- Rule: before pushing any commit that removes casts / changes type inference, run the type check cold: `rm -f *.tsbuildinfo && npx tsc --noEmit -p tsconfig.typecheck.json`. Also note: runtime guards like `safe(x?.field, 0) > 0` do NOT narrow `x` for TS — use `x?.field` again inside the branch instead of `x.field`.

### 2026-06-11 - `eas build --local` never auto-increments — duplicate CFBundleVersion rejected on submit

- What went wrong: `eas submit` for iOS failed with "You've already submitted this build of the app." `eas.json` had `cli.appVersionSource: "remote"` but **no** `autoIncrement` on any profile, and the failing pipeline (`.github/workflows/eas-build-local-ios.yml`) builds with `eas build --local`. Remote versioning made EAS ignore `app.config.js`'s existing `BUILD_NUMBER` hook, AND `--local` builds do not run the remote auto-increment (that only happens on EAS *cloud* builds) — so every local build baked the SAME `CFBundleVersion` and Apple rejected the duplicate.
- Pattern: `appVersionSource: "remote"` silently disables the local `ios.buildNumber` / `android.versionCode` values (remote becomes the source of truth), and the remote `autoIncrement` flag is a *cloud-build-only* feature. A `--local` + `remote` combination therefore has NO working increment path — it ships the same build number forever, and the failure only surfaces at submit time, not build time.
- Rule: any pipeline that uses `eas build --local` must manage the build number itself. Set `cli.appVersionSource: "local"` and compute a unique, monotonic `BUILD_NUMBER` (`scripts/next-build-number.mjs`: returns one higher than App Store Connect's latest build when `ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_KEY_P8` are present, else `date +%s` epoch seconds — which also stays under Android's ~2.1e9 `versionCode` cap) so `app.config.js` bakes a fresh `CFBundleVersion` into each binary. Reserve `remote` + `autoIncrement` for the *cloud* `eas build` path only. After a failed submit you must REBUILD with a new number — the already-built `.ipa` can never be re-submitted as-is.
