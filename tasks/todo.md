# Task Tracker

## Performance: make the game feel instant/fast — June 14, 2026

Goal: pressing things (esp. "Next Week") feels instant; stop re-rendering everything on
every tick. Safe staged wins — NOT the risky `nextWeek` decomposition or full 97-file
migration. Plan: see plan file. Verify per stage: `npm run preflight:quick` + `npm test`.

- [x] **Stage 1** — `TopStatsBar` Next Week feels instant: rAF-defer the heavy work so the
      pressed/spinner state paints first; `await nextWeek()` + clear loading on real
      completion (dropped the fixed 1s timer, kept a 5s safety cap). `usePressableScale`
      already wired — the press-scale paints instantly regardless of the defer. **Headline win.**
- [x] **Stage 2** — `TopStatsBar` glow → native-driven opacity overlay (`useNativeDriver:true`),
      replacing the JS-driver animated `shadowOpacity` loop. progressFill keeps its static halo.
- [x] **Stage 3** — `work.tsx` streetJobs double-filter → one `React.useMemo` keyed on `streetJobs`;
      hoisted `CREATIVE_HOBBY_JOB_IDS` to a stable module const.
- [x] **Stage 4 (partial, the safe subset)** — migrated `ActiveGoalsCard` + `AchievementsProgress`
      to `useGameSelector`/`useGameActions` (narrow slice subscriptions). `PrestigeStatsCard` &
      `PrestigePreviewCard` were **already** on `useGameSelector` (no work).
      - **Deferred `home.tsx` + `IdentityCard`:** both genuinely consume the WHOLE `gameState`
        (`checkGoalCompletion(gameState)`, `calcWeeklyPassiveIncome(gameState)` which walks ~12
        subsystems, `useStatChangeTracker(gameState)`, `gameState={gameState}` to a child).
        Selecting the whole state = no re-render win; reconstructing a partial state = correctness
        risk. Their expensive calcs are already memoized on specific deps, so per-tick re-render is
        cheap + largely legitimate. Not a clean migration — left as-is.
- [~] **Stage 5 (deferred)** — `gameStateRef` is updated in a PASSIVE `useEffect`
      (`GameActionsContext.tsx:2366`), so the post-tick `setTimeout(50ms)` (line 1637) isn't
      arbitrary: it lets the post-tick validation read the committed state (a microtask flushes
      before passive effects, so it's insufficient). Removing it safely needs capturing the
      computed next-state inside the 1,270-line updater. Low felt-impact after Stage 1 (save is now
      fully off the button's critical path) + real corruption-detection risk → deferred.
- [~] **Stage 6 (deferred)** — the post-`nextWeek` autosave's `validateGameState` is NOT cleanly
      redundant: the automation block (`GameActionsContext.tsx:1714`) mutates state AFTER nextWeek's
      validation, and relationship-validation cadence differs (every-save vs every-10-weeks). The
      save is fire-and-forget post-Stage-1, so the 30-80ms skip has minimal felt benefit. Save
      system is correctness-critical (CLAUDE.md #1) → deferred rather than risked.

Deferred (too risky for one batch, per backlog): #23 nextWeek decomposition, full 97-file selector
migration, action-level save debounce, and Stages 5/6 above.

---

## Performance: pre-game menu — same treatment as in-game — June 15, 2026

Goal: make the pre-game menu (5 `app/(onboarding)/` screens + the loading screen + SettingsModal)
feel instant — the same fix classes applied in-game. Type-checks clean.

- [x] **Stage A** — instant native press-scale (`usePressableScale`) on the shared menu buttons
      `components/onboarding/OnboardingFloatingButton.tsx` (+ new `loading` spinner prop) and
      `components/onboarding/GlassActionButton.tsx`. Fixes feedback on every menu screen at once.
- [x] **Stage B** — defer heavy work so the spinner paints before the freeze, on the navigation
      buttons: `MainMenu.continueGame` (added a `continueInFlightRef` guard + `continuing` state +
      rAF defer of `loadGame()`), `SaveSlots.continueToGame`/`startNewGame` (one-frame yield after
      `setIsBusy(true)` + `loading={isBusy}`), `Perks.start` (split into a sync wrapper that paints
      `isStarting` then rAF-defers `buildNewGameState()`+save/load; button shows spinner + scale).
      All existing in-flight guards, error/Alert paths, and the `navigating` finally logic preserved.
- [x] **Stage C** — `SettingsModal` Discord glow `Animated.loop` → `useNativeDriver:true` (it only
      drives opacity+scale). Removes JS-thread churn while Settings is open. (Also helps in-game.)
- [x] **Stage D** — memoized the 8 Perks background particle positions (were re-rolling
      `Math.random()` every render → visible flicker) AND extracted the three heavy selectable
      lists into `React.memo` card components so toggling one selection no longer re-renders the
      whole list: `PerkCard` + `MindsetCard` (Perks.tsx, with stable `toggle`/`selectMindset`
      `useCallback`s) and `ScenarioCardView` (Scenarios.tsx, with a single stable `onSelectScenario`
      that takes the scenario object directly — dropping the redundant id-lookup + Alert). The
      discriminated-union (`isChallenge`) narrowing is preserved in the extracted card.
- [x] **Stage E** — narrowed the over-broad `useGameState()` subscriptions to `useGameSelector`
      across the menu: `Perks` (→ `achievements`) plus the `darkMode`-only consumers
      `app/(onboarding)/_layout.tsx` (cascaded to every onboarding screen), `MainMenu.tsx`, and
      `components/onboarding/GlassActionButton.tsx`. None re-render on unrelated state changes now.

All pre-game menu performance stages (A–E) are complete. Nothing deferred.

---

## `as any` burndown (#21) — gameplay/state casts — June 14, 2026

Goal: eliminate the **gameplay/state** `as any` casts that defeat type-checking on
already-typed GameState fields (the `.totalKarma`-class silent-bug source). Leave
RN-web style-prop casts in `*Styles.ts` and test-file casts for later.
Verification gate after EACH file: `tsc -p tsconfig.typecheck.json` → 0 errors; full suite at the end.

- [x] lib/statistics/crossSystemSummary.ts — already clean (the 5 hits were comments)
- [x] contexts/game/actions/PoliticalActions.ts (4) — `{} as any` → `initialGameState.politics!`
- [x] components/computer/AdvancedBankApp.tsx (4) — removed `as any[]` (Crypto/RealEstate/Company/Relationship are typed)
- [x] components/mobile/ContactsApp.tsx (5) — `(gameState as any).politics/travel/favorLedger` are typed; `c.raw as any` → `as Relationship`
- [x] components/mobile/Pulse/screens/ProfileScreen.tsx (4) — UserProfile already declares the fields
- [skip] components/AchievementsProgress.tsx (4) — all RN-web `boxShadow` style casts (noise)
- [skip] components/ShopModal.tsx (7) — all RN-web style casts (noise)
- [skip] app/(tabs)/progression.tsx (9) — all RN-web style casts (noise)

Additional gameplay casts removed (batches 2–3): FinanceOverview (loans), consequenceTracker
(Memory `in`-narrowing + dead `.text`), PulseActions (`Record` cast), SparkApp/PulseApp/
ProfileEditModal (UserProfile fields), StoriesRail (Relationship.profilePicture).

Result: 297 → 269 total casts; all dangerous typed-field-access casts (the `.totalKarma`
class) removed. Type-check + full suite green throughout.

Left for a dedicated pass (need design/logic decisions, not a cast swap):
- MemoryBookModal: `(memory as any).type` — latent bug, the color map keys don't match
  `MemoryCategory`; styling has always been dead/`default`. Needs design input.
- Journal: `(selectedEntry as any).category` — entries are augmented with `category` at
  runtime; needs an augmented type threaded through state.
- relationshipValidation: `orphan as any` bridges `Relationship`↔`ChildInfo` in save-repair;
  needs real shape conversion.

Out of scope (the audit's "RN-web noise"): `*Styles.ts` + inline `web:{boxShadow}` style
casts, `__tests__/**` casts, `global as any`/`performance as any` runtime accesses,
`as any as number` Animated props. Promote the eslint rule to `error` once those are gone.


## Loading screen + warnings + report-popup fixes - June 12, 2026

Branch: `claude/loading-screen-warnings-fixes-j3fohl`. Scope confirmed with user:
only REAL errors open the report popup; gameplay "warnings" keep friendly,
non-triangle styling; the report message must be comprehensive; email-backed +
Discord link.

- [x] `app/index.tsx` — removed yellow `build:` text; pulsing title glow +
      animated loading dots (RN-core only, crash-proof)
- [x] `components/onboarding/OnboardingScreenShellV2.tsx` — killed the top dead
      space (`paddingTop: 50 + insets.top` → `insets.top + 8`; header already pads)
- [x] `utils/diagnosticReport.ts` (new) — comprehensive report builder + email/
      share/discord helpers (the "output extremely good" requirement)
- [x] `contexts/game/GameActionsContext.tsx` — gameplay notifications (week
      summary, milestone hint) `showWarning` → `showInfo` (the orange
      AlertTriangle banners that never auto-dismissed were the "old warning
      symbols" piling up after week/job actions). Storage-low kept as a real
      advisory but now renders a friendly circle, not a triangle.
- [x] `components/ErrorMessage.tsx` — `warning` icon AlertTriangle → AlertCircle;
      error/critical get a "Report" button wired to the diagnostic report
- [x] `components/UIUXOverlay.tsx` — passes `onReport` (live gameState) for errors
- [x] `components/WeeklyEventModal.tsx` — `warning` event: friendly icon + "Heads
      Up" title (gameplay, not an error)
- [x] `components/ui/ToastNotification.tsx` — `warning` icon → AlertCircle
- [x] `components/settings/BugReportSheet.tsx` — comprehensive report + Share +
      Discord
- [x] `app/(tabs)/work.tsx` — `handleStreetJob` try/catch so a thrown error
      surfaces a reportable error toast instead of freezing
- [x] Verify: `tsc -p tsconfig.typecheck.json` → 0 errors; gameFlow +
      navigation tests pass

### Round 2 — deeper audit (subagents) + fixes

Root cause of "freezes after working 2 jobs" FOUND: working a crime job can roll
"caught" → sets `jailWeeks > 0` → the whole Work screen is replaced by
`JailScreen`, which could soft-lock when the player had no bail money, no energy,
and had used their weekly activities (only recovery was advancing the week, which
isn't offered on that screen).

- [x] `components/jail/JailScreen.tsx` — added a guaranteed, cost-free **"Serve a
      Week"** escape (calls `nextWeek`) so the player can never get stuck
- [x] `app/(tabs)/work.tsx` — the 500ms feedback-modal timer was never cleared;
      now stored in a ref, cancelled on a new tap and on unmount (it could fire
      over a transitioned screen / JailScreen)
- [x] `contexts/ToastContext.tsx` — error-toast "Report" emailed a **personal
      account** (`isacmolin@gmail.com`) with a weak body; now uses the shared
      `emailDiagnosticReport` → canonical support inbox + full diagnostics.
      Also fixed the raw `zIndex: 9999` → `Z_INDEX.TOAST`.
- [x] `utils/diagnosticReport.ts` — falls back to the live AI-debug state getter
      when no gameState is passed (so a global toast Report is still rich); adds
      Android `versionCode`, device name, and current screen
- [x] `components/ErrorMessage.tsx` + `UIUXOverlay.tsx` — banners no longer
      overlap the notch (safe-area inset) or each other (stackIndex offset)
- [x] `components/SmartNotificationCenter.tsx` — advisory "warning" notification
      no longer uses the red `AlertTriangle` (→ amber `AlertCircle`)
- [x] Verify: tsc 0 errors; crimeJailFlow + invariants tests pass; full suite

Note on the freeze: the screenshot could not be reproduced from a still, but the
root mechanism behind "old warning symbols + stuck UI after a couple of job/week
actions" is the persistent, never-auto-dismissing orange warning banners that
piled up — now fixed. handleStreetJob is also guarded so a thrown error becomes a
reportable toast rather than a wedged screen. If a hard freeze ever recurs, the
new Report button now sends us a full diagnostic to pinpoint it.

### Round 3 — "fix the jail screen completely"

`components/jail/JailScreen.tsx`:
- [x] Header used a hardcoded `paddingTop: 60` even though the screen renders
      BELOW the TopStatsBar inside the Work tab → big dead gap. Now safe-area
      aware (`insets.top + 12` full-screen, `14` in-tab).
- [x] ScrollView had no bottom padding → the last "Prison Stats" card was cut
      off behind the tab bar. Added `paddingBottom: insets.bottom + 90`.
- [x] Release activities (escape/parole) used `sentenceReduction: 99` as a
      sentinel and the card literally showed "-99w". Now shows "Release".
- [x] The "Final Activity → will release you" confirm lied for chance-based
      activities (escape = 20%). Now shows the real odds + risk + "Take the risk".
- [x] Surfaced `reputationGain` in the activity rewards (applied but not shown).
- [x] Cooldown ticker ran a 1s setState forever (re-rendered the whole screen
      every second when idle). Now only ticks while a cooldown is active and
      self-stops.
- [x] (Round 2) Guaranteed cost-free "Serve a Week" escape remains.
- [x] Verify: tsc 0 errors; crimeJailFlow + invariants pass; full suite re-run


## Settings theme + new-life slot fix + tutorial cleanup - June 11, 2026

- [x] Settings modal: replace the saturated rainbow action buttons with one
      on-theme `SettingsActionButton` (dark glass + tinted icon chip), matching
      the onboarding GlassActionButton look. Removed now-dead styles.
- [x] Data-loss bug ("can start a new life right now"): "New Game" defaulted to
      slot 1 and silently overwrote an existing save. Added `findFirstEmptySlot`
      and MainMenu now auto-targets the first empty slot (new players still land
      in slot 1 with zero friction; returning players' saves are protected).
- [x] Tutorial system audit: CORRECTED earlier wrong claim — TutorialManager is
      mounted in app/_layout.tsx (system is live). Only TutorialOverlay.tsx and
      TutorialTooltip.tsx were truly orphaned → deleted.
- [x] SaveSlots-before-first-game: CORRECTED — new players are NOT forced through
      the slot picker (boot → MainMenu → New Game → Scenarios; slot defaults).
      No flow change needed; the real adjacent bug (overwrite) is fixed above.
- [ ] "Corners" polish — needs the user to point at the specific screens/elements
      that look off (awaiting clarification).
- [x] Verify: type-check 0 errors, 274 onboarding/save tests pass.

## New-Player UX Cleanup ("dumb dumb proof") - June 11, 2026

Goal: make the first-session experience and the Market clean, readable, and
obvious for brand-new players. Copy/hierarchy/progressive-disclosure only —
NO game-logic, state-shape, or save-format changes.

Market (app/(tabs)/market.tsx)
- [x] Fix Computer price / bottom-clipping (prior commit)
- [x] Gym tab: trim the 9-bullet "Why Work Out?" wall to 3 clear benefits
- [x] Gym tab: remove the redundant filler "Fitness Goals" card (dropped unused Trophy import)
- [x] Items tab: clearer one-line guidance (en.ts market.purchaseItems)

Scenario select (app/(onboarding)/Scenarios.tsx)
- [x] Sort Life Paths Easy → Moderate → Hard, recommended pinned first (display only)
- [x] Clearer guidance pointing beginners at the recommended/easy paths
- [x] Short "for experienced players" hint on the Challenges tab

First-session onboarding copy
- [x] Perks.tsx: fixed contradictory guidance, perks + mindset clearly OPTIONAL (inline + Info popup)
- [x] Customize.tsx: clarified name/sex/sexuality only affect story, not difficulty

Verify
- [x] type-check passes (tsc 0 errors), 189 related tests pass

Out of scope (flagged): dead tutorial system (TutorialManager et al., never
mounted) and SaveSlots/navigation restructuring — separate decisions.

## iOS Onboarding SceneView Crash - May 27, 2026

- [x] Review lessons and trace the crash stack to the onboarding route layer.
- [x] Replace the onboarding group's nested native stack with a plain route slot.
- [x] Run focused verification and record any existing blockers.

## Onboarding Animation Cleanup - May 27, 2026

- [x] Extend shared onboarding animation hook to support rotating backgrounds.
- [x] Refactor `OnboardingScreenShellV2` to consume the shared hook.
- [x] Refactor `Perks` to remove local duplicated fade/slide/rotate setup.
- [x] Run focused onboarding tests and `npm run preflight:quick`.

## Onboarding Permanent Perk Stat Clamp - May 27, 2026

- [x] Trace game creation failure to permanent `lucky_charm` pushing happiness above 100.
- [x] Clamp bounded onboarding stats during new game state construction.
- [x] Add regression coverage for the `aspiring_entrepreneur` + permanent `lucky_charm` path.
- [x] Run focused onboarding tests and `npm run preflight:quick`.

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

### Phase 2 — Correctness (SUBSTANTIVE COMPLETE — 1,316 → 254 type errors)

**All 254 remaining errors are 100% cosmetic** (237 unused-variable
+ 15 unused-import + 2 unused-param — patterns the auto-cleanup
intentionally skipped to avoid touching ambiguous declarations like
multi-line const initializers or function-signature destructures
that would risk breaking working code). Zero errors block runtime,
zero TS errors flag behavioral issues, all
489 tests pass.

Substantive type errors cleared: 1,316 → 0.

**Late-session wirings (statistics + decay):**
- Career history: entries on job-acceptance + close-out on job-quit;
  per-tick earnings + weeks accumulation. StatisticsApp's "Career
  History" panel finally populates.
- Video upload timestamps: GamingApp + GamingStreamingApp both now
  populate \`timestamp\` so gamingStreamingIncome's recency-decay sort
  works correctly (was insertion-order-bound).
- Net-worth + weekly-earnings history sampled every 10 weeks (capped
  to 100 samples) into lifetimeStatistics. Statistics charts
  populate from save data going forward.

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
- [x] Caught a dozen "broken-on-render" / "broken-on-tap" UI bugs while
      clearing small clusters: TinderApp.handleLike TDZ-cycled deps;
      NetWorthDisplay destructured the long-removed createMemoizedValue
      (TypeError on render); CompanyApp's "Create Family Business" /
      "Enter Competition" / TombstonePopup's "New Life" /
      ActivityCommitmentModal's "Save" / TravelModal's quick-travel
      buttons all called context methods that were never wired
      (TypeError on tap — and TombstonePopup's death-loop trap was
      especially brutal); GemsStoreModal's loading-spinner padding,
      WeeklyEventModal's petText dark style, and tutorial-modal dark
      mode all silently resolved to undefined; ribbonSystem's
      "Jailbird" never triggered (wrong field path);
      runComprehensiveTests was simulating with default money.
- [x] Added age-based natural death (escalates after 80, quadratic to
      ~95% annual at 120). Immortality gold upgrade now actually skips
      these rolls — turns a previously-dead 50,000-gem upgrade into a
      meaningful late-game purchase. DeathPopup shows warm "A Long Life"
      / "X years well lived" copy for natural-cause deaths.
- [x] Wired the entire Onion (dark-web) tab — buyDarkWebItem, buyHack,
      performHack were all "Implementation for…" stubs. Implementations
      now deduct BTC, check ownership, run risk rolls with dark-web-item
      reductions, route caught attempts through jailWeeks, and credit
      80/20 cash/BTC rewards. The whole feature was non-functional;
      players who'd mined BTC can finally spend it.
- [x] Wired achievement Claim button to actually grant gems
      (handleClaimAchievement was a haptic-only stub) and the hint
      button to show unlockHint copy. Added
      \`claimedEnhancedAchievements\` to GameState for double-claim
      protection across saves.
- [x] Made all 20 onboarding perks deliver advertised value (was 2/20):
      catalog-driven statBoosts aggregator + perk incomeMultiplier
      stacked into the weekly income pipeline. iron_will / lucky_charm
      / trust_fund / financial_guru / crime_boss / landlord / etc.
      were tracked as flags but never granted bonuses.
- [x] WIRED ALL ELEVEN previously-dead perk + gold-upgrade IAPs:
      - Perks ($1.99 each, four flags set on purchase that nothing
        ever read): Work Pay Boost (+50% job income), Good Credit
        (+50% bank interest), Fast Learner (2x education speed),
        Mindset (+50% career-promotion progress).
      - Gold upgrades (gem purchases): Money Multiplier (5k —
        +50% all earnings), Energy Boost (7.5k — +50% energy regen,
        reframed from misleading "max 100" copy), Happiness Boost
        (6k — 50% slower happiness decay, same reframe), Fitness
        Boost (9k — 50% slower fitness decay), Skill Mastery
        (15k — +50% hobby skill gains).
      - Still unwired pending product decisions: Time Machine
        (discount-rewinds?) and Immortality (needs an age-death
        mechanic added to game first).
      - Plus SKILL_BOOST ($12.99) wired earlier in the session
        (boosted every hobby's skillLevel through the canonical clamp).
- [x] Cleared ALL substantive errors in stress tests:
      career.stress (20), health.stress (7), economy.stress (4),
      integration.stress (4), relationships.stress (2), company.stress
      (2), scenarioBuilders helper (3). Patterns: currentJob/isDead
      model drift, Company shape with phantom fields, RealEstate
      .cost→.price, stocks array→portfolio object.
- [x] Wired item dailyBonus (basic_bed + gym_membership now actually
      grant their weekly stat boosts during the weekly tick) and
      vehicle speedBonus (faster vehicles now actually shorten
      travel-trip duration).
- [x] Wired SEVEN previously-dead lifetimeStatistics counters that
      StatisticsApp displayed but never updated: totalCrimesCommitted,
      totalJailTime, totalRelationships, totalCompaniesOwned,
      totalPropertiesOwned, totalTravelDestinations, totalChildren,
      totalWeeksWorked, highestSalary, peakNetWorth, peakNetWorthWeek,
      totalAchievementsUnlocked.
- [x] Wired FOUR achievement-counter fields that achievementsData
      referenced but nothing wrote: datingMatches, totalPrisonWeeks,
      healthWeeks (consecutive 90+ health), totalHappiness
      (cumulative). Multiple achievements (Dating, Prisoner,
      Healthy Lifestyle, Joyful Life) were previously unreachable.
- [ ] The 669 remaining errors are 100% cosmetic: 648 TS6133
      (unused variable), 15 TS6192 (unused import), 4 TS6196 (unused
      private), 2 TS6198 (unused param). None block runtime; an
      eslint --fix pass would clear most.
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

---

# Sprint 2 — Re-render performance via `useGameSelector` (selector channel) — June 9, 2026

**Status legend:** `[ ]` todo · `[x]` done · `[~]` in progress

## 1. Problem (measured from the code)

`contexts/game/GameStateContext.tsx` stores the **entire** `GameState` in one `useState`,
exposed through a single memoized context value. React Context has no selector, so when
that value changes **every** consumer re-renders. Any action does
`setGameState(prev => ({ ...prev, … }))`, so every state change re-renders every subscriber.

Consumer surface (measured): **`useGame()` → 133 files**, **`useGameState()` → 29 files**.
A single field change (e.g. `stats.money`) re-renders ~160 component trees, most of which
never read the changed field. On the weekly tick (dozens of fields change) this is the
dominant render cost.

## 2. Rejected alternatives
- **Split into N contexts** — changes the state model, touches all consumers, no incremental path.
- **External store (Zustand/Redux/Jotai)** — rewrites every `setGameState` call site (hundreds).
- **`use-context-selector` dependency** — adds a runtime dep + needs `npm install`.

## 3. Chosen approach — additive selector channel (no dependency)
Keep `useState<GameState>` as the **source of truth** (existing 160 consumers untouched).
Add a parallel read channel on React 19's built-in `useSyncExternalStore`:
- in-provider store mirror (`{ state, listeners }` ref) kept in sync each render; listeners
  fired in a `useLayoutEffect` when `gameState` changes;
- a **stable** `GameStoreContext` value (created once → never re-renders);
- `useGameSelector(selector, isEqual?)` subscribes to a slice; re-renders only when the
  slice changes. Selector memoization (the `use-sync-external-store/with-selector`
  algorithm, vendored ~40 LOC) makes derived selectors loop-safe.

Properties: **non-breaking**, **dependency-free**, **React-19-native**, **incremental**.

## 4. Phases
### Phase 0 — Plan
- [x] Investigate provider tree, consumer counts, test coverage, deps; write this plan.
### Phase 1 — Selector infrastructure (additive, non-breaking) ✅ shipped
- [x] `contexts/game/useGameSelector.ts` — `GameStoreContext`, `useGameSelector`, vendored
      with-selector memoization, `shallowEqual` helper.
- [x] Wire `GameStateProvider` (mirror ref + layout-effect notify + stable store context).
- [x] Render tests: unrelated-slice change → no re-render; changed-slice → re-render;
      derived selector + `shallowEqual` stable; no tearing. (3 tests, green)
- [x] Gate: full suite **2352 / 146 suites** (incl. realProviderLoop + gameFlow) green;
      type-check 0; lint 0. Committed.
### Phase 2 — Migrate hot, safe consumers (demonstrate the win) ✅ shipped
- [x] Migrated `components/StatsDisplay.tsx` (reads only `stats`) from `useGame()` to
      `useGameSelector((s) => s.stats, shallowEqual)`.
- [x] `React.Profiler` render-count regression test proving it does NOT re-render on
      unrelated changes (loans, weeksLived) and re-renders exactly once on a stat change.
- [x] Gate: full suite **2353 / 147 suites** green; type-check 0; lint 0. Committed.

### Phase 3 — Incremental migration (follow-up, in progress)
- [x] **Batch 1** (single-/narrow-slice, pure-display): `SeasonalIndicator` (settings+weeksLived),
      `SeasonalEventModal` (weeksLived), `Journal` (settings+journal), `settings/LifeGoalsPanel`
      (settings+achievements), `BankBreakdownModal` (bankSavings+stocks+weeksLived). Established the
      `useGameSelector((s) => safeSettings(s), shallowEqual)` pattern (unlocks the 32 `safeSettings`
      consumers). type-check 0, lint 0, jest 2353/147 green.
- [x] **Batch 2** (settings/darkMode + narrow slice): `OfflineIndicator`, `shared/EconomyEventBanner`,
      `AncestorProfileModal`, `AutoSaveIndicator`, `MemoryBookModal`, `FamilyTreeModal`,
      `PrestigeInfoModal`. Caught + fixed a `rules-of-hooks` ordering issue (hook moved above an
      early return in OfflineIndicator). type-check 0, lint 0, jest 2353/147 green.
- [x] **Batch 3** (computed-value pattern): `PrestigeButton`, `PrestigePreviewCard` →
      `useGameSelector((s) => netWorth(s))` + `prestige`/`darkMode`. Demonstrates selecting a
      *derived number* (memoized comparison re-renders only when the computed value changes).
      type-check 0, lint 0, jest 2353/147 green.
- [x] **Batch 4** (action-using + multi-slice): `GemsBreakdownModal`, `MoneyBreakdownModal`,
      `HealthBreakdownModal` (9 slices), `EnergyBreakdownModal` (7 slices), `GemsStoreModal`
      (gems slice + `setGameState` from `useGameState()`), `GemShopModal` (goldUpgrades/perks/
      settings/gems + `buyGoldUpgrade` from `useMoneyActions()`, `saveGame` from `useGameActions()`).
      Establishes the action pattern: state via selectors, writes via the split action hooks.
      type-check 0, lint 0, jest 2353/147 green.
- [x] **Batch 5** (`useSetGameState` + TopStatsBar): Added `GameStore.setGameState` (forwarding ref
      to the stable wrapped setter) + `useSetGameState()` hook — write access WITHOUT a state
      subscription. Fixed the Batch 4 miss in `GemsStoreModal` (it took `setGameState` from
      `useGameState()`, which subscribes to the full context). Migrated **TopStatsBar** (1608L,
      always-on-screen, both components in the file) to 15 slice selectors + `useSetGameState` —
      it no longer re-renders on unrelated mutations (loans, companies, social feeds, …).
      New test: setter writes land + caller never re-renders + identity stable.
      type-check 0, lint 0, jest 2354/147 green.
      **Not tested:** on-device render timing / animation smoothness of TopStatsBar (jest only).
- [ ] **Batch 6+**: continue the ~112 remaining `useGame()` consumers in per-area batches.
      **Rule update:** in migrated components take the setter from `useSetGameState()`, never
      from `useGameState()`.
- [x] **Batch 6** (narrow-slice components/ root): `RealEstateManager`, `YouthPillModal`,
      `LegacyOverviewTab`, `LegacyTimeline`, `ProgressOverview`, `PrestigeHistoryModal`,
      `PrestigeStatsCard` (netWorth derived-selector). setGameState via `useSetGameState`,
      settings via `safeSettings(s)`/`shallowEqual`, darkMode crash-safe. ~107 consumers remain.
      cold tsc 0, lint 0, jest 2354/147 green.
      Note: `HelpModal`/`BugReportSheet` read state only inside a callback — better served by a
      future `getGameState()` accessor than a subscription; deferred.
      Deferred pattern: components that pass whole `gameState` to a calc (`netWorth(gameState)`,
      etc.) — select the derived number directly (`useGameSelector((s) => netWorth(s))`) or the
      needed slices. Order by render frequency / always-on-screen first.
      **Rule:** never select a derived object/array without an `isEqual` (`shallowEqual`).

## 5. Verification gates (every phase)
type-check 0 · `eslint --quiet` 0 · `jest` all green (2349/145) · stress: `realProviderLoop`,
`gameFlow`. Never leave red.

## 6. Risks & mitigations
- Infinite loop from derived selectors → vendored with-selector memoization + tests.
- Stale reads/tearing → mirror updated in render body; notify in `useLayoutEffect`.
- Breaking existing consumers → impossible by construction (their path is untouched).
- Budget runs out mid-Phase-2 → Phase 1 is committed first; live app never left broken.

