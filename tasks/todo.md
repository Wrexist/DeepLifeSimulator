# Task Tracker

## 🎨 Vitals symmetry + Week Summary toggle + Heads Up Liquid Glass redesign (2026-07-09)

Branch: `claude/vitals-ui-notifications-redesign-e3262m`. User screenshots showed
(1) vitals text wrapping ("Happine ss", "10 0"); (2) a Week Summary popping up every
week with no way to turn it off; (3) frequent, plain "Heads Up" event popups.

### 1. Vitals — symmetrical & scale to all resolutions
- [x] `app/(tabs)/health.tsx`: label now `numberOfLines={1}` + `adjustsFontSizeToFit`
      (never wraps "Happiness"); value column widened scale(30)→scale(38) with
      `numberOfLines={1}` (holds a 3-digit "100"). Row stays symmetric everywhere.

### 2. Week Summary — on/off switch in Settings
- [x] `app/(tabs)/_layout.tsx`: weekly result sheet now gated on
      `settings.weeklySummaryEnabled` (both where `resultWeek` is set and on
      `showWeekResult`). Was unchecked → showed every week.
- [x] `components/SettingsModal.tsx`: relabelled "Monthly Summary / every 4 weeks"
      → "Week Summary" / "Show the weekly recap after each week. Turn off to skip
      it." (reuses the existing `weeklySummaryEnabled` flag — no schema change).

### 3. Heads Up popups — Liquid Glass redesign + far less frequent
- [x] `components/WeeklyEventModal.tsx`: rebuilt with the game's Liquid Glass look
      (BlurViewFallback frosted-dark card, accent icon chip + soft top glow + top
      highlight, full accent border per Hard Rule 7 — no side stripes,
      `getPlatformShadows` from the glass design system). ALL resolve logic
      preserved verbatim. Also fixed the wrong "Error" title on bad events → "Bad
      News".
- [x] `lib/events/cliffhangerEvents.ts`: roll chance 0.32/0.22 → 0.10/0.07 (+ doc
      comments corrected).
- [x] `lib/config/gameConstants.ts`: event gaps early 3→4, mid 6→8 (late kept 8 so
      `engine.test.ts` rate bounds hold); `engine.ts` mid-game chance 0.15-0.20 →
      0.10-0.13. Combined cadence now ~1 popup / 10–15 weeks.

### Verify
- [x] `npx tsc -p tsconfig.typecheck.json` → **0 errors**.
- [x] `jest lib/events/__tests__/engine.test.ts` (7/7) + cliffhanger equivalence
      (11/11, snapshots green) + `__tests__/render/` incl. new
      `WeeklyEventModal.render.test.tsx` (64/64) + criticalPaths (44/44).
- [x] ESLint on all touched files → 0 errors (added the modal's icons to the
      jest.setup.js lucide mock, matching the CommunityRewardPopup precedent).

### Follow-up (2026-07-09, round 2)
- [x] **Blue info banner removed** (`components/UIUXOverlay.tsx`): the full-width
      blue "ⓘ … ✕" bar covering the header every week was `ErrorMessage` at
      `severity: 'info'` (weekly subsystem-notification flush + social actions).
      UIUXOverlay now skips `info`-severity banners entirely — warning/error/
      critical still surface; weekly/social updates remain in game state + the
      notification center. Never renders that bar again.
- [x] **Bottom tab bar lowered/tightened** (`app/(tabs)/_layout.tsx`): trimmed the
      oversized inset padding (−scale(10), keeps ~24pt home-indicator clearance)
      and dropped the base height scale(70)→scale(56) + paddingTop 12→8, so the
      icon row sits lower with no dead space beneath. Verified: banner-cap test +
      screens render (home/_layout mount) green, type-check + lint clean.
- [x] **Visual preview** of the redesigned reservation-fee Heads Up card delivered
      as a published artifact for the user to eyeball before rebuilding.

### Follow-up (2026-07-09, round 3)
- [x] **Work tab is now one page-scroll** (`app/(tabs)/work.tsx`): the Current Job
      hero card + the Street/Career/Crime sub-tabs used to be pinned above a small,
      cramped inner ScrollView (only ~1 job visible, "Janitor" cut off behind the
      tab bar). Wrapped the whole thing in a single page-level `ScrollView` (hero +
      tabs + list scroll together); moved `SkillTalentTree` (an overlay) out of the
      scroll; added `local.tabContent` for the list's horizontal padding. Verified:
      type-check + lint clean, work screen render green.
- [x] **Treatment-Successful popup redesigned** (`components/CureSuccessModal.tsx`):
      rebuilt in Liquid Glass (frosted dark card, green success accent, icon chip +
      top glow + highlight — same family as the event card). Fixed the real layout
      bug where the fixed "Great!" button rendered ON TOP of the content: header
      and button are now fixed, only the cured list scrolls (bounded via
      `flexShrink`), so the button can never overlap. Cut the noise — dropped the
      generic 4-item "Health Benefits" list and the "Health Tips" box (whose
      bullets rendered as corrupt `�`); kept the essentials (what was cured) + one
      concise reassurance line. New render test (2/2). `Check` added to jest mock.

## 🔵 Fix: spamming "Next Week" floods screen with stacked blue info banners (2026-06-21)

User spammed the green "Next Week" button → screen covered in overlapping blue
info banners (+ warnings). Root cause: weekly notifications route through
`UIUXContext.showError` (severity `info`), rendered by `UIUXOverlay` as
`ErrorMessage` banners staggered `stackIndex * 96px`. Notification ids embed the
week number (e.g. `spark-tick-${nextWeeksLived}-${i}`) so each week produces NEW
ids — the dedup-by-id only collapses within one flush. Unlike the Toast system
(capped at 3), `errorStates` was UNBOUNDED, so a burst of advances piled up
banners across the whole UI before the ~5s auto-dismiss could clear them.

- [x] 1. Cap simultaneously-visible banners in `UIUXContext.showError` (the single funnel) via exported pure `capErrorBanners`, preserving real error/critical over transient info/warning advisories.
- [x] 2. Verify type-check (clean) + unit test `__tests__/components/uiuxBannerCap.test.ts` (4/4) + `realProviderLoop.stress` (7/7, drives 500 real nextWeek ticks).
  - Caught + fixed a `slice(-0)===slice(0)` edge case during testing (would have kept the whole advisory list when real errors filled the cap).

## 🧹 Stability hardening audit pass (2026-06-21)

Ran static `audit:weekly` (green, 1 minor warn) + 3 parallel review agents (spam/
unbounded-queue, crash/stability, week-loop/game-state). Fixed the highest-value,
lowest-risk findings — all in the "won't crash / won't flood / won't leak" family:

- [x] **Week-loop brick vectors (HIGH):** crypto/banking/dark-web weekly ticks ran
  inside the `setGameState` updater with no inner guard; on a partially-migrated
  save (slice present but an optional array missing) an unguarded `.map()`/`.length`/
  spread threw → outer catch returns prevState → "Next Week" silently soft-locks.
  Guarded the optional arrays at the root: `lib/crypto/weeklyTick.ts` (coinMarkets×2,
  dcaRules, banking.accounts), `lib/banking/weeklyTick.ts` (accounts),
  `lib/darkweb/weeklyTick.ts` (activeJobs/recentEvents normalized at entry).
  Regression test `__tests__/refactor/partialMigrationTickResilience.test.ts` —
  which CAUGHT a 2nd crypto crash vector the audit missed (weeklyTick.ts:303).
- [x] **Death haptic double-fire (HIGH, same class as banner bug):** `haptic.error()`
  fired INSIDE the death branch of the tick updater (runs 2× under React 19
  StrictMode / speculative renders). Moved to the single post-updater `deathTriggered`
  block. `GameActionsContext.tsx`.
- [x] **MotiStub animation-loop leak (HIGH):** the shared `MotiView` primitive
  (LoadingSpinner, AnimatedProgressBar) started `Animated.parallel`/`loop` with no
  cleanup → loops never stopped on unmount (same leak class as the fixed TopStatsBar
  one). Now captures + stops the composite on cleanup. `components/anim/MotiStub.tsx`.
- [x] **IdentityCard white-screen guards (HIGH):** unguarded `stats.money`,
  `stats.{happiness,health,energy}`, `date.age` on a card that renders
  unconditionally on home — optional-chained (file already guarded the same fields
  elsewhere). `components/IdentityCard.tsx`.
- [x] **WeeklyEventModal crash guard (MED):** `gameState.pets.find` → `pets?.find`;
  this modal mounts outside the home ErrorBoundary on any weekly event.
- [x] **Enact-policy double-enact exploit (HIGH):** preconditions read the stale
  snapshot arg, so a rapid double-tap enacted the policy twice (duplicate entry +
  double money/stat bonuses). Re-check + no-op inside the updater on fresh `prev`.
  `contexts/game/actions/PoliticalActions.ts`.

Verification: `type-check` clean; full non-stress suite 1786 passed; realProviderLoop
stress 7/7 (drives 500 real `nextWeek` ticks); static `audit:weekly` green.

## 🧹 Stability hardening — round 2 (deferred items, 2026-06-21)

Cleared every deferred item from round 1:

- [x] **Determinism (HIGH):** subsystem weekly ticks (crypto/dark-web/politics/stocks)
  used live `Math.random()` inside the `setGameState` updater → React 19's double
  invocation drew different numbers (committed outcome was whichever render it kept)
  and outcomes weren't reproducible from the save. New seeded helper
  `utils/seededRoll.ts` (`makeWeeklyRoll(weeksLived)` → keyed [0,1) roll); all four
  call sites now share one `weeklyRoll`. The ticks were already written to be
  deterministic with a seeded `rollFor`. Test `__tests__/utils/seededRoll.test.ts`.
- [x] **Dark-web duplicate-job double-tap (MED):** `startJob` now rejects a second
  active job for the same template (`lib/darkweb/operations.ts`). Test added to
  `operations.test.ts`.
- [x] **Pet sleep/play double-buff (LOW):** the once-per-week / energy gates now
  re-check inside the `updatePet` updater on fresh `p` (`PetActions.ts`).
- [x] **setTimeout setState-after-unmount leaks:** routed through the auto-cleaning
  `useTimerManager` hook — `DMSystem`, Spark `ChatScreen`/`SwipeScreen`, `PetApp`,
  `ContactsApp`, `GamingApp`, `GamingStreamingApp`, health tab; market-tab tutorial
  scroll uses a local `clearTimeout` in its effect.
- [x] **More partial-migration crash guards (MED):** `discoverySystem` (date/stats),
  `applyEducationProgression` (educations `|| []`), mining tick call sites
  (`cryptos || []`), `PrestigeStatsCard` (prestige sub-fields).
- [x] **Death-week phantom income (LOW):** `weekResult` income/expenses/net zeroed
  when death voids the week's money (`GameActionsContext.tsx`).
- [x] **Dead code removed:** unused, unbounded `contexts/game/social.ts`.

Intentionally NOT changed: the relationship breakup/disappointed roll's `relIdx >= 20`
quirk is documented "PRESERVED VERBATIM" for legacy parity (equivalence snapshot
test) — only affects a player with >20 relationships; left as-is by design.

Verification: `type-check` clean; non-stress suite 1791 passed (4 pre-existing
empty-helper-file artifacts, not real failures); realProviderLoop + legacyPulse­Politics
stress 51/51; static `audit:weekly` green.

## 🩺 Reduce week-advance popups + health issues on player card (2026-06-20)

User: game freezes on "Next Week" (too much happening). Remove health status
popups → show issues + fixes on the player card. Make life-moment / "heads up"
weekly-event popups far rarer.

- [x] 1. Stop auto Zero-Stat (health/happiness) popup on week advance — keep death counters.
- [x] 2. Stop auto Sickness modal on new disease (still viewable via TopStatsBar badge). Update snapshot.
- [x] 3. Remove unused ZeroStatPopup render from `app/_layout.tsx`.
- [x] 4. Add "Health Issues" section to player card (`IdentityCard.tsx`).
- [x] 5. Make life moments rare (`lifeMomentGenerator.ts`).
- [x] 6. Make weekly "Heads Up" events rarer (`gameConstants.ts`).
- [x] 7. Keep tests green (`engine.test.ts` → pity-based generation test).


## 🔵 Community (Discord) money-reward popup (2026-06-19)

Goal: a sleek, subtle in-game popup offering a one-time **$5,000** money reward for joining the
Discord. Unify the existing Settings reward (was 500 gems) onto the same **$5,000** cash reward,
sharing the existing `discord_reward_claimed` flag so a player can claim it exactly once from either
entry point.

- [x] `lib/config/gameConstants.ts` — added `DISCORD_JOIN_REWARD_MONEY = 5000`.
- [x] `components/CommunityRewardPopup.tsx` — new presentational popup modeled on `DailyRewardPopup`
      (scale+fade, dark/light palette, double-tap guard, a11y). "Join & Claim" + quiet "Maybe later".
- [x] `app/(tabs)/home.tsx` — subtle one-time trigger (tutorial done + ≥4 weeks + not while
      daily-reward/welcome-back popups show + not claimed + not snoozed via new `discord_popup_seen`),
      grant via `updateMoney`, persist flags, open Discord, mount under `<Suspense>`.
- [x] `components/SettingsModal.tsx` — switched the Discord reward from 500 gems → `$5,000` cash
      (grant via `updateMoney` + button label + reward-popup copy/icon).
- [x] `__tests__/render/CommunityRewardPopup.render.test.tsx` — render smoke + `$5,000` copy assert.
      (Also added MessageCircle/DollarSign/Gift to the `jest.setup.js` lucide mock.)
- [x] Verified: type-check 0 errors · render suite 20/20 green · ESLint 0 errors (warnings pre-existing).

## 🟢 H3 — nextWeek decomposition (2026-06-18)

Roadmap H3: instrument the ~1,475-line weekly tick into measured phases, then optimize the hot ones.

### Phase 1 — instrument (DONE)
- [x] `utils/tickProfiler.ts` — no-op-by-default per-phase profiler (mean/p95/max over a rolling
      window). Enabled by `EXPO_PUBLIC_PROFILE_TICK=true` or `setEnabled(true)`; `performance.now()`
      with a `Date.now()` fallback. Unit-tested.
- [x] 8 instrumentation points in `nextWeek` (`beginTick` + 7 phase marks + `endTick`):
      setup_stats_career_edu → income_engagement_finance_family → crime_events →
      disease_pets_vehicles → crypto_banking_darkweb → stocks → politics.
- [x] Zero behaviour change verified: 308 subsystemEquivalence snapshots unchanged (profiler off by
      default = inert marks); integration test proves all 7 phases fire through a real tick.
- [ ] NOTE: the final commit (return-object build — applyDeathRibbon / applyLifetimeStatistics /
      applyAutoCheckpoint) is the untimed remainder in Phase 1; split it out in Phase 2 if the
      measured phases don't account for the bulk of the ~85ms.

### Phase 2 — optimize (data-driven)
- [x] Node profile captured (`__tests__/refactor/tickProfile.manual.test.ts`, skipped): every
      instrumented phase is sub-ms (total ~0.9ms, empty portfolio) → the device ~85ms is NOT in
      these phases' JS logic. Prime suspects: the UN-instrumented pre-updater (`simulateWeek` +
      `buildPreRolls`) + commit (`applyAutoCheckpoint`); populated-state subsystem work; Hermes.
- [ ] Extend instrumentation to the pre-updater + commit (the un-measured ends) so a device profile
      is complete. (Commit needs the return-object → `const` refactor.)
- [ ] Capture a DEVICE profile (`EXPO_PUBLIC_PROFILE_TICK=true` in-app) — Node/jest can't pin the
      device hot spot (V8 ≠ Hermes; 1ms jest clock; empty test portfolio).
- [ ] Optimize the hottest phase(s), each behind the subsystemEquivalence + tick-stress tests.

### Phase 3 — yield between phases (OPTIONAL)
- [ ] Only if Phase 2 data shows the tick blocking the JS thread enough to warrant async yielding.

---

## 🔴 ACTIVE SPRINT — P0 code-bug fixes (2026-06-18)

Source: `tasks/master-punchlist-2026-06-18.md` §A (9 P0 code bugs) + `tasks/salvaged-audits/*`.
Rules: every fix folds side-effects into the atomic `setGameState` updater; tests use
`createTestGameState()`; protected files (`GameActionsContext.tsx`, `saveValidation.ts`, `types.ts`)
get extra care + the `game-state-reviewer` / `save-system-auditor` subagents after changes.
Run `npm run preflight:quick` between batches. **Sequence: isolated crashers → save path → economy
atomicity → core game loop (riskiest) last.**

### Batch 1 — Isolated guards — ✅ DONE (2026-06-18) · ⚠️ RE-GRADED after source verification
> **Verification finding:** none of these is the P0 *crash* the audit claimed. An out-of-bounds pre-roll
> returns `undefined`, and `undefined < chance` is `false`, so the accident/complication simply never fires
> for entities past the cap — no NaN, no crash (the dangerous severity math sits *inside* that `if`).
> `Math.random()` never returns 1.0, so the severity index can't overflow either. C2's `undefined` leak
> can't occur on JSON-loaded saves. **Re-graded: C2 → defensive / hard-rule fix; C3/C4 → P2 consistency.**
> Fixed anyway (cheap, correct, removes the fragility). Confirms the audit over-graded severity → verify
> each remaining P0 against real code before fixing.
- [x] **C2** Null/undefined/non-object relationship filter via type guard (also closes a `CLAUDE.md` "no unions without guards" violation) — `GameActionsContext.tsx:890`
- [x] **C3** Vehicle accident pre-roll index wrap + severity index cap — `weekly/applyVehicles.ts:56–59`
- [x] **C4** Disease complication/progression pre-roll index wrap — `weekly/applyDiseases.ts:181,210,212`
- [x] Regression test `__tests__/refactor/weeklyTickBounds.test.ts` — proves vehicle #11 / disease #21 now roll (would fail pre-fix); asserts no NaN
- [x] `npm run type-check` clean · **403 tests pass** (incl. 308 equivalence snapshots unchanged → no behavior drift ≤cap)
- [ ] ⚠️ Behavior note for review: C3/C4 now make vehicle #11+/disease #21+ roll (slightly less player-favorable). Flag if the cap was intended as a feature.

### Batch 2 — Save path — ✅ VERIFIED, NO FIX NEEDED (2026-06-18) · ⚠️ both over-graded
> **C7 is not a bug:** `repairGameState(currentState)` at `GameActionsContext.tsx:200` mutates its input
> **in-place** (confirmed `saveValidation.ts:894–908` — copies the repaired clone back onto the original).
> `currentState === gameStateRef.current`, and no React commit happens between line 200 and the re-validate
> at line 210 — so line 210 reads the **already-repaired** state, not stale. The async `setGameState` only
> refreshes React's reference. (The audit's own gamestate-P1-5 describes this copy-back, contradicting P0-3.)
> **C6 is not active:** only two callers pass `autoFix=true` — `conflict.remoteState` (2467) and `parsed`
> (2693) — both throwaway **deserialized** objects, never live React state. The in-place mutation is
> intentional there; changing the contract would break the load autofix.
> **Running tally: 5/5 audit P0s verified over-graded (C2/C3/C4 + C6/C7).**
- [x] C6 verified — not active (throwaway-object callers); no code change.
- [x] C7 verified — not a bug (in-place repair → revalidation reads repaired state); no code change.
- [ ] (optional P3) collapse the redundant double `repairGameState` call in `saveGame` — deferred, low value.

### Batch 3 — Economy — ✅ VERIFIED, NO P0 (2026-06-18) · ⚠️ all over-graded
> **C8:** exceeding `MONEY_CEILING` (`MAX_SAFE_INTEGER`) via a 10× bonus needs ~1e14 weekly income →
> unreachable. Real residue: lucky/streak not counted in `totalMoneyEarned` → **P2 stats accuracy**.
> **C9:** the 3 `launchIPO` `setGameState` calls are synchronous → React-batched → atomic; `updateMoney`
> is already ceiling-safe. **P2/P3 style** inconsistency with `acceptAcquisition` (the atomic model).
> **C5:** XP calls are batched + pure (StrictMode discards one invoke); `gainCrimeSkillXp` already halves XP
> on failure; "caught gains XP" is a **design choice**. Real residue: XP can fire if the main updater bails
> on the cap race → **P2 edge case**.
- [x] C8/C9/C5 verified — no P0; genuine residue is P2/P3. No fix applied (out of P0 scope).

### Batch 4 — Core loop (C1) — ✅ VERIFIED, OVER-GRADED (2026-06-18)
> **C1 is NOT "spurious double-deaths."** The `nextWeek` updater is already hardened against StrictMode /
> concurrent double-invoke: **death rolls are pre-rolled** (`GameActionsContext.tsx:359–364`) so the death
> decision is deterministic across invokes, and **notifications are deduped by id** before flush (`:1599–1605`,
> the "R10-2" mitigation the audit mistook for a paper-over). StrictMode double-invoke is **dev-only**.
> Residue: the updater is cosmetically impure; notifications with unstable (length-based) ids could slip the
> id-dedup → **P2 code-quality / B2**.
- [x] C1 verified — death deterministic (pre-rolled), toasts deduped; no production double-death. P2 at most.

### ⚠️ SPRINT VERDICT — all 9 audit "P0 code bugs" verified OVER-GRADED (0 genuine P0s)
> Every item source-verified: already-fixed defensive hardening (C2/C3/C4), unreachable/theoretical
> (C8 ceiling, C9 race), already-mitigated by existing code (C1 death pre-rolls + toast dedup; C6/C7 in-place
> repair), or design choice (C5 caught-XP). The audit reasoned abstractly about React semantics **without
> accounting for the codebase's existing mitigations** (pre-rolled RNG, id-dedup, in-place `repairGameState`
> copy-back) or realistic value ranges. **The 2026-06-15 roadmap's "code-ready; blockers are ops/config"
> assessment STANDS** — real launch blockers are L1–L6 (master-punchlist §B). The earlier "9 P0s contradict
> the roadmap" headline was wrong; corrected in `master-punchlist-2026-06-18.md`.
> **Optional P2/P3 follow-ups — outcome (2026-06-18):**
> - ✅ **B2** stable spark-notification ids (`:1209` length-based → array-index based) — done + tested.
> - ⏭️ **C8** `totalMoneyEarned` tracking — DEFER: entangled with the M3 income-ledger (no weekly-tick income
>   tracking exists at all); an isolated lucky/streak fix would be a band-aid on missing infrastructure.
> - ⏭️ **C9** unify `launchIPO` — DEFER: `acceptAcquisition` also keeps reputation separate; switching
>   `updateMoney`→`applyMoneyDelta` risks **dropping the income tracking** `updateMoney` provides. The current
>   3 calls are synchronous → batched → atomic, so benefit is marginal and regression risk is real.
> - ⏭️ **C5** fold crime-XP — DEFER: needs a caught-XP **balance decision** (currently caught players DO gain
>   XP) or a dual-updater refactor of the core crime flow, for a rare cap-race edge. High surface, low payoff.

### Close-out
- [ ] Full `npm test` green; `npm run preflight`
- [ ] Update `master-punchlist-2026-06-18.md` §A statuses; note any deferred follow-ups
- [ ] Commit per batch; push to `claude/awesome-euler-jaf2z2`
- [ ] Append the React-19 "fold side-effects into the updater" root-cause lesson to `tasks/lessons.md`

---

## Roadmap Phase B — UI render-test suite (the #1 durability gap) — June 15, 2026

Goal (from `tasks/roadmap-2026-06-15.md` H2): close the near-zero UI render-test coverage —
254 components, previously **0** `render()` tests; the import-smoke test only checked default
exports. This is the class of bug (undefined components, bad imports, provider cycles, Animated
mis-mocks) that only surfaced in TestFlight/production before.

Key discovery: the team believed render tests needed a `jest-expo` host. They don't — `react-test-renderer`
(19.1.0) is already installed and `react-native` is mocked to string-tag host components. The only
blockers were **gaps in the shared mock** (no `Animated.View`, no `ActivityIndicator`, composite
animations missing `.stop()`, and Expo `.js` ESM modules unparseable by ts-jest). Filled additively.

- [x] **Harness** — `__tests__/render/helpers/renderWithProviders.tsx` mounts a component inside the
      real `AppProviders` tree via `react-test-renderer` + `act`; asserts it commits without throwing.
- [x] **Mock completeness (additive, in `jest.setup.js`)** — added `Animated.View/Text/Image/ScrollView/FlatList`,
      `Animated.loop/stagger/delay` + `.stop()/.reset()` on `sequence/parallel`, `ActivityIndicator`/
      `ImageBackground`/`RefreshControl`/`BackHandler`, and mocks for `react-native-safe-area-context`,
      `@react-navigation/native`, and `expo-constants` (ESM). `jest.config.js`: ignore `render/helpers/`.
- [x] **13 render smoke tests** — harness smoke + leaf (`OnboardingFloatingButton`); 5 onboarding screens
      (MainMenu, SaveSlots, Scenarios, Customize, Perks); 3 in-game tabs (home, work, market); 3 hot
      components (TopStatsBar, IdentityCard, DeathPopup). All green locally.
- [ ] **Verify full suite** (2387 → 2400) still green after the shared-mock changes, then commit.

Render-suite follow-ups (incremental): assert key copy/elements (not just "mounts"); add interaction
tests (press Next Week, toggle a perk) now that the host renders; cover modal chains.

## Roadmap Phase B — save-durability stress tests (H4/H5) — June 15, 2026

Goal: close the audit's top-2 stability risks. Gap discovered: `longRunSaveLoad` advances time with the
SIMPLIFIED `advanceWeeks` helper (no real subsystems), so it never grows the history arrays — late-game
**save size vs MAX_SAVE_SIZE was never actually tested**. And `repairGameState` deep-clones + discards
(doesn't mutate input); NaN-stat repair lives in `autoFixStats`, invoked by `validateGameState(autoFix=true)`
— the exact load-path call the audit wanted verified.

- [x] **H4** — `__tests__/stress/saveDurability.stress.test.ts`: drives the REAL `nextWeek` 250×, then
      asserts `createSaveData(...)` round-trips and the serialized save is under `MAX_SAVE_SIZE`
      (measured **~849KB** at 250 weeks, cap 4096KB) and the history arrays stay write-capped — so save
      size is bounded at ANY week count (no ~2000-week soft-lock).
- [x] **H5** — same file: a corrupted state (NaN/Infinity stats) self-heals via
      `validateGameState(autoFix=true)` → finite + valid; and a RAW NaN state, loaded and ticked once,
      stays valid + finite (the live tick's post-validation genuinely self-heals — no load-then-crash).
- [x] Verified full suite green; committed (`554dd29`).

## Roadmap Phase B — H6 consolidate IAP entitlement-apply paths — June 15, 2026

Root cause of the H7 bug was DRIFT between duplicated entitlement-apply paths. Consolidated the two
server-side fulfillment paths in `services/IAPService.ts` onto ONE exported helper so they can't drift again.

- [x] Extracted `applyProductBenefitsToState(gameState, config, productId)` — the single source of truth
      for "what a purchase grants" (gems/money/youthPills/skillBoost/perk-flags/moneyMultiplier→goldUpgrades/
      allUpgrades/everythingUnlocked/unlimitedYouthPills/lifetimePremium/special-products switch/gems-clamp).
- [x] `applyProductToState` (in-memory, used by IAPHandler) → now just calls the helper. Behavior-preserving.
- [x] `applyBenefitToDisk` (persisted fulfillment) → calls the helper + a new `persistPermanentPerks(config)`
      (the cross-slot savePermanentPerk persistence, extracted so the state logic stays in the helper).
      The Verified-Pro subscription, tx-ledger, and disk save are untouched. Behavior-preserving.
- [x] Verified: type-check 0 errors; iapMonetization + itemGoldUpgradeFlow + premiumPackIncome = 44 tests green.

- [x] **THIRD path now consolidated too** — `ShopModal.applyPurchaseBenefits` routes through the shared
      helper via `setGameState(prev => { const next = structuredClone(prev); applyProductBenefitsToState(next,
      config, id); return next; })` + `iapService.persistPermanentPerks(config)` (made public). This FIXES the
      Shop path silently dropping moneyMultiplier / youthPills / goldUpgrades / everythingUnlocked / revival.
      - Folded `config.removeAds` into the helper first (only `IAP_PRODUCTS.REMOVE_ADS` carries it, which the
        switch already handled — so this is a strict superset, no behavior lost, and the two fulfillment paths
        gain the previously-missing generic `config.removeAds` handling).
      - Added a ShopModal render smoke test (it was previously untested).
      - Verified: type-check 0 errors; iapMonetization + premiumPackIncome + itemGoldUpgradeFlow +
        raceConditionGuard = 65 green; render components incl. ShopModal = 4 green.

All three IAP entitlement-apply paths now share ONE source of truth. H6 fully closed.

## Roadmap Phase B — H7 verify Premium-Pack income mapping — FOUND + FIXED a real bug — June 15, 2026

The "verify" task uncovered a genuine **"paid upgrade does nothing" revenue bug**. Weekly income reads
`goldUpgrades.multiplier` for the 1.5×, but BOTH IAP entitlement-apply paths in `IAPService.ts`
(`applyProductToState` @1578 + the disk path @~1037) set only the dead `settings.moneyMultiplier` flag for
a money-multiplier product — `goldUpgrades.multiplier` was set only under `allUpgrades`/`everythingUnlocked`,
which the $24.99 **Premium Pack** (`moneyMultiplier: true` only) does NOT have. So buying the Premium Pack
gave **no income boost**. (MON-3's "it's delivered via goldUpgrades.multiplier" was wrong.)

- [x] **Fix** — both `config.moneyMultiplier` blocks now also set `goldUpgrades.multiplier = true`.
- [x] **Regression test** — `__tests__/monetization/premiumPackIncome.test.ts` locks the full chain:
      applying GEMS_PREMIUM sets `goldUpgrades.multiplier`; `computeWeeklyIncome` applies 1.5× when set;
      end-to-end "buy Premium Pack → income ×1.5". Type-check clean; iapMonetization + itemGoldUpgradeFlow
      suites still green (41 tests).

Remaining Phase B: **H6** — consolidate the divergent IAP entitlement-apply paths.

---

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


---

## 🧬 Chapter: Identity & Body + three.js face creator (2026-07-25)

Branch: `claude/game-character-customization-fk5s4m`. Next chapter after Luxury.
Decisions confirmed with the owner: procedural three.js head (no model assets),
live GL on the creator only + a baked portrait everywhere else, chapter theme =
Identity & Body.

### Phase A — pure logic core (`lib/identity/`, zero native deps)
- [x] `types.ts` — `FaceGenome`, `BodyProfile`, `StyleProfile`, `Identity`
- [x] `faceGenome.ts` — defaults, seeded randomize, parent inheritance, age drift
- [x] `body.ts` — weight/bodyFat/muscle weekly simulation
- [x] `style.ts` — grooming + wardrobe decay & upkeep
- [x] `presence.ts` — derived attractiveness/presence score (never stored)
- [x] `procedures.ts` — cosmetic procedure catalog + outcome rolls
- [x] `__tests__/` for each

### Phase B — save plumbing (STATE_VERSION 25 → 26)
- [x] `contexts/game/types.ts` — `identity?: Identity`
- [x] `contexts/game/initialState.ts` — default identity + version bump
- [x] `utils/saveMigrations.ts` — v26 migration w/ backfill
- [x] `utils/saveValidation.ts` — `repairGameState` backfill (must set `repaired`)
- [x] `__tests__/helpers/createTestGameState.ts`
- [x] `DEV.md` / `CLAUDE.md` / `WORKFLOW.md` version sync

### Phase C — weekly tick
- [x] `contexts/game/actions/weekly/applyIdentity.ts`
- [x] Wire into `GameActionsContext.nextWeek` (try/catch, like the luxury tick)

### Phase D — the 3D creator
- [x] `three` + `expo-gl` deps; metro web alias; jest isolation
- [x] `components/identity/gl/` — procedural head mesh + renderer, lazy-required
- [x] `FaceCanvas` w/ non-GL fallback so it never renders blank
- [x] `FaceCreatorModal` — sliders, randomize, rotate, bake to portrait
- [x] Wire into `app/(onboarding)/Customize.tsx` + an in-game entry point

### Phase E — consequences (what makes it a chapter)
- [x] Presence feeds dating, interviews/career, social reputation

### Verify
- [x] `npm run type-check`, targeted jest suites, `npm run lint:errors`

### Outcome
- **4,286 tests green** (171 new across identity), type-check clean, lint clean.
- `STATE_VERSION 26`; `package.json` 2.5.11 → 2.6.0 for the next TestFlight build.
- New native deps: `three` + `expo-gl` → **requires a fresh EAS build**, not OTA.
- Preflight still fails on the two pre-existing missing EAS secrets
  (`EXPO_PUBLIC_SAVE_HMAC_KEY`, `EXPO_PUBLIC_IAP_VERIFY_URL`) — unrelated to this work.

### Known limits (honest)
- The procedural head is **stylized**, not photoreal — a smooth 3D head with
  legible features that respond to all 24 morphs, not a MetaHuman. Reaching
  photoreal needs a licensed blendshape GLB, which was the option not taken.
- Hair is a shell over the scalp with soft per-vertex coverage, not strands.
- Grooming/procedure UI is not built yet: `GROOMING_SERVICES` and
  `COSMETIC_PROCEDURES` are fully implemented and tested but have no screen, so
  they are currently unreachable in game. That is the obvious next slice.

---

## 💎 Luxury showcase: code-only 3D trophies (2026-07-26)

Branch: `claude/game-character-customization-fk5s4m`. Follow-up to the Identity
chapter, taking the img2threejs methodology (reconstruction-by-code, staged
passes, verify each pass against the reference render) and applying it where it
actually fits: hard-surface objects, not faces.

- [x] `lib/geometry/mesh.ts` — shared primitives (lathe, box, torus, merge,
      flatShade, transforms). No three.js.
- [x] `lib/luxury/models/` — diamond, watch, yacht (x2 scales) + registry
- [x] `components/luxury/` — `LuxuryModelViewer` + `ModelRenderer` (three.js)
- [x] Wired into `LuxuryApp`'s DETAIL SHEET only — one GL context at a time
- [x] Visual harness `lib/luxury/models/__tests__/preview.render.ts`
- [x] Model invariant tests (finite geometry, in-range indices, unit normals,
      determinism, triangle budget, real brilliant-cut proportions)

### Defects the render harness caught (none were expressible as assertions)
1. **Diamond half as deep as a real stone** — GIA proportions are fractions of
   girdle DIAMETER, applied to the RADIUS. Rendered as a flat lens with no
   pavilion. Now pinned by a test.
2. **Watch showed a blank steel face** — the case lathe closed to a solid top
   plate 0.005 below the dial and won the depth test. Dial, indices and hands
   were all invisible.
3. **Watch hero angle** was near edge-on; a watch has to be seen from above.
4. **Yacht hull invisible** on the app's near-black surface (navy on near-black).
5. **Zero-length normals** (black specks) from degenerate triangles in
   `flatShade` and from vertices sitting exactly on the origin in
   `computeNormals`. Fixed in both the new geometry lib and `headMesh.ts`.

### Scope — what is NOT done
- Only 4 catalogue ids have models: `museum_diamond`, `rare_watch_collection`,
  `luxury_yacht`, `mega_yacht`. The other 8 keep their flat artwork and are
  untouched; `buildLuxuryModel` returns null and every caller falls back.
- Deliberately not attempted: the racehorse (organic) and the private island /
  vineyard / penthouse / sports team (scenes, not objects). Code-only
  reconstruction of those reads as a toy.
- Fidelity is stated per model in `ProceduralModel.fidelity`: the watch has no
  dial printing (that is texture), the yacht's superstructure is stepped blocks
  rather than compound-curved glasshouse.

### Verify
- [x] 4,331 tests pass, type-check clean, lint clean on all touched files.
- [x] Zero new assets — the 3.7 MB artwork budget is unchanged.


---

## 🧩 Close out every deferred audit finding (2026-07-28)

Branch: `claude/game-character-customization-fk5s4m`. The user was given the
tradeoffs on five deliberately-deferred findings plus one pre-existing warning,
and asked for all of them fixed. Ordered by player impact.

### 1. The built portrait ages with the character — DONE
- [x] `isPortraitStale` + `applyFaceEdit` in `contexts/game/actions/IdentityActions.ts`
- [x] `PortraitRebaker` mounts a FaceCanvas off-screen ONLY while a built
      portrait is stale, captures at the character's current age, writes
      `portraitUri` + `portraitWeek`, unmounts (disposing the GL context)
- [x] Fails harmlessly: one attempt per mount, a null capture keeps the old
      portrait, nothing written unless a real `data:` URI came back

### 2. A way back into the creator after onboarding — DONE
- [x] `EditFaceButton` on the character card — its own leaf component, because
      `useGameState()` re-subscribes its caller to the whole state and
      IdentityCard uses a narrow projection specifically to avoid that
- [x] Opens at `startAt='studio'`, holds the genome as a local draft so a slider
      drag does not write to the save sixty times a second, commits on Done
- [x] Commits against `prev`, not the captured snapshot — a week can tick while
      the modal is open

### 3. Procedural head rebuild cost — DONE (27.27 -> 21.13 ms, -22.5%)
Only on the fallback path, but that path is also the slowest devices.
- [x] Index buffer cached — it depends only on the grid size, so it was identical
      on every call and cost ~9% to regenerate. Hands out a COPY.
- [x] Per-segment sin/cos hoisted to a lookup table — the inner loop was making
      ~33k trig calls per rebuild for 129 distinct angles.
- [x] `blobAniso`/`blobRot` take scalars, not Vec3 literals — the call sites were
      allocating ~1M short-lived arrays per rebuild (the 8% GC in the profile).
- [x] Bit-identical verified: SHA-256 over positions/normals/indices/coverage/brow
      across five faces, unchanged after every step.
- [x] Measured min-of-5 at 200 iterations: 27.27 -> 21.13 ms.

### 4. Scalp coordinates calibrated alike — DONE
`receding` read as a receding hairline on the scanned head and near-bald on the
procedural one, off one shared number.
- [x] `scalpCoordinate` now mirrors the GLB bake term for term: linear backness
      (was a smoothstep), 0.79 backness coefficient (was 1.60), the temple lift
      (was absent), a fixed `H * 0.55` ramp (was a varying one), and the
      offFace/hangY floor.
- [x] The scanned head is the reference because it is the path that ships —
      changing `low: 0.74` instead would have moved it, where it looks right.
- [x] Verified by RENDER: before has the flat bowl-cut rim running straight
      across the forehead and down the temple; after has a real temple corner
      with the forehead corners showing.
- [x] `receding`'s front-most hair 0.509 -> 0.641 against `short` at 0.740 —
      it now reads as receding rather than bald.

### 5. `createTestGameState` merges everything — DONE
- [x] Generic recursive merge; arrays still replace wholesale
- [x] Deep CLONE of the base, or a no-override fixture aliases `initialGameState`
      and any test mutating it poisons every later test (found by the long-run
      save stress test: 121 KB payload against a 100 KB bound)
- [x] Zero fallout in the suite — the concern that widening would silently change
      existing tests did not materialise

### 6. `as GameState` casts — DONE, audit clean
- [x] ROOT CAUSE: the factory took `Partial<GameState>`, which only makes
      top-level keys optional — `{ stats: { gems: 10 } }` did not type-check, so
      hand-building and casting was the only thing the type allowed. Now
      `DeepPartial<GameState>`.
- [x] 71 casts converted across 34 files
- [x] Reverted 12 files whose conversion surfaced errors needing per-test
      judgement, rather than rushing semantic changes
- [x] Three shapes were never violations and the detector now says so: updater-arg
      casts, `GameState['x']` subtype casts, and re-types of an object something
      else built. Anchored on `} as GameState` — a hand-built literal.
- [x] Nil-safety fixtures carry an explicit `NIL-SAFETY FIXTURE` marker: they are
      DELIBERATELY degenerate, which the factory cannot express by design.
      Converting two of them turned them green for the wrong reason.
- [x] `npm run audit:weekly` — all five domains green, zero warnings
