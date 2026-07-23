# Lessons Learned

<!-- Updated after every correction. Reviewed at the start of each session. -->

## Patterns to Watch For

### 2026-07-20 - Weekly audit: GameState schema drift — 4 fields added to initialState AFTER the version bump, no migration/repair

- What went wrong: `luxuryItems` (Luxury & Collectibles, commit `5e3cdf1`) and `ambitionId` /
  `ambitionCompletedMilestones` / `ambitionRewardClaimed` (Life Ambitions, commit `ffd82cc`) were
  added to `contexts/game/initialState.ts` on 2026-07-13, TWO days after `STATE_VERSION` was bumped
  to 22 and `migrations[22]` was written (`9ddff7e`, 2026-07-11). The version was never bumped to 23,
  so `migrations[22]` doesn't set them and `repairGameState` didn't backfill them → every existing
  v22 save loads with these fields `undefined`. Not an active crash today ONLY because every consumer
  happens to guard (`?? []`, `!!`, `|| []`), but that is one un-guarded future reader away from a
  crash on the entire installed base — the exact "GameState drift" Hard Rule #3 exists to prevent.
- Why the static audit missed it: `audit-save.cjs` verifies migrations `[2..N]` are all *covered*
  and that `STATE_VERSION` matches the docs — both were true. It does NOT diff `initialState`'s field
  set against what the migrations/repair actually set, so a field added without a version bump is
  invisible to it. The save-migration stress test also spreads `...initialGameState`, so tests always
  start complete and never exercise a real v22 save that lacks the newer fields.
- How it was found: the weekly-audit Crash/Save subagent traced each `initialState` field added this
  cycle back through git to confirm whether a migration + a `repairGameState` backfill existed. Fixed
  by bumping `STATE_VERSION` to 23, adding an idempotent `migrations[23]` that backfills the three
  concrete-default fields (only-if-missing), and mirroring the backfill into `repairGameState` for
  partial/CloudSync saves. `ambitionId` intentionally omitted — its default is `undefined`, so an
  absent key already equals the default. Updated DEV.md / WORKFLOW.md / CLAUDE.md to state v23.
- Rule: adding a field to `initialState.ts` is a THREE-part change that must land together — (a) a
  migration that bumps `STATE_VERSION` and backfills it, (b) a `repairGameState` backfill for partial
  saves, (c) inclusion in `createTestGameState`. A field that consumers only ever read via `?? []` is
  NOT safe drift — it's a latent crash waiting for the first non-guarded reader. Consider a static
  check that diffs the `initialState` key set against fields set by the migration ladder + repair, so
  this class fails the audit instead of a subagent having to catch it. (The `.claude/agents/*` +
  `.claude/prompts/*` the SKILL references still don't exist in-repo — ran the deep pass with
  general-purpose subagents again; same note as 2026-07-07.)

### 2026-07-07 - Weekly audit: divergent duplicate code paths (auto vs. manual wedding) + one unguarded call in a per-tick loop

- Two code paths that reach the SAME outcome must produce IDENTICAL state, or one silently drifts.
  `applyScheduledWedding` (the weekly-tick auto-marry path) built the spouse record with only
  `type: 'spouse'` + score, while the manual `executeWedding` (DatingActions) additionally set
  `marriageWeek`/`anniversaryWeek`, cleared `engagementWeek`/`engagementRing`, and set
  `livingTogether: true`. Which path fires is purely whether the player taps "execute" that week or
  lets the tick resolve it — so a large fraction of marriages went through the auto path and got an
  incomplete record. Concrete fallout: `checkAnniversary` bails on `!spouse.anniversaryWeek`, so
  auto-married couples NEVER got an anniversary (happiness reward + milestone permanently
  unreachable), and a married partner kept stale engagement flags. Fix: mirror the manual path
  field-for-field. Lesson: when you extract/duplicate a state transition, snapshot BOTH outputs and
  diff them — a subsystem-equivalence snapshot test is the right home for this (it caught the diff
  cleanly on `-u`).
- One unguarded caller in an every-tick loop reintroduces a soft-lock class the resilience test
  exists to prevent. `trackBudgetSpend` did `[...banking.budgetSpend]`; EVERY other caller guarded
  with `prev.banking?.budgetSpend ? … : …`, but the new weekly-tick `spendEvents` loop
  (`lib/banking/weeklyTick.ts`) called it unguarded every week. On a partial/older banking slice
  (`budgetSpend === undefined`) that throws inside the tick updater, whose outer catch returns
  `prevState` → "Next Week" silently no-ops (soft-lock). Fixed at the SOURCE (default
  `[...(banking.budgetSpend || [])]`) so all present/future callers are covered, and wrapped
  `runWeeklyBankingTick` in its own try/catch like the pulse/spark/stocks ticks — its crash surface
  grew this week (interest accrual + budget tracking) without an inner guard. Lesson: if N callers
  guard a helper and one doesn't, the fix belongs IN the helper, not in the Nth caller. And a
  subsystem tick whose failure aborts the whole week needs its own try/catch — check that every new
  tick step has one.
- `planWedding` charged its 25% deposit without re-checking affordability inside the updater
  (the same H-class atomicity gap the audit keeps closing) — a same-batch double-tap double-charged.
  Added the in-updater `money >= deposit` re-check to match `proposeMarriage`/`executeWedding`.
- Process note: the referenced project subagents/prompts (`.claude/agents/*`, `.claude/prompts/*`)
  do not exist in this repo — the SKILL points at them but they were never committed. Ran the deep
  qualitative pass with general-purpose subagents (one per domain) instead; worked fine. Worth
  either committing those agent/prompt files or updating the SKILL to drop the dead references.

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

### 2026-07-09 - Weekly audit: exposeCatfish was the last non-atomic gate→grant, this time on reputation not money

- What went wrong: the economy pass found `SparkActions.exposeCatfish` still split across an updater + a trailing dispatch: the `setGameState(prev => …)` appended a `catfishRecord` and bumped `totalCatfishExposed` with NO dedup on `profileId` (its sibling `reportProfile` guards `reportedIds.includes`), then `updateStats(setGameState, { reputation: 5 })` ran as a SEPARATE dispatch with no `applied` gate. Two same-batch taps → duplicate record, double counter, +10 reputation for one catfish. Same H-8/H-9 structural tell the audit keeps closing, but on a bounded stat (reputation clamps 0-100) rather than money, so it graded MEDIUM not a printer.
- Pattern: the gate→grant class is not money-specific. Any value-granting action whose grant is split across the updater and a trailing `updateStats`/`updateMoney` is double-tappable — reputation, followers, records, counters all leak the same way. The tell is identical; only the severity differs by what's granted.
- Rule: fold the dedup re-check into the updater against `prev`, capture an `applied` flag inside it (the PulseActions.composePost idiom), and skip the trailing `updateStats`/`updateMoney` when `!applied` (return a `success:false`). The regression test must fire the action TWICE against the same stale snapshot and assert exactly one record + the stat delta applied once. When sweeping for this class, don't stop at `updateMoney` — grep trailing `updateStats(`/counter bumps too.

### 2026-07-09 - Weekly audit: a concurrent audit PR had already fixed our top finding on main — rebase and re-scope before pushing

- What went wrong: this run's deep pass independently found the auto-wedding path (`applyScheduledWedding`) never set `marriageWeek`/`anniversaryWeek`/`livingTogether` (a HIGH) and fixed it inline. But between branching and pushing, merged PR #49 fixed the exact same bug on `main` — and better, extracting a shared `buildSpouseRecord` factory used by both the manual and auto paths (the very "factor the shared shape into one helper" refactor this audit's own lesson recommends). Our branch was cut from a now-stale base, so the PR went `mergeable_state: dirty` (conflict in `applyScheduledWedding.ts` + the equivalence snapshot). The wedding fix was fully redundant; only the `exposeCatfish` fix + tests were still novel.
- Pattern: audit branches are long-lived relative to a fast-moving `main`. Two audit passes (ours + PR #49's) racing on the same recently-shipped feature will converge on the same top bug. A finding being real does not make it still-unfixed by the time you push.
- Rule: before opening an audit PR, `git fetch origin main` and diff your finding's file against the CURRENT tip — not the base you branched from. If `main` already fixed it, rebase onto `main`, drop the redundant change, and re-scope the PR to only what's still novel (keep your tests if they add coverage the merged fix lacks — e.g. a direct semantic assertion vs an opaque snapshot). Resolve `dirty` by resetting onto the fresh `main` and re-applying just the novel diff; force-with-lease is fine when the discarded commits were never merged.

### 2026-07-10 - Weekly audit: the new server IAP endpoint accepted SANDBOX receipts in production (free premium)

- What went wrong: this week's big new surface was `server/iap-verify/api/verify.js` (the receipt-verification backend the app fails-closed against). The deep IAP pass found `verifyApple` looped `for (const env of [Environment.PRODUCTION, Environment.SANDBOX])` and returned `true` if EITHER verified. A StoreKit *sandbox* transaction is free to obtain on a production build (sign a Sandbox Apple ID into device Settings) and its signed JWS verifies cleanly under `Environment.SANDBOX` — so a normal user could unlock `deeplife_lifetime_premium` (and every gem/perk product) for $0. The server literally decoded the environment and granted anyway. Separately, the `ALLOW_SOFT_LAUNCH` stopgap granted ANY well-formed >20-char string for a known productId, one stray env var away from a total bypass on the live endpoint, "protected" only by a bearer token that ships in the client JS bundle.
- Pattern: the money exploit this week was NOT in the game's action layer (which the audit has hardened round after round against the gate→grant double-tap class) — it was in freshly-added *backend/server* code that the five static analyzers don't scan at all. A new trust boundary (a verification server) is exactly where the next revenue leak hides once the client-side exploits are closed. Also: "verifies under some environment" ≠ "is a real production purchase" — the environment IS part of the authorization decision, not an implementation detail to loop over.
- Rule: when a release adds a server/verification endpoint, audit it as its own domain — treat every `grant`/`verified:true` path as a money printer until proven otherwise. Accept PRODUCTION receipts only in prod; gate SANDBOX behind an explicit `IAP_ALLOW_SANDBOX` flag that staging/TestFlight/review builds set and production never does. Make every soft-launch/bypass stopgap fail-closed in production (require a second deliberate `*_IN_PROD` flag). Never rely on a bearer token sourced from an `EXPO_PUBLIC_*` var as a real gate — it's in the bundle. Grant *amounts* must come from a server-side product table, never the client-supplied receipt/quantity (this part was already correct — keep it that way).

### 2026-07-10 - Weekly audit: the gate→grant double-tap class also lives in UI components, not just action modules

- What went wrong: the logic pass found `components/LifeMomentModal.tsx` `handleChoice` read `gameState.lifeMoments?.pendingMoment` from the stale render closure and applied `updateMoney`/`updateStats`/karma via separate dispatches BEFORE the `setGameState` that clears `pendingMoment`. Two same-frame taps both passed the `if (!pending) return` gate → double grant (e.g. "Bank the windfall" = +$5,000 → +$10,000; karma choices double their delta). This is the identical structural tell the audit keeps closing in `contexts/game/actions/*`, but it had gone unscanned because it lives in a `components/*.tsx` modal, and the 4→20 life-moments expansion this week added a no-cost cash-windfall choice that turned a latent double-apply into a real (if low-frequency) printer.
- Pattern: the audit's grep for the gate→grant tell has historically targeted `contexts/game/actions/`. But any component whose `onPress` reads a pending/gate value from the render closure and then fires `updateMoney`/`updateStats` across multiple dispatches is the same bug. The action-module hardening pushed the remaining instances of the class into the UI layer, where money/stat helpers (`updateMoney`) can't be trivially folded into one `setGameState(prev=>)`.
- Rule: extend the gate→grant sweep to `components/**/*.tsx` — grep for `onPress` handlers that read a `pending*`/gate field from `gameState`/props and call `updateMoney(`/`updateStats(` before clearing the gate. When the grant helpers are external dispatches that can't be folded into the authoritative clear, latch on the item's unique id with a `useRef` (set synchronously at the top of the handler, checked before applying) so a same-frame double-tap resolves exactly once — the "disable after first tap" fix, done in a way that's robust to React's render timing.

### 2026-07-10 - Weekly audit: a weekly-tick subsystem grew crash surface but stayed outside the try/catch its siblings have

- What went wrong: `runPoliticsWeeklyTick` was called at `GameActionsContext.tsx:~1470` with NO try/catch, while the banking and stocks ticks that bracket it in the same `nextWeek` updater ARE each wrapped with a fallback. This week added +67 lines of election-resolution logic to the politics tick, growing its throw surface — and a throw there would abort the entire `nextWeek` updater and soft-lock "Next Week". The static perf audit even reported it obliquely ("48/49 subsystems inside try/catch") but the one unwrapped subsystem wasn't called out by name.
- Pattern: the weekly-tick resilience invariant ("one subsystem's failure must not abort the whole tick") is enforced unevenly — new subsystems get added without the try/catch wrapper their siblings have, and the "N/M wrapped" static metric hides *which* one is bare. A subsystem that gains new code this week is exactly the one whose missing guard now matters.
- Rule: when a weekly-tick subsystem gains logic in a release, confirm its call site is inside a try/catch with a carry-over fallback (`nextX = prevState.x` on error), mirroring banking/stocks. Better: make the static audit name the unwrapped subsystem(s) rather than emit a bare "48/49" count, so the gap is actionable instead of buried.

### 2026-07-13 - Weekly audit: political office was double-paid, and the money-conservation lens was blind to it

- What went wrong: winning political office (`PoliticalActions.ts`) sets BOTH `currentJob:'political'` and pushes `careers[political]` with `accepted:true`. That made the generic weekly career-salary path (`applyCareerSalaryAndPenalty.ts`) pay `POLITICAL_CAREER.levels[level].salary` as a WEEKLY amount, while `passiveIncome.ts` ALSO paid the same salary as ANNUAL ÷ WEEKS_PER_YEAR. Both fed `totalIncome` every week. POLITICAL_CAREER salaries are authored as annual figures (President = 100000), so the generic path paid a President ~$100k/WEEK (~$5.2M/yr) on top of the intended ~$1,923/wk — and because office-loss only zeroes `politics.careerLevel` (not `currentJob`/`careers[].accepted`), the ~$100k/wk never stopped after being voted out. A textbook money printer gated behind "win an election."
- Pattern (two compounding): (1) the same salary table is consumed by two income paths with DISAGREEING units (one treats it weekly, one annual) — whenever a value feeds more than one accrual path, the paths must agree on units AND on ownership, or they double-count. (2) The economy/money-conservation stress suite is blind to income that only unlocks off the default loop: winning the presidency isn't in the default simulation, so 33/33 money-conservation tests stayed green while a President printed millions. The static economy analyzer (savings<loan APR, tax monotonicity, miner ladder) also can't see it — it audits constants, not the tick's income aggregation. It took the *game-logic* lens (trace what fires on `currentJob:'political'`), not the *economy* lens, to catch it.
- Rule: any income source that is ALSO delivered by `passiveIncome` (political, rent, mining, stocks…) must be excluded from the generic per-`currentJob` career-salary path — one owner per income stream. When you add a salary/price table consumed by multiple accrual paths, assert the unit (weekly vs annual) at every consumer and pick a single owner. For the audit itself: money-conservation stress tests must exercise the OFF-default income unlocks (hold each political office for a week and assert the weekly credit equals the single intended figure), because a printer behind a feature-unlock is invisible to a default-loop conservation test. When the economy lens comes back clean, still run the game-logic lens over "what pays out when `currentJob`/a career flag is set" — the two lenses catch different halves of the economy.

### 2026-07-13 - Weekly audit: crypto & dark-web ticks were the last two subsystems running outside try/catch

- What went wrong: continuing the 2026-07-10 "bare weekly-tick subsystem" thread, the crypto tick (`GameActionsContext.tsx` ~1342) and dark-web tick (~1484) were the only subsystem ticks in the `nextWeek` updater still NOT wrapped in try/catch (banking/stocks/politics/pulse/spark/hustle all are). Both self-guard *missing* top-level slices (`?? initial`), and dark-web even carries a comment claiming it avoids throws — but that self-guard only normalized `activeJobs`/`recentEvents`, leaving `vendors`/`skills`/`laundering`/`listings` exposed, and crypto left `coinMarkets.btc` (halving path) and `market.openOrders` iteration unguarded. A present-but-null sub-field (CloudSync merge / hand-edit / corruption — the exact class `repairGameState` names as a threat but only handles for whole-slice-missing) throws, and a throw there aborts the whole updater → "Next Week" soft-locks. The static perf audit reported it only as an opaque "50/51 subsystems inside try/catch" — the ONE bare subsystem wasn't named, and here there were effectively two.
- Pattern: a subsystem that "self-guards" is not equivalent to one wrapped in try/catch — the self-guard defends the fields the author remembered, and silently rots as the schema grows new sub-arrays. The belt-and-suspenders wrapper (try/catch + carry-over fallback) is what actually makes the resilience invariant hold regardless of which sub-field is null. The "N/M wrapped" static metric hid *which* ones were bare.
- Rule: every subsystem tick call in `nextWeek` gets its own try/catch with a carry-over fallback (`nextX = prevState.x`), full stop — don't rely on the subsystem's internal null-guards to substitute for it. When a normalize/self-guard block lists specific sub-fields, it must cover EVERY iterated/indexed slice of that type (grep the tick's operations for `for (const … of dw.X)` / `dw.X[`), not just the two the author hit first. Upgrade the static audit to NAME the unwrapped subsystem(s) rather than emit a bare "50/51".

### 2026-07-16 - Weekly audit: the "bare weekly-tick subsystem" class recurred a 4th time — and this time I finally made the static audit NAME the gap

- What went wrong: this week added FOUR new subsystem calls into the `nextWeek` updater — `applySubscriptionsForWeek` (in-game sub billing, 1365), `applyContentMemberships` (streaming memberships, 1552), `applySavingsGoals` (1574), and `expireFavors` (favor-ledger expiry, 1596) — and NONE were wrapped in the per-subsystem try/catch that every sibling (banking/stocks/politics/crypto/darkweb/pulse/spark/hustle) has. The concrete HIGH: `expireFavors` (`lib/contacts/favors.ts`) did `ledger.favors.map(...)` while the call site only guarded `prevState.favorLedger` truthiness — a present-but-partial `favorLedger: {}` (CloudSync merge / hand-edit / interrupted migration) throws `undefined.map`, and unwrapped in the updater → outer catch at ~2033 returns `prevState` → `weeksLived` never advances → PERMANENT "Next Week" soft-lock. The other three were defensive enough that I couldn't construct a throw today, but they broke the categorical invariant. The static perf audit again reported only a bare "52/53 subsystems inside try/catch" — the offenders weren't named.
- Second finding (MEDIUM, different class, same root save-shape): dc3e337's crash-fix sweep for legacy `sparkApp` lacking `premium` missed two sibling call sites — `SparkActions.rewindLastSwipe` (`sp.premium.perks.rewindLastSwipe`, line 273) and `likeBackFromLikedYou` (`sp.premium.perks.seeWhoLikedYou`, line 468). Both read the RAW `gameState.sparkApp` (no `ensureSpark` backfill) and only guarded `if (!sp)`, so an old save with a `premium`-less sparkApp crashes with "Cannot read properties of undefined (reading 'perks')" on tapping Rewind / a Liked-You entry. A partial-save fix that touches ONE consumer of a slice must grep for EVERY consumer of the same sub-field — the class re-lives at the sites the sweep skipped.
- Economy verdict: CLEAN. Streaming (finalize/start/tick), in-game subscriptions, and the ad-reward orb were all independently traced by subagents + by hand — the gate→grant double-tap class is architecturally closed (every grant folds into the authoritative `setGameState(prev=>)` updater via `applyMoneyDelta`, with the gate re-checked against `prev` inside it). No printer. Non-blocking LOWs filed: immediate stream/video payouts bypass the $75k/wk soft-cap that only the passive aggregator enforces (earned + hard-bounded by the 5-actions/week cap, so a balance decision not an exploit); subscription weekly billing has no `BANKRUPTCY_FLOOR` guard (anti-player, drains to $0, unlike loan autopay); subscribe actions lack an already-active re-entry guard (anti-player double-charge, mitigated by modal gating); dead `deps.updateMoney` param in ContentActions.
- Rule: the recurring lesson finally got its tooling fix — `audit-perf.cjs` P2 now NAMES the unwrapped subsystem calls (`— unwrapped: <names>`) instead of a bare "N/M", so the next bare subsystem is actionable at a glance rather than buried in a count. The block-count delta (42→46 here) is the honest signal that new wraps landed. When the count is "M-1/M", read the named residual: a pure self-guarding helper like `applyMoneyDelta` (returns null, never throws) is an acceptable residual; a real `apply*/run*/process*` subsystem tick is not. Keep folding: every NEW subsystem call added to `nextWeek` gets its own try/catch + carry-over fallback in the same commit that adds it — the invariant is categorical, not a function of whether you can construct a throw this week.

### 2026-07-17 - Weekly audit: the "bare weekly-tick subsystem" class recurred a 5th time (disease/pet/vehicle/luxury) — and I learned the static P2 metric can't see it

- What went wrong: the chronic-disease management loop (11e87e6) added new logic to `applyDiseasesForWeek` but left its call site in the `nextWeek` updater OUTSIDE any per-subsystem try/catch — as were its three neighbors in the same block (`tickPetsForWeek`, `applyVehiclesForWeek`, `applyLuxuryItemsForWeek`). All four iterate player-growable arrays (`diseases`/`pets`/`vehicles`/`luxuryItems`) and carry real partial-save throw surface — the concrete one: `applyDiseases.ts:107` `[...(input.prevDiseases || [])]` throws "not iterable" on a truthy non-array `diseases` (CloudSync merge / hand-edit / interrupted migration), BEFORE the helper's own `Array.isArray` guard. Unwrapped, that throw falls to the outer updater catch which returns `prevState` → `weeksLived` never advances → "Next Week" fails that week (mitigated: the outer catch surfaces an error toast rather than white-screening, and `repairGameState` normalizes `diseases` to `[]` on next load — so it's failed-week-until-reload, not a permanent brick). Fixed all four with their own try/catch + carry-over fallback, preserving the deliberate money-mutation order so the success path stayed byte-identical (308 subsystem snapshots unchanged).
- Second thing I learned (audit-tooling reality check): I tried to make `audit-perf.cjs` P2 "name the gap" by excluding the whole-updater try (whose catch returns prevState = the soft-lock) from the guarded-ranges set. It backfired: doing so drops guarded coverage from 52/53 to 23/53 and names ~30 subsystems (computeWeeklyIncome, applyRentAndHousing, applyCrimeTick, applyWeeklyEvents, …) that ALSO rely solely on the outer wrapper. The truth the experiment exposed: the code does NOT actually wrap every subsystem individually — only the higher-risk, partial-save-prone ones get inner try/catch, while ~30 pure-ish calculators lean on the outer net. P2 is a *tolerant smell check* (guardRatio ≥ 0.6, outer-wrapper counts) by design; a strict "every call in its own try" rule would flag a 30-item backlog, not a regression. Reverted the P2 change.
- Rule: keep wrapping incrementally — every NEW or NEWLY-EDITED subsystem call in `nextWeek` that iterates a player-growable array gets its own try/catch + carry-over fallback in the same commit that touches it (the actionable, non-flooding version of the categorical invariant). The static P2 check genuinely CANNOT distinguish "safe outer-wrapper reliance" from "dangerous outer-wrapper reliance" — it counts the outer try as a guard — so it will keep reporting a reassuring 52/53 while a freshly-edited array-iterating tick sits bare. The real detector is the human/subagent game-logic lens tracing "which newly-touched tick iterates a growable slice without a leaf try" — run it every week on the diff, because the number will lie.
- Merge note: this fix collided with PR #65 (vitals-UI redesign), which added `moneyBeforeLuxury`/`luxuryCharged`/`moneyBeforePetFood`/`petFoodCharged` locals to the same pet/vehicle/luxury block. Re-applied the wrap onto the rebased base, hoisting the downstream-used vars (updatedPets/updatedVehicles/luxuryCharged/updatedAchievements/petFoodCharged) and leaving PR #65's money-floor intermediates as `const` inside the try.
- Review refinement (CodeRabbit, valid): my first cut grouped pets + vehicles + luxury + pet-food into ONE shared try/catch. That's a half-measure — those subsystems mutate `weeklyCtx.newStats.money`/happiness IN SEQUENCE, so if a LATER one (luxury) throws after an EARLIER one (vehicle maintenance / pet-death penalty) already mutated `newStats`, a shared catch reverts the later subsystem's OUTPUT (`updatedVehicles`→prevState) while the cash/happiness mutation stays applied → state-vs-cash desync, and the player gets re-charged/re-penalized for the same week on the next tick. Rule: when wrapping N sequential subsystems that each mutate shared `newStats`, give each its OWN try/catch so a failure isolates to that subsystem and never rolls back a sibling whose side effect already landed. Also: the carry-over fallback must self-heal — `?? []`/`|| []` preserves a truthy non-array (the exact throw case) and re-throws every week until reload; use `Array.isArray(x) ? x : []` so the bad shape is replaced THIS tick.

### 2026-07-22 - Weekly audit: migration/repair asymmetry — `realEstateActivity` had a v22 migration but no `repairGameState` mirror (the static save audit can't see per-field repair parity)

- What went wrong: `realEstateActivity: []` (`initialState.ts:75`, a top-level concrete-default array) was backfilled on the version ladder by migration 22 (`saveMigrations.ts:619`) but was NEVER mirrored into `repairGameState` (`utils/saveValidation.ts`) — zero matches in the file. This is exactly the CLAUDE.md save-format rule (b) asymmetry ("set a value in the migration AND mirror it in repairGameState") that Hard Rule #3 exists to catch. It is not an active crash — every consumer already guards with `?? []` (`GameActionsContext.tsx:808`, `RealEstateApp.tsx:338`) — but a partial save already stamped at v23 (CloudSync merge / hand-edit) that is missing the key is healed by neither path: the wholesale migration skips it (version already current) and repair has no branch for it. Four v22 Wave-A NESTED fields have the same gap at LOW severity (`travel.passportMilestones`, `socialMedia.followerHistory`/`scandalRiskScore`, `gamingStreaming.perkTier`/`lastMemberWeek`/`hypeStreak`) — all guarded reads, filed not fixed. Fixed the top-level `realEstateActivity` with a 6-line mirror of the adjacent `luxuryItems` block.
- Pattern: the static save analyzer verifies the version-consistency invariants (STATE_VERSION across code+docs, contiguous migration coverage [2..N], repair/factory PRESENCE) but it does NOT cross-check each concrete-default field in `initialState` against BOTH migration and repair coverage — so a field can be migration-covered, factory-covered (createTestGameState spreads `...initialGameState`, so (c) is structurally auto-satisfied for every field), and still silently miss the repair mirror (b). The audit's own v23 fields (luxuryItems/ambition*) got both treatments and passed; the OLDER v22 additions were the ones that rotted. Guarded `?? []` reads at every consumer are what keep this at MEDIUM instead of a crash — which is also why a purely runtime test never surfaces it.
- Rule: when a field with a concrete stored default is added to `initialState`, its migration backfill AND its `repairGameState` mirror must land in the same commit (rule (b)), for NESTED fields too — the parent-subsystem repair block must list every new concrete-default sub-array/scalar, not just the ones the author hit first (same "self-guard rots as the schema grows" failure as the bare-tick class). Audit-tooling upgrade worth doing: extend `audit-save.cjs` to enumerate every `key: <concrete-default>` in `initialState` and assert each appears in BOTH `saveMigrations.ts` and `saveValidation.ts` (skipping `undefined`-default keys like `ambitionId`), so the migration/repair asymmetry becomes a named static finding instead of a subagent catch.
- Economy note (NOT fixed — design call for the owner): channel-membership income (`applyContentMemberships.ts`, new v2.5.7) is credited post-tax at `GameActionsContext.tsx:1801`, capped $75k/wk and idempotent (`lastMemberWeek`), but never enters `totalIncome` so it escapes progressive tax — WHILE the same creator app's ad-revenue stream flows through `passiveIncome`→`totalIncome` and IS taxed. It is consistent with the established post-tax-credit pattern for crypto (`:1698`), hustle (`:1657`), and stocks (`:1929`), so it is not a new regression or a printer; taxing it would require risky tick-reordering (tax computed at `:836`, membership at `:1795`). Left as a filed balance decision rather than changing money-flow in an unattended routine. Lens rule reaffirmed: economy came back CLEAN on printers/double-grants/free-debt-erasure; the only real fix this week came from the SAVE lens, not the economy lens.

### 2026-07-23 - Weekly audit: CLEAN — monetization week (DeepLife+, gem shop, RevenueCat); welcome-gems exploit vector was pre-closed, plus an operational backstop gap

- Verdict: no blocking findings. Static suite green (5 domains; only the standing 🟡 "41 `as GameState` in tests" backlog item, unchanged, not a regression). Dynamic backstop all-pass once deps were installed: money-conservation (4), saveMigrationAudit + longRunSaveLoad 520/1040/5200-week (12), deepLifePlus exploit-resistance (7), performance (4); type-check + route-conflicts clean.
- This week's diff was monetization plumbing (RevenueCat SDK, DeepLife+ subscription/upsell, gem-shop art/perk fixes) + an Android local-build workflow — NOT core-loop gameplay. The only new value-granting path was DeepLife+'s 500 welcome gems, which is the classic "subscribe → cancel → resubscribe" farm vector. It is correctly closed: `applyDeepLifePlusBenefits` gates the grant on a STICKY `settings.deepLifePlusWelcomeClaimed` flag that (unlike `deepLifePlusActivated`) never clears on lapse, both grant call sites are entitlement-gated (`SubscriptionModal` on verified purchase, `SubscriptionReconciler` on `subscriptionService.hasPremiumAccess()`), and `deepLifePlus.test.ts` asserts the resubscribe no-re-grant explicitly. Gems also can't leak into in-game money — `StatsActions.updateStats` hard-rejects `money`/`gems` and routes them through `updateMoney`/`applyMoneyDelta`.
- Save note: the new `settings.deepLifePlus*` fields are optional booleans (`?: boolean`, default `undefined`, read via `=== true`) and are NOT written into `initialState.ts` — the `ambitionId`-style case where an absent key already equals the default, so per CLAUDE.md rule (b) they correctly need no `repairGameState` backfill and no STATE_VERSION bump. The drift analyzer stayed green for the right reason, not by luck.
- Operational lesson (new): a fresh routine clone has NO `node_modules`, and `npm run audit:weekly:full` DOES NOT fail on that — it prints "Performance jest suite skipped (dependencies not installed)" and exits 0, so the entire dynamic money-conservation/perf backstop silently no-ops while the report still reads "PASS". Run `npm ci` FIRST in the routine (or before `:full`) or the deep economy pass is running on static checks alone. Confirmed the backstop is meaningful once installed — it exercised money conservation and the resubscribe-farm case that static analysis can't see.
- Lens rule reaffirmed: economy/save/logic/perf/stability all came back clean; the meaningful review work was the game-logic lens tracing the new grant path (welcome gems) to prove single-grant, since a static economy analyzer that audits constants can't see a one-time-vs-repeatable currency grant.
