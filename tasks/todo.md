# Active plan — full-completion hardening pass (2026-08-16)

Recon (4 parallel audits: markers/dead-code, save/persistence, economy exploits,
week-tick integrity) over a fully green baseline (7,116 tests, clean type-check,
lint, routes, weekly audit). Findings triaged into work packages below.

## Wave 1 — parallel, disjoint file sets

- [x] **WP-A: UI-layer capture-across-updater fixes** (the class the 08-15 sweep
      closed in `contexts/game/actions/` but which survives outside it)
  - `components/AdRewardOrb.tsx` grant(): gate→grant capture; success UI shown for
    $0 grants (deterministic on 2nd same-week orb); check the week gate BEFORE
    playing the ad; honest already-claimed UI
  - `components/SkillTreeModal.tsx:514` Alert/haptic inside updater
  - `contexts/game/company.ts` buyMiner/buyWarehouse — no outer guard, capture read
  - `contexts/game/JobActionsContext.tsx` performJailActivity resultMessage capture
  - Regression tests for each
  - DONE 2026-08-16: orb gate moved to the spawner + `applyAdCashGrant`
    (stamp+credit in one updater); `SkillTreeModal` effects moved out of the
    updater onto a preview run; `resolveBuyMiner`/`resolveBuyWarehouse` pure
    resolvers; jail message built before the updater. Tests:
    `__tests__/ads/adCashGrantAtomicity.test.ts`,
    `__tests__/refactor/skillTreePurchaseSideEffects.test.ts`,
    `__tests__/economy/minerPurchaseResult.test.ts`,
    `__tests__/actions/jailActivityMessage.test.ts`
- [x] **WP-B: raw-weeksLived class (bug #4 of CLAUDE.md §4.2)**
  - [x] `lib/progress/featureUnlocks.ts:207,227` → `weeksInThisLife` (both fed by
        one local, now `weeksThisLife`); `getActiveChapter` in `lifeChapters.ts`
        had the same defect — `weekRange` is per-life, so an age-25 start was
        handed Chapter 5 at birth
  - [x] `app/(tabs)/home.tsx` — one `weeksThisLife` for all 9 gates on the screen
        (tutorial, daily reward, welcome-back, Discord, first-job CTA, prestige
        preview, discovery, First Week Guide ×2); `lifeStartWeek` added to the
        screen's selector slice, which `unlockTier` also needs
  - [x] `components/FirstWeekGuide.tsx:442` no-job tip (the dismissal cooldown at
        :429 stays absolute — it is a delta, not progress)
  - [x] `lib/analytics/AnalyticsTracker.tsx` first_week_completed
  - [x] Sweep: also fixed `components/BannerAd.tsx` (ad grace year applied to
        exactly one of eight scenario ages), `components/AchievementsProgress.tsx`
        (early-game sort bias), `utils/ratingPrompt.ts` (store-review sheet could
        fire in the first session)
  - [x] New primitive `weeksSinceLifeStart` in `utils/weekCounters.ts` for the
        `useGameSelector` call sites; `weeksInThisLife` delegates to it
  - [x] Tests: `__tests__/onboarding/featureUnlocks.test.ts` (+15, all eight
        shipped scenario ages), `__tests__/analytics/firstWeekCompletedThisLife.test.tsx`,
        `__tests__/progression/weeksInThisLifeSweep.test.tsx` (incl. a source
        guard over the six gate files)
  - NOT done, deliberately: ~45 event-availability gates in `lib/events/*`
    (`nearMissEvents`, `cliffhangerEvents`, `engine`, `wealthEvents`,
    `fameEvents`, `secretEvents`, `lifeMilestoneEvents`) have the same defect —
    early-game events (`weeksLived < 12`) are unreachable for non-18 starts and
    late-game ones (`> 20`, `> 30`) fire immediately. Same one-word fix each, but
    it is a content-pacing change across seven files and wants its own WP.
- [x] **WP-C: weekly tick guard completeness** (2026-08-16)
  - guardTick `applyEducationProgression`, `applyLifetimeStatistics`,
    `calcWeeklyPassiveIncome`
  - Replace `weeklyTickGuards.test.ts` allowlist with a full scan of all apply*
    call sites in the updater
  - `applyEducationStress.ts:88` missing clamp
- [x] **WP-D: save pipeline**
  - [x] `saveLoadMutex.ts` synchronous lock handoff (F-8)
  - [x] autosave releases mutex before write lands (F-9) — `addToQueue` now
        resolves on completion, not on enqueue; `performSave` deliberately does
        NOT take the mutex (the enqueuer still holds it → deadlock)
  - [x] `doubleBufferLoad` pointer-flip recovery vs comment (F-10) — pointer
        flip verified by read-back; timestamp preference when the pointer is
        MISSING (a present pointer stays authoritative, no double verify cost)
  - [x] sign/CRC `save_queue_persisted` (F-11) — same envelope as a save;
        refuse + clear on verification failure
  - [x] `assertValidGameState` stale required fields (F-1) — derived from
        `initialGameState`; re-enabled in `criticalPaths.test.ts`
  - [x] repair fallback drift for settings/stats defaults (F-5)
  - [x] F-13: backup quota-retry path now records the throttle stamp and rotates
- [x] **WP-E: economy guards** — done 2026-08-16
  - [x] `VehicleActions.purchaseVehicle` — converted to a pure resolver
    (`resolvePurchaseVehicle`) called twice (snapshot → outcome, `prev` → state):
    re-checks ownership + affordability against `prev` and REFUSES instead of
    flooring the debit at 0. Ids stay equal to the template id (the whole
    vehicle system keys on that); the ownership re-check is what stops the
    duplicate garage entry that `sellVehicle` used to remove two-for-one.
    Test: `__tests__/economy/purchaseVehicleDoubleTap.test.ts`
  - [x] `MoneyActionsContext.swapCrypto` — R3-M10 inner re-check + `toAmount`
    re-derived from `prev`; same "no production caller" warning as its
    siblings. `sellCrypto` credit now clamps at MONEY_CEILING.
    Test: `__tests__/economy/cryptoSwapDoubleTap.test.ts`
  - [x] `RDActions.processCompetitionResults` — rolls hoisted out of the updater
    into a memoised pool with a per-invocation cursor, so a StrictMode
    double-invoke resolves the SAME competition and pays the same prize.
    Test: `__tests__/actions/competitionResultsDeterminism.test.ts`
  - [x] `accountEntitlements` — documented why the `weeksLived`-denominated
    markers (`deepLifePlusLastGemClaimWeek` v40, `lastLoginRewardWeek` v31) must
    NOT be carried across prestige. No behaviour change.

## Wave 2 — after wave 1 lands

- [x] **WP-F: dead code & unwired features** — done 2026-08-16
  - [x] `totalPropertiesOwned` written inline in `resolveBuyProperty`
        (RealEstateActions), `totalPostsMade` / `totalViralPosts` inline in
        `composePost` (PulseActions) — both INSIDE the updater that commits the
        purchase/post, past its fresh-state guard (§4.4), so a refused action
        cannot count. Unblocks the `first-property` (15 gems) and `viral`
        (10 gems) milestones, which were unearnable since they shipped.
        Orphaned `trackNewProperty` / `trackPost` / `trackHobbyLearned` helpers
        deleted from `statisticsTracker.ts` (stress test updated).
  - [x] `totalHobbiesLearned`: field KEPT (removing an `initialState` field is
        save-format churn, Hard Rule #3), helper deleted, note left in
        `statisticsTracker.ts` — still no reader AND no writer.
  - [x] Deleted `lib/events/seasonal.ts` + `__tests__/lib/events/seasonal.test.ts`
        (zero non-test importers; `seasonalEvents.ts` is the live one),
        `lib/legacy/children.ts`, `utils/analytics.ts`, `services/AnalyticsService.ts`
        (sole importer was `utils/analytics.ts`). `lib/analytics` untouched.
  - [x] `IdentityCard` prestige badge: optional `onOpenPrestigeShop` prop, wired
        from `app/(tabs)/home.tsx` (which already mounts `PrestigeShopModal`);
        degrades to a plain View when unwired, so it never animates as a button
        that goes nowhere.
  - [x] `bookmarkPost` wired into `PostCard` (player posts only — ambient posts
        aren't in `recentPosts`) and `PostDetailScreen`; ProfileScreen's
        Bookmarks tab can finally fill.
  - [x] `markHustleNotificationRead` (tap a row) + `clearHustleNotifications`
        ("Clear all" in the section header) wired in `CompanyDetailScreen`.
  - [x] Tests: `__tests__/statistics/lifetimeCountersWired.test.ts` (8, incl.
        milestone reachability + refusal controls),
        `__tests__/refactor/unwiredActionCallSites.test.ts` (5, source-level
        call-site guard for the "green leaf nobody calls" class)
- [x] **WP-G: ratchet scope** — extend `updaterResultRatchet.test.ts` to scan
      weekly/, components/, app/, contexts/game/*.tsx (recursive), pin the
      documented survivors by name
  - Scope: recursive walk of `contexts/game/`, `components/`, `app/` (381 files,
    tests excluded); entries keyed by repo-relative path. Original top-level
    extraction preserved verbatim so all 93 prior members still mean the same
    thing; a second structural pass reaches nested handlers (the AdRewardOrb
    shape) with indentation normalised (GameActionsContext.tsx is 1-space).
  - Baseline 93 → **101**. No production code changed: 8 additions are pre-existing
    code in files the scan never opened. 7 are the benign outer-guard-mirrored
    shape (company.ts sellCompany/sellMiner, GameActionsContext proposeToPartner/
    moveInTogether, ItemActionsContext performHack, MoneyActionsContext
    purchasePrestigeBonus, SocialActionsContext haveChild).
  - The one REAL capture the wider scope found — `company.ts::upgradeWarehouse`,
    the live Mining warehouse-upgrade button — was converted to
    `resolveUpgradeWarehouse` (the siblings' preview/commit shape, money via
    `applyMoneyDelta`) in the same change; its atomicity suite now pins the
    resolver contract. `processVehicleWeekly` (no production caller) remains
    the single pinned capture.
  - components/ and app/ contribute zero (2d99a22 fixed them); fixtures + a
    negative control prove the scan really reaches them.

## Wave 3 — validation

- [x] Full suite (7,252 pass), type-check (app+tests), lint, routes, both
      ratchets, audit:weekly fully green across all five domains
- [x] Re-audit diffs — /code-review at high effort over main...HEAD; one
      finding survived verification (F-9b: `addToQueue` could resolve via a
      STALE drain promise from a dying drain, reopening the mid-write window
      F-9 closed) — fixed: the await now loops until the operation's own
      settle fires, with a discriminating regression test
- [x] lessons.md entry; committed and pushed

## Deliberately deferred (recorded, not done)

- stateInvariants.ts is ~unwired (F-14) — wiring it into load is a design decision
  (perf + false-positive risk); documented for the owner
- audit-save.cjs inverse-direction check (F-2) — analyzer extension, larger change
- Dead superseded action exports (refresh* etc.) — deletion sweep is churn-risk;
  keep list in recon reports
