# Task Tracker

<!-- Used by Claude Code sessions. Add checkable items for multi-step tasks. -->

## Full-App Audit & Remediation — May 22, 2026

> **Baseline correction:** the first audit pass ran against a repo with no
> `node_modules` installed, so its headline numbers (18,985 / "1,198" type
> errors, test counts, several "broken component" claims) were invalid noise.
> After installing dependencies the real baseline is **1,316 type errors**
> (~696 are harmless `TS6133` unused-variable warnings; ~620 are substantive).
> All figures below are from the corrected environment.

### Phase 1 — Runtime-breaking bugs & build integrity  ✅ DONE (this session)
- [x] Untrack committed `google-play-service-account.json` (real private key).
- [x] Fix `CompanyActions.buyCompanyUpgrade` bare `Dispatch`/`SetStateAction`.
- [x] Replace nonexistent lucide icons `Ring`/`Rings` (→ `Gem`) in
      `FamilyTab.tsx` / `WeddingPopup.tsx` — they resolved to `undefined`
      and crashed on render.
- [x] Repair `GamingStreamingApp.tsx`: incomplete hook extraction left an
      unimported `useStreamingLogic` + removed `setIsStreaming` → guaranteed
      `ReferenceError` whenever the streaming app opened.
- [x] Remove `DeathPopup.tsx` unreachable heir-selection branch (dead `true ?`)
      referencing undefined `setShowHeirSelection`/`confirmHeirSelection`.
- [x] Guard `PrestigeModal.tsx` null `pointsBreakdown` (13 crash-risk accesses).
- [x] Sync `android/app/build.gradle` versionCode 84→98, versionName 2.3.0→2.3.5
      to match `app.config.js` (documented single source of truth).
- Result: 1,316 → 1,261 type errors; all `TS2304`/`TS2305` runtime crashers cleared.

#### Phase 1 — owner action items (cannot be done from this branch)
- [ ] **Rotate the leaked Google Play service-account key in Google Cloud IAM** —
      it is already exposed; untracking the file does not un-expose it.
- [ ] **Purge the key from `main` history** — requires rewriting `main` and a
      force-push, which this branch is not authorized to do:
      `git filter-repo --path google-play-service-account.json --invert-paths`
      then `git push --force origin main`.

### Phase 2 — Correctness (IN PROGRESS — 1,316 → 740 type errors, 44% cleared)

> **Dead code removed:** 10 items — 9 unreferenced components
> (~6,000 lines) plus `MoneyActionsContext.buyPerk`, which had zero
> callers and would have corrupted gems to `NaN` if ever invoked
> (it subtracts a non-existent `perk.cost` field from gems).
>
> **Recurring root cause fixed in 5 places:** untyped lazy `require()` of an
> already-typed module degrades everything downstream to `any`/`never`
> (getAllStocks, processAutomationRules, simulateChildToAge, + the
> hook-vs-module updateMoney/updateStats signature trap in Item/Job actions,
> which was silently passing setGameState as a dollar amount). Worth a lint
> rule banning `require()` of internal modules.
>
> **Two shipped IAP/finance bugs fixed:**
> - The \$1.99 Mindset perk in ShopModal was advertised but never wired
>   into IAP_PRODUCTS/PRODUCT_CONFIGS — purchase ID resolved to
>   `undefined` so the button silently failed. Now plumbed end-to-end
>   (the "50% faster promotions" game effect itself still needs to be
>   implemented in the promotion code path).
> - BankApp defined its own local `Loan` type missing `autoPay`/`type`/
>   `weeksRemaining`, so every loan opened via the bank UI was missing
>   the `autoPay` flag and `lib/automation/autoPay.ts:169`
>   (`if (loan.autoPay)`) skipped it forever. Replaced with the
>   canonical type and a `autoPay: true` default.

- [x] Net-worth / FIRE / retirement / legacy: fixed wrong field names that
      silently read `undefined` (`loan.remaining`, `realEstate.currentValue`,
      company annual-income valuation, career-derived salary).
- [x] Core game loop: typed the weekly-loop lazy `require()`s, removed an
      unsafe cast, fixed `logger.warn` LogContext calls, `doubleBufferLoad`
      storage arg.
- [x] `VehicleInsurance.type`/`monthlyCost` made required (always present).
- [x] Finance & Stats UI: fixed `realEstates`/`salary`/`achievement.unlocked`/
      `achievement.secret`/`pastLives` — all were reading undefined.
- [x] GamingApp: timer typing, duplicate 66-line fallback literal, and three
      modals pointing at the wrong StyleSheet (34 → 4 substantive errors).
- [x] `Video` type reconciled with the shapes the code builds/reads;
      `StreamSession`/`StreamHistoryItem` and the gaming timer types
      sorted out. GamingApp and GamingStreamingApp now have zero
      substantive type errors.
- [x] `prestigeExecution`: typed child simulation so the `selectedChild`
      null-guard narrowing holds (was 17 spurious errors).
- [x] Cleared gaming, prestige, finance/stats, automation, money/item,
      hobby/job action clusters; deleted dead components.
- [x] Wired Mindset and SKILL_BOOST IAPs end-to-end (the latter now
      actually bumps every hobby's skillLevel through the canonical
      clamp helper).
- [x] Fixed silent BankApp auto-pay bug, streaming income decay,
      Education extras drift, and 11+ closure-narrowing issues in
      BugHunterSimulator via the boxed-ref pattern.
- [x] Cleared all 33 substantive errors in BugHunterSimulator, all 12
      in RealActionSimulator, all 8 in ComprehensiveGameSimulator.
- [x] Replaced GameState.automation's inline shape with the canonical
      AutomationState; replaced BankApp's local Loan with the
      canonical one.
- [x] Caught a half-dozen "broken-on-render" UI bugs while clearing
      small clusters: TinderApp.handleLike had its own useCallback in
      its deps array (TDZ ReferenceError every render); NetWorthDisplay
      destructured the long-removed createMemoizedValue and would have
      thrown TypeError; CompanyApp's "Create Family Business" and
      "Enter Competition" buttons called context methods that were
      never wired (TypeError on tap); GemsStoreModal's loading
      spinner padding was undefined; ribbonSystem's "Jailbird" ribbon
      read the wrong path and never triggered;
      runComprehensiveTests was simulating with default money because
      a stats override was nested wrong.
- [ ] Remaining ~88 substantive errors are concentrated in stress
      tests (~37, the currentJob/isDead model drift is a deeper test
      rewrite) and DevToolsModal (3, needs restartGame design). The
      rest are 1-2-error UI clusters that need individual auditing.
- [ ] ~654 remaining errors are cosmetic `TS6133` unused-variable
      warnings — biggest single batch left; a single eslint
      --fix-unused-imports pass would clear most of these.
- [ ] Remaining `TS18047`/`TS18048` (~65) null/undefined accesses.
- [ ] Remaining `TS2345`/`TS2322`/`TS2353` (~110) type mismatches.
- [ ] Simulation tooling (`BugHunterSimulator`, `RealActionSimulator`,
      `ComprehensiveGameSimulator`) — ~80 errors, internal tools, lower priority.
- [ ] Re-verify game-logic claims independently (free-week save timing, marriage
      migration heuristic, jail cooldown `week` vs `weeksLived`).
- [ ] IAP: `IAPService.validateReceipt` returns `true` unconditionally; the
      mutation-heavy `applyProductToState` needs the typed-transform refactor.
      Needs server-side verification — out of scope for a client-only branch.
- [ ] Make `preflight` blocking in CI once the type baseline is clean.
- Note: `saveGame` version write verified correct (writes `STATE_VERSION`,
  not `1` — the original audit claim was false).

### Phase 3 — Code quality & architecture (NOT STARTED)
- [ ] Sweep `TS6133`/`TS6192`/`TS6196`/`TS6198` (~720) unused code — mechanical
      but high-volume; do per-directory with type-check after each batch.
- [ ] Decide fate of orphaned modules (`components/computer/gaming/useStreamingLogic.ts`
      now unused; `GoalManager.tsx`/`EnhancedSocialManager.tsx` were marked removed
      in a prior pass yet still present — confirm).
- [ ] Architecture items deferred from prior passes: `_layout.tsx` size, single
      `gameState` atom re-render cost, source-root consolidation, asset compression.

### Phases 4–9 — Liquid Glass design system (DEFERRED until base is type-clean)
Unified design tokens, real `expo-blur` materials, `GlassSurface`/`GlassButton`
primitives, per-screen migration, animation polish, accessibility. Not started —
gated on Phases 2–3 per the user's chosen sequencing.

---

## Launch Readiness Pass - March 9, 2026

- [x] Audit current uncommitted onboarding changes for logic bugs, incomplete paths, and regression risks.
- [x] Review new onboarding helper modules and tests for correctness and missing edge cases.
- [x] Run focused onboarding tests and fix failures.
- [x] Run preflight checks (tsc, lint, unit, integration, preflight) and fix new regressions found in touched areas.
- [x] Validate onboarding route flow for guard gaps and launch-blocking issues.
- [x] Update task tracker and lessons learned with concrete outcomes.

### Launch Readiness Pass - Verification Notes
- Onboarding tests (`npx.cmd jest --testPathPattern=onboarding --runInBand`): PASS (18/18).
- Unit tests (`npm.cmd run test:unit -- --runInBand`): FAIL (2 pre-existing failures in `lib/events/__tests__/engine.test.ts` and `lib/economy/__tests__/passiveIncome.test.ts`).
- Integration tests (`npm.cmd run test:integration -- --runInBand`): PASS (14/14).
- Preflight quick (`npm.cmd run preflight:quick`): FAIL with repo baseline type-check errors (1253 errors in 188 files).
- Full preflight (`npm.cmd run preflight`): FAIL (mandatory blocker: missing `EXPO_PUBLIC_SAVE_HMAC_KEY`).

## AAA+ Onboarding Remake Plan - March 9, 2026

### Phase 0: Baseline and Success Criteria (2 days)
- [ ] Capture onboarding funnel metrics (MainMenu -> SaveSlots -> Scenarios -> Customize -> Perks -> first frame in `(tabs)`).
- [ ] Log startup + onboarding crash points and animation frame drops on iOS and Android.
- [ ] Define release goals: onboarding completion >= 85%, median completion time <= 120s, crash-free onboarding sessions >= 99.8%, D1 retention uplift target >= 8%.
- [ ] Freeze current onboarding visuals and interaction map for A/B comparison evidence.

### Phase 1: Onboarding Architecture Cleanup (4-6 days)
- [x] Extract shared onboarding shell (`background`, `safe area`, `header`, `CTA bar`, `progress stepper`) into `components/onboarding/`.
- [ ] Replace duplicated animation setup in all onboarding screens with `useOnboardingScreenAnimation()` hook.
- [ ] Split large screens into feature modules (`SaveSlots`, `Scenarios`, `Customize`, `Perks`) and target < 400 lines per screen file.
- [ ] Add typed onboarding flow guards so each route validates prerequisites before navigation.
- [ ] Add onboarding analytics events for step view, step complete, validation error, and exit reason.

### Phase 2: Professional Liquid Glass System (3-4 days)
- [ ] Upgrade `utils/glassmorphismStyles.ts` to semantic variants (`surface/subtle/strong/selected/disabled`) backed by theme tokens.
- [ ] Move raw color literals from onboarding files to `lib/config/theme.ts` + onboarding token map (`lib/config/onboardingTheme.ts`).
- [x] Add reusable glass components (`GlassPanel`, `GlassButton`, `GlassSegmentedControl`, `GlassCard`) with strict scaling and contrast rules.
- [ ] Keep blur behavior safe with fallback wrappers and platform guards (no native crash regressions).
- [ ] Add visual regression screenshots for light/dark mode and small/large device classes.

### Phase 3: Smooth UX Flow Redesign (5-7 days)
- [ ] Redesign `MainMenu` into a clear two-path entry (`Continue` and `New Life`) with save health indicators.
- [ ] Redesign `SaveSlots` with state chips (`Empty`, `Playable`, `Corrupted`, `Version mismatch`) and one-tap recommended action.
- [x] Redesign `Scenarios` with stronger card hierarchy, clearer difficulty communication, and reduced cognitive load.
- [x] Redesign `Customize` with inline validation, auto-suggestions, and instant preview of identity impact.
- [ ] Redesign `Perks` with guided presets + advanced mode toggle to reduce first-time overwhelm.
- [ ] Add a compact onboarding progress rail and estimated time per step.

### Phase 4: Correctness and Save Safety (2-3 days)
- [ ] Add integration tests for full onboarding happy-path and edge-path flows using `createTestGameState()` policies.
- [ ] Verify `saveGame`/`forceSave` correctness for new flow transitions and restore points.
- [ ] Run Save System Auditor and Game State Reviewer subagents on onboarding + save changes.
- [ ] Execute `npm run preflight:quick` each phase and `/preflight` before release candidate.

### Phase 5: Polish Pass (3-4 days)
- [ ] Add premium motion pass (staggered entrances, spring-tuned CTA feedback, reduced motion support).
- [ ] Add haptics/audio cues on key onboarding confirmations with accessibility-safe defaults.
- [ ] Add localization and text-overflow QA for onboarding copy.
- [ ] Run device matrix QA (small phones, Pro Max, tablets) and fix remaining layout edge cases.

### AAA+ Product Roadmap (Parallel, 6-12 months)
- [ ] Establish a vertical-slice quality bar (one full life arc with premium UX, narrative depth, and economy balance).
- [ ] Build live-ops layer: seasonal content pipeline, narrative events, economy telemetry, and tuned progression loops.
- [ ] Expand systemic depth: richer careers/relationships/health systems with cross-system consequences.
- [ ] Upgrade content quality: authored narrative packs, scenario cinematics, and higher-fidelity UI/audio identity.
- [ ] Add long-term technical foundation: deterministic simulation tests, performance budgets, crash analytics SLAs, and release train cadence.
- [ ] Define a live quality scorecard (retention, stability, economy fairness, content freshness, sentiment) for every release.

## UI Overflow Fix - Top Date Card (March 9, 2026)

- [x] Confirm root cause of `year/month/age` card overflow on large iPhone layouts.
- [x] Fix device classification so Pro Max iPhones do not use iPad sizing.
- [x] Add right-column/date-card width clamps in `TopStatsBar` as a safety net against future overflow.
- [x] Run `npm run preflight:quick` and record results for regression safety.
- [x] Update `tasks/lessons.md` with the pattern and prevention rule.
- [x] Verification note: `npm run preflight:quick` currently fails on pre-existing repo-wide TypeScript issues (baseline), with no new errors introduced by this fix.
- [x] Visual verification: confirmed in `/preview` at `430x932` that the date card no longer overflows.

## Extended audit verification — April 20, 2026

- **GitHub Actions:** [`.github/workflows/eas-build.yml`](.github/workflows/eas-build.yml) repaired (merge debris removed); matrix `android` / `ios`; single `eas build --profile production` per platform.
- **EAS / secrets docs:** [scripts/README_BUILD_SCRIPTS.md](scripts/README_BUILD_SCRIPTS.md) — `eas.json` production `EXPO_PUBLIC_*` flags vs EAS project secrets (HMAC, AdMob) documented.
- **Save typing:** [utils/saveValidation.ts](utils/saveValidation.ts) uses `VALIDATION_STAT_KEYS` + `statsAsUnknownRecord`; top-level array checks use `Record<string, unknown>`. [utils/gameEntryValidation.ts](utils/gameEntryValidation.ts) uses `keyof GameStats` for stat iteration. [utils/saveQueue.ts](utils/saveQueue.ts) embeds `_embeddedProtectedState` on a typed record envelope.
- **IAP:** [services/IAPService.ts](services/IAPService.ts) `applyProductToState(gameState: GameState, …)`; [components/IAPHandler.tsx](components/IAPHandler.tsx) casts JSON clone to `GameState` at call site.
- **Theme pilot (Phase F):** [app/(tabs)/work.tsx](app/(tabs)/work.tsx) screen background gradient uses [lib/config/theme.ts](lib/config/theme.ts) `palette` tokens (`dark900`, `light50`, `light100`) instead of inline hex.
- **Onboarding funnel:** [src/features/onboarding/onboardingAnalytics.ts](src/features/onboarding/onboardingAnalytics.ts) — step views on MainMenu, SaveSlots, Scenarios, Customize, Perks; validation errors + `Perks` completion in [src/features/onboarding/gameInitializer.ts](src/features/onboarding/gameInitializer.ts) and Perks input check.
- **PR checklist:** [tasks/pr-checklist-2026-03-09.md](tasks/pr-checklist-2026-03-09.md) PR-07/PR-08 marked done for removed components; Tombstone asset absent in repo.
- **Tests (focused):** `jest` on `__tests__/onboarding/gameInitializer.test.ts`, `__tests__/onboarding/flowGuard.test.ts`, `lib/progress/__tests__/saveLoad.test.ts` — **PASS**.
- **Type-check baseline:** `npx tsc --noEmit` — **~1107** lines matching `error TS` (unchanged order of magnitude; full baseline shrink is ongoing).
- **Lint:** `npm run lint` — **FAIL** (resolver): `EslintPluginImportResolveError: unable to load resolver "alias"` while linting `components/computer/gaming/PCBuildPanel.tsx` (tooling/config; separate unblock).

## Codebase Audit Plan - March 2026

### Phase A: Baseline and Tooling
- [ ] Unblock local quality pipeline (`npm run preflight:quick`, `npm run lint`, `npm test`) and capture fresh baseline counts.
- [ ] Add a scripted import integrity check (path resolution for `@/` and relative imports) to catch missing files before runtime.
- [ ] Record a known-failures baseline report in `tasks/` to separate pre-existing issues from new regressions.

### Phase B: Critical Correctness Bugs (Fix first)
- [x] Fix incorrect app config path in `utils/gameEntryValidation.ts` (`../../app.config.js` -> `../app.config.js`) so save-version warnings work.
- [x] Fix week counter misuse in progression logic.
- [x] Update `utils/goalSystem.ts` to gate by `weeksLived` (not `week` 1-4 UI cycle).
- [x] Update `components/computer/RealEstateApp.tsx` maintenance tracking to store/compare absolute weeks.
- [x] Update `components/mobile/BankApp.tsx` market APR input to use `weeksLived` for stable long-term variation.
- [x] Add regression tests for all `week` vs `weeksLived` fixes (goal visibility, property maintenance decay, APR progression).

### Phase C: Type Safety and State Mutation Hardening
- [ ] Remove high-risk `as any` / `@ts-ignore` usage in gameplay paths (`app/(tabs)/work.tsx`, `app/(onboarding)/Perks.tsx`, `contexts/game/GameActionsContext.tsx`, `contexts/game/actions/DatingActions.ts`, `utils/saveValidation.ts`).
- [ ] Replace mutation-heavy IAP application flow with typed pure transforms in `services/IAPService.ts` (single source of truth for entitlement application).
- [ ] Add strict guard helpers for union access and enforce no direct union property access in affected files.
- [ ] Update tests violating GameState factory policy (`__tests__/utils/saveValidation.test.ts`) to use `createTestGameState()`.

### Phase D: Integration Gaps and Dead/Orphan Code
- [x] Decide for each currently unreferenced runtime component: integrate or remove.
- [x] Removed unreferenced components: `TombstonePopup`, `GoalManager`, `QuickActionsPanel`, `EnhancedSocialManager`, `NetWorthDisplay`, `subscription/SubscriptionModal`, `AutomationSettingsModal`, `CloudSyncConflictModal` (none were imported anywhere in app code).
- [x] Documented removal via this tracker; no release-notes file added.
- [x] Tombstone asset was only referenced by removed `TombstonePopup` — optional follow-up: delete `assets/images/Tombstone.png` if present to shrink bundle.

### Phase E: Hardcoded Values and Config Drift
- [ ] Extract gameplay constants duplicated across files (loan caps, unlimited values, time windows, thresholds) into `lib/config/gameConstants.ts`.
- [ ] Replace magic numeric values in IAP and finance flows (`999999`, repeated `100000` caps, repeated day/week ms formulas) with named constants.
- [ ] Move external URL fixtures used in simulation UIs (social/tinder avatar endpoints) behind config or local fixtures to avoid runtime network fragility.

### Phase F: Theme, Scaling, and UI Consistency
- [ ] Reduce direct hex color usage in top offenders by moving to theme tokens and shared style helpers.
- [ ] Priority files: `components/computer/BitcoinMiningApp.tsx`, `app/(tabs)/work.tsx`, `components/mobile/CompanyApp.tsx`, `components/computer/GamingApp.tsx`, `components/computer/GamingStreamingApp.tsx`, `components/computer/AdvancedBankApp.tsx`.
- [ ] Enforce `scale()` / `fontScale()` and glassmorphism helpers in large UI files still using raw values.
- [ ] Add lint rule/check to block new direct color literals outside theme/config files.

### Phase G: Verification and Release Gates
- [ ] Run full preflight and ensure no new type/lint/test regressions.
- [ ] Run focused regression suite for save load, onboarding load flow, real estate maintenance, loan APR progression, and IAP entitlement application.
- [ ] Perform subagent reviews: Game State Reviewer for context/actions/state changes, Save System Auditor for save schema and migration integrity.
- [ ] Document results and residual risks in `tasks/` before release candidate cut.

---
## Comprehensive Bug Fix — March 2026 (Phases 1–3 Complete)

### Phase 1: CRITICAL — Crash Prevention & TypeScript Fixes
- [x] Fix 20+ critical TypeScript errors (undefined vars, wrong types, missing exports)
- [x] Fix saveBackup.ts scope bug, saveQueue.ts slot, initialState.ts missing defaults
- [x] Fix LoadingSpinner boxShadow + zIndex
- [x] Fix ~20 unused variable warnings across 14 files
- [x] Create offlineManager.d.ts, fix stateValidator, IAPService, turboModuleWrapper

### Phase 2: Data Integrity & Race Conditions
- [x] CloudSyncService: null guard on relationships merge + integrity verification on download
- [x] Bail payment stale closure (JobActionsContext.tsx)
- [x] Wedding deposit money validation (DatingActions.ts)
- [x] FirstWeekGuide week→weeksLived
- [x] Save migration backfills for v12

### Phase 3: Economy Exploits & Balance
- [x] Stock buy fee, vehicle sell floor, dividend reinvest fee, loan payment guard
- [x] Company upgrade stale closure (CompanyActions.ts)
- [x] Rent rate mismatch (RENT_INCOME_RATE=0.005, unified across 4 files)
- [x] Stock symbol case sensitivity (B.6)
- [x] Verified 6 audit items as already fixed (A.9, A.11, A.15, A.16, B.4, B.5, B.13)

### Deferred
- [ ] Phase 4: Hardcoded values extraction (only RENT_INCOME_RATE done)
- [ ] Phase 5: Theme tokens, font scaling (only LoadingSpinner done)
- [ ] Phase 6: Architectural (_layout.tsx refactor, server-side IAP, cloud auth)

## Verification
- TypeScript: 0 errors in modified files (1298 total, all pre-existing)
- Tests: 10 passed, 24 failed (all pre-existing) — **zero regressions**
- Same baseline as Round 3: 120 tests pass, 12 fail, 24 suites fail

---

## Round 3 Bug Fixes — COMPLETED (Previous Session)

- [x] Phase 1 — Fix regressions (5 items)
- [x] Phase 2 — Fix state mutation bugs (5 items)
- [x] Phase 3 — Replace raw `52` with WEEKS_PER_YEAR (~50 replacements)
- [x] Phase 4 — Centralize local constants
- [x] Phase 5 — Cleanup

Previous verification: 10 passed, 24 failed (all pre-existing) — zero regressions

