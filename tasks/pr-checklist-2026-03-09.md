# PR Checklist - Comprehensive Stabilization Plan (2026-03-09)

## Scope
This checklist converts the audit plan into executable PRs with file-level ownership and effort estimates.

## Owner Roles
- `Core Gameplay`: state progression, goals, simulation logic
- `Economy`: finance, APR, loans, rent, market values
- `Save/Platform`: save validation, config loading, migrations
- `UI/UX`: integration points, theming, scaling consistency
- `QA`: tests, regression coverage, release verification
- `Tooling`: lint/type tooling and guardrails

## PR-01 - Absolute Week Counter Foundation
- [x] `utils/weekCounters.ts` - Owner: `Core Gameplay` - Effort: `2h`
- [x] `utils/goalSystem.ts` - Owner: `Core Gameplay` - Effort: `1.5h`
- [x] `components/computer/RealEstateApp.tsx` - Owner: `Core Gameplay + Economy` - Effort: `2.5h`
- [x] `components/mobile/BankApp.tsx` - Owner: `Economy` - Effort: `1.5h`
- [x] `utils/gameEntryValidation.ts` - Owner: `Save/Platform` - Effort: `0.5h`
- Verification:
- [x] `__tests__/utils/weekCounters.test.ts` pass
- [x] Add component-level regressions for Real Estate weekly decay and Bank APR display

## PR-02 - Baseline Quality Pipeline and Reports
- [x] `scripts/preflight-check.js` - Owner: `Tooling` - Effort: `2h`
- [x] `tasks/baseline-failures-2026-03-09.md` - Owner: `Tooling + QA` - Effort: `1h`
- [x] `package.json` scripts audit (`preflight:quick`, `lint`, `test`) - Owner: `Tooling` - Effort: `1h`
- Exit criteria:
- [x] Stable baseline counts recorded and reproducible locally

## PR-03 - Import Integrity Guard
- [ ] `scripts/check-import-integrity.js` (new) - Owner: `Tooling` - Effort: `3h`
- [ ] `package.json` add script hook - Owner: `Tooling` - Effort: `0.5h`
- [ ] CI/local invocation docs in `tasks/` - Owner: `Tooling` - Effort: `0.5h`
- Exit criteria:
- [ ] Missing `@/` or broken relative imports fail fast before runtime

## PR-04 - Type Safety and Union Guards (High Risk Paths)
- [ ] `app/(tabs)/work.tsx` - Owner: `Core Gameplay` - Effort: `2h`
- [ ] `app/(onboarding)/Perks.tsx` - Owner: `Core Gameplay` - Effort: `1.5h`
- [ ] `contexts/game/GameActionsContext.tsx` - Owner: `Core Gameplay` - Effort: `3h`
- [ ] `contexts/game/actions/DatingActions.ts` - Owner: `Core Gameplay` - Effort: `2h`
- [ ] `utils/saveValidation.ts` - Owner: `Save/Platform` - Effort: `2h`
- Exit criteria:
- [ ] Remove high-risk `as any`/`@ts-ignore` in gameplay/save paths
- [ ] Union accesses protected with explicit `'property' in object` guards

## PR-05 - IAP Entitlement Flow Purification
- [ ] `services/IAPService.ts` - Owner: `Save/Platform + Economy` - Effort: `4h`
- [ ] `contexts/game/types.ts` (if needed for typed entitlement transforms) - Owner: `Core Gameplay` - Effort: `1h`
- [ ] `__tests__/` coverage for entitlement apply/revoke paths - Owner: `QA` - Effort: `2h`
- Exit criteria:
- [ ] Entitlements applied by typed pure transforms; no mutation-heavy side effects

## PR-06 - Test Factory Compliance for GameState
- [ ] `__tests__/utils/saveValidation.test.ts` - Owner: `QA` - Effort: `1h`
- [ ] Related tests manually constructing `GameState` - Owner: `QA` - Effort: `2h`
- Exit criteria:
- [ ] All tests use `createTestGameState()` and avoid `as GameState`

## PR-07 - Unintegrated Runtime Components (Integrate or Delete)
- [x] Removed unused components (April 2026): `TombstonePopup`, `GoalManager`, `QuickActionsPanel`, `EnhancedSocialManager`, `NetWorthDisplay`, `subscription/SubscriptionModal`, `AutomationSettingsModal`, `CloudSyncConflictModal` (none were imported in app code).
- Exit criteria:
- [x] Each former candidate removed from tree; tracked in `tasks/todo.md` Phase D.

## PR-08 - Missing/Dormant Asset Integrity
- [x] `assets/images/Tombstone.png` — not present in repo; only referenced by removed `TombstonePopup`. No action.
- [ ] `components/*` dormant flow asset references - Owner: `UI/UX` - Effort: `2h`
- Exit criteria:
- [ ] No unresolved runtime image requires in shipping flows

## PR-09 - Hardcoded Constants Extraction
- [ ] `lib/config/gameConstants.ts` - Owner: `Core Gameplay + Economy` - Effort: `2h`
- [ ] `services/IAPService.ts` - Owner: `Economy` - Effort: `1.5h`
- [ ] `utils/loan.ts` and finance call sites - Owner: `Economy` - Effort: `2h`
- [ ] Replace `999999`, repeated `100000`, raw day/week ms formulas across touched files - Owner: `Economy + Core Gameplay` - Effort: `3h`
- Exit criteria:
- [ ] Gameplay/finance magic numbers replaced with named constants

## PR-10 - External URL Fixture Hardening
- [ ] `components/mobile/TinderApp.tsx` - Owner: `UI/UX + Core Gameplay` - Effort: `1h`
- [ ] `lib/social/randomProfiles.ts` - Owner: `Core Gameplay` - Effort: `1h`
- [ ] `lib/social/npcPosts.ts` - Owner: `Core Gameplay` - Effort: `1h`
- Exit criteria:
- [ ] Simulation UI does not depend on unstable third-party avatar URLs

## PR-11 - Theme and Scaling Compliance
- [ ] `components/computer/BitcoinMiningApp.tsx` - Owner: `UI/UX` - Effort: `2h`
- [ ] `app/(tabs)/work.tsx` - Owner: `UI/UX + Core Gameplay` - Effort: `2h`
- [ ] `components/mobile/CompanyApp.tsx` - Owner: `UI/UX` - Effort: `2h`
- [ ] `components/computer/GamingApp.tsx` - Owner: `UI/UX` - Effort: `2h`
- [ ] `components/computer/GamingStreamingApp.tsx` - Owner: `UI/UX` - Effort: `2h`
- [ ] `components/computer/AdvancedBankApp.tsx` - Owner: `UI/UX + Economy` - Effort: `2h`
- Exit criteria:
- [ ] Color literals moved to tokens, major sizing uses `scale()`/`fontScale()`

## PR-12 - Release Verification Gates
- [ ] Run `npm run preflight:quick` and capture delta from baseline - Owner: `QA` - Effort: `0.5h`
- [ ] Run full `npm run preflight` before release build - Owner: `QA` - Effort: `1h`
- [ ] Run focused regressions for save load, onboarding, real estate maintenance, APR progression, IAP entitlements - Owner: `QA` - Effort: `2h`
- [ ] Game State Reviewer pass on state/actions touched PRs - Owner: `Core Gameplay` - Effort: `0.5h`
- [ ] Save System Auditor pass on save/schema PRs - Owner: `Save/Platform` - Effort: `0.5h`
- Exit criteria:
- [ ] No new regressions relative to baseline and release gate checks pass

## Estimated Totals
- Phase B remaining effort: `4h` (component-level regression tests + verification)
- Phases C-G effort: `~49h`
- Program total remaining: `~53h` (excluding baseline debt reduction outside scoped fixes)
