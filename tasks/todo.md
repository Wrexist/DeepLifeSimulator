# Retention ecosystem — the three holes worth filling (2026-08-19)

Branch: `claude/deep-life-retention-system-vbdd36`

## What the diagnostic actually found

The brief asks for ~56 retention systems. Most of them **already ship**, and the
audit below is the reason this plan is three systems and not fifty-six. Building
a second copy of a live system is the "duplicated source of truth" the brief
itself forbids, and in this repo it is also how the deleted linear goal system
got shipped broken next to a working Life Chapters ladder.

### Already built — do not rebuild

| Brief | Ships today as |
|---|---|
| §1 daily micro goals / §20 streaks | daily login rewards + `playStreak` + `DailyGemClaim` (v40/v46 gates) |
| §2 weekly goals / §19 weekly challenge | `lib/challenges/weeklyChallenges.ts` + `WeeklyChallengeCard` |
| §4 weekly summary | `LastWeekRecap` (non-blocking strip) + `WeeklyResultSheet` |
| §6 life milestones | `lib/statistics/milestones.ts`, `lib/progress/lifeChapters.ts` |
| §8 discovery | `lib/depth/discoverySystem.ts` + `DiscoveryIndicator` |
| §9/§10 events + choices | `lib/events/` — 25 modules, engine, cliffhangers |
| §11 story threads | `lib/lifeMoments/` + cliffhanger roll/resolution in the tick |
| §12/§13 relationships + NPC memory | `lib/depth` NPC goals/wants/memories, `applyNPCDepthTick` |
| §14/§15 comeback + contextual return | `WelcomeBackPopup` + `applyWelcomeBackBonus` (v44) |
| §22 battle pass without the bad parts | `lib/legacyPass/` keyed to prestige |
| §25/§26 timeline + album | `LegacyTimeline`, `MemoryBookModal`, `LifeStoryModal` |
| §27 achievements | `lib/progress/achievements.ts` + 3 modals |
| §33 passive progression | businesses, crypto mining, rentals, savings interest in the tick |
| §35 deterministic content | `lib/randomness/deterministicRng.ts`, seeded payloads |
| §54 endgame | prestige → dynasty (v36) → legacy contracts (v33) |

### The three genuine holes

1. **Nothing tells the player what to work toward *right now*.** The linear goal
   system was deleted (correctly — every goal's `shouldShow` was the negation of
   its completion predicate, so nothing could ever complete) and **never
   replaced**. Life Chapters and Ambitions are fixed ladders, not state-derived
   direction. This is brief §5 + §24.
2. **Nothing is visible in the future.** Grep finds no week-ahead surface. The
   tick knows a degree finishes in 6 weeks, a loan payment lands next week, a
   wedding is scheduled — none of it is shown before it happens. Brief §32.
3. **No rotating offer system at all.** Brief §17/§42–46. Nothing in the repo.

## Design constraints taken from the repo, not the brief

- **No new save fields.** All three systems are PURE functions of `GameState`.
  No `STATE_VERSION` bump, no migration, no `repairGameState` mirror, no
  carve-out reasoning to get wrong. CLAUDE.md §7 is the longest section in the
  file for a reason.
- **No new reward faucets.** The repo has shipped farmable grants five times
  (v28/v31/v35/v40/v44 all exist to close one). Goals and the week-ahead give
  *direction*; they pay nothing. The offer center *sells*; it grants nothing.
  Nothing here can be double-claimed because nothing here claims.
- **Never fabricate a price.** Research (Apple, 2026-08): Promotional Offers are
  **auto-renewable-subscription only** and cannot discount this game's
  consumable gem packs. The correct mechanism is an App Store Connect
  **scheduled temporary price change** (start + end date, max one year,
  explicitly supported for consumables). The app therefore never computes a sale
  price — it renders the live StoreKit price and shows a discount badge only
  when the live price is *provably* below the regular price.

## Steps

- [x] 1. `lib/goals/` — goal engine. Catalogue of derived goals, each with
      horizon (now/soon/dream), progress fn, eligibility fn, priority, and the
      route that acts on it. `recommendGoals(state)` returns ≤1 per horizon,
      deterministic.
- [x] 2. `lib/anticipation/` — week-ahead engine. `upcomingEvents(state)` reads
      education `weeksRemaining`, loan `weeksRemaining`, `pregnancyStartWeek`,
      `weddingPlanned.scheduledWeek`, disease duration, savings-goal
      `targetWeek`, career promotion proximity. All `weeksLived`-relative.
- [x] 3. `lib/offers/` — deterministic weekly rotation over a data-driven
      catalogue keyed to real SKUs; honest-price resolution helper.
- [x] 4. `components/NextGoalsCard.tsx` — NOW / SOON / DREAM on home.
- [x] 5. `components/WeekAheadCard.tsx` — the anticipation strip on home.
- [x] 6. `components/OfferCenterModal.tsx` — LAST / THIS / NEXT, real prices.
- [x] 7. Analytics: new event names + instrumentation for all three.
- [x] 8. `docs/IAP-PRICE-ROTATION.md` — the App Store Connect procedure the
      owner must run for a badge to ever appear, and why the app cannot do it.
- [x] 9. Tests: unit tests per module + the anti-fabrication price test.
- [x] 10. Verify: `npm run check:routes`, `type-check`, `type-check:tests`,
      `lint:errors`, targeted Jest, then the full suite.

## Verification (actual output)

Cold container — `npm install` first (exit 0). `tasks/lessons.md` records
mistaking a missing `node_modules` for a failing suite twice.

- `npm run check:routes` — `OK — 18 routes, no conflicts, all groups anchored`
- `npm run type-check` — clean, no output
- `npm run type-check:tests:ratchet` — `Test-tree type errors holding at 0 (baseline 0)`
- `npm run lint:errors` — clean, no output
- `npx jest lib/goals lib/anticipation lib/offers --ci` — **7 suites, 50 tests,
  all passed**
- `npm test -- --ci` — **599 suites, 7,804 passed, 1 skipped, 308 snapshots**
- `npm run test:ci` (coverage + ratchet) — see below

## One real bug the existing suite caught

`__tests__/render/modalListsShrink.test.ts` failed on
`OfferCenterModal.tsx:122`: its `ScrollView` sat in a sheet bounded only by
`maxHeight: '88%'` with no `flexShrink: 1`, so the scroller would have kept its
full content height and pushed the sheet past the bottom of the screen instead
of scrolling. Fixed by adding `styles.scroll`. Worth recording because the
sweep exists precisely for this class and found it on the first run.

## What was deliberately NOT built, and why

- **No new reward faucet.** Nothing in this change grants money, gems or XP.
  The game already has six faucets and five `STATE_VERSION` bumps
  (v28/v31/v35/v40/v44) whose entire purpose is closing a farm on one of them.
  Direction and anticipation are worth more here than another payout, and they
  carry no claim state to double-spend.
- **No `STATE_VERSION` bump.** All three engines are pure functions of existing
  state. No migration, no `repairGameState` mirror, no carve-out reasoning to
  get wrong.
- **No second copy of a live system.** Daily rewards, streaks, weekly
  challenges, the recap, milestones, discovery, events, story threads, NPC
  memory, the comeback popup, the Legacy Pass, the timeline, the memory book,
  achievements and the prestige/dynasty endgame all already ship. The audit
  table above is the record of what was checked.
- **No push notifications.** `expo-notifications` was removed to fix a
  TurboModule crash (CLAUDE.md §4.6). Re-adding it for re-engagement is a
  native-dependency decision for the owner, not a side effect of this change.
- **No A/B testing harness.** There is no experiment infrastructure and no
  server to hold assignments; building one is its own project. The analytics
  events added here are the prerequisite for it.
