# Task Tracker

<!-- Used by Claude Code sessions. Add checkable items for multi-step tasks. -->

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
- [ ] Redesign `Scenarios` with stronger card hierarchy, clearer difficulty communication, and reduced cognitive load.
- [ ] Redesign `Customize` with inline validation, auto-suggestions, and instant preview of identity impact.
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
- [ ] Decide for each currently unreferenced runtime component: integrate or remove.
- [ ] Candidates found unreferenced: `components/TombstonePopup.tsx`, `components/GoalManager.tsx`, `components/QuickActionsPanel.tsx`, `components/EnhancedSocialManager.tsx`, `components/NetWorthDisplay.tsx`, `components/subscription/SubscriptionModal.tsx`, `components/AutomationSettingsModal.tsx`, `components/CloudSyncConflictModal.tsx`.
- [ ] Either add import/render integration points or delete and document removal in release notes.
- [ ] Fix/validate asset references for dormant flows (for example `@/assets/images/Tombstone.png` currently missing).

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

