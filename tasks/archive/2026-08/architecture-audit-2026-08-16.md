# Architecture Audit — 2026-08-16

Full-codebase architecture audit. Read-only — no code was modified. Produced by six
parallel domain audits (entry/routing/build · state core · persistence · lib game
systems · UI/services/hooks · testing/data-flows), with every CRITICAL and HIGH
finding re-verified against source by the orchestrator before inclusion, per §8's
"don't trust an audit/subagent claim without re-reading the source".

Severity buckets: **CRITICAL** = fix before continuing development. **HIGH** = fix
in the next working session or two; each is either a live player-facing defect or a
broken safety net. **MEDIUM** = schedule; real debt with a concrete failure mode.
**LOW** = opportunistic.

A recurring meta-pattern ties the worst findings together: **the repo's safety nets
are its architecture**, and several of them report green while not actually
guarding anything (C2, C3, C4, H2, H3, H4, H5). The discipline documented in
CLAUDE.md is genuinely followed in the code — the §4.4 atomicity sweep, the tick
guards, the migration/carve-out registry are all in better shape than most codebases
this size — but the machinery that *proves* it keeps holding has holes exactly where
it matters.

---

## 1. Architecture overview (as-built, verified)

**Entry/boot.** `package.json main → app/entry.ts` (17 lines, Hard Rule #1 intact) →
`app/_layout.tsx` (1,491 lines — the real init file: global error handlers, ~8
deferred startup tasks, `startupOrchestrator` for ATT→AdMob→Firebase→IAP→telemetry,
error boundaries at four levels) → `contexts/AppProviders.tsx` (9 app providers) →
`app/index.tsx` boot loader → `router.replace('/(onboarding)/MainMenu')`.

**Routing.** expo-router v6; `(onboarding)` group (6 screens, anchored MainMenu) and
`(tabs)` group (9 screens, anchored home, 5 with `href: null`). No route conflicts
today; `scripts/check-route-conflicts.cjs` correctly replicates group-stripping.

**State.** One `GameState` behind 9 nested game providers
(`contexts/game/GameProvider.tsx`), each in a `ProviderBoundary`.
`GameStateContext` holds the single `useState`, wraps the setter (identity
short-circuit, `updatedAt` bump, wealth-peak ratchet) and publishes a
`useSyncExternalStore` mirror consumed by `useGameSelector`/`useSetGameState`/
`useGameStateGetter`.

**Week tick.** `GameActionsContext.nextWeek` (~2,900 lines, lines 420–3490): pre-rolls
computed outside the updater for StrictMode determinism → one `setGameState` updater
containing ~43 subsystems, 13+ behind `guardTick` and the rest behind inline
try/catch, ordering constraints documented in place (death money-revert before
ambition payout before mail) → notification flush → validate/repair → `saveGame`.

**Persistence.** `saveGame` → mutex → validate/repair → backup → `saveQueue`
(protected-state embed, history pruning, size-capped re-prune, CRC32+HMAC v2
envelope, double-buffer write with pointer flip). `loadGame` → mutex → double-buffer
read → envelope verify → backup fallback → `runMigrations` (STATE_VERSION 43,
future-version refuses with a typed error) → `repairGameState` → family/relationship
reconciliation → `{...initialGameState, ...parsed}` + `mergeLoadedSlice` for
stats/date/settings/userProfile → invariants → protected-state restore →
`restoreStockPrices`. Layered, each stage degrades rather than crashes.

**lib/.** 58 domain directories, ~288 source files, ~81k LOC. **Zero true import
cycles touching lib/** (measured over value edges; the eslint cycle-breaker audit's
conclusions hold). Normal direction `app/components → contexts → lib → lib/config`,
with five inversions (H6). `lib/` is genuinely free of `as any` in code.

**Services.** 8 singletons; every native SDK is lazy-required inside try/catch
behind a load latch (§4.6 respected everywhere checked). `IAPService` (2,309 lines)
is heavily defended in the right direction (refuses to grant on unverifiable
receipts).

**UI.** 261 components; heaviest are the device-app screens (AdvancedBankApp 2,337
LOC, BitcoinMiningApp 2,218, PoliticalApp 1,892, ContactsApp 1,839, OnionApp 1,819)
— mostly presentation + wiring, with domain math correctly in `lib/` and mutations
through action modules.

**Testing.** 574 test files across three trees; jest capped at 2 workers in CI;
coverage and test-type ratchets in good shape *as ratchets* — the problem is what
some gates actually scan (C3, C4, H3).

### Data-flow traces (condensed; full hop-by-hop in §5)

1. **Week advance:** HUD → `nextWeek` → re-entrancy guard → pre-rolls →
   single updater (43 subsystems) → notification flush → post-tick validate →
   `saveGame(false)` → queue → AsyncStorage → selector mirror → HUD re-render.
2. **Money spend (verified atomic end-to-end for luxury + real estate):** UI →
   action module → snapshot pre-check (message only) → in-updater re-check against
   `prev` + `applyMoneyDelta` (NaN/overdraft reject) → single returned object →
   save → UI. §4.4 holds on every audited path except the welcome-back bonus (C1)
   and two relationship actions (M1).
3. **Load/boot:** user-driven from MainMenu/SaveSlots (no auto-load) → mutex →
   double-buffer → envelope → backup fallback → migrate → repair → merge →
   invariants → `setGameState` → providers hydrate.

---

## 2. CRITICAL

### C1. Welcome-back cash bonus is farmable by scrubbing the device clock forward
- **Why it's a problem.** The bonus (`0.5 × weekly salary × min(daysAway, 7)`, floor
  $100) is gated only on `Date.now() − prev.lastLogin`. The updater is atomic and
  correctly refuses a *rewound* clock, but nothing refuses a *forward* scrub — the
  exact asymmetry v28/v31/v35/v40 each closed for the sibling faucets on the same
  screen ("anything gated on a device-clock day-string is farmable; gate on game
  state", §4.4). There is no `weeksLived` component and no per-week cap: repo-wide
  grep for `lastWelcomeBack` returns nothing.
- **What could break.** Set the date +7 days → open app → close popup → 3.5 weeks of
  salary credited → repeat. Zero game weeks played, so it bypasses tax brackets, the
  net-worth soft cap, and the weekly tick entirely, and it compounds without limit.
  For a late-career player this out-earns the pre-v35 ad orb.
- **Recommended solution.** v44 carve-out `settings.lastWelcomeBackWeek` (default
  `undefined`, no backfill, no `repairGameState` mirror — the v35 reasoning:
  stamping the current week would deny the next legitimate bonus). Reject inside the
  same updater when `prev.settings?.lastWelcomeBackWeek === prev.weeksLived`; stamp
  it in the grant. Mirror the gate in the spawn effect at `home.tsx:397` so an
  unredeemable bonus is never offered (the `AdRewardOrb.tsx:108-116` spawner
  pattern).
- **Files.** `app/(tabs)/home.tsx:397-412, 873-889` · `utils/welcomeBackBonus.ts:18-28`
  · `utils/saveMigrations.ts` (new stub) · `contexts/game/types.ts`.
- **Fix before continuing? YES.** Live monetisation-bypassing exploit of the class
  this repo has already patched four times.

### C2. The production OTA workflow ships JS updates without `check:routes` — the guard for the bug that shipped the v2.5.0 launch crash
- **Why it's a problem.** `eas-update.yml` fires on push to main and ends with
  `eas update --channel=production`. Its gates are type-check, test-type ratchet,
  lint, and `npm test -- --ci` — **not** `npm run check:routes`. §5 records that a
  duplicate route "silently drops one **in production only**" and that this exact
  class shipped the v2.5.0 launch crash; the guard exists and runs in every *build*
  workflow, but the one pipeline that pushes JS straight to production users skips
  it. Also absent from all CI: `test:ci`/`coverage:ratchet` (the floors are
  advisory-only) and `audit:weekly`.
- **What could break.** A route collision merged to main reaches every production
  device via OTA with no build step in between — the same failure as v2.5.0, minus
  even the chance of catching it in TestFlight.
- **Recommended solution.** Add `npm run check:routes` to `eas-update.yml` before
  the update step (one line). Add `npm run test:ci` (or a nightly coverage job) and
  a scheduled `audit:weekly` job while in there.
- **Files.** `.github/workflows/eas-update.yml`.
- **Fix before continuing? YES.** One-line change; the exposure is production-wide.

### C3. The GameState-drift ratchet (audit-save V11) passes fields on word-matches in code comments — 8 concrete-default fields are unprotected and invisible
- **Why it's a problem.** `uncoveredConcreteFields` tests coverage with
  `mentionsField(migSrc, name)` — a bare `\b<name>\b` regex over the **unstripped**
  migration source, comments included (`audit-save.cjs:569`, `:486-495`; the repair
  body *is* noise-stripped, the migration source is not). Eight concrete-default
  top-level fields (`week`, `day`, `social`, `family`, `economy`, `goals`,
  `progress`, `prestige`) have no migration, no repair mirror, and are not in
  `LEGACY_PRE_MIGRATION_FIELDS` — each passes because its name happens to appear in
  a migration *comment* (e.g. `family` matches "…churn the whole family tree…",
  `economy` matches an import line). Verified: the check is green today with all
  eight uncovered.
- **What could break.** Two things. (a) The false-negative is generic: **any future
  field whose name appears anywhere in migration prose is silently exempt from Hard
  Rule #3's machine check** — the ratchet CLAUDE.md §7 describes as the thing that
  catches drift does not bite. (b) The eight fields themselves: not live bugs on the
  primary load path (the `initialGameState` spread fills them), but `prestige` and
  `family.children` are read bare in the week loop and prestige UI, and any
  non-spreading path (the cloud-apply path, M6) gets no healing.
- **Recommended solution.** `stripNoise(migSrc)` before matching, and require an
  actual `state.<name> =` assignment (the `concreteBackfillPaths` helper in the same
  file already does this correctly for the parity check — reuse it for V11). Then
  either write the eight missing `repairGameState` mirrors or grandfather them
  **once** into `LEGACY_PRE_MIGRATION_FIELDS` with the shrink-only note. Do not
  grandfather without first fixing the matcher, or the hole stays open for new
  fields.
- **Files.** `scripts/audit/audit-save.cjs:483-495, 569` ·
  `utils/saveValidation.ts:490, 521, 818` ·
  `contexts/game/initialState.ts:123, 1060, 1061, 1151, 1414, 1420, 1516, 1525`.
- **Fix before continuing? YES** for the matcher (it is the drift alarm); the eight
  mirrors can follow in the same or next change.

### C4. The Hard Rule #3 factory scan only walks `__tests__/` — 25 hand-built `as GameState` casts in `lib/**/__tests__` are invisible and the audit prints PASS
- **Why it's a problem.** `audit-save.cjs:200` scans `L.walk('__tests__', …)` while
  `jest.config.js` runs three trees (`lib/**/__tests__`, `__tests__/`, co-located
  `*.test.*`). 18 files under `lib/` alone (25 casts total, incl.
  `contexts/game/actions/weekly/__tests__`) build state by raw cast — e.g.
  `lib/careers/__tests__/jobMarket.test.ts:27-35` (`as unknown as GameState` with
  five fields) and `lib/luxury/__tests__/luxury.test.ts:38-43`, which drives the
  **real** `purchaseLuxuryItem` money path with `banking`/`luxuryHoldings`/
  `weeksLived` all `undefined`. The audit reports `[PASS] No manual as GameState
  construction in tests`.
- **What could break.** The factory exists so a GameState schema change breaks test
  compilation; these suites are immune, so a field rename ships with green tests
  that assert against a state shape that no longer exists — while the machine check
  says the rule holds. A green light that lies is worse than no light.
- **Recommended solution.** Widen the walk to mirror `testMatch` (add `lib`,
  `contexts`, `utils`, `components`, `services`, `src`), widen `FACTORY_ALLOWLIST`
  handling the same way, then burn the 25 down using the existing
  `isDeliberateCast` escape hatch where a partial state is genuinely intended.
- **Files.** `scripts/audit/audit-save.cjs:200` · 18 test files under
  `lib/**/__tests__` and `contexts/game/actions/weekly/__tests__`.
- **Fix before continuing? YES** for the scan-scope fix; the burn-down can be
  incremental.

---

## 3. HIGH

### H1. `reconcileDiscoveredSystems` reads six fields that do not exist on GameState — the discovery meter can never reach 100%
- **Why.** `lib/depth/discoverySystem.ts:506-535` casts to
  `as unknown as Record<string, any>` (which sails through the syntactic `as any`
  ban) and reads `s.bankAccounts`, `s.visitedCountries`, `s.rdProjects`,
  `s.research`, `s.darkWebPurchases` — none exist in `contexts/game/types.ts`
  (verified by grep) — plus `has(s.pursuits)`, which is always false because
  `pursuits` is a Record, not an array. Real shapes: `banking.accounts`,
  `rdLab`/`researchProjects`, `darkWebItems`. This is the exact fabricated-property
  class §5 documents as the repo's top bug source (`career.name`,
  `stockInfo.currentPrice`).
- **What breaks.** Runs every week from the tick and feeds the `X/20` meter in
  `components/depth/DiscoveryIndicator.tsx`. `rd` can never be marked at all; `bank`
  only fires on the v14-deprecated `bankSavings` pool; `travel` only during an
  active trip; `hobbies` only on the deprecated array. A completionist sees a meter
  that cannot complete, permanently.
- **Fix.** Delete the escape hatch and read typed paths
  (`Object.keys(gameState.pursuits ?? {}).length > 0`, `has(gameState.banking?.accounts)`,
  `gameState.travel` fields — verify names, `!!gameState.rdLab || has(gameState.researchProjects)`,
  `has(gameState.darkWebItems)`). Then close the lint bypass: extend
  `no-restricted-syntax` to flag `TSAnyKeyword` anywhere inside a `TSAsExpression`
  subtree.
- **Files.** `lib/depth/discoverySystem.ts:506-535` ·
  `contexts/game/GameActionsContext.tsx:1939` ·
  `components/depth/DiscoveryIndicator.tsx:57` · `eslint.config.js`.
- **Fix before continuing? Yes** — live, self-contained, and the lint-bypass closure
  prevents the next one.

### H2. `npm run preflight` (Hard Rule #6's mandatory release gate) validates the developer's shell env, not the build's
- **Why.** `preflight-check.js:719-729` reads `process.env` directly and never
  parses `eas.json`; `npm run preflight` always passes `--platform ios`, so
  `isProductionBuild` is always true while `EXPO_PUBLIC_IAP_VERIFY_URL`, RevenueCat
  keys, and AdMob unit ids are unset locally (only `.env.example` exists). Sections
  9/9b/10 therefore fail on a clean checkout regardless of the real production
  config.
- **What breaks.** Either the mandatory gate fails on every clean checkout and gets
  skimmed/worked around — the corrosive "gate that cannot pass" pattern §8
  documents for the old coverage threshold — or developers hand-export the vars,
  creating an unversioned second source of truth that can silently disagree with
  `eas.json`.
- **Fix.** Read `eas.json`'s `build.<profile>.env` as the baseline, overlay
  `process.env`, take `--profile` as input; report EAS-store-only secrets as "not
  verifiable locally" instead of failing.
- **Files.** `scripts/preflight-check.js:719-729` (and §9b/§10 siblings) ·
  `package.json:28`.
- **Fix before continuing? Yes** — this determines whether the release gate means
  anything.

### H3. `npm run test:integration` — the documented save/load gate — tests a JSON round-trip it defines itself
- **Why.** `lib/progress/__tests__/saveLoad.test.ts:34-55` defines its **own**
  `saveGame`/`loadGame` (`JSON.stringify` into a local mock object) and imports
  nothing from `saveValidation`, `saveMigrations`, `saveQueue`, `saveBackup`,
  `loadedStateMerge`, or `GameActionsContext`. Its 17 tests, including "should
  maintain data integrity through save/load cycle", assert that
  `JSON.parse(JSON.stringify(x)) === x`.
- **What breaks.** A regression in envelope signing, CRC, migration ordering,
  repair, or the merge passes the *named* integration gate untouched. (`__tests__/save/`
  does contain 28 real suites — the defect is that the command CLAUDE.md points at
  is the hollow one.)
- **Fix.** Repoint `test:integration` at `__tests__/save/ __tests__/integration/`;
  delete the file or rewrite it against the real pipeline.
- **Files.** `package.json` · `lib/progress/__tests__/saveLoad.test.ts`.
- **Fix before continuing? Yes** — one script-line change restores a load-bearing
  gate.

### H4. `npm run type-check` (preflight §1 and the EAS build gate) excludes `src/` entirely
- **Why.** `tsconfig.typecheck.json` includes app/components/contexts/hooks/lib/
  services/utils but not `src/**` — while `tsconfig.tests.json` *does* include it,
  so the omission is an oversight, not policy. `src/` is shipped app code on the
  boot path: `app/_layout.tsx` imports `@/src/debug/aiDebugConfig`,
  `AppProviders` imports `@/src/features/onboarding/OnboardingContext`, and
  `src/features/onboarding/slotSafety.ts`/`gameInitializer.ts` are the modules the
  save-loss fix (2026-07-29) lives in.
- **What breaks.** Type errors in onboarding/slot-safety/debug code reach
  `preflight:quick` and release builds unchecked; they surface only through
  `type-check:tests`, read as test-tree problems, and a release cut from a branch
  never sees them.
- **Fix.** Add `"src/**/*.ts", "src/**/*.tsx"` to the include list; fix fallout in
  the same change.
- **Files.** `tsconfig.typecheck.json:8-26`.
- **Fix before continuing? Yes** — one-line config change.

### H5. Boot-error surfacing is dead code: the early-init error screen and the Metro-connection screen can never fire
- **Why.** `_layout.tsx:592` snapshots `getEarlyInitError()` into a module `const`
  on the same synchronous pass that installs the handlers, so every error the
  global handler later captures writes to a variable nothing reads again; the
  fatal-screen branch at `:914-922` reads the frozen `null`. Same shape for
  `metroConnectionHealthy` (`:174/:217/:775`): set in a `setTimeout`, read only in a
  `useState` initializer that has already run.
- **What breaks.** A JS error during boot produces a blank app instead of the
  diagnostic screen this file exists to provide — the team believes it has boot
  telemetry it does not have, which is what made v2.5.0 hard to diagnose. ~60 lines
  of unreachable Metro-screen code maintained for nothing.
- **Fix.** Make the fatal screen read live state (subscriber list or
  `global.__errorQueue`, which *is* re-read); delete the Metro-connection apparatus.
- **Files.** `app/_layout.tsx:91, 174, 217-219, 581-592, 775, 914-922`.
- **Fix before continuing? No**, but stop counting on boot-error telemetry until
  fixed.

### H6. Five `lib/ → contexts|services` value imports invert the layering the lint rationale claims to protect
- **Why.** `lib/mail/resolve.ts:18` imports a constant from
  `contexts/game/actions/JobActions` (which statically pulls 8+ lib modules);
  `lib/crypto/estimateWeeklyMining.ts:19` imports from `MiningActions`;
  `lib/retirement/elderActivities.ts:16` imports `applyMoneyDelta` from
  `MoneyActions`; `lib/prestige/prestigeExecution.ts:6` imports `initialGameState`;
  `lib/subscription/deepLifePlus.ts:20` imports the IAP service singleton. The
  eslint comment justifies keeping `lib/simulation` unenforced precisely to avoid
  "baking a lib → contexts inversion into the graph" — but the inversion is already
  static, in error-enforced directories, where the require-based rule cannot see it.
  (Measured: zero true cycles today; `lib/mail` is one import away from one, inside
  the tick path.)
- **What breaks.** A future cycle here surfaces as `undefined` at module init inside
  the week loop — a lost week, not a build error. `deepLifePlus` is untestable
  without mocking the IAP layer.
- **Fix.** Move each symbol down into `lib/` (`RAISE_MIN_PERFORMANCE` →
  `lib/careers/`, `calculateMiningEarnings` → `lib/crypto/`, `applyMoneyDelta` is
  already pure → `lib/economy/`) and have `contexts/` re-export. Then add an
  import-boundary lint rule banning `lib/** → contexts|components|app|services|hooks`
  value imports so the boundary is enforced, not asserted.
- **Files.** the five imports above · `eslint.config.js:108-113`.
- **Fix before continuing? No** — but before the next feature lands in `lib/mail`
  or `lib/crypto`.

### H7. Weekly-event randomness: `payoffRoll` uses `Math.sin` (a documented engine-divergence hole) and 25 event payloads still roll `Math.random()` inside the tick
- **Why.** `lib/events/engine.ts:2506-2509` seeds payoff events with
  `Math.sin(weeksLived*1013+salt)` — and the *same file* at `:3660-3663` documents
  why `Math.sin` was banned from the selection roll (Hermes vs V8 divergence on
  which event fires = save-integrity hole). Meanwhile event `generate()` payloads
  (`:1570-1571`, `:1589`, `:2401-2403`, +22 more) decide money signs, amounts, and
  victim selection with raw `Math.random()` at generation time inside the tick —
  the shape `pulseTick` and `npcDepth` were both already fixed for
  ("save-scummable + StrictMode-inconsistent"). Five parallel RNG mechanisms exist
  overall (seededRoll mulberry32, deterministicRng FNV-1a + commit log, four
  hand-copied FNV-1a's, a second mulberry32, Math.sin).
- **What breaks.** Cross-engine divergence on which payoff event fires for a given
  week; StrictMode/double-invoke inconsistency in event payloads; save-scum on
  event outcomes.
- **Fix.** (1) One-liner now: `payoffRoll` →
  `makeWeeklyRoll(state.weeksLived)('payoff-'+id)`. (2) Thread the week's seeded
  roll into `EventTemplate.generate(state, roll)`. (3) Consolidate to
  `utils/seededRoll.ts` as the one primitive; adopt-or-delete `deterministicRng`'s
  commit log.
- **Files.** `lib/events/engine.ts` · `lib/randomness/deterministicRng.ts` ·
  `utils/seededRoll.ts` · FNV copies in `lib/social/pulseTick.ts:125`,
  `lib/economy/stockMarket.ts:146,160`, `lib/careers/jobMarket.ts:204`,
  `lib/parenting/grandchildren.ts:71`, `contexts/game/actions/TravelActions.ts:22`.
- **Fix before continuing? The payoffRoll one-liner: yes. The rest: no.**

### H8. `forceSave` skips the protected-state embed and update that `performSave` does — and `forceSave` is the app-kill/IAP/death path
- **Why.** `saveQueue.ts:271-285` (`performSave`) embeds `_embeddedProtectedState`
  and advances the marks after a successful write; `forceSave` (`:489`) does
  neither. `forceSave` is what runs on background/app-kill
  (`GameActionsContext.tsx:4200`), IAP grants, redeem codes, the death popup, and
  onboarding.
- **What breaks.** The most recent blob on disk frequently has no embedded
  protected state, so the anti-exploit restore in `loadGame` (which fires when
  AsyncStorage protected state is missing *and* the embed exists) has nothing to
  restore from; death/jail/wanted high-water marks stop advancing on those writes.
  Anti-cheat degradation, not data loss.
- **Fix.** Lift embed + `updateProtectedState` into one helper called by both paths
  (the quota-cleanup retry branch at `:406-415` needs the same treatment).
- **Files.** `utils/saveQueue.ts:271-285, 367-368, 406-415, 489`.
- **Fix before continuing? No.**

### H9. ~5.8 s of hard-coded `setTimeout` theatre on every cold start
- **Why.** `app/index.tsx:120-166`: a scripted 6-step × 800 ms progress interval
  + 500 ms + 100 ms navigate delay + 100 ms router timer, stacked on
  `usePreload.ts:55-75`'s 450 ms of bare sleeps standing in for work the comments
  say was moved elsewhere. Nothing measures actual readiness; the bar hits 100%
  whether or not providers mounted. (Both the boot agent and the UI agent found
  this independently.)
- **What breaks.** Nothing crashes — it is a ~5.5–5.8 s tax on every cold start,
  the single largest first-session drop-off lever, and it drowns any *real* boot
  regression in noise.
- **Fix.** Drive progress from real signals (fonts, provider mount, storage
  hydration, `routerReady`); if a minimum splash is wanted, one explicit ~600 ms
  constant. Also fix the unbounded 10 Hz health-check poll in the same file
  (`:82-106` — self-scheduled recursion never cleared, writes to state nothing
  reads).
- **Files.** `app/index.tsx:82-166` · `hooks/usePreload.ts:55-75`.
- **Fix before continuing? No** — but it is the highest-leverage single UX change
  found.

---

## 4. MEDIUM

### M1. §4.4 gate→grant: `breakUpWithPartner` / `moveInTogether` apply stats in a second, unguarded dispatch
`GameActionsContext.tsx:4900-4908, 5014-5026` — state updater is idempotent but the
follow-up `updateStats({happiness: ±N})` is a separate unconditional dispatch; a
same-batch double-tap moves happiness twice (outer gate reads the lagging
`gameStateRef`). Contrast `proposeToPartner:4947-4960`, which folds charge+stat into
one updater. **Fix:** fold via `applyStatsDelta` and re-check against `prev`.
Fix-first: no.

### M2. `nextWeek`'s tick-failure guard is read synchronously after dispatch and can never fire
`GameActionsContext.tsx:492, 3314, 3326` — `stateUpdateError` is set inside the
updater and read immediately after `setGameState` with no await between; when an
unguarded subsystem throws, the updater returns `prevState`, `postTickState` stays
null, and the *pre-tick* state is validated and saved — the player taps Next Week,
nothing happens, and the error path that exists for exactly this never runs.
**Fix:** move the check below the existing `await setTimeout(0)` or use a ref.
Fix-first: no (guard coverage makes the trigger rare), but it is a two-line move.

### M3. The relationship pass is all-or-nothing and a bad entry freezes it permanently
`GameActionsContext.tsx:1362-1470` — the try/catch wraps the whole `.map()` over
relationships; one malformed entry carries *all* relationships over untouched, and
since nothing repairs the entry it throws again every week: no pregnancies, no
weddings, no child aging, silently, for the rest of the life. **Fix:** move the
try/catch inside the map callback (return `rel` unchanged, log the id), keep the
outer catch as backstop. Fix-first: no.

### M4. Six components/providers hold whole-state subscriptions the selector layer was built to remove
`IAPHandler.tsx:14` (setter-only — the exact documented regression),
`AchievementToast.tsx:42`, `UIUXOverlay.tsx:18` (all root-mounted), plus all five
action providers + GameActionsContext mirroring state into a ref via post-commit
effect (`MoneyActionsContext.tsx:82-89` et al.) — which also *creates* the
one-commit staleness that the gate→grant class exploits. **Fix:** `useSetGameState`
/ `useGameSelector` / `useGameStateGetter` respectively. Fix-first: no.

### M5. `useAchievements` recomputes 159 achievement specs on every state mutation, on the home screen
`hooks/useAchievements.ts:19-102` — whole-state subscription + memo keyed on the
entire `gameState` + two sorts whose comparators call `findIndex` over the
159-element catalog (~290k array scans per invalidation), running on every tick
write; `achievementProgress` is also un-try/caught here while its sibling wraps the
identical call. **Fix:** narrow selectors, hoist an id→index Map, wrap the call.
Fix-first: no.

### M6. Cloud sync is a half-wired second load path
`GameActionsContext.tsx:4278-4299` — "Keep Cloud Version" applies remote state with
no `initialGameState` merge, no `mergeLoadedSlice`, no family reconciliation, no
`weeksLived` regression guard, and depends entirely on `repairGameState` (i.e. on
C3's missing mirrors). Meanwhile `queueSync`/`downloadState`/`checkConflict`/
`resolveConflict` in `services/CloudSyncService.ts` have **zero callers**, and the
service starts a network listener + `setInterval` in its constructor at first
import (`:36-39, 63-71, 470`). **Fix:** route cloud-apply through the extracted
`loadGame` merge, or delete the unreachable surface; make the singleton lazy with an
explicit `start()`. Fix-first: no — but do not enable cloud sync without this.

### M7. 35 divergent local `formatMoney` implementations despite a canonical helper
`utils/moneyFormatting.ts` vs 35 local copies (`PrestigeModal.tsx:144` has no
finite guard — renders `$NaN` — and puts the sign inside the `$`; `LoanRow.tsx:15`
never abbreviates; `BitcoinMiningApp.tsx:145` has no B/T/Q tiers). Same value reads
differently on adjacent surfaces. **Fix:** delete the copies, import the canonical;
add a `formatMoneyCompact` variant where genuinely needed. Fix-first: no.

### M8. Gem-upgrade catalog duplicated between UI and reducer; purchase reports success even when refused
`GemShopModal.tsx:712-789` vs `MoneyActionsContext.tsx:252-262` — nine prices
hand-synced by a comment, no parity test; and `handleBuyUpgrade`
(`GemShopModal.tsx:314-338`) alerts "Purchase Successful" unconditionally because
`buyGoldUpgrade` returns void and both gates read the render snapshot (atomic
reducer means no gem loss — it is a paid-currency *reporting* bug and a support
ticket). **Fix:** move the catalog to `lib/config/`, adopt the
`SkillTreeModal.commitUnlock` boolean-result pattern, add `iapBusy` to the card's
lock. Fix-first: no.

### M9. Four net-worth implementations; the canonical one memoizes into module-level mutable state with an `any`-typed cache key
`lib/progress/achievements.ts:23-44, 288-294` (identity-keyed module cache shared
across slots/lives/simulators; key omits `overdueBalance` — which netWorth also
never subtracts — and legacy `stocksOwned`; `as never` cast in the card-debt path)
· private copies in `lib/legacy/ribbonSystem.ts:25`,
`lib/challenges/weeklyChallenges.ts:41` · a fifth valuation engine in
`utils/netWorth.ts`. NetWorth gates prestige, achievements, ambitions, bail, and
ad-reward scaling. **Fix:** delete the private copies, type the cache key with real
slices, decide the `overdueBalance` liability question, drop the `as never`.
Fix-first: no.

### M10. Age is stored *and* derived, and lib/ reads it both ways
`date.age` advances by `+1/52` per tick (`GameActionsContext.tsx:568`) while
`weeksLived` is the absolute counter; `pension.ts`, `secretEvents.ts`,
`nearMissEvents.ts`, `ribbonSystem.ts` each keep a private `getAge` off `date.age`
while `storyGenerator.ts` derives from `weeksLived`. One corrupt `date.age` resets
the player to 18 for the death roll and every event condition while the story
engine still reports the true age; float accumulation adds permanent skew. This is
§4.2's `week` hazard in a second variable. **Fix:** make `date.age` display-only,
one shared `getAge(state)` derived from `weeksLived`+`lifeStartWeek`, document next
to the week rule. Fix-first: no.

### M11. `useSyncExternalStore` mirror is written during the render phase
`GameStateContext.tsx:50-57` — the render body assigns `mirrorRef.current.state =
gameState`, so a discarded/StrictMode render can publish state that never commits
and selector consumers can disagree with `useGameState` consumers (the opposite of
the comment's claim). The `useLayoutEffect` at `:70-80` is already the correct sync
point. Latent under today's synchronous RN rendering. **Fix:** delete the render-body
write. Fix-first: no.

### M12. No test loads a save carrying any of the 14 carve-out fields and asserts survival
§7 ends with "After adding a field, load a save that has it and assert it is still
there" — grep across all save/integration tests finds zero files referencing
`lifeStartWeek`, `tuitionWaiverUSD`, `legacyContracts`, `grandchildren`,
`revivalPack`, `lastAdCashGrantWeek`, `lastLoginRewardWeek`. The erasure class this
instruction exists for (v39 avatar, v28 no-fill) has already shipped twice.
**Fix:** one table-driven `carveOutRoundTrip.test.ts` covering all fourteen.
Fix-first: no.

### M13. Test-scaffold casts hide the stale-PreRolls class the `zeroPreRolls` helper was built to kill
`__tests__/helpers/zeroPreRolls.ts` documents the failure precisely; only 4 files
import it while ~15 still hand-cast (`{} as never`/`as unknown as WeekContext` in
`applyEducationProgression.*.test.ts:18/23`, `applyCareerSalaryAndPenalty.*`,
`applyPets.test.ts:63`, `chargeOrDefer.test.ts:25`, etc.) — invisible to the
baseline-0 type ratchet *because* they are casts. **Fix:** audit rule banning
`as WeekContext` outside the helper; migrate the 15. Fix-first: no.

### M14. audit-logic G5's gate→grant detector exempts by proximity, not by routing
`audit-logic.cjs:87-90` — any mention of `applyMoneyDelta` within 20 lines exempts
a hand-written charge; `RealEstateActions.ts:460/522/554/586` carry
`?? { stats: {...money: cash - cost} }` fallbacks that re-implement the charge
outside the canonical guard on the same line that exempts them (currently
unreachable; each resolver refuses ~10 lines up). The check also only matches
`money|gems`, not reputation/claim flags §4.4 names. **Fix:** require the helper to
produce the assigned value; delete the `??` fallbacks. Fix-first: no.

### M15. EAS `preview` profile silently ships with IAP + ATT active and unconfigured
`featureFlags.ts:16-18` — `BORING_BUILD_MODE` defaults on only via `__DEV__`; a
preview build is a release binary with only `EXPO_PUBLIC_ENABLE_DEVTOOLS` set
(`eas.json:25-33`), so `iap`/`att`/`notifications` (all default-on `!== 'false'`
form, contradicting §4.6's opt-in rule for native SDKs) activate with no verify URL
or RC keys — ATT denial is remembered per-install by iOS. Also: the
`notifications` flag has zero readers and its package was removed. **Fix:** set
`EXPO_PUBLIC_BORING_BUILD=true` in the preview profile, flip `iap`/`att` to
`=== 'true'`, delete the dead flag. Fix-first: no.

### M16. `(tabs)/_layout.tsx` subscribes the tab navigator to full game state and dereferences `gameState` non-optionally once
`app/(tabs)/_layout.tsx:114, 359` — `useGame()` above the `<Tabs>` navigator
re-renders it on every mutation (the sibling onboarding layout deliberately uses a
selector and documents why); line 359 `gameState.showDeathPopup` is the one
non-optional dereference in a file with 12 `gameState?.` guards. **Fix:** narrow
selectors for the ~8 fields read; make 359 consistent. Fix-first: no.

### M17. `app/preview.tsx` nests a second `GameProvider` inside the root one and ships as a production route
Two independent GameState trees on web (saves written from one invisible to the
other); on native it is a live blank route (`deeplife://preview`). Also forces
special-casing in `_layout.tsx:781`. **Fix:** move out of `app/` or `__DEV__`-fold;
drop the nested providers regardless. Fix-first: no.

### M18. `EventChoice.special` is an untyped string dispatched by `===` chains
`lib/events/engine.ts:67` + `GameActionsContext.tsx:3651-3731` — a typo in a new
template's `special` compiles and silently does nothing; the repo already had one
event inert for its whole life (v41's `scholarship_opportunity`). **Fix:** a
string-literal union + `switch` with `assertNever`. Fix-first: no.

### M19. Shared constants and market plumbing duplicated in lib/
`WEEKS_PER_YEAR` redefined in `lib/mail/templates.ts:45`, `lib/pets/lifecycle.ts:11`,
`lib/pets/decay.ts:14`; `MS_PER_WEEK` in `lib/legacyPass/legacyPass.ts:19`; bare
`* 52` in hustle/stock/mail arithmetic. Plus near-identical order books in
`lib/stocks/orderBook.ts` and `lib/crypto/orderBook.ts`, and three unsynchronized
stock-universe registries (`DEFAULT_PRICES`, `volatilityMap`, `STOCK_SECTORS` — all
25 symbols match today; a 26th added to one gets default volatility and no sector,
silently). **Fix:** import the constants; extract a parameterized order book; derive
`type StockSymbol = keyof typeof DEFAULT_PRICES` and type the other two registries
with it. Fix-first: no.

### M20. audit-save V8/V11 only walk *top-level* fields; nested concrete defaults are invisible
Anything under `settings`, `banking`, `family` is outside both the parity check and
the inverse check — relevant because most recent carve-outs are `settings.*` keys.
**Fix:** extend the walker one level into the known merged sub-objects. Fix-first:
no.

---

## 5. LOW

- **L1.** `useGameSelector` mirror agents both noted: `weekCounters.ts`'s three
  headline helpers (`resolveAbsoluteWeek`, `normalizeStoredWeekToAbsolute`,
  `getWeeksSinceStoredWeek`) have zero production callers while §4.2 names them as
  *the* week helpers — wire them into migrations/repair or delete and amend §4.2 to
  name `weeksInThisLife`/`resolveCalendar`.
- **L2.** Lint-selector bypasses: the internal-require rule misses relative paths
  and `@/services|hooks|components|src` (`eslint.config.js:66-69`); live examples
  `app/_layout.tsx:499,517` (`require('../utils/…')` → `any` → a rename silently
  disables crash recovery at boot), `lib/rd/breakthroughs.ts:65`,
  `components/DailyRewardPopup.tsx:26-28`. Broaden the regex; convert the sites.
- **L3.** `lib/gameLogic/` is a phantom domain — two test files, no source, tests
  re-implement what they assert. Delete or repoint.
- **L4.** A 1-byte silenced suite (`lib/skillTrees/__tests__/careerSkillTrees.test.ts`)
  kept dead by a bespoke jest ignore pattern (`jest.config.js:76`). Delete both.
- **L5.** `saveGame`'s repair branch mutates `prev` in place inside an updater
  (`GameActionsContext.tsx:294-305`; `repairGameState` writes back onto its
  argument) — works by side effect; return the repaired object explicitly.
- **L6.** Load path deep-clones the whole state twice (`repairGameState` then
  `validateGameState(_, true)` → repair again) — pass `autoFix: false` on the
  second call (`GameActionsContext.tsx:4525-4533`).
- **L7.** Startup queue replay (`saveQueue.restoreOnStartup`) drains with no mutex
  holder, breaking the invariant the queue's own comment relies on; damage bounded
  by double-buffering and replay guards. Acquire the save mutex around the kick.
- **L8.** `purgeSlotIfPhantom` is the one destructive storage op outside the
  save/load mutex (TOCTOU; practically unreachable today).
- **L9.** Save HMAC is CESU-8, not UTF-8, for astral chars (emoji in names/posts) —
  self-consistent so no data loss, but a standards-compliant server verifier would
  disagree; comment it at minimum.
- **L10.** Quota-cleanup retry returns success while skipping `updateProtectedState`
  and the re-prune (`saveQueue.ts:406-415`) — same class as H8, narrower trigger.
- **L11.** `BUILD_TAG` (`lib/config/buildTag.ts`, `'NAV-FIX-1'`) is a third,
  hand-maintained, never-bumped build identity read by the crash screen — derive it
  from version+BUILD_NUMBER or gate it in preflight.
- **L12.** `scripts/fix-podspec.js` postinstall: dead icon-copy block (both paths
  tracked in git — and 3 tracked copies of the same 1.6 MB icon), and `exit(1)` on
  best-effort patch failures can fail `npm install`.
- **L13.** `app.config.js:4,121` — non-numeric `BUILD_NUMBER` yields
  `versionCode: NaN`, rejected 20 minutes into Gradle; validate at config eval.
- **L14.** Dead Node<20 `toReversed` prototype patch in `metro.config.js:1-9`;
  `app/entry.ts`'s default export is never read (keep the file, drop the export).
- **L15.** `lib/economy/stockMarket.ts:141` module-global market board — currently
  handled correctly (documented past bug), but it is the one place game state lives
  outside `GameState`; warn at the accessors or migrate onto state.
- **L16.** audit-perf P2's 0.6 guarded-ratio check at severity `low` duplicates,
  weakly, what `__tests__/stress/weeklyTickGuards.test.ts` already proves
  rigorously — delete P2 and point the audit at the test.
- **L17.** `applyAmbitionPayout` has no direct test for its `wasDue` gate (its
  reducer is well covered); double-tap success toasts in `LuxuryActions`/
  `RealEstateActions` report from the snapshot resolve while the `prev` resolve
  correctly refuses (money right, toast wrong).
- **L18.** Doc drift: CLAUDE.md §4.5 names `saveCompression.ts` which does not
  exist; §9 says preflight has 10 sections (it has 11 + subsections) and §2 omits
  `lint:ratchet`/`check:content` from the preflight description;
  `tsconfig.tests.json`'s header points at the wrong ratchet script. Update all in
  one docs pass.

---

## 6. Verified sound (checked, no finding — recorded so the next audit doesn't re-tread)

- **Hard Rule #1** holds: `entry.ts` is 17 lines, no forbidden imports.
- **Hard Rule #4** holds: all 7 config plugins have their packages;
  `expo-store-review`'s absence documented in place.
- **Hard Rule #5** holds at all four production DatingActions call sites.
- **Hard Rule #7** holds: all 175 one-sided-border hits are permitted structural
  exceptions.
- **§4.4 in action modules**: all 37 outer affordability sites pair with in-updater
  re-checks; `applyMoneyDelta`/`updateMoney`/`batchUpdateMoney` reject rather than
  clamp. Luxury and real-estate purchase flows verified atomic hop-by-hop.
- **§4.6**: every native SDK lazy-required in try/catch behind a latch; no static
  native imports repo-wide.
- **Tick guards**: `weeklyTickGuards.test.ts` mechanically proves no subsystem runs
  bare; StrictMode determinism of pre-rolls/weekCtx verified; notification flush
  deduped.
- **Save pipeline**: migration↔repair parity for every concrete-default backfill
  v22–v33; every `repairs.push` sets `repaired = true`; all 14 carve-outs since v26
  are registered stubs with reasoning; all 18 carve-out fields survive the load
  round-trip via `mergeLoadedSlice`/spread (though untested — M12); mutex ownership
  token-checked; future-version saves refuse with a typed error; no derived-value
  duplication in the persisted shape.
- **No import cycles** touching `lib/`; the 2026-08-14 cycle-breaker audit's
  conclusions hold; `lib/` free of `as any` in code; `grandchildren` and
  `mail/generate` determinism claims true as written.
- **React.lazy discipline** holds (modal leaves only; computer/mobile stay eager);
  route table conflict-free; privacy manifest and purpose string correctly
  configured; timers cleaned up at all 9 `setInterval` sites; only one skipped test
  in 574 files.

---

## 7. Recommended fix order

1. **C1** welcome-back `weeksLived` gate (+ v44 stub migration) — closes a live exploit.
2. **C2** `check:routes` into `eas-update.yml` — one line, production-wide exposure.
3. **C3 + C4** fix the audit-save matcher and scan scope — the drift alarm and the
   factory alarm currently lie; everything else leans on them.
4. **H3 + H4** repoint `test:integration`; add `src/` to typecheck — two one-liners
   that restore load-bearing gates.
5. **H1** discoverySystem typed reads + close the `as unknown as Record<string,any>`
   lint bypass.
6. **H7(a)** the `payoffRoll` one-liner.
7. **H2** preflight reads `eas.json` — before the next release.
8. **H5, H8, H6, H9** as the next debt block; then the MEDIUMs, with M1/M2/M3
   (tick/action correctness) and M12 (carve-out round-trip test) first among them.

Items 1–6 are small, independent, and each closes either a live defect or a lying
gate. Nothing in this report requires a redesign; the architecture is fundamentally
sound — the work is repairing the instruments.
