# Master Program 15 — Release Readiness Forensic Audit (2026-09-04)

Branch `claude/deeplife-release-audit-vcs3t8`, on `main` at `ab61f90` (the
merge of PR #190, the eight TestFlight screenshot fixes). Nothing in this
program adds a feature. Every number below was measured on this HEAD in this
session; where an earlier report is quoted, it is quoted as the thing being
checked, not as evidence.

The question was not "is the game good". It was: **what can still stop the
next update from shipping?**

## 0. Baseline

| item | value | source |
|---|---|---|
| HEAD | `ab61f90` (merge of #190) | `git log` |
| package version | **2.12.0**, cut 2026-08-30 (`a3796e7`) | `package.json` |
| last TestFlight upload | run #71, 2026-09-04, `d845b9e` (Program 14 merge) — **on 2.12.0** | Actions, `eas-build-local-ios.yml` |
| STATE_VERSION | 51, consistent in CLAUDE.md / DEV.md / WORKFLOW.md | `contexts/game/initialState.ts:9` |
| lint ratchet | 0 errors (limit 0), **721 warnings against a ceiling of 719 — RED on main** | `scripts/check-lint.js` |
| UI ratchets | gradients 152/152, raw font sizes 94/94, heavy weights 652/652 — all exactly at ceiling | `npm run ui:ratchet` |
| type-check / type-check:tests | clean / 0 (baseline 0) | |
| routes | 17, no conflicts | `npm run check:routes` |
| test files | 774 (`*.test.ts(x)`) | `find` |
| live-ops runway | every stage has runway; published `new`/`early` go quiet 59 d in the next 90, `mid`/`late`/`endgame` 90 d | `npm run check:liveops` |
| ASO / content | pass / at or above every floor (cliffhanger share at goal) | `check:aso`, `check:content` |
| open PRs | none | GitHub |
| release copy | `WHATS_NEW.md` top entry is **v2.11.0** — no 2.12.0 entry, nothing for what merged since | |
| runbook examples | `docs/RELEASE_RUNBOOK.md` still says "Currently `2.9.0`", "919 warnings (ceiling 920)", "545 suites" | stale |

## 5. Happiness — measured, not tuned (Phase 5)

Harness: `__tests__/simulation/happinessLongRun.sim.test.ts` (new, `RUN_*`-gated,
measurement only). Seed 1 unless stated; social personas over the real tick.

| persona | wks | mean | p10 | med | p90 | ≥95 | <50 | flat | min |
|---|---|---|---|---|---|---|---|---|---|
| LONER | 150 | 81.9 | 64 | 85 | 96 | 52 | 2 | 49 | 48 |
| CASUAL SOCIAL | 150 | 93.7 | 86 | 97 | 98 | 98 | 0 | 83 | 62 |
| FRIENDSHIP-FOCUSED | 150 | 93.7 | 86 | 97 | 98 | 88 | 0 | 69 | 77 |
| ROMANCE-FOCUSED | 150 | 92.7 | 85 | 95 | 97 | 106 | 0 | 98 | 55 |
| CAREER-OBSESSED | 150 | 83.3 | 69 | 86 | 96 | 54 | 2 | 50 | 48 |
| WEALTH MAXIMIZER | 150 | 83.3 | 69 | 86 | 96 | 54 | 2 | 50 | 48 |
| LONER | 250 | 74.3 | 56 | 72 | 96 | 52 | 15 | 59 | 16 |
| CASUAL SOCIAL | 250 | 92.7 | 83 | 97 | 98 | 172 | 0 | 145 | 54 |
| FRIENDSHIP-FOCUSED | 250 | 92.1 | 81 | 97 | 98 | 148 | 2 | 117 | 49 |
| ROMANCE-FOCUSED | 250 | 92.8 | 87 | 95 | 97 | 181 | 0 | 158 | 55 |
| CAREER-OBSESSED | 250 | 75.4 | 54 | 74 | 96 | 54 | 15 | 61 | 19 |
| WEALTH MAXIMIZER | 250 | 75.4 | 54 | 74 | 96 | 54 | 14 | 61 | 19 |

At 500 weeks (three personas): LONER mean 72.1 / median 70 / 35 weeks under
50 / min 16; CAREER-OBSESSED 72.3 / 71 / 35 / 19; CASUAL SOCIAL 93.8 / 98 /
0 under 50, **291 of 500 weeks flat** at the ceiling.

Controlled starts (150 weeks; `rec80` = first week at ≥80):

| start | LONER rec80/rec90 | CASUAL rec80/rec90 | ROMANCE rec80/rec90 |
|---|---|---|---|
| 20 | 21 / 27 | 19 / 20 | 15 / 16 |
| 50 | 19 / 27 | 18 / 19 | 15 / 16 |
| 80 | 5 / 21 | 5 / 18 | 5 / 16 |

Same policy across five lineages (150 weeks, mean happiness): CASUAL SOCIAL
88.1–94.2 (sd 2.4); CAREER-OBSESSED 71.2–88.2 (sd 5.9).

**Reading.** Three things Program 14 left open are now measured further out:

1. **The bottom half is reachable now, at 250 weeks.** LONER and the two
   solitary optimisers spend 14–15 of 250 weeks under 50 and bottom out at
   16–19. At 150 weeks it was 2 weeks. Nothing changed in the curve; a
   lonely life simply keeps sliding.
2. **The social ceiling is unchanged.** CASUAL / FRIENDSHIP / ROMANCE sit at
   median 95–97, and at 250 weeks spend 117–158 weeks with happiness moving by
   exactly zero. This is the Program 14 §11 finding, one horizon further out.
3. **CAREER-OBSESSED and WEALTH MAXIMIZER are still identical to the decimal**
   at every horizon. Wealth still buys nothing a career does not.

Recovery from 20 takes 15–21 weeks to 80 — unchanged from Program 14's 16–25.
Cross-life variance is real (a career life ranges 71–88 by seed).

**Classification: OWNER, not a blocker.** Nothing here crashes, locks or
misleads; it is a balance property the owner has already seen and deferred
(Program 14 §17: "a tuning pass with an owner, not a mechanism change"). No
number was touched.

## 4. Determinism on THIS head (Phase 4)

Program 14's claims were re-run, not re-read:

| check | result |
|---|---|
| `RUN_REPRO_SIM=1 RUNS=2 WEEKS=150` — 5 personas, every field, every week | **identical** (5/5), 150 weeks (Program 14 measured 80) |
| `RUN_SAVELOAD_SIM=1 WEEKS=120 SPLIT=50` — continue from a round-tripped save vs straight through | **identical** (3/3) |
| `simulationDeterminismAudit` (TIER 1–3), `weekOnlyRollAudit`, `happinessGainAudit`, `lifeReproducibility` | pass (43 tests) |
| `git diff 9fe90c5..HEAD` for new `Math.random` / `Date.now` / `new Date` in `lib`, `contexts`, `utils` | two live additions, neither on the tick: an ad-impression id (`lib/ads/adRevenueTracking.ts`) and the deliberately in-memory notification cooldown clock (`utils/smartNotifications.ts`, documented under v50) |

The deterministic contract holds on HEAD. No guard was weakened.

## 8. Economy long run (Phase 8)

`RUN_ECONOMY_PERSONAS=1 WEEKS=250` (nine personas, seed 1) and
`RUN_ECONOMY_SHOCKS=1` (six shocks at week 60 over 150 weeks). Net worth at
250 weeks: POOR START $340k (musician L5 at $2,120/wk), AVERAGE WORKER $52k,
CAREER CLIMBER −$41k (two degrees on loans, $93k still owed, $1,100/wk),
HIGH-SPENDER $9.4k, SAVER $59k, INVESTOR $66k, OPTIMIZER $380k (software L5 +
$421k portfolio), RISK-TAKER died wk 33, TEXT-SKIPPER died wk 15. Every shock
recovers except "wallet to $50", which never regains its pre-shock cash in
the window but stays alive with zero arrears. Passive income is 0 for every
persona (no property, no company) — nothing prints money on a timer. The
`economyBoundaries` gates pass in the full suite. **No release-level finding.**

## 9. TestFlight regression replay (Phase 9)

Against a real static web export of HEAD (`expo export --platform web`,
served on :8090, Playwright/Chromium), not source inspection:

| defect (PR #190) | replay | result |
|---|---|---|
| season/month disagreement | home HUD + season modal, week 1 | **January = Winter Season**, "Week in Season 1 / 13", "Spring in 12 weeks" |
| SeasonalIndicator off-by-one / dark holiday card | season modal | holiday card renders ("New Year"), readable in dark mode |
| Bank Pro empty box | Bank Pro, Statement tab | segmented control sized to content, labels present (not bare icons) |
| food restore honesty | Market before / after 7 meals | chips `+4/+8/+2` → `+1/+2/+1`, equal to what satiety pays |
| Apps grid dead space / DeepMail icon | Apps tab | tiles sized to content; DeepMail tinted |
| death flow → Start New Life | Dev Tools "Trigger Death" at 430 and 360 pt | death screen renders, Start New Life lands on Choose Scenario at both widths |

Two things the replay found that the fix PR did not:

- **P1 — the death screen counts the wrong life.** "Age 20 • 2 yrs lived" for a
  character who died in week one. `DeathPopup.tsx:711` divided the ABSOLUTE
  `weeksLived` by 52; the counter is seeded from the starting age (§4.2), so an
  age-25 start dies "7 yrs" into a one-week life, on the most-screenshotted
  screen in the game. Fixed: `weeksInThisLife`; pre-v43 saves keep the
  behaviour they had. Test: `__tests__/render/deathScreenLifeLength.render.test.tsx`.
- P3 — Bank Pro's statement chip and the credit-inquiry rows print the raw
  absolute week ("Week 104" on a fresh age-20 life). Cosmetic and internally
  consistent; not changed.

Toast, wedding and revival-pack surfaces: covered by render/state tests
(`blockingPopupScroll`, `revivalPackBanked`, `repeatableRevive`,
`toastQueue`), not re-photographed — none takes a dev-tools path on web.

## 10. UI / accessibility pass (Phase 10)

- 360 pt width, four tabs (Home, Work, Apps, Life): `scrollWidth === 360`,
  worst element overflow 0 px on every tab; nothing clipped in the captures.
- Dark mode: the export renders dark; the holiday card that was white-on-white
  is readable.
- UI ratchets: all three counters exactly at ceiling — zero headroom, so any
  new gradient / raw font size / heavy weight fails preflight. Not a defect;
  a note for whoever touches UI next.
- Larger font settings, VoiceOver focus order, iOS Modal presentation:
  **HUMAN** (device only).

## 6. Social economic safety (Phase 6)

`RUN_SOCIAL_PERSONAS=1` (twelve personas, 250 weeks, seed 1), end state:

| persona | chosen | friends | strong | romance | avgBond | happiness | net worth | status |
|---|---|---|---|---|---|---|---|---|
| LONER | 0 | 0 | 0 | none | 1 | 58 | $60k | alive |
| CASUAL SOCIAL | 23 | 23 | 25 | none | 100 | 98 | $60k | alive |
| FRIENDSHIP-FOCUSED | 36 | 36 | 38 | none | 100 | 98 | $2.6k | alive |
| ROMANCE-FOCUSED | 8 | 7 | 1 | partner | 29 | 95 | $11k | alive |
| FAMILY-FOCUSED | 9 | 8 | 11 | partner | 100 | 98 | $14k | alive |
| RISK-TAKER | 18 | 18 | 8 | none | 56 | 98 | $62k | alive |
| SOCIAL BUT BROKE | 14 | 14 | 16 | none | 100 | 99 | $325k | alive |
| SOCIAL + CAREER | 7 | 7 | 3 | none | 51 | 89 | $61k | alive |
| WEALTH MAXIMIZER | 0 | 0 | 0 | none | 1 | 61 | $66k | alive |
| TEXT SKIPPER | 0 | 0 | 0 | none | 42 | 0 | $4.5k | died wk 15 (happiness) |
| SOCIAL OPTIMIZER | 34 | 34 | 36 | none | 100 | 98 | $16 | died wk 211 (health) |

Read with the red-team table in §15: no social path prints money (partner
income is annual/52, top earner only, score ≥ 50; the one support event pays
≤ $400 against real arrears and costs 12 bond; IOUs carry no interest).
Socialising costs money and health rather than making it — FRIENDSHIP-FOCUSED
ends on $2.6k and SOCIAL OPTIMIZER dies of neglect at week 211. Two balance
observations, both OWNER: every regular contact still ratchets to bond 100 by
week 250 (the falloff slows the ladder, it does not cap it), and a free Call
still has no time cost (Program 12 §19, unchanged).

## 2. Save integrity (Phase 2)

`__tests__/save` + `__tests__/integration`: 41 suites / 509 tests pass.
`scripts/audit/audit-save.cjs` §3: no blockers; all 42 migrations + 8 no-ops
cover v2..v51; V11 finds 43 backfilled concrete defaults mirrored in
`repairGameState`, every repair sets `repaired`. A round-trip probe through
the REAL pipeline (`createSaveEnvelope → decodePersistedSaveEnvelope →
runMigrations → hydrateLoadedState`) confirmed every §7 carve-out survives the
load (`revivalPack`, `shownNotificationIds`, `Relationship.metAt`, `liveOps`,
`lifeStartWeek`, the `weeksLived`-denominated gem markers, `politics.*`); a
v10 payload walks 41 migrations with zero errors; a v38 `gameMode:'story'`
save loads; tampered / wrong-key / garbage payloads are rejected without
throwing. **STATE_VERSION does not need to change.**

| finding | sev | evidence |
|---|---|---|
| `liveOps.claimedInstanceIds` is not carried across prestige while `achievements` is, so an `achievements_unlocked`-gated live event can pay once per prestige | P2 / OWNER | `lib/dynasty/transition.ts:41-45`, `lib/liveops/claim.ts:71`, `objectives.ts:143`; bounded by per-event caps + weekly budget |
| Fresh-start gem carry-over: the stash lands before `deleteSaveSlot`; if the delete rejects, the record stays pending and the dead slot survives → a later new life applies gems twice | P3 | `components/DeathPopup.tsx:566-606`; needs a storage failure at one await |
| v11/v13/v14 migrations throw on a `null` array element and halt the ladder at that version | P3 | `utils/saveMigrations.ts:97,192,279`; no known producer of such a save |
| A dev-client build and the store build sign with different HMAC keys, so a tester's save reads "corrupted" after installing the store build over a dev build | HUMAN (testers only) | `utils/saveSigningConfig.ts:95-110` |
| Prestige/heir re-arm the login / DeepLife+ faucets by one claim | P3, documented | `accountEntitlements.ts:54-75` |

## 3. Modal / soft-lock audit (Phase 3)

99 modal surfaces scanned (77 raw `<Modal>` files + 22 `BaseModal` consumers),
60 `gameAlert` callers. Mechanism verified: `utils/gameAlert.ts` is a host
STACK, the most recently mounted `AlertHost` wins; `AlertHost` defers a
button handler until its own Modal dismisses and runs a pending one on
unmount. Full table in the audit transcript; the rows that matter:

| surface | host | nested modal | dismissal dependency | risk |
|---|---|---|---|---|
| `DeathPopup` (root) | own nested host | `LifeStoryModal` nested; GemShop via suppress-then-open bridge | flag cleared by revive / heir / new game / rewind | P2 residual: a second alert queued in the same host runs its handler synchronously (`AlertHost.tsx:154-157`) |
| `WeddingPopup` (root) | none (no alerts) | — | renders null when `weddingPartnerName` is empty but only it clears the flag | P2 hardening, not reachable from any writer found |
| `SparkPremiumUpsellModal`, `VerifiedProUpsellModal` (`BaseModal`) | **root host only** | inline in SparkApp / PulseApp | `onDismiss` | **P1 — fixed** |
| `GemShopModal` → `OfferCenterModal` | nested each | nested | receipt OK → deferred close | P3 |
| `SettingsModal` → `DangerZone` confirm | nested | Modal inside Modal | closes both before `router.push` | P3 |
| 16 surfaces pinned by `nestedAlertHosts.test.ts` | nested | single Modal each | own `visible` | P3 |
| `(tabs)/_layout` LifeMoment / WeeklyEvent, home popups | root | exclusive; gated on `!showDeathPopup && !showWeddingPopup` | own | P3 |
| `showStatsBar` route gate (`_layout.tsx:794-799`) | — | — | death/wedding popups depend on `segments[0]==='(tabs)'` | P3: every week-advance caller lives in `(tabs)`; the string-matched exclusion list is fragile (OWNER) |
| `showZeroStatPopup` | — | — | no renderer | P3 dead flag |

**P1 (fixed).** `BaseModal` is a raw RN `<Modal>` with no `AlertHost`. The
Spark Premium and Verified Pro upsell sheets raise their "Cancel subscription?"
confirm and their insufficient-funds alert from inside it; on iOS the root
host's sibling Modal is refused presentation while a sheet is up, so the tap
looks dead — the exact class the field reported for "Start New Life" and the
property "Sell" confirm. The derived guard missed it because `'<BaseModal'`
does not contain `'<Modal'`. Fix: one `<AlertHost />` inside `BaseModal`
(covers all 22 consumers; hosts unregister when hidden), and the guard now
pins that host and counts the BaseModal consumers that raise alerts.
Device confirmation of the iOS presentation is HUMAN.

## 12. Store / IAP (Phase 12) and ads / analytics

43 suites / 454 tests across `__tests__/monetization`, `ads`, `services`,
`prestige/entitlementSurvival`, `actions/deepLifePlus`, and the per-profile
flag truth table pass. Verified sound by trace: grant lands in one updater and
is saved BEFORE `finishTransactionAsync` (fail-closed leaves the transaction
open); restore skips consumables and re-applies entitlements only; Revival
Pack charge vs purchase record kept apart; purchases survive prestige, heir,
fresh start and rewind via `carryAccountLevelEntitlements`; every gem/cash
faucet is `weeksLived`-gated; a SKU whose product did not load is not buyable;
remove-ads honoured at spawn, watch and banner; analytics never throws on the
tick or at boot.

| finding | sev | evidence |
|---|---|---|
| WHATS_NEW 2.11.0 says membership "no longer switches off offline"; true for ad-free, but with no RevenueCat cache ever fetched the reconciler clears `deepLifePlusActivated` (a deliberate bounded clear) | P2 / OWNER copy | `SubscriptionActions.ts:398-410`, `SubscriptionReconciler.tsx:69-73` |
| RC path: a charged gem pack whose grant fails (save I/O failure) has no in-app retry; the message points to Restore, which skips consumables | P2 | `IAPService.ts:1019-1048`, `2127-2129` |
| Native Restore of a MIXED consumable (`GEMS_MEGA`) marks the real transaction id processed entitlements-only, so a failed original grant is closed without its gems | P2 | `IAPService.ts:2272-2283`, `1456-1468`; Revival Pack already uses a synthetic id |
| Gem packs are not reserve-before-grant (ledger written after grant) | P3 | `IAPService.ts:340-362` |
| Time Machine rewind restores login/ad-orb week markers; free rewinds after the 150k-gem `chronomaster` make that a slow faucet | P3 | `checkpointSystem.ts:243-252, 320-328` |
| Sandbox purchase + restore + relaunch, RC entitlement ids, intro-offer config, Play acknowledgement | HUMAN | — |

## 15. Red team (Phases 6 and 15)

Probe suite with a fake `setGameState` feeding two updaters from one stale
snapshot (React batch semantics), 8/8 pass; a scanner over 414 files found 54
snapshot-gated updaters, every one re-checking `prev` or re-running a pure
reducer.

| exploit | result |
|---|---|
| double-tap chapter reward, daily login, DeepLife+ daily, welcome-back, ad orb cash, Revival Pack, legacy contract, dynasty endowment/seat/vault/trial, statistics milestone, ambition pick/payout, sell-all miners | BLOCKED |
| repeat chapter rewards after prestige | PARTIAL by design: `completedChapters` resets with the life, so chapters 1–3 pay ~145 gems per life (OWNER) |
| reroll a weekly action by reload/rewind — Contacts interactions, weekly event pick, disease, event payoffs | BLOCKED (life-seeded) |
| reroll — dark web job stages, market buys, election, lawsuit, R&D patent, Pulse follow-back | PARTIAL: fresh `Math.random` per call, but the save is immediate so only a priced Time Machine rewind rerolls (P3) |
| hack caught-roll keyed per (life, week) with no attempt index → a safe week is safe for unlimited runs | P3 LATENT: `performHack` has no UI caller |
| duplicate relationships — meetSomeone, Spark promotion / re-match, intro favour | BLOCKED (idempotent ids, `resolveMatchPromotion` on `prev`) |
| partner income, IOU, support event, gift/date farming, marry/divorce loop | BLOCKED |
| ad orb VITALITY grant (+100 all three stats, real-time respawn, week-ungated, bypasses `scaledHappinessGain`) | P3 / OWNER |
| free Call farming | PARTIAL by design (OWNER, Program 12 §19) |
| > $10k grant reachable in 20 weeks by repetition | none found |

## 7. Events and live ops (Phase 7)

Measured against `tasks/event-delivery-2026-09-04.md` on HEAD:

| measure | Program 13 | HEAD |
|---|---|---|
| authored / weight-0 sequels | 365 / 16 | 365 / 16 |
| ever eligible / competing (12 lives × 150 w) | 118 / 107 | 119 / 108 |
| ever selected (12 lives × 150 w) | 78 | 76 (inside the report's own ±6 churn) |
| distinct ids, 50 lives × 100 w | 108 | 105 |
| events answered per life (50 lives) | — | min 6 / mean 17.8 / max 26 |
| cross-life exact overlap | 9.4% | 10.3% |
| same-life byte-identical replay | pass | pass |
| weight response (`gym_invite` ×20) | 0.96% → 4.86% | 0.66% → 5.30% |
| reachability, 17 archetypes | 226 / 365 | 226 / 365 |
| interruption budget / arc completion | hand-derived | **not measured** — no harness emits the decomposition (HUMAN) |

Two findings in `lib/events/seasonalEvents.ts`, the file PR #190 touched:

- **Fixed — the seasonal roll was keyed on the week alone.** `shouldTriggerSeasonalEvent`
  seeded a local `Math.sin` PRNG on `(season index, event id)`, so every life of
  the same starting age drew the same festival schedule — the Program 13
  defect, alive in a side channel `weekOnlyRollAudit` cannot see because it is
  not `makeWeeklyRoll`. Confirmed: a ten-year schedule byte-identical across
  two lineages at three starting ages. `lifeSalt(state)` is folded into the
  seed now; the same life replays the same schedule (pinned), two lineages
  differ (pinned), and the 2000-week engine cadence is unchanged (the
  `engine.test.ts` bound still holds).
- **OWNER — four holiday templates are starved.** A holiday template ANDs its
  holiday gate with the seasonal target week, which is start-biased across the
  whole season; the retimed holidays sit at the END of theirs. Over 100
  game-years on the real module, at ages 18/20/25: Thanksgiving fires in
  **0** years, Christmas / Valentine's / Black Friday in **~1**, Halloween /
  New Year / Independence Day in 4–7, Easter 10–11, spring/summer festivals
  20–31. Drawing the target inside the window fixes it in ten lines and I
  tried it: every template then fires in ≥5 of 100 years — and the 2000-week
  event cadence rises **0.218 → 0.254** past the owner's 0.22 ceiling, because
  seasonal events are appended AHEAD of the weighted pick and twelve templates
  coming alive add their authored 22%/season each. The ceiling is the
  interruption budget Programs 1–6 won; the season modal's own copy promises
  "1–2 per season". Both are owner-authored and now provably in conflict, so
  the change is reverted and the four starved holidays are PINNED in
  `seasonalEvents.test.ts` (the test flips the day they are fixed). Options:
  (a) accept a higher cadence ceiling, (b) lower `CHANCE_PER_SEASON` for the
  windowed templates, (c) make seasonal events compete for the weekly slot
  instead of bypassing it. Not a blocker: nothing crashes, and the season card
  never promises a specific event.

Live ops (`lib/liveops`, 15 suites / 178 tests pass): fetch path has an 8 s
timeout and never throws on 404 / malformed JSON / offline; ladder is remote →
14-day cache → compiled-in; `paused` and `disabledEventIds` are honoured; caps
500 gems / $25k / 5 LP per event, ledger keyed `eventId@startsAt` and checked
against `prev` inside the updater, rolling 900/7 d budget. **The live URL
serves the repo file byte-for-byte.** Runway: published new 115 d / early
150 d / mid–endgame 192 d; compiled-in new/early **52 d** (`first_rungs` ends
2026-10-26). Findings: a payload carrying only `disabledEventIds` is ignored
from cache offline (P3, `remote.ts:159`); an offset-less `startsAt` parses
as device-local time (P3, both calendars use `Z`); a remote republish with a
changed `startsAt` mints a new claimable instance (P3/OWNER — it is also the
rerun mechanism; document "never change `startsAt` on a correction"); the
compiled-in Q4 on-ramp for offline new players is thin (OWNER).

## 11. Release configuration (Phase 11)

| check | result |
|---|---|
| STATE_VERSION 51 | consistent in CLAUDE.md, DEV.md, WORKFLOW.md, `initialState.ts` |
| 11 workflow YAMLs | all parse |
| `eas.json` | production ads/IAP/ATT/RC/Firebase on, Boring off, `autoIncrement`, `appVersionSource: remote`; live-ops URL identical in production and preview |
| RevenueCat key names | `EXPO_PUBLIC_RC_IOS_KEY` / `_ANDROID_KEY` / `_API_KEY` consistent across service, runbook, RELEASE_SECRETS, preflight §9 |
| Save HMAC | `EXPO_PUBLIC_SAVE_HMAC_KEY` consistent; production is fail-closed (a build without it cannot start a life — "Build Configuration Error"). Preflight §8 can only WARN locally because the key lives in the EAS env; the cloud workflow runs preflight `continue-on-error` |
| preflight (`--platform ios`) | exit 0; every section PASS except §8/§9 WARN (keys not local), §10 WARN "iOS interstitial ad unit not configured", §11 WARN 14 unreferenced images |
| `package.json` version | **was 2.12.0 and 2.12.0 is on TestFlight (run #71)** — bumped to **2.13.0** in this program |
| `WHATS_NEW.md` | had no entry past 2.11.0 — a 2.13.0 draft is added, marked for owner trim |
| runbook | four stale numbers ("Currently 2.9.0", 919/920 warnings, 545 suites, 2.8.x) refreshed; the "currently" value is no longer hard-coded |
| CLAUDE.md | preflight is seven gates, not five; `entry.ts` is 32 lines, not 17 — both refreshed |
| `docs/STORE_LISTING.md` | says "monthly gem drop"; code grants daily. The authoritative copy is `marketing/aso/metadata.mjs`, which does not make the claim (P3) |
| analytics | production sets `EXPO_PUBLIC_ENABLE_FIREBASE` but not `EXPO_PUBLIC_ENABLE_ANALYTICS`, so the self-hosted telemetry queue is off unless the EAS env supplies it (OWNER — `docs/ANALYTICS.md` calls this the historic failure mode) |
| interstitial ad unit | preflight §10 warns the iOS interstitial id is not configured locally; the listing advertises year-end interstitials (OWNER: confirm the id is in the EAS production env) |

## 13. Build graph (Phase 13)

`git diff 9fe90c5..HEAD`: 103 files, +5101/−322. The only dependency change
is the REMOVAL of `uuid` (it crashed Hermes via `crypto.getRandomValues`;
no importers remain, no `crypto.randomUUID` in app code). No new
`__DEV__` / `process.env` / `import()` / `React.lazy` in screen files; the
two sub-app maps stay eager; native SDKs are `require()`d in try/catch;
`entry.ts` imports only `expo-router/entry`. Startup suite 9 suites / 92 tests
pass; 17 routes, no conflicts. Web export succeeds (it is what the replay in
§9 ran against). iOS production export: see §17.

## 14. Findings — the one table

| # | finding | sev | evidence | repro | root cause | release impact | action |
|---|---|---|---|---|---|---|---|
| 1 | `npm run preflight` was RED on main: 721 lint warnings vs a 719 ceiling | **P1** | `scripts/check-lint.js` on `ab61f90` | run it | `__tests__/economy/seasonalEvents.test.ts` (PR #190) merged with two inline `require()`s and a ternary-as-statement | the release gate cannot pass | **fixed**; ceiling lowered to the measured 716 |
| 2 | 2.12.0 already on TestFlight (run #71, `d845b9e`); the next build would ship a second binary labelled 2.12.0 | **P1** | Actions history; `package.json` | — | §9 "bump for every build" not done after the screenshot fixes | crash reports and TestFlight builds unorderable | **fixed**: 2.13.0 |
| 3 | Death screen "N yrs lived" divides the ABSOLUTE week counter | **P1** | `components/DeathPopup.tsx:711`; capture `death-360.png` | Dev Tools → Trigger Death at age 20, week 1 → "2 yrs lived" | §4.2 class: `weeksLived` is age-seeded | wrong number on the most-shared screen | **fixed**: `weeksInThisLife`; render test |
| 4 | Spark Premium / Verified Pro sheets raise alerts the root host cannot present on iOS (dead "Cancel subscription" tap) | **P1** | `BaseModal.tsx` has no `AlertHost`; `SparkPremiumUpsellModal.tsx:75`, `VerifiedProUpsellModal.tsx:81` | Mobile → Spark → Upgrade → Cancel subscription | `nestedAlertHosts` guard matches `'<Modal'`, not `'<BaseModal'` | field-reported class ("button lights up and does nothing") | **fixed**: host inside `BaseModal`, guard extended. Device confirm: HUMAN |
| 5 | Seasonal roll keyed on the week alone — every life of a starting age sees the same festivals | **P1** (deterministic-contract violation) | `seasonalEvents.ts:213-227`; schedule byte-identical across lineages | probe | local PRNG outside `makeWeeklyRoll`, invisible to `weekOnlyRollAudit` | Program 13's defect in a side channel | **fixed**: `lifeSalt` folded in; lineage + replay pinned |
| 6 | Thanksgiving fires 0/100 years; Christmas, Valentine's, Black Friday ~1/100 | P2 → **OWNER** | §7 | run the pinned test | holiday gate vs start-biased target week; fixing it lifts cadence 0.218→0.254 past the 0.22 ceiling | dead holiday content, no crash | owner picks ceiling vs copy; four ids pinned |
| 7 | `WHATS_NEW.md` had nothing past 2.11.0; runbook carried four stale numbers; CLAUDE.md under-described preflight | P2 | §11 | — | docs not updated at 2.12.0 | operator copies stale copy / follows a downgrade example | **fixed** (draft notes for owner trim) |
| 8 | `liveOps` claims not carried across prestige while `achievements` is | P2 / OWNER | `lib/dynasty/transition.ts:41-45` | prestige after claiming an `achievements_unlocked` event | v49 "absence resolves" + transition written before liveOps | one extra capped reward per prestige | owner: carry the ledger or document per-life claims |
| 9 | RC path: a charged gem pack whose grant fails has no in-app retry; native Restore can close a failed MIXED consumable grant | P2 | `IAPService.ts:1019-1048`, `2272-2283` | needs a save-I/O failure mid-purchase | consumables excluded from restore by design | rare; support refund | post-release: pending-grant record; synthetic restore id for mixed SKUs |
| 10 | WHATS_NEW 2.11.0 over-claims offline membership (deliberate bounded clear when RC never fetched) | P2 / OWNER | `SubscriptionActions.ts:398-410` | reinstall offline | copy vs code | expectation mismatch | owner wording |
| 11 | Happiness: social personas pinned at median 95–98 with 117–291 flat weeks; CAREER = WEALTH to the decimal; the bottom half now reachable for solitary lives at 250+ weeks | OWNER | §5 | soak | Program 14 §11/§17, unchanged | balance | owner tuning pass |
| 12 | Ad orb VITALITY grant is real-time, week-ungated, +100 to three stats, bypasses the happiness curve | P3 / OWNER | `AdRewardOrb.tsx:352-386` | watch, wait 6–10 min, repeat | design | stat pinning, bounded cash | owner |
| 13 | Fresh-start gem stash lands before `deleteSaveSlot`; v11/13/14 migrations throw on a `null` element; dev-build vs store-build HMAC | P3 / HUMAN | §2 | storage failure / corrupt array / tester devices | — | none for customers | post-release |
| 14 | Live ops: cache ignores a disable-only payload offline; offset-less `startsAt`; republish with changed `startsAt` re-pays; compiled-in Q4 runway 52 d | P3 / OWNER | §7 | — | — | bounded by caps + budget | post-release / author Q4 on-ramp |
| 15 | Bank Pro "Week 104" chips; UI ratchets at zero headroom; `showZeroStatPopup` dead flag; `showStatsBar` route gate string-matched | P3 | §9, §3 | — | — | cosmetic / fragility | post-release |
| 16 | Interruption budget / arc completion have no reproducible harness | HUMAN | §7 | — | — | unverifiable claim | add the decomposition to `eventTelemetry.sim` |
| 17 | Store-side: sandbox purchase/restore/relaunch, RC entitlement ids, intro offer, Play acknowledgement, VoiceOver, larger fonts, iOS Modal presentation, EAS env has HMAC + RC + interstitial ids | HUMAN | — | — | — | — | device + dashboard checks before submit |

## 16. Scorecard (0–100, honest)

| dimension | score | basis |
|---|---|---|
| startup safety | 90 | entry.ts dumb, eager sub-app maps, boundaries everywhere, startup suite green, web export renders; iOS export in §17 |
| save integrity | 92 | 509 save tests + real-pipeline probe of every carve-out; no version change needed; two P3 edges |
| deterministic simulation | 94 | 150-week replay and 120-week save/load continuation identical on HEAD; one side-channel roll found and fixed |
| economy integrity | 85 | nine personas + six shocks: no printer, no runaway, no dead end; CAREER CLIMBER's −$41k at 250 w is a loan story, not a trap |
| social integrity | 82 | every farm attempt blocked; bond ladder still ratchets to 100 and a free Call is free (owner) |
| progression integrity | 85 | chapter rewards tick-granted and idempotent; per-life gem repeat is by design (owner) |
| event integrity | 72 | delivery numbers hold; four holidays starved (owner); budget decomposition unmeasured |
| live ops safety | 84 | caps, ledger, budget, kill switch verified; published URL byte-identical; 3 P3s |
| monetization safety | 86 | 454 tests; every grant atomic; two rare fulfilment edges; store-side HUMAN |
| modal / input safety | 84 | 99 surfaces; one P1 fixed; one residual P2 (queued-alert sync teardown) unobserved |
| UI quality | 80 | six screenshot fixes hold on a real export; 360 pt clean; ratchets at ceiling |
| accessibility | 65 | labels present where checked; VoiceOver / large font unverified (HUMAN) |
| TestFlight readiness | 78 | version bumped, notes drafted, preflight green after the lint fix; export + device checks outstanding |
| release-process integrity | 80 | gate was red on main and nobody saw; docs drifted at 2.12.0 — both fixed, cause noted in lessons |

**Counts.** P0: **0**. P1: **5** (all fixed in this program). P2: 6 (none
blocking; two are owner copy). OWNER: 9. HUMAN: 6.

## Verdict

**YELLOW — release after the blockers below are closed.** Nothing found can
corrupt a save, lose a purchase, or soft-lock the game. What can still stop
the update is now a short, specific list (see `tasks/todo.md` → RELEASE
BLOCKERS): the fixes in this branch must merge, the iOS export must succeed,
and the EAS production env must carry the HMAC and RevenueCat keys; the rest
is device verification.

## 17. Fixes and verification (Phase 17)

Changed in this program (all minimal, all root-cause, no contract weakened):

| file | change |
|---|---|
| `components/ui/BaseModal.tsx` | `<AlertHost />` inside the Modal — covers all 22 consumers |
| `__tests__/tooling/nestedAlertHosts.test.ts` | pins the BaseModal host and counts the BaseModal consumers that raise alerts |
| `components/DeathPopup.tsx` | "yrs lived" from `weeksInThisLife` |
| `__tests__/render/deathScreenLifeLength.render.test.tsx` | new: age-25 week-one death reads "1 wks", not "7 yrs" |
| `lib/events/seasonalEvents.ts` | `lifeSalt` folded into the seasonal seed; the starved-holiday trade-off documented in place |
| `__tests__/economy/seasonalEvents.test.ts` | lint fix (the two warnings that broke the ratchet); new: every template's real `condition` over 100 years × 3 starting ages, the four starved holidays pinned, lineages differ, same life replays |
| `scripts/lib/lintRatchet.js` | ceiling 719 → 716 (measured) |
| `__tests__/simulation/happinessLongRun.sim.test.ts` | new `RUN_*`-gated harness (Phase 5); flushes its dump after every test |
| `package.json` / `package-lock.json` | 2.12.0 → 2.13.0 |
| `WHATS_NEW.md`, `docs/RELEASE_RUNBOOK.md`, `CLAUDE.md`, `tasks/todo.md`, `tasks/lessons.md` | notes draft, stale numbers, preflight description, the four lists, five lessons |

Soaks re-run AFTER the seasonal change: `RUN_REPRO_SIM=1 RUNS=2 WEEKS=60` —
five personas identical field-for-field; `lifeReproducibility` and both
determinism audits pass.

**Real iOS production bundle** (`expo export --platform ios --clear`):
succeeds, **3 998 modules**, 13.5 MB Hermes bytecode. The web export that the
§9 replay ran against also succeeds.

The final gate run on the changed tree:

| gate | result |
|---|---|
| `npm run type-check` | clean |
| `npm run type-check:tests:ratchet` | 0 (baseline 0) |
| `node scripts/check-lint.js` | 0 errors, **716 warnings (ceiling 716)** — was 721/719 on main |
| `npm run lint:errors` | clean |
| `npm run check:routes` | 17 routes, no conflicts |
| `npm run check:aso` / `check:content` / `check:liveops` / `ui:ratchet` | pass / at or above every floor / every stage has runway / at ceiling ×3 |
| `node scripts/preflight-check.js --platform ios` | ALL PREFLIGHT CHECKS PASSED (WARN: HMAC + RC keys not verifiable locally, iOS interstitial id, 14 unreferenced images) |
| `expo export --platform ios` | 3 998 modules, 13.5 MB Hermes bytecode |
| full `npx jest --ci` (first pass, after the code fixes) | 760 suites, 9 587 passed, 0 failed, 32 `RUN_*` soaks skipped |
| full `npx jest --ci` (after the version bump) | **1 failure**: `whatsNewFeed` pins the in-app changelog's first entry to `package.json` — the bump needs a 2.13.0 entry in `lib/config/changelog.ts`. Written (player-facing, bullets ≤ 95 chars, jargon-free per the feed's own rules); see the rerun below |
| full `npx jest --ci` (final) | see the last line of this file |

That failing test is worth naming as a release-process fact: **bumping the
version without a changelog entry is caught by the suite, not by preflight.**
The runbook's Part 1 now says so.

**Final full `npx jest --ci`: 760 suites passed, 9 609 tests passed, 0 failed,
32 skipped (the `RUN_*`-gated soaks).**

## Next step

Merge this branch, confirm the EAS production env holds the HMAC and
RevenueCat keys, trim the drafted release notes, and cut 2.13.0 from the
merge commit. Everything after that is on the RELEASE VERIFICATION list in
`tasks/todo.md` and needs a device.
