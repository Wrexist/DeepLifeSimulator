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
- [x] **WP-M: the verified UI findings** — eight items from the UI audit, each
      re-read at the source before editing.
  - **HUD clipping (HIGH).** `TopStatsBarStyles.ts` paired a scaled `fontSize`
    with a RAW `lineHeight` on all three lines of the date block — the bug shape
    already annotated on `chipText` in the same file and fixed once in
    `FirstWeekGuide`. `fontScale` clamps at 1.6 on a tablet, so `yearText` put
    26pt glyphs in a 20pt box (month 22 in 18, age 19 in 16) on the one bar that
    is on screen at all times. Each box now `fontScale()`s at its original
    ratio; `hudLegibility` gained a guard that no `lineHeight` in the sheet is a
    literal, so a fourth cannot be added quietly.
  - **Market dead end + money format.** `sortedItems.map()` had no empty branch,
    so the "Owned" chip — which matches nothing on week 1 for every character —
    rendered its own active state, a count badge reading 0, and then nothing.
    Named the dead end with a way out, in the Mail app's empty-state shape.
    Prices went through raw interpolation (`$20000`, and `.toFixed(2)` on a
    value `getInflatedPrice` had ALREADY rounded, so it only ever printed
    `.00`) while the same file used `formatMoney` for rents and the purchase
    dialog; all now use the one convention, the sell CONFIRM included — it reads
    the same value as the Sell button, so leaving it raw would have introduced
    a "$2.5K" button over a "$2500.5" dialog.
  - **Savings goal +/- (a11y).** Two 28pt circles moving real money in opposite
    directions, no `hitSlop`, nothing announced. Uses the repo's
    `hitSlopToMinTarget` — but NOT verbatim: the pair sits `responsiveSpacing.sm`
    apart, so a symmetric slop would make their hit rectangles OVERLAP, and RN
    hit-tests the last-rendered child first, which would turn "too small to hit"
    into "withdraw deposits". The facing edge is capped at half the gap and the
    remainder pushed outward; both still clear 44pt on both axes.
  - **Unbounded typed names.** First/last name, pet name and bank account name
    were uncapped, and those strings reach the HUD, the ID card, save-slot
    metadata and the obituary. Capped at 20/20/20/30 — 20+20 matches Pulse's
    40-char display-name budget. `onboardingValidation` has no length rule and
    did not gain one, so no message can be wrong about a limit. `IdentityCard`'s
    name got `numberOfLines={1}` (the cap cannot shorten an already-saved name).
  - **a11y labels** on the listed icon-only touchables (DMSystem back ×2 +
    send, ProgressOverview clear-search + sort, Journal close + filter). MailApp
    and InfoButton were already compliant — the audit's line numbers were stale.
  - **Raw zIndex** → `Z_INDEX.DROPDOWN` / `Z_INDEX.LOADING` (the latter's comment
    already named the constant it was not using).
  - **`React.memo(MailRow)` was inert.** The list passed `() => openMessage(m.id)`
    per row, so the memo compared unequal every render and a keystroke in the
    search field re-rendered all 50 rows. The row takes its id back now (Pulse's
    FeedScreen pattern) and the list hands every row the same two callbacks.
  - **Found while testing: `render — in-game tab screens` was green on a crash
    screen.** `useNavigationContainerRef` was missing from `jest.setup.js`'s
    expo-router mock, so every screen going through `useNavigationReady` threw on
    first commit and rendered its OWN `ErrorBoundary` fallback — a valid tree, so
    `expect(json.length).toBeGreaterThan(0)` passed on a screen that had never
    rendered. Mock added; all 40 render suites still pass, and the market tests
    below mount `MarketScreenContent` rather than the boundary-wrapped default
    for the same reason.
  - Full suite 7,295 pass / 308 snapshots unchanged, type-check (app + tests)
    clean, eslint 0 errors on every touched file, `check:routes` OK. One existing
    assertion updated: `uiTruthF5toF8` pinned the food price's exact
    interpolation; its subject (the displayed price is the INFLATED one) is
    unchanged and still asserted through the formatter.

## Wave 4 — picked up from the deferred list

- [x] **WP-I: wire `utils/stateInvariants.ts` (F-14)** — the module claimed "the
      game never enters an impossible state" while enforcing nothing:
      `validateMoneyInvariants` log-only in `MoneyActionsContext`,
      `validateStateInvariants` only in dev tooling, and six exports with zero
      production callers.
  - New `enforceStateInvariants(state, context)` runs as the LAST step of
    `loadGame` (after migrations → `repairGameState` →
    `validateGameState(autoFix)` → `repairRelationshipState`, and after the
    merge onto `initialGameState`) and in the CloudSync "keep cloud version"
    path. Logs every violation under one grep-able tag, `[INVARIANT]`, and
    clamps the safely-repairable ones. **It never rejects** — a player's save
    must always load — and it never invents or deletes: relationship violations
    (duplicate ids, out-of-union types) are reported and left alone, because
    every repair for those is a deletion or a guess about who someone is.
  - Deliberately NOT in the weekly tick or per-action paths: the tick has its
    own per-subsystem guards (§4.3) and the boundary is where corruption enters.
    Cheap when clean — one pass, early return with the same object reference;
    the shallow copies only happen on a state already known to be broken.
  - Does not double-implement the pipeline. It catches what the earlier stages
    miss on the final state: `date.week` outside 1–4 (`validateGameState` only
    rejects a NEGATIVE week) and a negative/non-finite `weeksLived` (nothing
    else checks it at all, and it is the counter every cooldown compares
    against). Stats clamping is `autoFixStats`' job; kept as a backstop for the
    paths that skip it.
  - **Two validators were genuinely wrong and fired on legitimate saves** —
    exactly why an unwired checker is worse than none, since nothing ever
    disproved them: (1) `date.age < 18` was a hard ERROR, but the
    `athletes_journey` scenario starts at **16** and `gameStateBuilder` writes
    that into `date.age` — now `MIN_VALID_AGE = 16` with the citation;
    (2) `date.year > 2100` warned, but the year is CUMULATIVE across prestige
    generations (`newYear = previousYear + yearsLived + 1`), so it fired on the
    saves of the players who play the most — upper bound removed, lower bound
    (the 2025 epoch) kept. Also un-nested the "multiple spouses" check, which
    sat inside `if (family.spouse)` and so could never see the corruption shape
    it exists to catch.
  - Tests: `__tests__/save/loadInvariants.test.ts` (10) — unit coverage of the
    wrapper plus an end-to-end corrupted-save load through the real
    `GameProvider`/`loadGame` proving (a) logged, (b) repaired, (c) still loads,
    with a healthy-save control asserting silence. Verified discriminating: with
    the call stubbed out, `date.week` comes back 9.

- [x] **WP-J: close the save-format tooling gaps (F-2, F-3, F-4, F-6, F-7)** —
      the audit only ever checked ONE direction of the §7 rule, and two repair
      mirrors plus two doc entries were missing.
  - **F-2 (the substantive one): `audit-save.cjs` V11, the INVERSE check.** V8
    walks the migrations and asks "is each backfill mirrored in repair?", which
    only ever sees fields somebody already remembered to migrate. §7's rule runs
    the other way — every `initialState` field with a concrete default ships a
    migration AND a mirror in the same change — and nothing checked it. V11 now
    parses `initialGameState`'s 141 top-level keys (depth-tracked, not
    indentation-matched), keeps the 126 with a concrete default, and fails on
    any that is named by neither the migration registry nor `repairGameState`.
    **57 legacy fields are grandfathered** in `LEGACY_PRE_MIGRATION_FIELDS`
    (`totalHappiness`, `criminalXp`, `vehicles`, `karma`, `lifetimeStatistics`,
    `politics`, …). They are NOT live bugs: the primary load path is
    `{ ...initialGameState, ...parsed }`, so an absent key is filled before
    anything reads it — what they lack is the second line of defence for a save
    that arrives partial through a path that does not spread. The set is a
    ratchet like the coverage floors: seeded so the audit is green today, may
    only SHRINK, and a NEW field without its pair now fails the audit instead of
    waiting for someone to notice by eye. V11b flags stale entries so the list
    cannot rot into protecting nothing.
  - Two analyzer bugs found while wiring it: `repairGameStateBody` ended at "the
    first column-0 `}`", which landed ~400 lines INSIDE the function (stripNoise
    deletes `//` comments, so cleaned offsets match nothing) — now brace-matched
    from the body's opening brace, not the return type's. And repair's
    table-driven backfills (`requiredArrays`/`catalogArrays`/`subsystemObjects`)
    live in string literals that stripNoise blanks, so they are read separately
    from the raw source. V9 gets the same fix for free: it now scans the whole
    function instead of a third of it.
  - **F-3: `lastEventWeeksLived` repair mirror.** v12 migration, no mirror — the
    last v12 field without one. Seeded from `weeksLived`, not 0, because the
    pity system reads `weeksLived - lastEventWeeksLived`: a 0 on a 400-week
    character reads as a 400-week drought and fires an event immediately.
  - **F-4: the v22 `pets.ownedToys` → `toys` collapse mirror.** The one part of
    migration 22 that MOVES data rather than defaulting it, and the one with no
    repair counterpart — a partial save stamped ≥v22 still carrying `ownedToys`
    is skipped by the ladder while every reader has moved to `pet.toys ?? []`,
    so those toys are paid for and invisible. Union-then-empty, so it never
    drops a toy and a second pass is a no-op.
  - **F-6: §7's no-op rule matched no practice.** It said a structure-free bump
    "must be listed in the intentional-no-op set", but that set is versions 2–9
    only (the pre-v10 baseline) and all 14 carve-out bumps since v26 are stub
    migrations carrying their reasoning in a comment. §7 now describes both
    mechanisms and says which one new work uses.
  - **F-7: §7 was missing v35** (`settings.lastAdCashGrantWeek`, the marker the
    ad orb's week gate reads). Added in its neighbours' style.
  - Tests: `__tests__/save/v22FieldRepairParity.test.ts` +11 (collapse, dedupe,
    idempotence, malformed-pet safety, the pity-marker seed and its fallbacks)
    and a new `__tests__/tooling/initialStateFieldCoverage.test.ts` (8) that
    proves the V11 ratchet still BITES against fixtures — a ratchet nobody can
    show still fires is not a ratchet.

- [x] **WP-K: verified-findings cleanup sweep** — done 2026-08-16
  - **F-12: `saveQueue.clearQueue()` dropped a LIVE drain's handle.** It nulled
    `processingPromise` while a drain could still be mid-write. Nothing cancels
    an in-flight `performSave`, so the write kept going — it was merely no
    longer OBSERVED: the next `addToQueue` saw a null promise and started a
    SECOND concurrent `processQueue`, and `forceSave`'s "wait for the queue to
    finish first" guard then awaited only the new one, so a force-save could
    overwrite the slot mid-write. `kickProcessing`'s `finally` is now the only
    place the handle clears. `__tests__/save/saveQueueCompletion.test.ts` +1,
    verified discriminating (fails with the old line restored).
  - **17 dead superseded action exports deleted** (the item this file had
    deferred as churn-risk; each re-verified at zero production call sites
    across the whole repo, tests included): Banking `refreshCreditScore` /
    `recordCategorizedSpend` / `getCheckingAccount`; Loan `refreshCreditFromLoans`
    / `payLoanWeekly` (weekly/`applyLoanAutopay`); Mining `updateMiningStatistics`
    / `updateMiningDifficulty` (weekly/`applyMiningWarehouse`); LegacyPass
    `unlockLegacyPassPremium` (the second door — `reconcileLegacyPassSeason` is
    the live path `LegacyPassModal` uses); Crime `getDarkWebSkillLevel`; Dating
    `getRelationshipStatus`; Education `clearCampusEvent`; FamilyBusiness
    `inheritFamilyBusinesses`; Luxury `luxuryVerbItemName`; Mail
    `lapseMailDecision` (weekly/`applyMailLapse` reimplements it); Pulse
    `clearAllNotifications`; Vehicle `getTotalVehicleReputationBonus` /
    `getActiveVehicleSpeedBonus`. Their now-unused imports went with them.
    Tests that only covered a deleted export were deleted; the legacy-pass tests
    that used `unlockLegacyPassPremium` as a SETUP helper were re-pointed at
    `reconcileLegacyPassSeason`, so the coverage is kept on the live path.
  - `DatingActions.cancelEngagement` deliberately KEPT — a designed half of the
    engagement flow with a stress test but no UI entry point. Annotated in place;
    wiring it is a product decision. (Wired up in WP-Q below, 2026-08-16.)
  - Logger conformance: `lib/social/npcPosts.ts` (3) and
    `lib/config/featureFlags.ts` (1) `console.*` → `utils/logger`. No cycle —
    `logger` pulls only `RemoteLoggingService`, which reads no flag.
  - Noise casts removed: two `orphan as any` in `utils/relationshipValidation.ts`
    (`ChildInfo extends Relationship` with all-optional additions, so both
    directions already typecheck) and `property as any` in `DatingActions`
    (`currentResidence` is a real optional field on `RealEstate`).
  - `EnergyBreakdownModal` used Coffee for the residence row under a comment
    claiming "Home icon was undefined". It is not — lucide-react-native exports
    `Home` (aliased to `House`) and eight other files in this repo import it.
  - `utils/smartNotifications.ts`: the `weeksLived` condition key and its switch
    arm deleted — no notification definition in the file ever set it, and the
    conditions are authored only there.
  - Ratchet: `updaterResultRatchet` measures 100 against RATCHET 101 after the
    deletions — slack 1, inside the file's own ≤5 tolerance, so left as-is.

## Wave 5 — the verified UI-polish tail

- [x] **WP-P: clipping line boxes, the unbounded contacts list, a dev route, and
      a dead mail branch** — four verified audit findings, one disjoint file set.
  - **Scaled font in a RAW line box, swept repo-wide.** The harmful half of the
    raw-pixel debt: `fontScale` clamps at 1.6 and `scale` at 1.8, so a
    `responsiveFontSize.*` / `fontScale()` fontSize paired with a literal
    `lineHeight` grows its glyphs toward the clamp while the box stays put and
    clips descenders on a tablet. A raw fontSize with a raw lineHeight keeps its
    ratio at every size and is NOT this bug — merely unscaled, deliberately left
    alone, since converting those moves layout app-wide.
    8 pairs in 5 files, all scaled at their existing ratio:
    `components/work/workScreenStyles.ts` (`sectionDescription` 24,
    `jobDescription` 16 — the two confirmed findings),
    `components/FirstWeekGuide.tsx` (`stepDescription` 20, `tipText` 16),
    `components/SettingsModalStyles.ts` (`settingDescription` 18),
    `components/settings/BugReportSheet.tsx` and
    `components/settings/DangerZone.tsx` (22 each).
    Guarded by a repo-wide scan in `__tests__/render/hudLegibility.test.ts`
    (the TopStatsBar suite this extends): it brace-matches every style object in
    `components/` and `app/`, blanks nested objects so a sheet does not inherit
    its children's properties, and fails listing any survivor. Allowlist is
    empty. A control test re-runs the matchers over the clipping shape, the
    raw+raw shape and the fixed shape, so a guard that quietly stopped matching
    cannot pass forever.
  - **`components/mobile/ContactsApp.tsx` personal tab → `FlatList`.** The one
    list on the screen with no upper bound (every friend, ex, colleague, child
    and grandchild of a long life), previously `.map()`ed into a ScrollView, so
    mount cost tracked relationship count and never came back down. Restructure
    was clean and NO nesting anti-pattern was introduced: the tab's ScrollView
    is the OUTER scroller (its parent is a plain View holding the four tab
    bodies), and there is exactly one section above the list — so the portfolio
    hero moved to `ListHeaderComponent` verbatim and the empty state to
    `ListEmptyComponent`. The header stays suppressed at zero contacts, matching
    the old `length === 0` branch. `keyExtractor` hoisted to module scope, where
    stability is real; `renderItem` deliberately left inline because
    `renderPersonalCard` closes over `expandedId`, the theme and every handler —
    a `useCallback` around it memoizes nothing (ESLint says so) and only adds
    indirection. Virtualization is the win being bought.
  - **`app/preview.tsx` left static, with the measurement recorded.** The
    obvious improvement — defer its heavy imports behind the existing
    `Platform.OS !== 'web'` check so the release native bundle drops them —
    saves zero bytes: `AchievementToast` and `UIUXOverlay` are imported directly
    by `app/_layout.tsx`, and `GameProvider` / `UIUXProvider` /
    `OnboardingProvider` all arrive through `contexts/AppProviders.tsx`, which
    `_layout.tsx` composes. The route adds no module to the native graph the app
    does not already pull in, so a conditional require would buy nothing and add
    a shape CLAUDE.md §5 warns about. The comment now carries the reason and
    tells the next reader to re-measure rather than inherit the claim.
  - **`contexts/game/actions/MailActions.ts`: dead `lapsed` branch trimmed.**
    `resolveMailDecision` took a `mode: 'chosen' | 'lapsed'` and an optional
    `decorate` callback; both call sites pass `'chosen'` and neither passes
    `decorate`, and the lapse path (`weekly/applyMailLapse.ts`) stamps
    `resolvedAs: 'lapsed'` itself rather than routing through here. Both
    parameters removed, the unused `lapsedCopy` with them, and `resolveDecisionOn`
    simplified to hardcode `'chosen'` with a comment naming who owns the other
    value. `resolvedAs` stays `'chosen' | 'lapsed'` on the type — the lapse path
    still writes it.
  - Verification: `__tests__/render` + `mail` + `social` + `startup` + `actions`
    = 122 suites / 1,275 tests passing. `npm run type-check` and
    `npm run type-check:tests` both clean. ESLint on all changed files: 0 errors;
    warning count on `ContactsApp.tsx` unchanged at 3 vs HEAD, no new warnings
    anywhere.

- [x] **WP-Q: the achievement ladder's week goals, and the engagement's missing
      exit** — the two product-shaped findings deferred out of the earlier
      sweeps, done 2026-08-16.
  - **Storage-vs-derived, investigated first because it decides everything.**
    Achievement COMPLETION is DERIVED — `achievementProgress` runs the
    `progressSpec` closure against live state on every render — while only the
    CLAIM is stored (`claimedProgressAchievements`, per-life, wiped by prestige;
    plus `prestige.claimedAchievementIds`, permanent, which one-shots the GEM
    mint across all lives). So a naive switch to `weeksInThisLife` would have
    left every card reading "Claimed" (that branch is checked first in
    `AchievementsProgress`) but silently dropped the achievement out of the
    `progress >= 1` completed count, out of `isAchievementEarned`, and through
    it out of `getSatisfiedAchievementIds` — which gates the perk unlocks
    (`app/(onboarding)/Perks.tsx`), `LifeGoalsPanel` and the prestige snapshot.
  - **`src/features/onboarding/achievementsData.ts`: 4 week goals + 1 divisor.**
    `beginner_survivor` (4), `beginner_getting_started` (10),
    `milestone_100_weeks`, `milestone_500_weeks` now measure `weeksInThisLife`
    through one helper, `weeksTowardGoal`, which short-circuits to the goal for
    an id already in the per-life claim store — the "|| alreadyRecorded" that
    keeps existing claims honoured. It cannot hand anything out: the claim
    button needs `progress >= 1 && !claimed`. `joyful_life` is the same defect
    inverted — it divided `totalHappiness` (one reading per week PLAYED, 0 at
    the start of every life) by the age-seeded absolute counter, so an age-25
    life's average happiness read ~2 instead of ~85; the divisor is now weeks in
    this life, which can only RAISE the value, so it needs no claim guard.
  - Left alone deliberately: `totalPrisonWeeks`, `healthWeeks`,
    `healthZeroWeeks`, `lifetimeStatistics.totalWeeksWorked` are per-life
    accumulators seeded at 0 (not from age), and the age goals measure age.
    Progression's "Weeks Lived" stat card feeds NO progress bar (that card is
    `liveAchievements.filter(a => a.claimed)`) and is an age-derived lifetime
    figure sitting beside Age, so it stays as it is.
  - Pre-v43 saves have no `lifeStartWeek`, so `weeksInThisLife` falls back to
    the absolute counter and their behaviour is bit-identical to today.
  - **`components/FamilyTab.tsx`: "Call off the engagement"** on the engaged
    partner card, next to Propose / Plan the wedding, calling the fully-tested
    `DatingActions.cancelEngagement` that had shipped with no caller anywhere in
    `components/` or `app/`. Destructive → `Alert.alert` confirm first, the same
    shape as Move In / Try for Baby on that screen, with `style: 'destructive'`
    and the cost (-15 happiness, -20 bond) stated in the prompt. The
    "no UI entry point" comment in `DatingActions.ts` is updated rather than
    left to mislead. NOT added to `components/mobile/ContactsApp.tsx` (the other
    surface with propose / plan wedding): another agent holds that file this
    session.
  - Tests: `__tests__/progression/weekAchievementsPerLife.test.ts` (24 — every
    shipped scenario age completes none of the four at birth, each fires at
    exactly its own week count, a recorded claim survives, pre-v43 fallback, the
    happiness divisor, null-safety, and a source guard) and
    `__tests__/render/familyTabEngagement.render.test.tsx` (5 — the row appears
    only while engaged, confirms before acting, cancel is a no-op, confirming
    clears the engagement and KEEPS the partner).
  - Verification: `progression` + `onboarding` + `src/features/onboarding` +
    `useAchievements` = 33 suites / 582 tests; `render` + achievements/marriage
    stress = 43 suites / 403 tests; `dating` + `social` + `scenarios` +
    `prestige` + `actions` = 97 suites / 1,066 tests. All passing.
    `npm run type-check` and `npm run type-check:tests` clean. ESLint on the 5
    changed/added files: 0 errors, only the 4 pre-existing `require()` warnings
    already in `DatingActions.ts`.

## Deliberately deferred (recorded, not done)

- (empty — the dead-export deletion sweep listed here was done as WP-K above)
