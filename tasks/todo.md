# Active plan — full-completion hardening pass (2026-08-16)

Recon (4 parallel audits: markers/dead-code, save/persistence, economy exploits,
week-tick integrity) over a fully green baseline (7,116 tests, clean type-check,
lint, routes, weekly audit). Findings triaged into work packages below.

## Wave 1 — parallel, disjoint file sets

- [ ] **WP-A: UI-layer capture-across-updater fixes** (the class the 08-15 sweep
      closed in `contexts/game/actions/` but which survives outside it)
  - `components/AdRewardOrb.tsx` grant(): gate→grant capture; success UI shown for
    $0 grants (deterministic on 2nd same-week orb); check the week gate BEFORE
    playing the ad; honest already-claimed UI
  - `components/SkillTreeModal.tsx:514` Alert/haptic inside updater
  - `contexts/game/company.ts` buyMiner/buyWarehouse — no outer guard, capture read
  - `contexts/game/JobActionsContext.tsx` performJailActivity resultMessage capture
  - Regression tests for each
- [ ] **WP-B: raw-weeksLived class (bug #4 of CLAUDE.md §4.2)**
  - `lib/progress/featureUnlocks.ts:207,227` → `weeksInThisLife`
  - `app/(tabs)/home.tsx:651` isBrandNew; `components/FirstWeekGuide.tsx:442`;
    `lib/analytics/AnalyticsTracker.tsx` first_week_completed
  - Repo sweep for remaining raw "played N weeks" comparisons; tests incl. a
    non-18 scenario start
- [ ] **WP-C: weekly tick guard completeness**
  - guardTick `applyEducationProgression`, `applyLifetimeStatistics`,
    `calcWeeklyPassiveIncome`
  - Replace `weeklyTickGuards.test.ts` allowlist with a full scan of all apply*
    call sites in the updater
  - `applyEducationStress.ts:88` missing clamp
- [ ] **WP-D: save pipeline**
  - `saveLoadMutex.ts` synchronous lock handoff (F-8)
  - autosave releases mutex before write lands (F-9)
  - `doubleBufferLoad` pointer-flip recovery vs comment (F-10)
  - sign/CRC `save_queue_persisted` (F-11)
  - `assertValidGameState` stale required fields (F-1)
  - repair fallback drift for settings/stats defaults (F-5)
- [ ] **WP-E: economy guards**
  - `VehicleActions.purchaseVehicle` — no inner re-check; double-tap dup ids
  - `MoneyActionsContext.swapCrypto` — latent coin duplicator; `sellCrypto`
    missing MONEY_CEILING clamp
  - `RDActions.processCompetitionResults` — Math.random inside updater (prize money)
  - `accountEntitlements` — record the v40 marker decision as a comment

## Wave 2 — after wave 1 lands

- [ ] **WP-F: dead code & unwired features**
  - Wire `totalPropertiesOwned` / `totalPostsMade` / `totalViralPosts`
    (unblocks 2 unearnable gem milestones); wire-or-delete `totalHobbiesLearned`
  - Delete `lib/events/seasonal.ts` (+test) — getCurrentSeason collision trap
  - Delete `lib/legacy/children.ts`, `utils/analytics.ts`, `services/AnalyticsService.ts`
  - `IdentityCard.tsx:530` empty onPress; Pulse `bookmarkPost` unwired;
    Hustle notification read/clear unwired
- [ ] **WP-G: ratchet scope** — extend `updaterResultRatchet.test.ts` to scan
      weekly/, components/, app/, contexts/game/*.tsx (recursive), pin the
      documented survivors by name

## Wave 3 — validation

- [ ] Full suite, type-check (app+tests), lint, routes, both ratchets, audit:weekly
- [ ] Re-audit diffs (code-review pass)
- [ ] lessons.md entry; commit and push

## Deliberately deferred (recorded, not done)

- stateInvariants.ts is ~unwired (F-14) — wiring it into load is a design decision
  (perf + false-positive risk); documented for the owner
- audit-save.cjs inverse-direction check (F-2) — analyzer extension, larger change
- Dead superseded action exports (refresh* etc.) — deletion sweep is churn-risk;
  keep list in recon reports
