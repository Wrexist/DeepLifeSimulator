# Lessons Learned

<!-- Updated after every correction. Reviewed at the start of each session. -->

## Patterns to Watch For

### 2026-07-02 - Weekly audit (salvaged from PR #45): 3 more money printers + 2 silent-immunity buffers + crash guards

- Origin: PR #45 (weekly audit 2026-07-02) went unmergeable after PR #46 independently landed two
  of its fixes (audit-save doc rename + `enterCompetition` atomicity). The remaining six fixes were
  salvaged onto the bug-fix branch instead of rebasing the conflicted PR.
- Non-atomic gate→grant money printers (same H-8/H-9 class the mega-audit keeps closing):
  `runForOffice` re-applied the up-to-$5M election reward with no idempotency re-check (fixed with a
  `lastElectionAttemptWeek` marker stamped by BOTH branches, since win/loss is rolled independently
  per tap); `filePatent` filed duplicate perpetual-income patents via stale-outer dedup + inline
  floored charge; `stakeCrypto` drove the coin balance negative and minted a phantom staking
  position. Fix idiom unchanged: fold gate re-check + debit (`applyMoneyDelta`) + grant into ONE
  `setGameState(prev => …)` that returns `prev` when the gate no longer holds.
- TWO more fixed-size pre-roll buffers indexed by an uncapped collection (the petSickness class,
  2026-06-21): `relBreakup`/`relDisappointed` (len 20) indexed by the raw full-relationships
  index → partner past index 20 immune to breakup; doctor-visit cure buffer (len 10) → 11th+
  curable disease never cured. Both fixed with `idx % buffer.length`, matching the pet/vehicle/
  disease consumers that already wrap. A docstring that says a quirk is "PRESERVED VERBATIM" is a
  red flag, not a spec — re-verify it's intended, not just inherited.
- TWO unguarded `.length` reads on fields `repairGameState` does NOT backfill (`family.children`
  in ShareLifeCard's tagline, `curedDiseases` in CureSuccessModal) — crash-on-old-save. Note
  `curedDiseases.length` sat in a useEffect dependency array, which evaluates EVERY render
  regardless of the render-guard short-circuit below it.
- Process note: when two audit PRs overlap, the conflicted one is not worthless — diff it against
  main fix-by-fix before closing; here 6 of 8 fixes were still missing from main.

### 2026-06-30 - IAP `applyBenefit` double-granted every consumable (in-memory path + disk path both additive)

- What went wrong: `IAPService.applyBenefit` runs TWO grant paths in sequence for every
  purchase: (1) the in-memory `stateUpdater` (registered by `<IAPHandler/>`, mounted in
  `GameProvider`) clones live state, applies the product via `applyProductToState`, and
  `await`s `saveGame(true)` — persisting the credited state to the active slot — before
  resolving; then (2) `applyBenefitToDisk` reads that just-persisted slot back and calls
  `applyProductBenefitsToState` AGAIN. That helper is additive for consumables
  (`gems/money/youthPills` use `+=`), so every foreground gem/money/youth-pill purchase
  credited the player 2×. Flag products (perks, multipliers, ads-removed) are idempotent
  boolean sets, so they were unaffected — which masked the bug.
- Why it hid: all existing IAP tests (`iapMonetization.stress.test.ts`,
  `premiumPackIncome.test.ts`) exercised `applyProductToState` — ONE path — never the
  combined `applyBenefit`. The disk path was designed as a cold-start FALLBACK ("Always
  update disk as backup/source of truth") but ran unconditionally even when the in-memory
  path had already applied+persisted. `ShopModal` even carries a "DOUBLE-GRANT FIX"
  comment asserting the grant happens "exactly once per transaction" — the author removed
  a UI-layer re-apply but never saw that `applyBenefit` itself re-applies on disk.
- How it was found: the weekly-audit economy subagent flagged it (MEDIUM); source-verified
  by tracing `applyBenefit` → `stateUpdater` (IAPHandler) → `applyBenefitToDisk`, confirming
  `applyProductBenefitsToState` is `+=` additive and `<IAPHandler/>` is mounted
  (`GameProvider.tsx:113`). Proven with a new test that drives the real `applyBenefit` with
  the save pipeline mocked to an in-memory slot: warm path granted 1000 gems for a 500-gem
  pack (2×) before the fix. Fixed by capturing the in-memory updater's boolean result and
  passing `{ skipBenefitReapply: inMemoryApplied }` to `applyBenefitToDisk`, which then
  gates only the additive `applyProductBenefitsToState` re-apply (disk-only concerns —
  permanent perks, subscription fulfillment, transaction ledger, save — still run).
- Rule: when a benefit/grant has redundant apply paths (in-memory + disk, optimistic +
  authoritative), exactly ONE must perform the additive mutation per transaction; the
  fallback path must no-op the additive part when the primary already applied+persisted.
  Test the COMBINED entry point, not just the shared leaf helper — a redundant-path bug is
  invisible to a test that only calls the helper once.

### 2026-06-24 - "Normalize to current season" helper RESET unclaimed Legacy Pass rewards instead of rolling over

- What went wrong: the Legacy Pass module has two ways to bring a stale pass up to the live
  season. `ensureCurrentSeason(pass, liveSeasonId)` (`lib/legacyPass/legacyPass.ts:143`) RESETS
  to a fresh empty pass when `pass.seasonId !== liveSeasonId` — it's a normalizer, not a
  collector. `rolloverLegacyPass` / `reconcileLegacyPassSeason` / `awardLegacyPassXp`
  AUTO-COLLECT earned-but-unclaimed rewards before resetting (no silent loss). The two claim
  entry points (`claimLegacyPassReward`, `claimAllLegacyPassRewards`) used the RESET variant.
  So if the real-time 6-week season boundary was crossed while the pass modal sat open (the
  modal reconciles on open, but not continuously), tapping Claim ran against a freshly-reset
  empty pass: it claimed nothing, discarded the old season's earned gems/youth-pills/traits,
  and the modal's optimistic toast still said "Claimed N rewards (+X gems)" (computed from the
  pre-reset local `pass`). Reward loss + a lying toast.
- Why it hid: every claim test operated WITHIN the current season (the happy path). The
  rollover/collection tests covered only the XP and reconcile paths — none drove a claim across
  a rolled-over season. The asymmetry (same helper name family, two different behaviors) made
  the wrong call site look correct.
- How it was found: the weekly-audit economy subagent flagged it; source-verified at
  `LegacyPassActions.ts:176,197` against `ensureCurrentSeason`'s reset semantics. Fixed by
  adding a `withLiveSeason` helper that rolls over (auto-collects) when the season changed and
  only normalizes within-season, then routing both claim functions through it. Added 2
  regression tests that claim against an `oldSeasonPass()` and assert the rewards land on the
  account + a season summary is stamped.
- Rule: when two helpers in the same module both "bring state to the current period" but one
  RESETS and one MIGRATES/COLLECTS, every state-mutating entry point must use the collecting
  one unless loss is intended. Audit each call site of a `reset`-style normalizer for whether
  earned/pending data would be silently dropped. And test the boundary-crossing path, not just
  the in-period happy path — a rollover that's only exercised by one subsystem will rot in the
  others.

### 2026-06-24 - Cold-container false positive: perf jest "FAIL" was just missing node_modules (again)

- What went wrong: `npm run audit:weekly:full` reported a 🟠 HIGH "Performance jest suite
  failed" that looked like a real blocking week-loop regression. The container had an EMPTY
  `node_modules` (fresh clone, no install), so `jest` died with "Preset ts-jest not found" —
  the audit script graded a can't-even-start as a failure. After `npm ci`, the perf suite and
  money-conservation stress both passed clean.
- Why it hid: the static `npm run audit:weekly` (no jest) is green, so only the `:full` dynamic
  layer surfaces it, and the failure message ("See CI logs") reads like a genuine perf miss.
  This is the inverse of the 2026-06-21 cold-container lesson (there jest was silently absent →
  false green; here jest can't load its preset → false red).
- Rule: on a routine run, before trusting ANY jest-backed audit result (pass OR fail), confirm
  deps are installed (`ls node_modules/.bin/jest`). If empty, `npm ci` first, then re-run.
  Treat a jest config/preset error as an environment problem, not a code finding.


### 2026-06-21 - Fixed-size pre-roll arrays indexed by an uncapped collection silently grant immunity

- What went wrong: the weekly tick pre-rolls per-entity RNG into fixed-length arrays
  (`preTick.ts`: `petSickness`/`petSicknessType` length 10, `relBreakup`/`diseaseProgression`
  length 20, `vehicleAccident` length 10) to stay StrictMode-pure. Consumers index them by the
  entity's position in the FULL array (`applyPets.ts:76` `rolls.petSickness[petIdx]`). `petIdx`
  runs over alive + dead pets and there is no pet-count cap, so a player who has owned more pets
  than the buffer length reads `undefined`. The bug is silent because the comparison is
  `undefined < 0.06` → `false`: those pets become permanently immune to sickness (no crash, no
  error, just a balance/correctness drift that only shows up on a long, pet-heavy save).
- Why it hid: every test used ≤ a handful of pets (well under the buffer), and the refactor
  snapshot suite asserted byte-identical output for small inputs — none exercised an index past
  the buffer end. A length assertion (`toHaveLength(10)`) "passed", reinforcing the wrong size.
- How it was found: the weekly-audit Crash/Save/Logic subagent traced `petIdx` to the full-array
  map index and cross-checked the buffer length. Fixed by wrapping the index modulo the array
  length in the consumer (`petIdx % rolls.petSickness.length`, deterministic, no impure
  Math.random) + a regression test that drives index 11 to a guaranteed-sick draw.
- Rule: when a fixed-size pre-roll/lookup array is indexed by a collection whose size isn't
  capped to that length, the overflow entries silently get the default-branch behaviour. Either
  cap the collection to the buffer length, or wrap the index (modulo) in the consumer, and add a
  test that exercises an index PAST the buffer. The same latent shape still exists for >20
  relationships/diseases and >10 vehicles — apply the same wrap if those collections can grow.

### 2026-06-21 - "Missing" tooling already existed on main — fetch + check open PRs before building it

- What went wrong: the scheduled "weekly audit" routine prompt referenced `npm run audit:weekly`,
  `tasks/weekly-audit-<date>.md`, and `.agents/skills/weekly-audit/SKILL.md` — none of which were on
  the freshly-cut branch (only `eas-build`/`preflight`/`test-suite` skills existed), and the cold
  container had no `node_modules` so `type-check`/`jest` silently "passed" (`jest: not found`). I
  concluded the harness was missing and BUILT a parallel one (`scripts/weekly-audit.js`, a skill, npm
  scripts, a SessionStart hook). At PR time the merge was `dirty`: PR #23 had merged the real weekly-audit
  suite (`scripts/audit/*.cjs` + the same skill + `audit:weekly` scripts) into `main` ~10 minutes AFTER
  this branch was cut. My harness was a straight duplicate and had to be discarded in the merge.
- Why it hid: the branch base (`dc6ff19`) predated the #23 merge, and the local `origin/main` ref was
  stale from clone time, so `git rev-list origin/main...HEAD` showed main as fully behind. The duplication
  only surfaced when CodeRabbit/`mergeable_state: dirty` forced a `git fetch origin main`.
- Also true (still-valid sub-lessons): a piped `| tail` swallows the real exit code (`${PIPESTATUS[0]}`
  ≠ `$?`) — verify `node_modules` exists before trusting a green check on a cold container; and verify
  every subagent severity grade against source (this run's three real P2 fixes were each confirmed at the
  line — they survived the reconciliation because they were genuine code fixes, not tooling).
- Rule: before building tooling that looks "missing", `git fetch origin main` and scan open + recently
  merged PRs (`list_pull_requests`, recent `git log origin/main`) for an in-flight implementation. A
  routine branch cut minutes before a related PR merges will look like the tooling doesn't exist. Adapt
  to run the audit (reconstruct intent from equivalents) — but don't commit a parallel harness without
  first confirming `main` doesn't already have one. Keep the genuine deliverable (the code fixes) separate
  from the scaffolding so it survives if the scaffolding turns out to be redundant.

### 2026-06-18 - A "find bugs" subagent over-graded 9 findings as P0; source verification found 0 real P0s

- What went wrong: three deep audit subagents (run as background agents, salvaged after a session suspend)
  graded 9 `setGameState`/save/economy findings as P0 crashes/corruption. I consolidated them and told the
  user the app was "not code-ready, contradicting the roadmap." On source verification, ALL 9 were
  over-graded — 0 genuine P0s. Examples: the "out-of-bounds NaN crash" (C3/C4) can't fire because
  `undefined < chance` is false (the math is inside that `if`); the "stale-ref revalidation" (C7) reads the
  already-repaired state because `repairGameState` copies its clone back in-place (`saveValidation.ts:894`);
  the "spurious double-deaths" (C1) can't happen because death rolls are pre-rolled
  (`GameActionsContext.tsx:359`) and toasts are id-deduped (`:1599`); the "MONEY_CEILING bypass" (C8) needs
  ~1e14 weekly income to reach `MAX_SAFE_INTEGER`.
- Why it hid: the audits reasoned ABSTRACTLY about React semantics ("async setState", "StrictMode
  double-invoke", "races") and worst-case constants without tracing (a) the actual call sites, (b)
  synchronous in-place mutations, (c) React batching, (d) the codebase's EXISTING mitigations (pre-rolled
  RNG, id-dedup, in-place repair copy-back), or (e) realistic value ranges. The failure mode of a "find as
  many bugs as possible" prompt is severity inflation and ignoring mitigations.
- How it was found: verifying each finding against the real code BEFORE fixing (the user chose "verify-first").
  Batch 1 (3 items) all fell to verification, then Batch 2 (2), Batch 3 (3), and C1 — 9 of 9.
- Rule: treat subagent/audit severity grades as UNVERIFIED LEADS, never ground truth. Source-verify each P0
  against the actual code path — call sites, sync vs async, batching, and existing mitigations — before
  reporting it to the user or "fixing" it. One verified non-bug is reason to re-verify the whole batch. When
  a fresh audit contradicts a prior careful assessment ("code-ready"), suspect the audit first.

### 2026-06-15 - The $24.99 Premium Pack money multiplier was inert — dead flag written, real field not

- What went wrong: weekly income applies the money multiplier by reading `goldUpgrades.multiplier`
  (`applyIncome.ts:92`), but BOTH IAP entitlement-apply paths in `IAPService.ts` (`applyProductToState`
  @1578 and the disk-apply path @~1037) set only `settings.moneyMultiplier = true` for a
  `config.moneyMultiplier` product. `goldUpgrades.multiplier` was set ONLY inside the separate
  `config.allUpgrades` / `config.everythingUnlocked` branches — which the Premium Pack
  (`moneyMultiplier: true`, no allUpgrades/everythingUnlocked) does not have. So the paid 1.5× multiplier
  did nothing. A prior audit (round11 MON-3) even mis-concluded "the money mult IS delivered via the
  different goldUpgrades.multiplier" — it traced the write of the dead flag and the existence of a
  goldUpgrades write, but never the END-TO-END write→read chain for that specific product.
- Why it hid: a stress test (`iapMonetization`) asserted `settings.moneyMultiplier === true` after the
  purchase — i.e. it tested the WRITE of the dead flag, which "passed", giving false confidence. No test
  fed the purchased state through `computeWeeklyIncome` to confirm the income actually changed.
- How it was found: a "verify the mapping" task (roadmap H7) written as an END-TO-END regression test —
  apply the real product config, then run the real income calc and assert the 1.5×. It failed (ratio 1.0),
  exposing the inert multiplier. Fixed by setting `goldUpgrades.multiplier` under `config.moneyMultiplier`
  in both paths.
- Rule: for monetization (and any write→read feature), test the END-TO-END effect, not just that a flag
  was written. A flag/field is only "wired" if the consumer reads THAT field. When the same effect is
  applied by multiple code paths (here: in-memory `applyProductToState` vs disk-apply — the "divergent
  entitlement paths" / H6 drift), they WILL drift; consolidate to one helper, and assert the observable
  game effect (income changed, ad removed, etc.), not the intermediate flag.

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

### 2026-06-26 - Weekly audit reported a false 🟠 high: perf jest suite "failed" in a fresh routine container

- What went wrong: the scheduled weekly-audit routine runs `npm run audit:weekly:full` in a freshly-cloned container. `node_modules` was not installed, so `npx jest __tests__/performance` died with "preset ts-jest not found" *before any test ran*. `audit-perf.cjs` caught that and reported it as a 🟠 high "Performance jest suite failed", failing the whole audit (`✗ ... 0 critical, 1 high`). There was no real perf regression — the suite passes in 4.5s once `npm ci` runs.
- Pattern: a dynamic check that shells out to a test runner conflates two distinct outcomes in one `catch` — (a) the suite ran and an assertion/timing budget failed (a real regression, 🟠), and (b) the runner couldn't start at all (missing deps, bad preset, no tests collected — an environment problem, not a regression). The routine harness (cron container) is exactly the env where (b) happens on every cold run, so the false blocker is recurring, not a one-off.
- Rule: before treating a shelled-out test failure as a finding, prove the harness actually ran. In `audit-perf.cjs`: gate the run on `depsInstalled()` (`node_modules/.bin/jest` + `ts-jest` both resolve) → INFO-skip if absent; and in the catch, only emit 🟠 when the output contains a real test summary (`/Tests:\s+\d+/`) — downgrade `preset .* not found` / `Cannot find module` / `No tests found` to INFO. The SKILL playbook's "false positive → tighten the analyzer, don't suppress" applies: the fix is detection, not deleting the check. Operationally, the routine's SessionStart setup should `npm ci` so the dynamic backstop actually runs (it only adds value with deps present).

### 2026-06-29 - Weekly audit: two HIGH money printers static checks can't see (atomicity + unit mismatch)

- What went wrong: the deep qualitative economy pass found two repeatable money printers the static audit (`audit:economy`) passed clean over. (1) `ContactsActions.redeemFavor` gated on the stale `gameState`, credited cash in one `setGameState` call, then flipped the ledger in a SEPARATE call — two same-batch taps both passed the stale gate and both paid out (a positive credit never overdraft-rejects) while the ledger closed once. (2) `VehicleActions.cancelInsurance` charged a 6-month premium (`monthlyCost*6`) for a 26-week term but refunded `floor(monthlyCost*weeksRemaining/4)-25` — a 4-week "month" against a 26/6≈4.33-week premium, so an immediate buy-then-cancel refunded up to 6.5 months of a 6-month policy: +$25..+$175/cycle, repeatable. Also `sellVehicle` lacked the inside-`prev` ownership re-check its sibling `sellItem` already had.
- Pattern: the static economy analyzer validates CONSTANTS (APR ordering, tax monotonicity, ladders, floors) but is blind to (a) grant/credit and state-flip split across two updaters — the H-8/H-9 same-batch double-tap race — and (b) refund/proration formulas whose week↔month unit basis disagrees with the charge formula (the H-3 "refund returns more than was paid" class). Both compile, type-check, and pass the existing tests because those tests only assert flags/active-state, never the money delta.
- Rule: any action that grants value (cash, item, perk) AND mutates a ledger/ownership flag must do BOTH inside ONE `setGameState(prev => …)` that re-checks the gating condition against `prev` (use `applyMoneyDelta` for the money leg so it shares the overdraft/ceiling guards), never gate on the outer stale `gameState`. For any refund/proration, prorate against the ACTUAL premium paid and ACTUAL term (`premiumPaid * remaining/term`) and clamp `refund ≤ premiumPaid` — never re-derive months with a different week-per-month divisor than the charge used. And every regression test for a money action must assert the exact `stats.money` delta across the buy+cancel / double-tap, not just the resulting flag.

### 2026-06-29 - IAP listener didn't share the foreground flow's in-memory dedup lock

- What went wrong: after the expo-iap migration, `runPurchaseFlow` (foreground) guarded against concurrent same-transaction processing with the in-memory `processingTransactions` Set, but `setupPurchaseListener` checked only the PERSISTED ledger (`isTransactionProcessed`). The persisted mark (`markTransactionProcessed`) is written at the very END of `applyBenefit`, after an async disk read/write — so if the listener fired for the same transactionId while the foreground grant was mid-flight, both passed the persisted check and both called `applyBenefit`, double-granting a consumable (gems/money).
- Pattern: two code paths that can process the same event need to share the SAME fast (in-memory) dedup guard; relying on a persisted ledger that's written late leaves a race window equal to the async work between the check and the write.
- Rule: when a singleton has both an interactive and a listener/callback path that grant the same entitlement, the listener must consult AND populate the same in-memory lock the interactive path uses (add on entry, delete in `finally`), in addition to the persisted ledger. Persisted-only dedup is correct for cold starts, not for same-process concurrency.

### 2026-07-01 - Weekly audit: hobby tournament was the last non-atomic "gate → grant" money action

- What went wrong: `enterHobbyTournament` (`HobbyActions.ts`) gated its once-per-week cooldown on the stale render-time `gameState`, then wrote the entry marker, drained energy, and paid the reward in THREE separate `setGameState`/dispatch calls. Two same-batch taps both passed the stale gate (the deterministic roll is identical for both, so both "win"), both wrote the marker, both drained energy, and both called `updateMoney` — an untaxed, repeatable payout for one week's cooldown. Its own sibling `trainHobby` in the same file already re-checked its cap inside the `prev` callback; this function was the lone exception. The static `audit:economy` (constants-only) and the existing `hobbyFlow.stress.test.ts` (sequential `act()` blocks with committed state between them) both passed clean — the same-batch race is invisible to both.
- Pattern: this is the same H-8/H-9 double-tap class the mega-audit and PR #43 kept closing (ContactsActions.redeemFavor, buyPet, enterCompetition). The tell is structural, not behavioral: an action that (a) reads its gating condition from the outer `gameState` snapshot and (b) applies the grant/marker/cost in more than one updater. Grep target: any `enter*`/`redeem*`/`claim*`/`buy*` action whose cooldown/ownership check sits ABOVE the first `setGameState`, with `updateMoney(`/`updateStats(`/a second `setGameState(` below it.
- Rule: any value-granting action must fold the gate re-check + every state mutation (marker, cost, reward) into ONE `setGameState(prev => …)` that re-reads the gate from `prev` and returns `prev` unchanged if it no longer holds; route the money leg through `applyMoneyDelta(prev, …)` so it shares the overdraft/ceiling guards. Re-derive any deterministic roll from `prev` (the lineage-seeded RNG is stable within a batch, so the outer message and the inner authoritative recompute agree). Every regression test must assert the exact `stats.money` AND resource (energy) delta across a same-batch double-tap — thread one shared `setState` over the same stale snapshot passed to both calls — not just the resulting flag.

### 2026-07-01 - Double-grant bugs hide in DEAD components too (GemsStoreModal)

- What went wrong: PR #43 fixed the IAP consumable double-grant in `ShopModal` and `GemShopModal` (the service applies `config.gems` via the IAPHandler `stateUpdater`; the modals must NOT re-add locally). But `GemsStoreModal.tsx` still ran `stats.gems += totalGems` after `purchaseProduct` — a real double-grant of real-money gems. It survived because the component is imported NOWHERE (grep found only its own self-reference); the live gem modal is `GemShopModal`. So it was a dormant landmine, not a shipped exploit — but exactly the footgun to trip a future dev who wires it up.
- Pattern: when a fix removes a redundant grant from "the modals," an orphaned/duplicate component carrying the same pattern gets missed because it never runs and no test covers it. Static and dynamic checks are both blind to unreachable code.
- Rule: after fixing a class of bug (double-grant, unit mismatch, non-atomic gate), grep the WHOLE tree for the pattern — not just the wired call sites — including dead/duplicate components (`grep -rn 'stats.gems +' components/` etc.). Fix or delete the dead copy; leaving a live `+= <currency>` after `purchaseProduct` anywhere in the tree is a regression waiting to be re-mounted. Verify reachability with a component-name grep before down-grading a duplicate-grant finding to "not exploitable".

### 2026-07-03 - Weekly audit: RDActions.enterCompetition was the last gate→grant that actually PRINTED money

- What went wrong: the deep economy pass found `enterCompetition` (`contexts/game/actions/RDActions.ts`) still non-atomic. The `alreadyEntered` + affordability gates were read from the stale outer `gameState`, the entry fee was charged via `deps.updateMoney` (dispatch #1), then the history entry was appended in a SEPARATE `setGameState` (dispatch #2) that never re-checked the gate. Two same-batch taps both passed the stale gate and both appended a duplicate `competitionHistory` entry (same `competitionId|entryWeek`). Unlike the self-charging double-tap actions (buyAccessory, purchasePassport, …) this one PAYS OUT: `processCompetitionResults` loops every pending entry and does `totalPrize += prize` per entry, so the duplicate independently placed and its prize was summed — a repeatable, untaxed money printer (prizes are 10×+ the entry fee). `applyHistory` marks BOTH duplicates completed, so nothing lingered to hint at the double-count.
- Pattern: same H-8/H-9 class the audit keeps closing (ContactsActions.redeemFavor, buyPet, PetActions/HobbyActions enterCompetition). The tell is purely structural: a gating read from the outer snapshot ABOVE the first `setGameState`, with the grant/marker/cost split across more than one updater. RDActions was overlooked because a PRIOR round (R10-1) had already made `processCompetitionResults` (the resolution/payout half) atomic — but the ENTRY half was never folded, and the two halves were audited separately. When a feature has a deferred payout (enter now, resolve N weeks later), BOTH halves must be atomic; hardening only the resolver leaves the printer open at entry.
- Rule: fold the gate re-check + entry fee (`applyMoneyDelta(prev, …)`) + marker append into ONE `setGameState(prev => …)` that re-reads the gate from `prev` and returns `prev` unchanged on the second tap. For any deferred-payout action, grep BOTH the enter* and the resolve/process* sides — a duplicate entry created at enter-time becomes a duplicate payout at resolve-time even when the resolver itself is atomic. Every regression test must assert exactly ONE entry appended AND the fee charged once across a same-batch double-tap.

### 2026-07-03 - The weekly-audit analyzer's own doc-drift check silently went dark after a file rename

- What went wrong: this week's tree renamed the dev docs (CLAUDE.md → DEV.md, AGENTS.md → WORKFLOW.md). `scripts/audit/audit-save.cjs` hard-coded `for (const doc of ['CLAUDE.md', 'AGENTS.md'])` for its STATE_VERSION cross-check. After the rename both files were absent, so the check hit the `src == null` branch and emitted `a.low('… not found', 'Skipping doc-version check')` for both — a WARNING that reads as noise, while the actual invariant (docs must state the canonical STATE_VERSION, drift has bitten this repo before) was no longer verified against ANY file. The audit's own safety check went dark and reported it as a low, not as "I can no longer see the thing I'm supposed to guard."
- Pattern: a static analyzer that references source/doc paths by hard-coded name silently stops enforcing its invariant when the target is renamed — the "skipping check" branch is indistinguishable from "nothing to check." This is the analyzer-integrity twin of the perf-suite lesson (2026-06-26): a check that can't run must not masquerade as a check that ran clean.
- Rule: when a file/symbol the audit scripts reference is renamed, grep `scripts/audit/` for the old name as part of the change. Point the check at the CURRENT names and distinguish "current doc missing" (worth an INFO/medium — the tree should ship it) from "legacy doc missing" (silent, expected). If NO doc satisfies the invariant, escalate to medium ("No dev doc states STATE_VERSION") rather than emitting per-file "not found" lows that bury the real signal.

### 2026-07-03 - IAPHandler resolved `true` on save-success regardless of whether the benefit applied

- What went wrong: the logic/stability pass found `components/IAPHandler.tsx` resolved the in-memory `stateUpdater` promise with an unconditional `resolve(true)` in the `saveGame().then(…)` branch, ignoring the `applied` boolean from `applyProductToState`. `IAPService.applyBenefit` keys its `skipBenefitReapply` guard on that resolved value: when the in-memory apply FAILED (`applied === false`, e.g. an unknown/misconfigured product) but the save succeeded, the service saw `true`, skipped the additive disk re-apply, and the paid consumable (gems/money/youthPills) was silently never credited — a lost paid grant. (The `.catch` branch already resolved `false`, so only the apply-false + save-success path was wrong.)
- Pattern: a callback that resolves a dedup/skip signal with an outcome it didn't actually verify. Resolving `true` on "the save finished" conflated "persisted" with "benefit landed"; the two diverge exactly when apply returns false.
- Rule: resolve the skip-reapply signal with the ACTUAL apply result (`resolve(applied)`), never an unconditional success. When one path's boolean gates whether another path does the fallback work, that boolean must reflect the thing the fallback exists to guarantee (benefit granted), not an adjacent success (disk write completed).

### 2026-07-06 - Weekly audit: an exclusivity/anti-bigamy guard added to the manual paths but not the weekly auto-executor

- What went wrong: commit `e72db35` ("block scheduling a second wedding on pre-fix bigamous saves") added the `otherCommitted` cross-partner guard to the manual `planWedding` and made `executeWedding` remove a pre-existing spouse — but the weekly scheduled-wedding auto-executor (`applyScheduledWedding.ts` Gate 1) promotes a relationship to `type:'spouse'` and overwrites `family.spouse` with NO existing-spouse check. A pre-fix corrupted save carrying two `weddingPlanned` relationships (the exact target of the fix) still auto-marries both on their scheduled weeks, yielding two `spouse` entries and a dropped `family.spouse` record — directly defeating the commit's stated guarantee. Static audit (constants-only) and money-conservation tests are both blind to it; it's a relationship-graph invariant, not a money one.
- Pattern: a state-transition can be reached from more than one path (manual action + deferred/weekly auto-execute). Hardening only the manually-triggered path leaves the invariant open on the scheduled path that fires later without a human tap. This is the exclusivity-guard twin of the deferred-payout lesson (2026-07-03, RDActions.enterCompetition): when a feature has an "enter now / resolve later" split, BOTH halves need the guard.
- Rule: when adding an exclusivity/uniqueness/anti-dup guard to a transition, grep for EVERY writer of that state field (`grep -rn "spouse" contexts/game/actions/`), including the weekly-tick auto-executors, and apply the same re-check at each. A guard on the manual action is not a guard on the invariant.

### 2026-07-06 - Weekly audit: an "age since X" timer computed against a value that is mutated at consume-time is always zero

- What went wrong: `applyScheduledWedding.ts` computes `weddingAge = nextWeeksLived - rel.weddingPlanned.scheduledWeek` to drive a documented 1-year forfeiture (lose deposit, -15 score). But Gate 1 only fires when `scheduledWeek === nextWeeksLived`, so `weddingAge` is structurally always 0 and the `>= WEEKS_PER_YEAR` branch is dead code; on the broke path `scheduledWeek` is overwritten to `nextWeeksLived + 4`, so it can never age. The anti-exploit forfeiture never happens — a broke engaged player postpones forever for free.
- Pattern: measuring elapsed time against a field that is itself the trigger condition (or is rewritten each cycle) yields a constant. The "age" needs an immutable anchor set once at creation, not the live, consumed-and-rewritten schedule value.
- Rule: any "expire/forfeit after N weeks" logic must age against an immutable `createdAt`/`plannedAtWeek` stamped once when the record is created — never against a mutable schedule/next-due field that the same tick advances. When reviewing a forfeiture/expiry branch, check it can actually be reached: if the guard field equals the fire condition, the elapsed delta is 0 and the branch is dead.
