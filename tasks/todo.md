# TestFlight submit: 22 minutes of a silent step (2026-08-19)

Symptom: `eas-build-local-ios.yml` → **Submit to TestFlight** sat at 22m44s with
28 log rows, the last one `- Submitting`, no way to tell stuck from working.

# Retention ecosystem — the three holes worth filling (2026-08-19)

Branch: `claude/deep-life-retention-system-vbdd36`

## What the diagnostic actually found

- The step is not slow, it is **blocked**. `eas submit` uploads the archive and
  schedules the submission in ~90 s (rows 10–25 of the log), then row 27 —
  `Waiting for submission to complete` — blocks on EAS's submission queue and
  EAS's Transporter upload to App Store Connect. Nothing in this repo makes
  Apple's side faster.
- `--wait` is the eas-cli default (`allowNo: true`, so `--no-wait` turns it off).
  While waiting, the CLI prints ONE spinner line for the whole submission — it
  never reports which state the submission is in, which is why 22 minutes
  produced no rows.
- The 2026-08-05 lesson already rejected bare `--no-wait`: it makes the job
  green the instant the submission is *scheduled*, so a rejected binary reads as
  a passing release. That objection is about losing the signal, not about
  waiting, and eas-cli **22** ships the piece that was missing then:
  `eas submit:view <id> --json` returns `status` +`error`, and the status enum is
  `AWAITING_BUILD | IN_QUEUE | IN_PROGRESS | FINISHED | ERRORED | CANCELED`
  (verified against the published tarball, not recalled).
- `printSubmissionDetailsUrls` runs BEFORE the wait, so `--no-wait` still prints
  `Submission details: …/submissions/<uuid>` — the id the poller needs.

## Steps

- [x] 1. `scripts/lib/easSubmission.mjs` — pure: id/URL parsing (ANSI-tolerant),
      status classification, poll backoff, log-throttle, failure formatting
- [x] 2. `scripts/wait-for-eas-submission.mjs` — polls `eas submit:view --json`,
      prints every state change plus a heartbeat, bounded, red on ERRORED/CANCELED
- [x] 3. `eas-build-local-ios.yml` — `--no-wait` + capture id, then the watch step
      behind a `wait_for_submission` input (default true)
- [x] 4. Same in `eas-build-local-android.yml` and the iOS diagnostics twin
- [x] 5. `npm run submit:watch` for the same check from a laptop
- [x] 6. `__tests__/tooling/easSubmissionWait.test.ts`
- [x] 7. Amend the 2026-08-05 lesson in place — its `--no-wait` verdict is now
      half-stale, and a stale absolute is a trap for the next reader

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
- `npm run test:ci` (coverage + ratchet) — exit 0,
  `[coverage-ratchet] OK — no metric regressed.` Coverage measured
  **55.68 / 37.20 / 47.30 / 56.89** against recorded 53.71 / 35.99 / 45.22 /
  55.01, so the floors were raised to 55.0 / 36.3 / 46.6 / 56.2 in this commit
  — the rule `scripts/lib/coverageRatchet.js` states in its own header, and the
  thing its 2026-08-04 history entry exists to stop being skipped. Part of the
  gain predates this change and had never been ratcheted in.

## One real bug the existing suite caught

- `Submit to TestFlight` now ends when the .ipa has actually reached EAS (~90 s)
  and the waiting moved into `Watch the TestFlight submission`, which prints
  `IN_QUEUE → IN_PROGRESS → FINISHED` plus a 2-minute heartbeat. Same wall clock,
  same red-on-rejection signal, but "working" and "stuck" are now distinguishable.
- `wait_for_submission: false` ends the run at "handed to EAS" and records the
  link; the submission still completes.
- Applied to all three local-build workflows (iOS, iOS diagnostics, Android).

## Verification

- `npx jest __tests__/tooling --ci` — **14 suites, 185 tests, all passed** (10.8 s),
  23 of them the new `easSubmissionWait` suite
- `npm run type-check` and `npm run type-check:tests` — both clean
- `npx eslint` on the three new/changed source files — clean
- `python3 -c "yaml.safe_load(...)"` over all 8 workflows — all parse
- End-to-end smoke of the watcher against a stubbed `eas` on PATH: FINISHED
  exits 0 with a step summary; ERRORED exits 1 carrying the error code and
  message; `--link-only` exits 0 with the URL; five unreadable polls in a row
  exit 1 rather than hanging to the timeout. The id was parsed out of a
  transcript carrying real ANSI escapes, which is the case that decides whether
  the watch runs at all.

## Not done, and why

- `eas submit` in `scripts/build-and-submit-testflight.{sh,ps1}` still waits
  inline. A human running those is already watching the terminal, so the silent
  step is not the same problem there.
- Nothing here makes the submission FASTER. The 22 minutes are EAS's queue plus
  the Transporter upload to App Store Connect; that is Apple's and Expo's side.

## Audit round (same day)

Re-read the change looking for what it got wrong. Five things, all fixed:

- [x] 8. **The pairing was only a comment.** `--no-wait` is safe only while a
      watch step follows it. Added `__tests__/tooling/submitWorkflowInvariants.test.ts`,
      which pins the pairing, the `success() &&` guards and `set -o pipefail`
      across all three workflows — and verified it by breaking each invariant
      and watching it go red.
- [x] 9. **The retry budget was measured in attempts.** Five failed polls is 40
      seconds at the tight early cadence, so a one-minute blip failed a release
      that was fine. Now a five-minute grace, with the relationship to
      `pollDelayMs` asserted.
- [x] 10. **`FINISHED` was reported as if it meant approved.** It means the
      store accepted the UPLOAD; Apple validates afterwards, which is where
      Invalid Binary comes from. Both the annotation and the runbook say so now.
- [x] 11. **The `--platform` fallback path had no link.** The payload carries
      `app.ownerAccount.name` + `app.slug`, so the URL is rebuilt from it —
      a failure report with no link is one nobody can act on.
- [x] 12. **Android was reading iOS wording.** The shared watcher said "App
      Store Connect" and "Apple said" on Play submissions. One
      `storeName(platform)` helper; failure line made platform-neutral.

## Verification (audit round)

- `npx jest __tests__/tooling --ci` — **15 suites, 209 tests, all passed** (8.7 s)
- Mutation-tested the new pin: dropping `--no-wait` fails it; dropping
  `success()` fails it; the workflow was restored and verified clean against HEAD
- Re-ran the watcher end to end against the stub for: transient read failures
  recovering into a FINISHED (URL rebuilt from the payload, no `--from-log`),
  an Android ERRORED (Play wording, exit 1), and a watch timeout (exit 1 with
  the "this is not a rejection" wording)

## Review round (CodeRabbit, #146)

Five findings. Three acted on, two skipped as contrary to this repo's conventions.

- [x] 13. **MAJOR, and correct: bound each `eas submit:view`.** A hung child
      meant `readSubmission()` never resolved - no heartbeat, and the watch
      timeout unreachable, i.e. the exact silence this whole change removes.
      Added a 90s read deadline (SIGTERM, then SIGKILL 5s later, unref'd),
      resolving as an unreadable poll so `READ_FAILURE_GRACE_MS` absorbs it.
      Verified against a stub that hangs forever: the loop keeps turning every
      ~12s and leaves zero orphan processes. `--read-timeout-seconds` makes the
      path exercisable in seconds.
- [x] 14. **Correct: the `eas-build` skill hardcoded iOS.** It accepts
      `ios|android` but told every user `--platform ios` and to check
      TestFlight. Now platform-specific, with the Play follow-up spelled out.
- [x] 15. **Partly correct: bind the guards to each watcher step.** The claim
      that unrelated conditions could satisfy the old assertion was wrong - it
      asserted `success()` on EVERY line mentioning the input, and dropping one
      was mutation-tested red. But the REAL gap it points at is untested:
      nothing asserted `wait_for_submission` defaults to **true**, so
      `default: false` would silently disable the release signal everywhere.
      Guards are now read off each watcher step, and the default is pinned
      (mutation-tested).
- [x] 16. **Skipped: "use interfaces, not inline object shapes" (nit).** Not
      this repo's convention - `initialStateFieldCoverage.test.ts` uses inline
      shapes in exactly this position, and there is no `.coderabbit.yaml`, so
      the cited "coding guidelines" are the bot's defaults, not ours.
- [x] 17. **Skipped: "annotate Jest callbacks with `void`/`Promise<void>`" (nit).**
      Contradicts the neighbouring file: `ascRelease.test.ts` uses bare
      `beforeAll(async () => {`. Across ~535 test files there are 4 such
      annotations and 3 of them are inside regexes asserting on source text.

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


---

# Retention cohorts — making D1/D7/D30 computable (2026-08-19)

The follow-up to the above. Chosen because every remaining retention item is a
guess until retention is measurable.

## What the investigation found first

The plan was "derive cohorts from the existing funnel". The funnel turned out
not to be running.

`analytics.init()` and `setConsent()` have ONE production call site, inside
`if (enableTelemetry)` in `app/_layout.tsx`. The `production` EAS profile sets
`EXPO_PUBLIC_ENABLE_FIREBASE=true` but NOT `EXPO_PUBLIC_ENABLE_ANALYTICS`, so
`telemetry` was false, the block never ran, `consent` stayed false forever, and
`track()` dropped every custom event at its first branch — Firebase included.
Firebase still collected its own automatic events, so the dashboard looked
alive while the entire product funnel reached nothing.

`AnalyticsService.track()` was right: it forwards to Firebase before the
queue's `active` check, specifically so one sink cannot silence the other. The
call site one level up defeated that. Independence has to hold where it is
decided.

## Steps

- [x] 1. Gate analytics init/consent on `enableTelemetry || enableFirebase`.
- [x] 2. `lib/analytics/retentionCohort.ts` — install anchor, monotonic day
      index, distinct-days and session counters. Pure; AsyncStorage-backed.
- [x] 3. `AnalyticsService.trackSessionStart()` — the one sanctioned way to
      emit a session, folding the launch into the cohort first.
- [x] 4. New `retention_day` event, fired once per new day index.
- [x] 5. Point `app/_layout.tsx` at `trackSessionStart`.
- [x] 6. `docs/RETENTION-ANALYTICS.md` — the two metric definitions, the
      cohort-size query, and the `anchorEstimated` exclusion rule.
- [x] 7. Tests, including a source-level pin on the wiring.

## Design notes

- **Facts on the device, metrics in the sink.** Classic day-N and rolling
  N-day retention disagree, and only one survives if the device picks. It
  emits `dayIndex` and lets the query decide.
- **The clock rule does not apply here.** v28/v31/v35/v40/v44 gate PAYOUTS on
  game state because a wall-clock gate on a reward is farmable. Nothing here
  pays out, so a moved clock buys nothing. Rewind is still handled — the index
  is monotonic — because the residual risk is data quality, not exploitation.
- **A null cohort emits no cohort props.** Deliberately not replaced with an
  ephemeral record: a device with broken storage would then mint a fresh day-0
  entry every launch and inflate the denominator. Absent beats fabricated.
- **`anchorEstimated` is permanent and must be filtered.** No install
  timestamp exists in this app's history and none can be recovered, so the
  retention curve starts from the release that ships this. Any number computed
  over the existing base before then is fiction — stated plainly in the doc
  rather than papered over.

## Verification (actual output)

- `npm run check:routes` — `OK — 18 routes, no conflicts, all groups anchored`
- `npm run type-check` — clean
- `npm run type-check:tests:ratchet` — holding at 0 (baseline 0)
- `npm run lint:errors` — clean
- `npx jest lib/analytics --ci` — 3 suites, 29 tests, all passed
- `npm test -- --ci` — **602 suites, 7,826 passed, 1 skipped, 308 snapshots**

## Two guards that earned their place immediately

1. The typed event catalogue rejected `retention_day` at compile time until it
   was registered — `track()` drops unknown names, so an unregistered event
   would have been a silent no-op.
2. The new source-level pin failed on its own comment (which quotes the banned
   string). Fixed by stripping comments before matching, not by deleting the
   explanation.


---

# Closing the goal loop (2026-08-19)

Two halves of the same gap: a goal that is reached gave nothing back, and the
return screen never said what to do next.

## 1. Acknowledgement

A recommended goal simply VANISHED on completion. The player did the thing and
the game said nothing.

Detecting that without storing anything is the design problem. The answer is
`achievementLevel(state) => number` on each goal — rungs passed, properties
owned, career level, children — and a goal is reached when that number
INCREASES between two states (`goalsAchievedBetween`).

Why a level and not a boolean:
- A boolean cannot express crossing a savings rung, because the goal stays on
  screen with a higher target. Banking your first $1,000 is a real moment.
- Direction falls out for free: selling a property LOWERS the level, and a
  decrease is not an achievement.
- There is no stored "done" flag, so there is nothing to double-claim
  (CLAUDE.md §4.4) and no `STATE_VERSION` bump.

Surfaced IN-CARD, not as a toast. `showAchievementToast` is hard-gated to
genuine rewarded achievements and hijacking it is exactly the dilution that
gate exists to prevent; a popup per savings rung is also the modal spam the
design rules out. Ephemeral (a session-scoped ref), so a reach from before
launch is not re-announced on every cold start.

## 2. The return screen looks forward

`WelcomeBackPopup` ended on "Continue your life journey" — the most valuable
slot on the screen, spent on a line that tells the player nothing. It now shows
`primaryGoal(state)`: the SAME derived recommendation the home card shows, so
the two surfaces cannot disagree. Falls back to the old copy when no goal is
eligible.

## Steps

- [x] 1. `achievementLevel` on all 14 catalogue goals.
- [x] 2. `goalsAchievedBetween(prev, next)` — pure, direction-aware.
- [x] 3. In-card acknowledgement row in `NextGoalsCard`.
- [x] 4. `goal_reached` analytics event, carrying the level so "how far up each
      ladder do players get" is answerable — the question that says whether the
      mid-game flattens.
- [x] 5. `primaryGoal` in `WelcomeBackPopup`.
- [x] 6. Tests.

## Verification (actual output)

- `npm run check:routes` — `OK — 18 routes, no conflicts, all groups anchored`
- `npm run type-check` — clean
- `npm run type-check:tests:ratchet` — holding at 0 (baseline 0)
- `npm run lint:errors` — clean
- `npm test -- --ci` — **603 suites, 7,836 passed, 1 skipped, 308 snapshots**

The typed event catalogue rejected `goal_reached` at compile time until it was
registered — the second time this session that guard caught an event that would
otherwise have been a silent no-op.


---

# Session-start priority audit (2026-08-19)

Brief §30: at most one critical item, one opportunity, one recommended goal on
open. This was the item that might REMOVE rather than add, so it started as an
inventory, not a change.

## What the inventory found

**The interruption problem is already solved, and solved well.**
`contexts/InterruptionContext.tsx` is a declarative priority queue: a surface
says "I want to show, at this priority" every render, and exactly one claimant
wins. It replaced four independent, mutually-blind popup chains. Nothing in
this audit improves on that design.

Three hypotheses were checked and **rejected** — recorded because each would
have been a plausible-sounding "finding" that was simply wrong:

| Hypothesis | Reality |
|---|---|
| `SicknessModal` auto-pops outside the queue | It is opened ONLY by a tap on the TopStatsBar disease badge (`TopStatsBar.tsx:797`). Tap-initiated, correctly outside. |
| `CureSuccessModal` is unreachable dead code | `ItemActionsContext` sets its flag at three sites when a cure is used. It is direct feedback for a deliberate tap. |
| The new retention cards need slots | They are non-blocking cards, and the Offer Center is user-initiated. None interrupt. |

## The one real finding

`INTERRUPTION_PRIORITY` has carried **`LIFE_MOMENT: 80`** and
**`EVENT_INBOX: 70`** since it was written, and **nothing ever claimed
either**. Both were suppressed downward by a local `higherModalUp` boolean in
`app/(tabs)/_layout.tsx` — the exact hand-rolled single-file chain the queue
exists to replace.

That chain works in one direction only. The two surfaces hid everything in
their own file; every surface in a DIFFERENT file was blind to them. So an
auto-presented Life Moment could be covered by the daily reward (50), welcome
back (45) or community reward (42) from `home.tsx`, by the premium promo (20),
or by the ad orb (10) — the modal the player is meant to read, buried under an
upsell. `LifeMomentModal` auto-presents (`_layout.tsx:377`, no user action), so
this was reachable in ordinary play.

Both now claim. Death and wedding stay deliberately unclaimed: they are
root-level modals that gate their own dismissal, which
`InterruptionContext`'s own docs already record as a short-circuit.

## The structural guard

A priority constant with no claimant is a declared intention nothing
implements, and nothing else in the codebase can report it — the app compiles,
renders, and quietly ignores the ordering.
`__tests__/components/interruptionClaimants.test.ts` sweeps the claim sites and
fails on any unclaimed priority.

**Verified to fail on the regression**: replacing
`INTERRUPTION_PRIORITY.LIFE_MOMENT` with a bare `80` at the claim site turns
2 of its 4 tests red, and restoring it turns them green. A guard that has not
been seen failing is not known to guard anything.

## Steps

- [x] 1. Inventory every surface that can appear on open.
- [x] 2. Verify each hypothesis against source before claiming it.
- [x] 3. Claim `LIFE_MOMENT` and `EVENT_INBOX` in `app/(tabs)/_layout.tsx`.
- [x] 4. Sweep test for unclaimed priorities, proven to fail on the regression.

## Verification (actual output)

- `npm run check:routes` — `OK — 18 routes, no conflicts, all groups anchored`
- `npm run type-check` — clean
- `npm run type-check:tests:ratchet` — holding at 0 (baseline 0)
- `npm run lint:errors` — clean
- `npm test -- --ci` — **604 suites, 7,840 passed, 1 skipped, 308 snapshots**

## Not changed, and why

The home CARD stack (now including the two retention cards) was reviewed and
left alone. Cards are not interruptions: every one of them self-hides when it
has nothing to say, the secondary tail is already collapsed behind "Show more",
and §30's budget is about what the app THROWS at the player on open. Trimming a
scrollable feed that the player controls would cost discoverability for no
interruption saved.
