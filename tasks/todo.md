# Active — Master Program 16: release blocker closure (2026-09-06)

Branch `claude/deeplife-release-blockers-7wcdpg`, on `main` at `47595f5`.
Report: `tasks/release-blocker-closure-2026-09-06.md`. Input:
`tasks/release-readiness-2026-09-04.md` (Program 15).

Verdict **YELLOW — every code-side release blocker is closed; what remains is
device verification and two owner calls.** P0: 0 before, 0 after. P1: 5 before,
5 closed (all by Program 15, all re-proved here on the merged head). Two P2s
were closed here; the rest of the P2/P3 list is unchanged and below.

## RELEASE BLOCKERS (must close before the build)
- [x] `npm run preflight` was red on main (721 lint warnings vs 719) — fixed at
      the source, ceiling lowered to 716. **Re-measured on HEAD: 0 errors, 716/716.**
- [x] 2.12.0 is already on TestFlight (run #71) — `package.json` bumped to 2.13.0.
      **Still valid: the Actions API shows run #71 (2026-09-04) is the newest iOS
      build, so 2.13.0 is unshipped and needs no second bump.**
- [x] Death screen "N yrs lived" read the absolute counter — `weeksInThisLife`.
- [x] Spark Premium / Verified Pro cancel confirm raised from a `BaseModal`
      with no `AlertHost` (dead tap on iOS) — host inside `BaseModal`, guard extended.
- [x] Seasonal roll keyed on the week alone — `lifeSalt` folded in.
- [x] Merge the audit branch to `main` — done; `origin/main == 47595f5`, which is
      this branch's base. The build is cut from here.
- [x] HMAC key confirmed present as a GitHub secret and passed to both the
      preflight and the build step (iOS and Android). Blocker closed.
- [x] RevenueCat IS set up — the keys live in the EAS production env store, not
      in GitHub secrets, which is why preflight could not see them. This audit
      briefly recorded the opposite; that conclusion is retracted in report §18,
      along with the sandbox / verify-token / eas.json findings built on it.
- [x] Preflight now runs inside the EAS production environment
      (`eas env:exec production "…" --non-interactive`, with an Expo/EAS login
      step ahead of it) on both local-build workflows, so the RevenueCat and
      save-signing keys are actually VERIFIED instead of warned about.
- [x] **Native restore recorded the REAL store transaction id for a MIXED
      consumable** (Mega Pack: 40 000 gems + permanent entitlements). The
      listener dedups store REDELIVERY on that id and finishes the transaction,
      so a Restore tap after a failed grant closed the retry and the gems were
      gone — and tapping Restore is exactly what the failure message tells the
      player to do. Fixed with `nativeRestoreLedgerId`; the RevenueCat path
      (the shipping one) was already correct, so this hardens the fallback.
- [x] **`WeddingPopup` could raise a flag nothing could lower** — it returns
      `null` with no partner name and is the only thing that clears
      `showWeddingPopup`, which suppresses every interrupting surface in the
      game while set. The renderer that declines now releases the flag.
- [ ] **Watch the first workflow run after the `env:exec` change** in the Actions
      tab. Preflight can now fail loudly where it used to warn, which is the
      point, but it is a new failure mode (report §18, HUMAN). **Confirmed still
      pending: run #71 predates the change, so no run has exercised it.**
- [ ] Trim the drafted v2.13.0 entry in `WHATS_NEW.md` before it goes to the store.

## RELEASE VERIFICATION (device / dashboard — cannot be done from the repo)
- [ ] Sandbox: buy a gem pack, buy the Revival Pack, subscribe, restore, relaunch mid-purchase (iOS + Play).
- [ ] RevenueCat dashboard: entitlement ids `ads_removed` / `premium`, intro offer on `deeplife_premium_*`.
- [ ] iOS: open Spark → Upgrade → Cancel subscription and Pulse → Verified Pro → Cancel; the confirm must appear.
- [ ] iOS: death → Start New Life, death → Revival Pack → return; wedding popup Continue.
- [ ] VoiceOver pass on Home / Apps / Bank Pro; largest Dynamic Type on the death screen.
- [x] `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` confirmed present and passed to the build; the preflight warning was local-visibility only.
- [ ] Decide `EXPO_PUBLIC_ENABLE_ANALYTICS` for production (the self-hosted queue is off without it).

## PLAYER BUG REPORTS (2026-09-05) — see tasks/player-bug-triage-2026-09-05.md
- [x] Life Skills modal was unclosable on iOS: the header pushed its own close X
      off the card, and it was the only exit. Photographed before and after.
- [x] One lost election permanently barred the political ladder (tenure reads 0
      once you are out of office, so every rung above Council refused forever).
- [x] Lobbyists could never be re-hired after an office exit, and vanished from
      the catalogue.
- [x] Health commitment progress was advertised and never applied; the health
      tab and hobbies modal quoted base energy while the actions charged the
      modified cost.
- [x] Verified already fixed at HEAD: recurring milestone pop-ups (v50), the
      marriage/spouse/family-page defects and the forever-engaged wedding
      (fffe9e9), the dead Unlock button (fffe9e9 + BaseModal host).
- [ ] Ask the tester to re-verify on 2.13.0 — every report was filed against
      binary 2.5.8, and several were already fixed in builds they have not seen.

## POST-RELEASE
- [ ] IAP: persist a pending-consumable-grant record on the RC failure branch, so
      a charged pack whose grant fails has an in-app retry. **(The synthetic
      restore id for MIXED consumables is done — Program 16 §3.1.)**
- [ ] Save: null-guard the v11/v13/v14 loops. **Re-proved (Program 16 §4.2): it
      does NOT throw out of `runMigrations` and the save stays loadable — the
      chain halts at the last good version and `hydrateLoadedState` repairs. What
      the original finding missed is that it never recovers either: the hydrated
      state keeps `version: 10`, repair does not strip the `null`, and every
      later load fails the same migration identically. Such a save plays on
      permanently un-migrated. Still no known producer of a `null` element.**
- [ ] Save: the fresh-start carry-over ordering. **Do NOT simply move the stash
      after `deleteSaveSlot` (Program 16 §4.1): that converts "a soft currency
      could be applied twice" into "a paid entitlement is destroyed" at the same
      single await. If it is fixed, it needs a two-phase record — write pending,
      delete, mark committed — that a later new-life build reconciles.**
- [ ] Live ops: honour a disable-only payload from cache; require a UTC offset in `parseInstant`; document "never change `startsAt` on a correction"; author the Q4 compiled-in on-ramp.
- [ ] Events: add the interruption-budget / arc-completion decomposition to `eventTelemetry.sim`; consider a pity floor (one seed answered 6 events in 100 weeks).
- [x] Modal: clear `showWeddingPopup` in the `!weddingPartnerName` branch — done
      (Program 16 §3.2).
- [ ] Modal: make `AlertHost` defer a queued handler that tears down its own
      Modal. **Analysed and deliberately left (Program 16 §4.3): the obvious fix
      (a pending-action QUEUE, always deferred) would run handler #1 up to 350 ms
      late — potentially after the player has answered alert #2 — reordering two
      real decisions to close a hazard with no known caller.**
- [ ] Bank Pro: "Week 104" chips print the absolute counter.
- [ ] `docs/STORE_LISTING.md` "monthly gem drop" → daily, or mark superseded.
- [ ] Hack caught-roll: fold an attempt index into the key before any UI is wired.

## OWNER DECISIONS
- [ ] PAC spending is HALF as efficient as spending cash directly ($10k per
      approval point vs $5k), while its own comments promise 1.5x. Not visible
      to the player, so nothing on screen lies — but a player who banks money
      into the PAC to spend it gets a worse rate. Fix the rate (a 3x buff to a
      money sink) or the comments, not both.
- [ ] Party "Standing" drifts toward 50, so above it the score decays 1/week
      unconditionally and holding the 60-point endorsement needs a favoured
      bill roughly every 6 weeks from a one-shot pool. Also, the party card
      says enacting the platform raises standing but never names which
      categories the party favours — the tester asked for exactly that.
- [ ] DeepLife+ benefits are cleared on a launch where RevenueCat has never
      successfully fetched (fresh reinstall offline, or a blocked host) — a
      deliberate bounded clear, and the RevenueCat SDK's own offline cache
      normally covers it. Keep it and soften the 2.11.0 release note that says
      membership never switches off offline, or accept the wording (report §18,
      restoring §12 finding #1).
- [ ] Holidays: Thanksgiving fires 0/100 years, Christmas / Valentine's / Black Friday ~1. Fixing it lifts the 2000-week event cadence 0.218 → 0.254 past the 0.22 ceiling. Pick: raise the ceiling, lower `CHANCE_PER_SEASON` for windowed templates, or make seasonal events compete for the weekly slot. Four ids pinned in `seasonalEvents.test.ts`.
- [ ] Happiness: social personas pinned at median 95–98 (117–291 flat weeks of 250–500); CAREER-OBSESSED = WEALTH MAXIMIZER to the decimal; solitary lives now reach the bottom half after 250 weeks. Tuning pass (Program 14 §17), not a mechanism change.
- [ ] `liveOps.claimedInstanceIds` across prestige: carry it, or document per-life claims.
- [ ] Chapter gems re-earned every life (~145/life) — once per lineage instead?
- [ ] Ad orb vitality grant: week-ungated, +100 to three stats, bypasses the happiness curve.
- [ ] Free Call has no time cost; regular contacts still ratchet to bond 100 by week 250.
- [ ] WHATS_NEW 2.11.0 "membership no longer switches off offline" is only true when RevenueCat has ever fetched; soften or accept.
- [ ] `showStatsBar` route gate: the string-matched exclusion list would hide the death screen for a new tab named e.g. `perks`.

---
# Archive — Playtest screenshot fixes (2026-09-04) (COMPLETE)

Branch `claude/game-problems-xnap1l`. Four TestFlight screenshots, eight defects,
all traced to source before any change. Owner decisions recorded inline.

## Phase 1 — the season/month disagreement. STATUS: **done**
`getCurrentSeason` labels weeks 0-12 of the year "spring", but every life starts
in **January** (`computeWeeksLived = (age-18)*52`, always a multiple of 52), so
every season label sits one quarter ahead of the month the HUD prints beside it.
February rendered as "Spring Season".

- [x] 1.1 Derive the season from the SAME calendar the HUD shows
      (`resolveCalendar().monthNumber`), so the two can never disagree again.
      Owner's call: **Jan-Mar = Winter**, Apr-Jun Spring, Jul-Sep Summer,
      Oct-Dec Fall. Quarter boundaries already land exactly on weeks 0/13/26/39.
- [x] 1.2 Fix the knock-on: every seasonal event was firing a quarter early
      (Spring Festival in January, beach party in April, harvest in July).
- [x] 1.3 Test: the season must agree with the month for all 52 weeks.

## Phase 2 — holidays land in the wrong month. STATUS: **done**
Only Valentine's, Christmas and New Year were right. Easter fired in late
January, Independence Day in April, Halloween in August.

- [x] 2.1 Retime all eight to their real week-of-year (owner: retime all).
- [x] 2.2 Stop the clobbering: `halloween` was overwritten by `thanksgiving`
      and then `blackfriday` on the overlapping weeks, so Halloween had a
      ONE-week window instead of three. Give each a disjoint window.
- [x] 2.3 Test: each holiday resolves in its real month, and no week resolves
      to two holidays.

## Phase 3 — SeasonalIndicator display bugs. STATUS: **done**
- [x] 3.1 Off-by-one: `weeksUntilNext = 13 - weekInSeason` mixes the 0-based
      index with the `weekInSeason + 1` printed one row above, so "week 8 / 13"
      claimed the next season was 6 weeks out when it is 5.
- [x] 3.2 The holiday card is `#F8FAFC` with NO dark-mode override, and
      `holidayNameDark` is `#F8FAFC` — the holiday name is rendered as white
      text on a white card and has never been readable in dark mode.
- [x] 3.3 Four of the eight holidays (easter, independence, thanksgiving,
      blackfriday) have no icon entry, so `getHolidayInfo` returns null and the
      card does not render for them at all.

## Phase 4 — Bank Pro's giant empty box. STATUS: **done**
- [x] 4.1 `SegmentedControl`'s `scrollable` branch returns a horizontal
      `ScrollView`, whose RN default style is `flexGrow: 1, flexShrink: 1`. As a
      direct child of the screen's flex column it inflates to half the viewport.
      Hits Bank Pro and LuxuryApp — the only two `scrollable` callers.
- [x] 4.2 Test: the scrollable control must not be allowed to grow.

## Phase 5 — the market advertises what it does not pay. STATUS: **done**
- [x] 5.1 `renderFood` passes the raw catalogue `healthRestore`/`energyRestore`
      to the chips, so Instant Ramen advertised "+4 Health / +8 Energy" while
      satiety (v48) was paying +1/+2. Route the chips through
      `scaledFoodRestore` — the same helper the charge and the toast use.
      This is the advertised-vs-actual rule v48 exists to enforce.
- [x] 5.2 Test: the chips equal what `resolveFoodPurchase` applies.

## Phase 6 — toast spam. STATUS: **done**
- [x] 6.1 Three taps on Buy stacked three identical toasts over the HUD.
      Collapse a repeat of the message already on screen into a counted single
      toast instead of pushing a new one.
- [x] 6.2 Test: N identical messages render one toast.

## Phase 7 — the Apps grid. STATUS: **done**
- [x] 7.1 Tiles are a fixed `scale(112)` with content anchored to the top,
      leaving a large dead gap under every label. Size to content while keeping
      every tile in a row equal (owner flagged the dead space).
- [x] 7.2 DeepMail has no icon asset and no `mail.webp` exists, so it renders a
      grey outline glyph beside seven full-bleed icons and reads as unfinished.
      No matching art to author — give the fallback a real tint so it reads as
      an app icon rather than a missing one.

## Phase 9 — the one template the relabel broke. STATUS: **done**
- [x] 9.1 `winter_holidays` ("the city is decorated and festive", gifts, family)
      was gated on `season === 'winter'`, which is now Jan-Mar - so the relabel
      would have moved a December event into January. Re-gated on the MONTH,
      which is what the event was ever about; the season name was a proxy.
      Every other template improved under the relabel (Spring Festival moved
      from January to April, the harvest from July to October, winter sports
      from October to January), so this was the only one to retarget.

## Verification
- `npx jest __tests__/render __tests__/economy __tests__/tooling lib/events
  lib/economy utils/__tests__` — 201 suites, 2157 tests, all pass.
- `npm run lint:errors` clean. `npm run type-check` clean.
  `npm run type-check:tests` clean (baseline is 0).
- Two suites went red mid-way and both were mine to answer, not to relax:
  the owner's zero-em-dash rule for `.tsx` (comments included), and
  `engine.test.ts`'s event-frequency bound — see Phase 8.

## Phase 8 — the frequency test was under-powered, not violated. STATUS: **done**
- [x] 8.1 The season relabel turned `engine.test.ts` red at 0.230 vs a 0.22
      ceiling. MEASURED before touching it: the long-run cadence is 0.215
      before and 0.218 after, i.e. unchanged within noise, while the single
      100-week window the test samples swings 0.16-0.23 — and two other
      windows (weeks 160 and 360) already exceeded 0.22 on untouched code.
- [x] 8.2 Raised the SAMPLE to 2000 weeks. Bounds left exactly where the owner
      set them: lowering a gate to get unstuck is what CLAUDE.md 8 forbids.
      The seasonal share did rise slightly (0.033 -> 0.043 over 2000 weeks)
      because Halloween and Thanksgiving got their real three-week windows back.

## Phase 10 — captured, and one more defect found by capturing. STATUS: **done**
- [x] 10.1 `scripts/capture-screenshot-fixes.mjs` photographs all four changed
      screens against the static web export. Each shot ASSERTS its subject is on
      screen before writing, and the market step compares the food card's
      advertised restores before and after seven meals - measured
      `+4/+8/+2` -> `+1/+2/+1`, so the capture cannot quietly become a
      photograph of the bug.
- [x] 10.2 Bank Pro's container measured 456px tall without the fix and 58px
      with it, in the live page, by toggling `flexGrow` - the half-viewport box
      the player photographed.
- [x] 10.3 NEW DEFECT the capture found: the scrollable tab labels collapsed to
      bare icons on web. `flex: 0` expands to `flexBasis: auto` under Yoga and
      to `flex: 0 1 0%` (basis ZERO) under React Native Web, so the slot
      computed to 0px. Fixed in longhand; pinned. NOT a regression from 4.1 -
      tab width was identical (28px) with `flexGrow` forced back to 1.
- [x] 10.4 The season badge had no `accessibilityLabel` while its modal's close
      button did, so the HUD control announced as an unnamed button.

## Out of scope / flagged, not changed
- The Christmas-in-"Fall" consequence of the Jan-Mar=Winter mapping — see the
  note in `seasonalEvents.ts`. One constant table away if the owner wants the
  meteorological (Dec-Feb = Winter) split instead.

---
# Archive — Master Program 14 (COMPLETE)

# Master Program 14 — STAT SEMANTICS + DETERMINISM + DIFFERENTIATION — COMPLETE

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 13 (`9fe90c5`).
Programs 1-13 untouched. Report: `tasks/simulation-integrity-2026-09-04.md`.

**Result.** The simulation is deterministic: the same life replayed produces the
same life, field for field, week for week, and so does a life continued from a
saved game. Seven defects, three guards. Happiness had compressed every persona
into 90-97; it now diminishes as it rises, which cut ceiling-weeks 24-31% and
widened the median spread 85% — real, measured, and partial (see Phase 11).

## Phase 1 — determinism audit. STATUS: **done** (report 1-2)
Program 13 named `Date.now()` as the likely cause of the non-reproducible tick.
**That was a hypothesis and it was wrong**: freezing the clock for a whole run
changed nothing. The obvious instrumentation failed too — a probe replacing
`Math.random` recorded ZERO calls, because `earlyGameSim` seeds the global for
its own runs and overwrote the probe. A draw that is unreproducible in the app
looks reproducible in a test, which is why the eventual guard is static.

## Phase 2 — isolate the divergence. STATUS: **done** (report 2)
Seven rounds of "diff two identical runs field by field, fix the first field
that differs, diff again": `generateNPCGoals` (Math.random ON THE TICK), memory
ids, the disease-cure rolls, Spark ids, checkpoint ids, the whole Pulse posting
path, and `playConversationOption`'s default roll. Plus `checkViralChance`,
which carried an "ANTI-EXPLOIT: deterministic hash instead of Math.random()"
comment over a hash of `Date.now()`.

## Phase 3 — same-life reproducibility. STATUS: **done** (report 4)
5 personas x 3 runs x 80 weeks, every field every week. All pass.

## Phase 4 — save/load reproducibility. STATUS: **done** (report 5)
Continuing from a round-tripped save (through the real `hydrateLoadedState`)
matches continuing straight through. One documented normalization.

## Phase 5-8 — the happiness equation, ledger, saturation, distribution
- STATUS: **done** (report 7-9). Root cause is NOT the cap: unbounded linear
  inflow against one fixed drain, with the clamp discarding the surplus. The
  romance life spent **132 of 149 weeks with happiness moving by exactly zero**;
  weeks below 50 were **zero for all six personas**; CAREER-OBSESSED and WEALTH
  MAXIMIZER were identical to the decimal; and a life knocked to 20 converged on
  the identical trajectory within ~25 weeks.

## Phase 9-10 — differentiation + second-order. STATUS: **done** (report 6, 13)
25 lives vary (happiness sd 8.0, net worth sd $6.3k) while repeats do not. No
happiness->health or happiness->energy loop exists to run away.

## Phase 11 — implementation. STATUS: **done** (report 10-12)
`lib/economy/happinessGain.ts`, the `closenessFalloff` / food-satiety pattern
applied to a third flat ladder. Four choke points, chosen by measurement: the
first cut used the two obvious ones and barely moved the distribution because
they carry 1-3.5 points a week out of a much larger flow.
**Did NOT achieve**: romance is still pinned (136/150 weeks at 95+), career and
wealth are still identical, and weeks below 50 is still zero. Halving the
falloff floor was tried, measured to buy nothing (12.18 -> 12.29), and reverted.

## Phase 12-14 — long-run, red team, verification. STATUS: **done** (report 16-18)
Measured to 150 weeks; 250/500 not run. Four save-scum rerolls closed. Six
suites failed on the first full run and every one was inspected rather than
adjusted — two were em dashes I introduced, four were exact-value assertions
that the curve legitimately shifted.

# Master Program 13 — WORLD SIMULATION + EVENT DELIVERY — COMPLETE

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 12 (`f405c91`).
Programs 1-12 untouched. Rule of the program: **measure the pipeline before
changing it**. Report: `tasks/event-delivery-2026-09-04.md`.

**Result.** The weekly event roll was seeded on the WEEK ALONE, so every life in
the game drew the same number in week N and explored ONE sample of a
365-template pool. Twelve lives reached 33 distinct events; the same twelve on
the same seeds now reach 78, and fifty lives reach 108 instead of 30. Nothing
authored, no weight tuned, no save field added.

## Phase 1 — pipeline map + the Program 12 lead. STATUS: **done** (report §1-3)
`lib/events/engine.ts` built its roll with `makeWeeklyRoll`, keys
`'event-jitter'` / `'event-fire'` / `'event-pick'`. None carried the life salt.
`pickWeighted` was never broken — there was one sample of the distribution per
week and it was the same sample in every life, so moving a span only changes the
answer if it straddles that fixed point. Directly violated CLAUDE.md §4.3.

## Phase 2 — telemetry harness. STATUS: **done** (report §5)
`eventTelemetry.sim` over 50 lives x 100 weeks. Distinct ids 30 -> 108, exact
pairwise overlap 28.3% -> 9.4%, same-life replay still byte-identical.

## Phase 3 — reachability. STATUS: **done** (report §7)
`eventReachability` (pure, in the normal suite): 17 archetype states, 226/365
reached, its own ratchet. Both jumps while writing it (137 -> 183 -> 226) were
PROBE bugs, not game bugs.

## Phase 4 — randomness audit. STATUS: **done** (report §8)
Every `makeWeeklyRoll` call site classified, and the classification is
machine-checked by `__tests__/tooling/weekOnlyRollAudit.test.ts`. Verified to
FAIL on a planted violation before being kept.

## Phase 5 — weight responsiveness. STATUS: **done** (report §9)
20x on `gym_invite`: 0.96% -> 4.86% delivery share, 3 -> 16 deliveries. The first
attempt probed a 0.1-weight template and measured 0 vs 0 — underpowered, not a
null effect, and it is documented in the test.

## Phase 6 — the funnel. STATUS: **done** (report §6)
365 authored / 118 eligible / 107 competing / **33 -> 78 selected**. Eligibility
and competition did not move at all, which is the signature of a SELECTION
defect rather than a content or gating one.

## Phase 7 — cross-life variation + same-life replay. STATUS: **done** (§11)
Both hold simultaneously. Save-scumming a week is still ineffective.

## Phase 8 — life-stage distribution. STATUS: **done, not measured** (§12)
Structurally sound (all four packs tag via `.map()` at export and the pick
boosts them). A 100-week `food_courier` cohort cannot reach midlife or
seniority, so no claim is made.

## Phase 9 — interruption budget. STATUS: **done** (report §10)
The number that could have been a regression, decomposed: back-to-back event
weeks 21.3% -> 28.4%, but adjacent weeks where BOTH were independent pool picks
went **29 -> 29**. All the growth is multi-week authored arcs completing.

## Phase 10 — implementation. STATUS: **done** (report §16)
Three call sites in `engine.ts`. Plus four measurement harnesses and one static
guard. Nothing authored, no weight edited.

## Phase 11 — red team. STATUS: **done** (report §14). No new exploit surface.

## Phase 12 — regression. STATUS: **done** (report §15b)
Four existing gates failed and were ATTRIBUTED (engine stashed, tests re-run,
all passed on the old code) before being touched. Two happiness margins moved to
the p10 because the mean now saturates against the ceiling for every persona;
one pacing bound went 5 -> 6, measured across five lineages (6/5/3/6/6); and the
rarity test stopped pinning a single lucky draw and now asserts the legendary
stamp across twelve lineages (the secret wins 20 of 24, not 24 of 24).

## Phase 13 — verification. STATUS: **done** (report §21)
type-check clean, test-tree types 0, lint 0 errors / 719 warnings (ceiling 719),
routes clean, full suite green.

## Found and NOT fixed, deliberately (report §15c, §18)
- The tick is not deterministic across repeated runs in one process (identical
  event streams, differing happiness). Not `Math.random()` — a probe recorded
  zero calls — but `Date.now()` is read on the tick path. Predates this program.
- Happiness saturates at 90-97 for every persona once the catalogue is
  delivered. A balance question with an owner, not a same-commit tuning pass.

# Master Program 12 — RELATIONSHIP DEPTH + SOCIAL VALUE + CONSEQUENCES — COMPLETE

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 11 (`10001ab`).
Programs 1-11 untouched. Rule of the program: no money printing, no chores, no
new subsystems - an existing system plus a small state-aware rule. Relationships
stay OPTIONAL. Report: `tasks/relationship-depth-2026-09-03.md`.

## Phase 1 - what a bond buys. STATUS: **done** (report §3)
Measured with a controlled cohort experiment, not a code read: nine cohorts,
same policy, same seed, differing only in who was in the life and at what bond.
**Happiness, health and energy byte-identical** whether a life held nobody, one
soulmate or fifty acquaintances. 45 bought nothing; 60 bought a one-off $2,800;
75, 90 and 100 bought exactly what 60 bought.

ROOT CAUSE 1: the only wire between relationships and wellbeing ran ONE WAY -
`applyRelationshipHealth` could subtract 25/10/8/1-a-week and could add nothing.
ROOT CAUSE 2: a free `Call` paid a flat +3 at every score against a -0.5/week
decay, so any contact anyone ever rang ratcheted to 100 (measured: CASUAL SOCIAL
at avgBond 100 across 23 relationships). Nothing above the floor could mean
anything because everybody was already at the ceiling.

## Phase 2 - harness. STATUS: **done** - the §38 set is complete (twelve personas).
## Phase 3-6 - value / friendship / romance / family. STATUS: **done** (report §3-6).
## Phase 7-8 - consequence graph + emergent stories. STATUS: **done** (report §8, §14-15).
## Phase 9 - proposals, split SAFE / OWNER / REJECTED. STATUS: **done** (report §18-20).
## Phase 10 - implementation. STATUS: **done**, one commit:
- [x] `lib/social/closeness.ts` - one definition of what a bond means
      (estranged 25 / known 45 / close 60 / trusted 80) · `closeness.test.ts`.
- [x] The wire runs both ways: `happinessSupport`, +1 per close bond capped +3,
      mirroring the neglect drag exactly · `closeness.test.ts`.
- [x] `closenessFalloff` - a catch-up is worth less to somebody you already see.
      The root-cause fix for quantity-over-quality · `bondFalloff.test.ts`.
- [x] `lib/events/friendSupportEvents.ts` - four templates gated on a real
      crisis AND a trusted bond, bound to the person · `friendSupport.test.ts`.
- [x] The Happiness breakdown names the circle, from the same function the tick
      applies, and shows the line at ZERO so the gap is legible.
- [x] Program 11's partner-income fix re-verified under every §9 state ·
      `partnerIncomeBounded.test.ts`.
- [x] Four new gates in `socialBoundaries.test.ts`.
- [ ] NOT done, owner decisions (report §19): a free Call has no time cost (the
      one remaining imbalance); the weekly event pick is not life-salted; the
      support events are delivered by a channel that gives them ~1 appearance
      per life.
## Phase 11-13 - red team, regression, verification. STATUS: **done** (report §16-17, §22).

NO SAVE FORMAT CHANGE. `STATE_VERSION` stays at 50.

# Master Program 11 — SOCIAL LIFE + RELATIONSHIPS + FAMILY + EMERGENT STORIES — COMPLETE

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 10 (`4eaa778`).
Programs 1–10 untouched. Rule of the program: map first, measure on the real
tick, then fix in priority order (broken → hidden → meaningless → missing
connections → missing entry points → new content). Relationships stay OPTIONAL;
nothing here may become a weekly maintenance chore. Report:
`tasks/social-systems-2026-09-03.md`.

## Phase 1 — social system map. STATUS: **done** (report §1).
## Phase 2 — relationship entry audit. STATUS: **done** (report §2–3)
Only THREE producers of a `Relationship` existed — `promoteMatchToRelationship`
and `promoteMatchToFriend` (Spark, **tier 2**) and the `intro` favour, offered
only on a `business` contact (travel, **tier 3**). A tier-1 player had Mom and
Dad and no way to meet anybody, which is why `ch2_make_friend` had to count the
seeded parents and pay its share of the chapter bundle for nothing.
## Phase 3 — relationship depth audit. STATUS: **done** (report §4–6).
## Phase 4 — family audit. STATUS: **done** (report §9).
## Phase 5 — personal history / life moments. STATUS: **done** (report §10).
## Phase 6 — social persona simulation (real tick). STATUS: **done**
Seven personas × 250 weeks through the real `nextWeek()` with ten social actions
routed through the production modules. `__tests__/helpers/socialPersonas.ts`,
soak `RUN_SOCIAL_PERSONAS=1 npx jest socialPersonas`.
## Phase 7 — story variation. STATUS: **done** (report §11–12).
## Phase 8 — discoverability audit. STATUS: **done** (report §14).
## Phase 9 — exploit red team. STATUS: **done** (report §15) — two live exploits found.
## Phase 10 — proposals ranked. STATUS: **done** (report §17, seven proposals).
## Phase 11 — implementation. STATUS: **done**, two commits:
- [x] Partner income units: an ANNUAL salary was spent WEEKLY, so one Spark
      promotion paid up to $62,500/wk forever · `householdPartnerIncome` ÷
      `WEEKS_PER_YEAR` · `partnerIncomeUnits.test.ts`.
- [x] A tier-1 way to meet somebody · `lib/social/meetPeople.ts` + `meetSomeone`
      + the Contacts card · `meetPeople.test.ts`.
- [x] v51 `metAt` — where and when somebody entered the life; surfaced on the
      Contacts card and in the life story · `carveOutRoundTrip.test.ts`.
- [x] `ch2_someone_close` — one bond at 60, satisfiable by a loner who calls
      their mother · `wealthRatchet.test.ts`, `progressionIntegrity.test.ts`.
- [x] One person, one record (the unmatch → re-swipe duplicate) ·
      `duplicatePeople.test.ts`.
- [x] A renter can move in together (and therefore marry) ·
      `movingInWhileRenting.test.ts`.
- [x] Three dead verbs deleted from `SocialActionsContext`; lint ceiling 722 → 719.
- [x] The journal files a lost friendship as a relationship event.
- [x] Social boundary gates · `__tests__/simulation/socialBoundaries.test.ts`.
- [ ] NOT done, owner decisions (report §17): the `networking_opportunity`
      payoff delivering a person; NPC life events as situations; a cap or cost
      on Spark friend promotion; what a 100 bond should buy; a Home-screen
      social surface; life moments that name a real relationship; an end state
      for family estrangement.
## Phase 12 — gates + report. STATUS: **done** — `tasks/social-systems-2026-09-03.md`,
lessons appended, CLAUDE.md §7 (v50) and the social note updated.

# Plan — Discord bug triage, round 2 (2026-09-04)

Follow-up to PR #186 (merged). Three screenshots arrived after that landed and
they change two conclusions.

## What the screenshots proved

- **#5 App Initialization Error — the reporter's own theory was wrong, and the
  recording names the cause.** It is not achievements or discovery. The error
  text is `crypto.getRandomValues() not supported`, which is verbatim from
  `uuid`'s browser `rng.js`. Metro resolves `uuid`'s `browser` export for React
  Native, Hermes has no `crypto` global, and the repo ships no polyfill - so the
  single `uuidv4()` call in the codebase throws every time it runs. The screen
  then blames iOS ("This may be caused by an incompatible iOS version"), which is
  why the report reads as a version problem.
- **#3 Re-occurring pop-ups — my merged fix was for a DIFFERENT bug.** The five
  screenshots are toasts, not queued modal events: "You're now a parent",
  "Congratulations on getting married", the perfect-week celebration. These are
  `showOnce` milestones in `utils/smartNotifications.ts`, and the "already shown"
  record is a private `Map` on a module singleton - pure in-memory state that dies
  with the JS runtime. Every relaunch re-arms the entire backlog, because every
  condition (`hasSpouse`, `hasChildren`, `minMoney`) is still true. That is
  exactly "they pop up every time the game is refreshed". The pendingEvents
  dedupe I shipped was a real bug; it was not this one.

## Tasks

- [x] 1. Drop the `uuid` dependency. Its one call site mints an ad-impression
      correlation id, which needs uniqueness, not cryptographic randomness -
      a far smaller change than adding a native polyfill on the boot path. (#5)
- [x] 2. `AdMobService.trackBannerRevenue` evaluates `newImpressionId()` as an
      ARGUMENT, so the throw lands outside the try/catch that `BannerAd` says
      "fully swallowed inside the service". Make the guard true. (#5)
- [x] 3. Persist the `showOnce` notification record so a milestone the player has
      already been told about cannot fire again on the next launch. (#3)
- [x] 4. Verify: type-check, type-check:tests, lint, routes, save audit, full suite.

All four complete. Verification: type-check clean, type-check:tests clean,
check:routes OK, lint:errors 0, lint:ratchet 722/722, check:aso and check:content
OK, `npm run audit:save` clean — its `as GameState` count is 41, two lower than when
this round started, because the hand-cast state PR #186 introduced in
`applyWeeklyEvents.test.ts` was routed through `createTestGameState` as well.
Full suite: 743 suites / 9399 tests green.
The v50 carve-out row was added after `carveOutRoundTrip` correctly failed for
its absence.

## Deliberately not doing

- **Settings > Show Tutorial "incomplete"** - the reporter self-resolved it in a
  follow-up ("The FAQ help button next to settings more than makes up for this").
  A content gap, not a defect.
- **A `crypto.getRandomValues` polyfill.** `react-native-get-random-values` is a
  native module, so it lands under Hard Rule #4 (config-plugin alignment) and has
  to be imported before anything touches uuid - a boot-order hazard on the ad
  path. Removing the only uuid call removes the need entirely.
- **Persisting notification COOLDOWNS.** They are keyed on `Date.now()`, and a
  persisted wall-clock gate is the farmable shape CLAUDE.md warns about
  (v28/v31/v35/v40/v44). Only the showOnce set is persisted; a cooldown resetting
  on restart lets a warning repeat, which is not what was reported.

---

# Plan — Discord bug triage (2026-09-04)

Source: `#bug-reports` triage brief. All 8 current reports from `a.a.a8644` (BBQ),
build 2.5.8 (2026-07-20); HEAD is 2.12.0. Each item below was re-verified against
HEAD before planning — several of the brief's hypotheses did not survive that.

One limit worth stating: this clone's history begins at 2.9.0 (the 2026-08-18
repo-cleanup merge), so the reporter's 2.5.8 code is not reachable here and "was
this already broken then?" cannot be answered. Everything below is a defect that
is live at HEAD, which is what a future build would ship regardless.

## Findings that changed the brief

- **#2 Property / #6 Life Skills are ONE bug, not two.** Neither is a real-estate
  or skill-tree logic error. Both screens raise their confirm through `gameAlert`
  from inside an RN `Modal` that does not nest its own `AlertHost`. iOS refuses
  the root host's sibling Modal presentation, so the dialog never appears — "button
  lights up but nothing happens" — and the refused transparent presentation is what
  strands touches ("screen freezes"). `__tests__/tooling/nestedAlertHosts.test.ts`
  already documents the class and pins THREE files by hand; 13 more surfaces need it.
- **#1 Crypto Mines is not the `selectedCrypto` gate.** Measured on the real tick:
  electricity is charged out of revenue that has ALREADY been cut by the per-coin
  multiplier, the difficulty ramp and the halvings — while the cost itself is
  scaled by none of them. XRP mines exactly $0/wk at every fleet size; ADA hits $0
  the moment the automatic difficulty ramp reaches 2.0. That is permanent and silent.
- **#4 Activity Commitments is half-fixed at HEAD.** The bonus/penalty wiring landed
  (C-1, four sites). What is still live: `commitmentLevels` has an increment path for
  `hobbies` ONLY — career, relationships and health can only ever decay.
- **#7 part 1 root cause found.** The `wedding` random event's "marry" choice
  promotes `type` to `'spouse'` inline instead of via `buildSpouseRecord`, and never
  mirrors `family.spouse`. That single line produces all three reported symptoms.
- **#7 part 2 is not the unpushed branch.** `claude/fix-wedding-popup-stuck-state`
  does not exist in this clone or on `origin`. The real cause is `applyScheduledWedding`
  postponing an unaffordable wedding +4 weeks, silently, until it expires a year later.
- **#3 root cause found.** `applyWeeklyEvents` appends without deduping against
  `pendingEvents`, and `resolveEvent` removes one entry by index — so a template
  queued twice reappears after being answered.

## Tasks

- [x] 1. AlertHost: nest `<AlertHost />` in the 13 Modal surfaces that raise
      `gameAlert`, and replace the hand-maintained list in
      `__tests__/tooling/nestedAlertHosts.test.ts` with a derived scan so the
      inventory cannot rot again. (#2, #6)
- [x] 2. Mining: charge electricity against the fleet's own gross output rather than
      post-lever revenue, so the coin multiplier / difficulty / halving scale the NET
      instead of driving it to a hard zero. Mirror in `estimateWeeklyMining`. (#1)
- [x] 3. Mining QoL: "Sell all" for a rig tier. (#1, explicit request)
- [x] 4. Commitments: give career / relationships / health the increment path hobbies
      already has, at the three sites that already resolve their modifiers. (#4)
- [x] 5. Wedding event: route the `marry` promotion through `buildSpouseRecord` and
      mirror `family.spouse`; make `resolveFamilySpouse` adopt an unmirrored spouse so
      already-broken saves self-heal. (#7 part 1)
- [x] 6. Scheduled wedding: tell the player when a wedding is postponed for want of
      the balance, and when the plan expires. (#7 part 2)
- [x] 7. Events: do not queue an event whose id is already pending. (#3)
- [x] 8. Verify: `npm run type-check`, `type-check:tests`, lint, and the affected suites.

All eight complete. Verification: `type-check` clean, `type-check:tests` clean
(ratchet holding at 0), `check:routes` OK, `lint:errors` 0, `lint:ratchet` 722 /
ceiling 722, full `npm test` green. One snapshot updated deliberately
(`subsystemEquivalence` ETH mining, reasoning recorded at the test).

## Out of scope this pass (reported, not fixed)

- **#5 App Initialization Error** — the only evidence is a screen recording on the
  Discord thread. Investigate + report; do not guess a fix.
- **#6 clipped "X" on Pro Max** — a recurring device-class layout issue (three prior
  threads). Needs a device/simulator repro, not a static read.
- **Rigs at 0% durability still earn full yield** — real, but a nerf that needs
  balance measurement, and it is not what the player reported.
- **`app/_layout.tsx` gates the wedding/death popups on `showStatsBar`** — a real
  soft-lock risk, but it is a protected file whose checklist requires a TestFlight
  pass. Flagged, not touched.

---

# Master Program 10 — ECONOMY + PROGRESSION + LONG-TERM LIFE BALANCE — COMPLETE

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 9 (`a227a0b`).
Programs 1–9 untouched. Rule of the program: measure on the real tick before
touching a number; priority order broken formulas → exploits → dead
progression → missing tradeoffs → aspiration gaps → new content. The tier-1
"meeting someone" path is NOT implemented here (owner instruction) — it is
assessed and reported only. Report: `tasks/economy-progression-2026-09-03.md`.

## Phase 1 — economy map (code-read, no changes)
- Every flow with its source: wages (`lib/careers/careerData.ts`, 30 ladders),
  promotion progress (`applyCareerProgress`: 5 × early 2.5/1.5 × perf × pace),
  tax brackets (`lib/economy/constants.ts`), rent tiers (`lib/realEstate/rentals.ts`),
  property catalogue + mortgage + carrying costs, vehicles, luxury, health
  activities and food, dating/wedding/pets, education programmes + merit +
  student loans, savings/loans/cards (`lib/banking`), stocks (7%/yr drift,
  2% fee, quarterly dividends), crypto regimes, companies (founding costs,
  upgrades, per-company caps), street jobs, prestige threshold ($10M ×1.25^n),
  chapters 1–7 rewards, unlock tiers, lucky/streak/beginner-luck faucets.
- STATUS: **done** (report §1–2).

## Phase 2 — money flow map. STATUS: **done** (report §2: sources, sinks, conversions, caps).

## Phase 3 — economic persona simulation (real tick)
- PROBLEM: the existing simulator only drives the survival actions; the
  economy questions need deposit / stocks / property / education / company /
  vehicle / luxury / loan actions through the real action modules.
- PLAN: extend `__tests__/helpers/earlyGameSim.ts` (`SimActions` +
  `SimRow` income/expense/housing/education/tier columns) and add
  `__tests__/helpers/economyPersonas.ts` with POOR START, AVERAGE WORKER,
  CAREER CLIMBER, HIGH-SPENDER, SAVER, INVESTOR, RISK-TAKER, OPTIMIZER,
  TEXT-SKIPPER. Soak `__tests__/simulation/economyPersonas.sim.test.ts`
  (`RUN_ECONOMY_PERSONAS=1`, horizons 20/50/100/250).
- RISK: a persona that plays better than a thumb can measures a solver, not a
  player — every policy is written as a reaction to something on screen.
- TEST: the soak prints the tables; gates in Phase 11 pin the outcomes.
- STATUS: **done** — 9 personas × 250 weeks (seed 1) + 100 weeks (seeds 2–3),
  JSON dumps; two harness lessons on the way (the doctor reflex, the 500 ms
  `resolveEvent` debounce). Report §3.

## Phase 4 — life-stage analysis. STATUS: **done** (report §4) — the two stages the doc never named: the comfort cliff at week ~14 (Chapter 2 bundle = 21 weeks of wage) and the plateau at week ~80 (ladder ceiling, no rung on screen).
## Phase 5 — progression spine + dead paths. STATUS: **done** (report §5) — entry-ladder dead end; `ch_investment_news` never fired; chapters 3+ are a social spine; the student loan charges during study.
## Phase 6 — price audit. STATUS: **done** (report §6).
## Phase 7 — reward audit. STATUS: **done** (report §7) — Chapter 2 spike confirmed; inheritances were repeatable.
## Phase 8 — dominant-strategy + opportunity-cost. STATUS: **done** (report §8, `economyStrategies.sim.test.ts`) — no dominant deployment at $30k; business is the slope; the 10-year investor beat the tycoon only because of the drift defect.
## Phase 9 — shocks + long-run stability. STATUS: **done** (report §9–10, `economyShocks.sim.test.ts`) — every shock recovers monotonically, no arrears, no spirals; equities measured at 19.3%/yr against a documented ~9–11.5%.
## Phase 10 — proposals ranked. STATUS: **done** (report §12, ten proposals).
## Phase 11 — fixes. STATUS: **done**, one commit:
- [x] Stock drift: σ²/2 convexity subtracted; `expectedAnnualReturnFor` · `lib/economy/stockMarket.ts` · `stockMarketDrift.test.ts` (multi-life statistics).
- [x] Inheritance cliffhangers once per life via `eventLog`; `ch_investment_news` gate reads `holdings` · `lib/events/cliffhangerEvents.ts` · `cliffhangerWindfalls.test.ts`.
- [x] `soon_get_qualified` goal for plateaued entry workers · `lib/goals/catalogue.ts` · `getQualified.test.ts`.
- [x] Economic boundary gates on the real tick · `__tests__/simulation/economyBoundaries.test.ts`.
- [ ] NOT done, owner decisions: student-loan deferment (schema), Chapter 2 bundle scaling, play-streak tick counting, the tier-1 "meeting someone" path (per instruction).
## Phase 12 — red team. STATUS: **done** (report §14).
## Phase 13 — gates + report. STATUS: **done** — `tasks/economy-progression-2026-09-03.md`, lessons appended, CLAUDE.md §4.3 note.

# Master Program 9 — LONG-TERM RETENTION + PLAYER MOTIVATION — COMPLETE

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 8 (`6fbdbf4`).
Programs 1–8 untouched. Retention here means "the life is still going
somewhere" — no timers, no streak pressure, no new popups. Report:
`tasks/retention-journey-2026-09-03.md`.

## Phase 1 — player journey audit (simulated + code-read)
- Personas from `__tests__/helpers/earlyGamePersonas.ts` plus journey-specific
  ones (optimizer, casual, ambition/wealth/career/social/risk) run 100 weeks on
  the real tick with a per-week SIGNAL probe: new decision (pending event),
  cliffhanger teaser, promotion ready, unlock tier change, chapter goal step,
  goal-recommendation change, anticipation item, weekly-challenge rotation,
  job-board rotation, life moment, relationship change.
- STATUS: **done** — `__tests__/simulation/retentionJourney.sim.test.ts` (soak) and
  `retentionJourney.test.ts` (gates). The harness now answers inbox events and
  life moments, so the measurement is a player who opens what the game raises.

## Phase 2 — Day 1 → Day 30 map. STATUS: **done** (report §2–6).
## Phase 3 — dead zones. STATUS: **done** — 10 → 3; root causes: frozen goal max, life moments at 1/yr, Chapter 2 stalled on a bed, board turnover unannounced.
## Phase 4 — the three loops. STATUS: **done** (report §8–10).
## Phase 5 — story systems. STATUS: **done** (report §11).
## Phase 6 — pacing. STATUS: **done** (report §9–10, §19).
## Phase 7 — reuse. STATUS: **done** (report §14) — four underused systems strengthened, none added.
## Phase 8 — ranking. STATUS: **done** (report §15–16).
## Phase 9 — implementation. STATUS: **done**, one commit:
- [x] SOON/DREAM goal spotlight rotation (8-week window, hold at ≥ 60%, NOW never rotates) · `lib/goals/engine.ts` · `spotlight.test.ts`.
- [x] Life moments 5%/wk, pity 30 (the authored 2–3/yr) · `lifeMomentGenerator.ts` · `cadence.test.ts`.
- [x] Chapter 2 "Get a Roof Over Your Head" (rent or own) replaces the bed · `lifeChapters.ts` · `progressionIntegrity.test.ts`.
- [x] Week-ahead "New openings next week" · `lib/anticipation` · `engine.test.ts`.
## Phase 10–12 — persona re-test, red team, gates. STATUS: **done** (report §19–22).

# Master Program 8 — LIFE VARIATION + DISEASE FAIRNESS + PROGRESSION INTEGRITY — COMPLETE

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 7 (`3bfee78`).
Programs 1–7 untouched. Every row: PROBLEM · ROOT CAUSE · PLAYER IMPACT · PLAN ·
RISK · TEST · STATUS. Full report: `tasks/life-variation-2026-09-02.md`.

## Phase 1–2 — system map and randomness audit (done, read-only)

Randomness sources on the week-tick path, as found:

| source | seed | per-life? | reproducible from save? |
|---|---|---|---|
| `buildPreRolls()` (career delay, breakups, police, miners, disease complications/progression, pets, luxury, vehicles) | `Math.random()` | n/a | **no** |
| `oldAgeDeathRoll` | `Math.random()` | n/a | **no** |
| `makeWeeklyRoll(weeksLived)` keyed streams (education, crypto, dark web, politics, pulse, relationships, events) | week + key | only where the caller folds `lineageId:generationNumber` into the key (stocks, lucky bonus, cliffhangers, life moments, spark) | yes |
| `generateRandomDisease` | `weeksLived*1000 + year*100` via `Math.sin` | **no** | yes |
| event payload rolls (`payloadRoll`, six inline `Math.sin(weeksLived*777+42)`) | week only | **no** | yes |
| job board | `rngCommitLog.seed` + first name + week block | first name only | yes |
| `deterministicRng` commit log (street jobs, applications, dating, luxury) | `rngCommitLog.seed` → falls back to `lineageId:generation` | see below | yes (persisted) |

**Root finding.** `initialState.lineageId = 'initial-lineage'` "will be replaced
with a UUID on first load" — nothing ever does. Every fresh life carries the same
lineage id and generation 1, so the per-life salt the codebase already adopted
(`${lineageId}:${generationNumber}`) is one constant for every new game. The
seeded architecture is sound; its seed is never minted. That is why every Quick
Start rolled Depression at week 7, why stock tapes and cliffhangers replay
across lives, and why "unlucky" was a schedule. Two systems (`preRolls`, the
old-age roll) are not seeded at all, so a life is not reproducible either.

## Phase 3 — reproducibility and variation (simulation)
- PROBLEM: identical lives across players; non-reproducible ticks. ROOT CAUSE: above.
- PLAN: harness option to run the game's own RNG (no `Math.random` stub) and set
  `lineageId`; 20 same-seed runs must be byte-identical; 50 seeds must diverge
  in disease timing/type; repeated Quick Starts must mint distinct ids.
- TEST: `__tests__/simulation/lifeReproducibility.test.ts`. STATUS: **done** — one life ×20 identical; 50 lives distinct at 20 and 40.

## Phase 4–5 — disease curves, age fairness, the treadmill
- PROBLEM: 35%/week occurrence cap binds for 30+ at low fitness. ROOT CAUSE (to
  verify): summed template base chances (~0.16) × age × fitness saturate the cap;
  recovery grants no resistance (immunity list is short), cooldown is 4 weeks.
- PLAN: measure curves at ages 18/25/30/35/40/50/60 × fitness 0/10/30/50/100 ×
  health bands; run the careful persona 50–100 weeks at ages 30/40/50/60; define
  the treadmill as (expected interval ≤ recovery time). Change only what the
  measurement names. TEST: `diseaseCurves.test.ts`, long-run gates. STATUS: pending.

## Phase 6 — fitness forensic audit
- PROBLEM: the "base" fitness-decay bracket is unreachable. ROOT CAUSE:
  `weeksSinceLastGym = nextWeeksLived − lastGymVisitWeek ≥ 1` always, so
  `> 0` is always true and a player who trained THIS week is charged ×1.5.
- PLAN: `> 1` (trained this week = base); brackets otherwise unchanged. RISK:
  none found (gym-goers lose ~1.1 fitness/wk instead of 1.6). TEST: unit +
  real-tick. STATUS: **done**; plus walk +1 / yoga +2 fitness (the list was
  named FITNESS_INCREASING and increased nothing) and managed chronic
  conditions stop draining fitness (arthritis −5/wk for life pinned it at 0).

## Phase 7 — recovery loop
- Measure interval between illnesses vs recovery length, overlapping illness,
  time spent ill, across ages; verify recovery lowers future risk. STATUS: **done**
  — four clear weeks after every recovery (gate, 78 weeks at 55); age 40 over
  100 weeks with monthly managed care alive above 50 health.

## Phase 8–9 — Chapter 2 ledger and reward integrity
- FINDING (verified in code): `applyChapterProgress` pays `completion + perGoal ×
  totalGoals` in ONE grant on the tick the LAST goal completes; the promotion
  itself pays nothing. Chapter 2 = $2,000 + 4 × $200 = $2,800, two of four goals
  complete at frame one for phone-seeded scenarios ("Buy a Smartphone") and all
  scenarios ("Make a Friend", seeded parents, load-bearing).
- PLAN: reproduce with a ledger on the real tick; assert paid once, never
  re-paid on reload or a second tick; decide the phone goal on evidence. STATUS: **done**
  — the $2,800 is the chapter bundle landing when the LAST goal completes,
  and the promotion was last only because two goals were pre-ticked. "Buy a
  Smartphone" → "Buy a Bed" (never seeded); "Make a Friend" kept (documented);
  bundle paid once, never on reload; promotion pays nothing (gates).

## Phase 10 — ambition picker timing
- FINDING: `AmbitionPickerCard` renders on frame one for any life without an
  ambition; every milestone needs tier-2+ systems. PLAN: evidence table of what
  the player knows at each candidate moment; decide. STATUS: pending.

## Phase 11 — implementation (evidence-backed, one commit each)
1. Mint a per-life `lineageId` at new-life creation (`mintId`); prestige keeps it.
2. Disease seeds and event payload rolls fold the life salt.
3. `buildPreRolls` and the old-age roll derive from the salted weekly stream
   (pure → StrictMode-safe AND reproducible; `timestamp` stays `Date.now()`).
4. Fitness bracket.
5. Disease occurrence model; cooldown from recovery; walk/yoga fitness;
   managed-care fitness; Chapter 2 bed goal; ambition picker timing. All done.

## Phase 12–14 — long-run sims (20/50/100 weeks), red team, full gates. STATUS: **done**
(report §19–25). Verification: type-check 0 · type-check:tests 0 · lint:errors 0 ·
lint:ratchet 722/722 · ui:ratchet OK · check:routes 17 · `npm test` 9,297 passed / 0
failed · preflight exit 0.

# Master Program 7 — NEW LIFE BALANCE — COMPLETE

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 6 (`b544fd2`).
Scope: early-game survivability, economic fairness, recovery paths. Programs 1-6
are complete and are not redone. Full report with every table:
`tasks/early-game-balance-2026-09-02.md`. No save-format, IAP, subscription or
monetization change; three owner decisions recorded there (§7), not applied.

## Phase 1 — repository and system audit (done)
The early-game vital loop as the tick runs it (`GameActionsContext.tsx` ~700-960,
`preTick.computeDecayInputs`, `applyHousingWellbeing`, `applyCareerSalaryAndPenalty`):

| system | value (before → after) | source |
|---|---|---|
| natural decay | base 4 × wealth × prestige × grace; health ×0.6, happiness ×0.8, fitness ×0.2 | `lib/economy/statDecay.ts` (new) |
| wealth multiplier | `100000 / max(1000, netWorth)` clamped **0.5–2.0 → 0.5–1.0** | same |
| homeless penalty | −2 hp / −4 hap / −5 en; every scenario starts without a home | `rentals.ts` |
| entry job toll | authored per career; unprofiled −3/−2 | `applyCareerSalaryAndPenalty` |
| death | 4 consecutive weeks at 0 health or 0 happiness | `ZERO_STAT_DEATH_WEEKS` |
| free recovery | Walk +6/+3, Meditation +10/+2, energy-bound, no weekly cap | `healthActivities` |
| rent surface | **Market → Housing, tier 0** (since Program 5) — Program 6's "computer-only" note was stale | `market.tsx` |
| disease | occurrence per eligible week, 4-week cooldown, 35% cap; fitness was counted twice | `diseaseGenerator.ts` |

## Phase 2–6 — starting state, decay, stacking, recovery, 20-week simulations (done)
Harness: `__tests__/helpers/earlyGameSim.ts` + `earlyGamePersonas.ts`; soak
`__tests__/simulation/earlyGamePersonas.sim.test.ts` (`RUN_EARLY_GAME_SIM=1`).
Six personas × five poor starts × 20 weeks on the REAL tick. Before: the
text-skipper died at week 12 on every seed with $4k; the average player ended
at health 4; the careful age-25 player caught four illnesses and hit health 0.

## Phase 7 — evidence-based changes (done; one commit each, each with a test)
Format: SYSTEM · CURRENT · OUTCOME · ROOT CAUSE · BALANCE/DISCOVERY · CHANGE · EXPECTED · RISK · TEST.
- [x] **Natural decay** · wealth multiplier clamped 0.5–2.0 · ×2 for every net worth < $50k = the whole early game; largest, least visible drain (−4.8 hp / −6.4 hap) · the ceiling, not the formula · BALANCE · ceiling 1.0 in one shared module, four readers (tick, recap projection, both breakdown modals — two had drifted) · careful 61→96, average 4→35, B still dies (12→13) · mid-game ($10k–100k) decays at 1.0 instead of 1.0–2.0 · `statDecay.test.ts`, parity, 5 equivalence snapshots updated on purpose.
- [x] **Disease roll** · fitness in the base multiplier AND per template · a fresh 25-year-old at fitness 10 (→0 by week 4) had a 60-year-old's disease rate and failed the "young" gate · double count · BALANCE (stacked penalty) · fitness removed from the base, kept per template · careful age-25: health 0 → 96 at week 20; age 30+ unchanged (cap binds) · none found; late game unchanged · two disease tests re-pointed at the per-template term.
- [x] **Homeless notice** · pointed only at the free offset · a week-1 player was not told a $45 room exists at tier 0 · stale belief that rent was computer-only · DISCOVERY · names the cheapest tier, its price and Market → Housing · rent from week 1 is a known option · none · `applyHousingWellbeing.test.ts`.
- [x] **Death screen** · "The weight of life became too much" · a player with $4k could not say why · no cause surface at death · FAIR FAILURE · one line: what sat at 0, the drains (same projection as the recap), where the fix was · the three fair-failure questions answered · none (total helper) · `deathCauses.test.ts`.
- [x] **Gates** · `__tests__/simulation/earlyGameSurvivability.test.ts` — 34 outcome tests (starting state ×15, additivity, careful/average/struggling/strategic, text-skipper fails-fairly, money paradox, recovery ≤ 6 weeks). 4 of 34 fail against the old numbers.

## Phase 8–10 — recovery validation, walkthrough, red team (done)
Recovery from the Critical tip: 1 week to ≥ 60/60 (food_courier), ≤ 6 (age 25
with Pneumonia). Red team and scores in the report §10–12. Overall early-game
balance 40 → 68; what holds it under 70 is recorded as owner decisions:
1. Disease frequency at 30+ (35%/week cap binds for any 30+ life without the gym).
2. The disease roll is seeded on `weeksLived` alone — every Quick Start life
   rolled Depression at week 7; fold `lineageId` in (project RNG convention, so
   not changed silently).
3. Chapter 2: 2 of 4 goals pre-ticked → $2,800 on the single promotion tap at
   week ~14; the ambition picker asks for a lifelong commitment on frame one.
4. Fitness decay's "trained this week" bracket is unreachable (`> 0` vs `> 1`).

## Verification
type-check 0 · type-check:tests 0 · lint:errors 0 · lint:ratchet 722/722 ·
ui:ratchet at ceiling · check:routes 17 · `npm test` 9,271 passed, 0 failed ·
preflight exit 0 (all 11 sections passed).

# Master Program 6 — THE FIRST 30 MINUTES — COMPLETE

Branch `claude/ui-hierarchy-asymmetry-pass-fwqtue`, on top of Program 5
(`cf2bc0f`, verified). Scope: comprehension, consequence clarity, game feel,
pacing, discovery in a FRESH life. No save-format change, no economy/IAP/
subscription change, no new modal, no owner decision overturned. Balance
findings are PROPOSED (Phase 12), not applied.

## Phase 1 — fresh walkthrough (done; evidence)
Method: web export of HEAD (`web-p5`), scripted new player in Playwright
(`scratchpad/play.mjs`, run `play2/`): Play → coach "Find a job" → Apply →
Home → 20× Next week, dismissing whatever pops. Four independent read-only
audits (teaching layer, week-tick visibility, early economy, agency) verified
against the code.

Quick Start seeds `food_courier`: age 20, $1,500, smartphone + bike, no job,
no home (`realEstate: []`, no `rental` → HOMELESS from frame one), health/
happiness/energy 100, fitness 10. `weeksLived` 104, `lifeStartWeek` 104.

Measured passive life (job at week 0, Next week only):

| wk | health | happiness | cash | what the player saw |
|---|---|---|---|---|
| 0 | 100 | 100 | 1,500 | coach "You need work" → Work → Apply → hired instantly → coach "Hired. Now live a week / Got it" |
| 1 | 95 | 91 | 1,642 | +25 gems floater, Daily Reward modal ("Gem +1", "Money bonus $25" — it granted 25 gems and $0), "🌟 Perfect Week!" toast, recap "+$142 · Career +16%", cliffhanger teaser, "Nowhere to live" banner |
| 2–4 | 89→77 | 82→62 | 1,793→2,063 | identical taps; "N decisions waiting" grows (1st-paycheck bonus, windfall never opened); "Career +32% / +48%" |
| 5–6 | 70 | 51 | 3,015 | Chapter 1 complete: +$800 +35 gems, banner names "Progression and Contacts" as newly available (they were open at week 0); lead goal becomes "Have 80+ fitness 0/4 objectives" |
| 7–8 | 62→52 | 39→17 | 3,314 | tip "Feeling down? Do activities you enjoy or socialize!" (no route); disease contracted; ad orb "Full refill"; "Saved" pill over the net-worth figure |
| 9–12 | 42→4 | 0 | 4,240 | "Health is low! Go to Life → Health…"; promotion ready on Work (never surfaced on Home once the tip took the lead) |
| 13 | 0 | 0 | 4,240 | **"You Died — The weight of life became too much." MEDIOCRE, Life Quality 5%.** |

Thirteen taps. In real time roughly 8–15 minutes.

After the changes (same script, new build): tick one shows the coach's
"You earned $142 / That's the loop… Life → Health tops them up for free" and
the recap line "Each week −7 happiness · −6 health · No home · Natural decay ·
Line Cook shifts · free fixes in Health"; no reward modal, no praise toast, one
decision waiting (the starter envelope). The fast-clicker who ignores all of it
still dies on week 13 (the balance, Phase 12). A second script that follows the
recap line each week and does the two free activities ends week 20 alive at
health 68 / happiness 87 / $2,561, having also cured a depression at week 8.

## Phase 2 — minute map (0–30, careful new player, ~2 min per week)
| min | knows | can do | primary goal | decision | consequence seen | feeling | confusion | load | reason to continue |
|---|---|---|---|---|---|---|---|---|---|
| 0–1 | a life, Jan 2025, age 20, $1,500 | Play | none | none | — | curious | low | low | novelty |
| 1–2 | I need a job | Find a job / ambitions / goals | Earn $500 (chapter) | none yet | — | oriented | "0/3 goals" under "Earn $500"; "Hold $5,000 · 0/3 done" | medium | coach CTA |
| 2–4 | jobs pay $110 | pick 1 of 4, Apply | get hired | REAL: ceiling/toll/climb (metadata chips, same pay) | hired instantly, coach flips | competent | none | medium | "live a week" |
| 4–5 | the arrow lives a week | Next week, Got it | wage | Got it (retires the coach for good) | +$142, gems modal, praise toast, vitals −5/−9 unexplained | rewarded + noisy | why did happiness drop? what's a gem? | HIGH (3 surfaces + banner) | money went up |
| 5–10 | tap = money | tap; Work; Life | Earn $500 | none (passive) | recap money only; "Career +32%" reads as weekly | fine → bored | vitals sliding, cause invisible; "decisions waiting" badge | low | chapter bar |
| 10–14 | chapter done (+$800) | tap | "Have 80+ fitness" (impossible) | none | banner names unlocks that already happened | flat | lead goal impossible at fitness 10 | low | none named |
| 14–20 | something is wrong | tip (no route), Health tab if found | Get Promoted 3/4 | find the free fixes (walk/meditate) | happiness 17 → 0; disease | anxious | tip says "socialize" — no route, no "free" | low | promotion (Work only) |
| 20–30 | dying | tap / Health | survive | meditate ×N | health 4 → 0 → death screen | punished | "why?" — the causes were never named | low | new life |

Three questions — Where am I? YES (HUD + identity strip). What can I do? YES at
0–4 min (coach), NO from 5 min (the only routed goal row is pushed out of the
three slots by chapter + challenge + live event). Why should I care? WEAK: the
first consequence (pay) is buried under three simultaneous surfaces, the second
consequence (vital drift) is never explained.

First meaningful decision: which entry job (min 2–4) — real but the differentiator
is in chips, not the headline. First success: first pay (min 4). First setback:
the unexplained happiness slide (min 5–14), then disease (min ~16), then death.

## Phase 3–12 — root causes → changes (each row is one commit; each has a test)
Format: PLAYER MOMENT · PROBLEM · ROOT CAUSE · CHANGE · BENEFIT · RISK ·
BEHAVIOUR · STATE · VERIFICATION.

- [x] **R1 consequence: the drift is invisible.** wk 1–12 · vitals lose ~9 happiness / ~6 health a week, three causes (poverty-doubled decay, no home −4/−2, job toll −3/−2), no surface names any until ≤20 · the recap reports money + career only; the breakdown modals exist behind an un-invited ring tap · `lib/economy/vitalDrift.ts` (pure projection, one source shared with the breakdown modals' formula) + one recap line "Drifting −13 happiness · −9 health a week · no home, shifts, drift" that routes to Life → Health · the player learns the cause and the cure at minute 4 · low · none (display) · none · unit test on the helper + render test on the recap line.
- [x] **R2 teaching stops at the first wage.** min 4 · "Got it" on the 'advance' step retires the coach permanently, so the 'paid' payoff ("That's the loop") never renders · `onAction` calls `retire()` for 'advance' · 'advance' acknowledgement is local (card folds), 'paid' still appears; 'paid' copy adds the second loop in one clause (vitals drift, Life tab tops them up for free) · the loop is closed and the maintenance loop named once · low · coach shows one more card · AsyncStorage flag written one step later · `firstSessionCoach.test.ts` extended.
- [x] **R2 tip copy has no route.** min 14+ · "Feeling down? Do activities you enjoy or socialize!" · no route, vague · tips name the free fix and are pressable (Life → Health) · low · none · none · render test.
- [x] **R4 goal feed: the routed row never shows.** min 5–30 · GoalsCard MAX_ROWS=3 filled by chapter + weekly challenge + live event; the catalogue recommendation (the ONLY row with a destination, incl. "Get your health back up" <60) is 6th · row order · catalogue row is pinned second; a weekly challenge whose objectives all need locked systems is omitted (tier gate mirrors the Apps padlocks) · every glance offers one actionable thing · low · none · none · `goalsCardRows.test.ts` extended.
- [x] **R3 honesty: Daily Reward popup.** min 4 · says "+1 gem" and "$25 money bonus"; grants 25 gems, $0 · hard-coded copy · show `+{rewardAmount} gems`, drop the money row · first reward is believable · none · none · none · render test.
- [x] **R3 honesty: "Perfect Week!" on week 1.** · praise for stats that started at 100 · no life-age condition · celebration gated on ≥4 weeks into this life · none · none · none · unit test.
- [x] **R3 honesty: chapter banner announces old unlocks.** min 12 · "Progression and Contacts and 1 more are now available" when tier 1 was granted by the $500 milestone at week 0 · announcement reads the chapter tier, not the delta · announce only features the completion actually opens (prev tier < chapter tier) · none · none · none · unit test.
- [x] **R3 honesty: recap "Career +48%".** · cumulative progress labelled as a weekly gain · field is cumulative · label "Promotion 48%" / "Promotion ready" · none · none · none · render test.
- [x] **R3 honesty: live-event row "0/3 done".** · a $1,500 player reads "Hold $5,000 in cash · 0/3 done" under a 30% bar · fraction = objectives met · "$1,500 / $5,000" for numeric objectives, "N/M objectives" otherwise · none · none · none · goalsCardRows test.
- [x] **Pacing: three surfaces on the first tick.** min 4 · Daily Reward modal lands on the same tick as the first wage · gate `weeksThisLife < 1` · `< 2`: the first tick belongs to the wage; the reward arrives on tap two (same session, one tap later) · fewer collisions at the one moment that teaches the loop · low (one-tap delay of a free reward) · daily reward one week later on a new life · none · home effect test.
- [x] **Discovery: hire is silent** (pending path) · when an application resolves 1–2 weeks later nothing announces it · `applyCareerApplications` returns no notification · push "Hired: X — $N a week from next week" · low · one banner · none · unit test.
- [x] **Agency: dead starter event.** wk 1 · `starter_luck` condition `weeksInThisLife === 0` can never be true (events roll on `nextWeeksLived`) · off-by-one · `=== 1` · the first decision (save $300 / invest in yourself) lands on tick one as an inbox item, not a modal · low · one more inbox event in week 1 · none · `lifeRelativeGates` test.
- [x] **Honesty: homeless banner** · "Renting even a shared room would help" — the only rent UI is Real Estate, computer-only ($5,000) and tier 2 · copy assumes a mid-game player · name the cost and the free offset instead · none · none · none · unit test.
- [x] **Collision: "Saved" pill over the net-worth figure** (wk 8 capture) · AutoSaveIndicator absolute at `top: insets.top + 70`, right 16 — lands on the identity strip · verify + move below the HUD band or make it non-overlapping · low · none · none · capture.
- [x] **Discovery: the padlocks open on tick one.** wk 1 · Apps grid reads "Locked (6)" at week 0 and "Locked (1)" after ONE Next Week with $1,642 cash, under padlocks that say "Finish Chapter 2: Settling In" (browser capture) · the tick stamped `lifetimeStatistics.peakNetWorth` from preTick's private net worth, which counts owned Market items (bike + smartphone = $1,050), so a $1,500 life "peaked" at $2,550 and `wealthMark`'s ratchet put `unlockTier` at 2 · the peak sample is the canonical `netWorth()` (the HUD's figure); decay still reads preTick's number (both clamp to 2.0 below $50k, so no balance change) · the ladder means what its copy says · low · tier 2 arrives when cash reaches $2,000 (~week 4-5) instead of week 1; peak net worth stops counting furniture · `peakNetWorth` now equals the HUD figure (a stats field, not a schema change) · `__tests__/firstSession/firstTickProgression.test.ts` runs the real provider loop on the real onboarding seed.
- [x] Tests: `__tests__/firstSession/*` — fresh-state truth (quick start seeds), first meaningful decision reachable, consequence visibility (drift line), critical-state prioritisation (tip leads, routed), quiet state (nothing to say → recap silent), simultaneous problems (low health + low happiness + promotion), new-player progression (row order over weeks 1–12), tutorial triggers (coach steps).
- [ ] Gates after each phase; full `npm test` + `npm run preflight` at the end.
- [ ] Red team (new / confused / impatient / text-skipping / fast-clicking / unlucky), five- and thirty-minute tests, scores, report in `tasks/ui-hierarchy.md` §Program 6, lessons appended.

## Phase 12 — PROPOSALS (owner decisions, not applied)
1. **Balance: the passive new life dies at week 13.** Decay is ×2.0 for net
   worth ≤ $50k (`preTick.ts` wealthMultiplier), every scenario starts homeless
   (−4 happiness / −2 health / −5 energy a week), and the entry job tolls
   −3/−2. Together: −13 happiness a week at full grace → 0 at week 9 → death at
   13 with $4,240 in the bank. `rentals.ts:63-69` says the penalty "alone must
   never be able to get there from a healthy start"; it can with the other two.
   Options, cheapest first: (a) no homeless penalty until the player can act on
   it (Real Estate reachable — see 2); (b) wealth multiplier ceiling 1.5 for the
   first 26 weeks of a life; (c) cap total passive drift so 0 is ≥ 20 weeks
   away. Any of these is a number in one file plus a test.
2. **Reachability: renting.** The $45/wk Shared Room exists but `RealEstateApp`
   is `onPhone: false` and tier 2. Either a phone entry for rentals or a Life →
   Home segment. Template/owner decision (Program 3 kept the app map).
3. **Chapter 2** ships two goals a quick-start player has already met (phone,
   "Make a Friend" via seeded parents). Content decision.
4. **Weekly challenges** are all multi-objective mid-game content; for a fresh
   life every one is impossible within its 4-week window. This program only
   hides the row on Home; the card itself is untouched.
5. **Ambition picker at week 1** asks for a lifelong commitment with milestones
   ("own a company", "$100k") unreachable for 30+ weeks. Content decision.

# UI Overhaul Master Program 5 — CONSISTENCY CLOSURE — COMPLETE

Branch `claude/ui-hierarchy-asymmetry-pass-fwqtue`, on top of Program 4
(12 commits, verified). Rules and the closing report: `tasks/ui-hierarchy.md`.
Every item below is PURE LAYOUT / VISUAL STYLE / CONTENT PRIORITY / COPY
unless its row says otherwise; nothing changes what a player can do, what it
costs, or what is saved.

## Phase 1 — remaining Program 4 issues, verified against the code
- [x] Health green vs HUD red — REAL. `app/(tabs)/health.tsx:171-174` and `HealthCard.tsx:52-54` paint health `#34D399`; `SicknessModal` swaps energy/happiness; Statistics calls happiness "Mood" in gold and fitness green. Nine different "low" thresholds exist (25 / 30 / 40 dead / 50 / 15 / 20).
- [x] 13 apps on strip-over-rows — PARTLY. Audit of 15 landings: 7 KEEP (DeepMail, Pulse, Pets, YouVideo, Political, Garage, Spark), 8 escape candidates ranked (Streaming, Real Estate, Bank, Contacts, Dark Web, Education, Hustle, Bank Pro).
- [x] Work chrome — REAL: title → segments → instruction line → fold header → board note → first card.
- [x] Three merges — untouched in `components/launcher/appCatalog.ts`; stay owner decisions.

## Phase 2 — health and semantic state consistency
| Area | Problem | Root cause | Change | Why | State | Behaviour | Risk | Verify |
|---|---|---|---|---|---|---|---|---|
| Vitals everywhere | same number is silent / amber / red on three surfaces | no shared state model; each surface invented thresholds | `vitalState()` in `lib/config/hierarchy.ts` (critical ≤20, low ≤40, fair, good ≥80) | one word, one colour per band | health/energy/happiness/fitness | tips now fire on the CRITICAL band (was 25/25/15) — a UI gate, not gameplay | low | new unit test + stateDrivenHierarchy |
| Health screen, HealthCard, SicknessModal, Statistics, GymCard | identity colours contradict the HUD | local literals | consume `STAT_IDENTITY` | recognition | all vitals | none | low | statIdentity test |
| HUD | dead value-grader with a comment claiming it renders | leftover | deleted | honesty | — | none | none | hudLegibility |
| Pets | pet health graded 50/25 | local curve | `vitalState` | same ladder as the owner | pet health | none | low | render |
- [x] implemented; tests pending

## Phase 3 — chrome budget and Work
- [x] Work: drop the three generic instruction sentences; fold the board note ("4 openings · new in 8 wks") into the fold summary; the crime tab's duplicate cap line becomes its fold summary. Budget after: title → segments → fold header → card.
- [x] Chrome budget recorded per screen in `tasks/ui-hierarchy.md` (Home 0, Work 2, Life 2, Market 1, Health 1).

## Phase 4–5 — template audit and escapes (pure layout; every handler unchanged)
- [x] Streaming: a live session replaces the box-art hero on the dashboard (current activity + history); "Go live" becomes the one saturated button, not a text link
- [x] Real Estate: a property needing repair or sitting vacant hoists above the equity hero as the lead with its action
- [x] Bank: a bill due / negative balance / loan payment this week takes a lead slot above the strip; its section opens
- [x] Contacts: the worst at-risk relationship's triage card leads the Personal tab when any is at risk
- [x] Dark Web: the threat monitor leads (and the console collapses to its balance line) when heat is critical
- [x] Pets: the critical banner sits under the stage; a sick pet is the selected pet
- [x] Garage: low fuel / damage swaps the "View details" bar for the costed Refuel / Repair button
- [x] KEEP with reasons written down: DeepMail, Pulse, YouVideo, Political, Spark, Education (tab already state-chosen), Hustle (hero already tier 1)

## Phase 6 — buttons, copy, contradictions
- [x] `LoadingButton` `secondary` stops aliasing `danger` red: it becomes the flat tonal secondary. Market's Sell uses it.
- [x] `GradientButton` gains `emphasis="secondary"` (tonal, no gradient, no glow). One saturated button per viewport: Work's board (first applicable card only), Health's activity list (only the treatment lead), JobCard/HealthCard take the prop.
- [x] `Chip` `md` meets the 44pt target and reads as an action (weight 600) — it is the quiet action everywhere already
- [x] Red means danger only: HealthCard 'vitality' accent leaves `#EF4444`; "Free" is never red. Crime stays red on purpose (illegal = risk; a real semantic).
- [x] Copy: Buy (not Purchase/Acquire) on shop CTAs and confirms; "Done" for sheet dismissals; one cloud-restore label
- [x] Locked: one treatment — grey lock + reason line; the JobCard double signal ("- Locked" + lock icon) drops the text; lock icons in red/amber go grey; one disabled opacity

## Phase 7 — edge-state hierarchy tests
- [x] collisions (sick + starving + broke + promotion): exactly one lead on Home, Health, Market, Work
- [x] quiet state: goals lead, no tip, no invented urgency; very high vitals show nothing red
- [x] extremes: health 0 with countdown, energy 100, money negative

## Phase 8 — responsive + accessibility: 360 / 390 / 430 captures of every changed surface; labels on every new pressable; `maxFontSizeMultiplier` on new tier-1 text

## Phase 9 — dead code and typography
- [x] delete `CareerPathCard.tsx` (602 L, zero importers), `ui/InfoButton.tsx`, `onboarding/GlassActionButton.tsx`, `AnimatedMoneyNative`
- [x] delete the 148 dead style keys (SettingsModalStyles 111, IdentityCardStyles 11, TopStatsBarStyles 8, …)
- [x] raw font sizes: modal/screen titles at 20–24 → `tier1Title`; hero numbers → `tier1Value`; card titles 16–18 → `tier2`; JailScreen / SmartNotificationCenter bodies → `fontScale()` with scaled line boxes; keep the splash, crash screens, tab-bar label (documented reasons)
- [x] lower `rawFontSizes` and `heavyWeights` ceilings to what is earned

## Phase 10 — red team, walkthrough, scores, report (`tasks/ui-hierarchy.md` §Program 5)

Gates after every phase: type-check · type-check:tests · lint:errors · lint:ratchet · ui:ratchet · check:routes · targeted Jest; full suite + preflight at the end. No ceiling raised, no test skipped.

---

# UI Overhaul Master Program 4 — ASYMMETRY + EDITORIAL HIERARCHY — IN PROGRESS

Branch: `claude/ui-hierarchy-asymmetry-pass-fwqtue`. Programs 1 and 3 are on
`main` (PRs #182, #183). **Program 2 (asymmetry / hierarchy) was briefed and
never implemented** — confirmed: no commit on any branch carries it, the only
mentions are the two "never landed" notes in `tasks/phone-apps-audit.md` and
this file. This program applies that missing judgement to the CURRENT tree.
It does not redo Program 1, undo Program 3, or start another
component-standardization pass. Rules and scales: `tasks/ui-hierarchy.md`.

Auto-safe classes: PURE LAYOUT / VISUAL STYLE / CONTENT PRIORITY / COPY.
Everything that changes what a player can do, what it costs, or what is saved
is out of scope and is called out per screen below as "behaviour: none".

## Phase 1 — repository state (done)
- [x] Program 1 present (Card, StatBreakdownModal, BaseModal, HUD/Home/Work/launcher rebuilds, ui:ratchet)
- [x] Program 3 present (AppHeader, StatStrip/StatTile, Chip, SectionTitle, ProgressBar, KeyValueRow, all 19 apps converted, launcher ErrorBoundary)
- [x] Program 2 missing (no asymmetry work anywhere; every screen still distributes weight evenly)
- [x] `node_modules` installed; baseline web export + screenshots captured for the walkthrough

## Phase 2 — audit findings (done; four independent read-only passes)
- HUD: four saturated fills of equal weight (green cash, indigo gems, blue date, green Next week) → nothing wins; gems (premium currency) reads equal to cash; a value-graded stat colour is computed and never rendered (`TopStatsBar.tsx:245`, comment claims otherwise) so a critical vital looks like a full one apart from the arc.
- Home: IdentityCard is a permanent centred hero (80pt avatar, 2xl name) regardless of state, followed by 4–6 identical list rows of reference data; GoalsCard's three rows are identical in weight though its first row is by construction "the one that matters now"; the lead of the feed never changes with player state.
- Work: no dominant element in any state; hero salary (12.5) is smaller than every list card's (16); the employed job renders twice (hero + its own list card); the hero has no action; screen chrome ("Work", 22/800) is the largest type; `workScreenStyles.ts` has 574 keys of which **7 are used** — 567 dead, 122 of them raw `fontSize` literals (a third of the app-wide 368).
- Health: 14 identical cards; when SICK the three cures are cards 5/7/8 below "Walk in park"; the issues card has the lightest heading on the screen.
- Market: three identical sections; a hungry/low-energy player gets no emphasis on food; a rental row title (18) outranks its section header (17).
- Progress: 50/50 split "hero" (Prestige | Legacy Pass) identical for a pre-prestige player and a level-5 dynasty; achievements completion printed three times.
- Onboarding: MainMenu has a real 48→21→20→17→13→10 ladder (keep). The three wizard screens put a static 24pt header above a 20pt raw-literal CTA above 18pt content — chrome wins.
- Phone apps: 10 of 19 open `banner → StatStrip(3) → SectionTitle → uniform rows`; only Education, Garage and Pulse let state pick what shows first. Weakest five: Crypto, Stocks, Statistics, Luxury, Travel.

## Phase 3 — scales (done: `tasks/ui-hierarchy.md`, tokens in `lib/config/hierarchy.ts`)
- [x] Four-tier weight scale; five-step rhythm scale from `responsiveSpacing`; hierarchy rules

## Phase 4 — main screens (each its own commit; each verified before the next)

| Screen | Problem | Dominant element | State that picks it | Axes | Yields space | Behaviour |
|---|---|---|---|---|---|---|
| HUD | 4 saturated blocks, gems = cash | **Next week** — the only saturated fill | always (primary action) ; a critical vital's number goes danger-red | colour + weight | date box → neutral surface; gems chip → outline; cash chip → neutral surface, white value | none |
| Home | permanent centred identity hero; 3 equal goal rows | **the lead slot**: prestige CTA → urgent tip (health/happiness/energy/money critical) → goal lead row | `isPrestigeAvailable` / `useContextualTip` / GoalsCard row 1 | scale + position + density | IdentityCard → compact left-aligned strip (avatar 48, name, job · status, net worth); its 4–6 reference rows fold into the existing Details disclosure, cash-flow stays visible | none |
| Work | hero without action; job rendered twice; chrome biggest | employed: **the current job hero with its one action** (Promote when eligible, Manage otherwise) ; unemployed: the job board with the lead section open | `canPromote` / `isEmployedHere` / `!currentJob` | scale + position + colour (one CTA) | the employed job's duplicate list card; the 3 local 18pt raw headers → `SectionTitle`; 567 dead style keys | none (same `promoteCareer` / manage sheet) |
| Health | cures buried 5th/7th/8th when sick | sick: **Treatment** (issues + the three cures) leads; healthy: vitals lead | active diseases / critical vitals | position + scale + colour(danger) | cures leave the activities list while promoted (no duplicate) | none |
| Market | hungry player sees Items first | low energy: **Food** leads; else Items | `stats.energy <= 20` (same threshold as HealthIssuesCard) | position + one lead line | housing row title 18 → 16 | none |
| Progress | 50/50 hero, state-invariant | **Prestige** full-width lead; Legacy Pass supporting row | `prestigeAvailable` / claimables promote the sub-line | span + scale | half the hero row | none |
| Onboarding | 24pt static header > 20 CTA > 18 cards | the **CTA** (already the only saturated element) | — | scale | header title 24→18; CTA raw 20 → `fontScale(17)` | none |

- [x] 4.1 HUD
- [x] 4.2 Home (lead slot + IdentityCard strip + GoalsCard lead row)
- [x] 4.3 Work
- [x] 4.4 Health
- [x] 4.5 Market
- [x] 4.6 Progress
- [x] 4.7 Onboarding chrome + shared `ScreenHeader` title to Tier 2

## Phase 5 — phone apps (weakest five only; landing chosen by state, Garage/Education pattern)
- [x] Luxury lands on Collection when anything is owned (Garage rule)
- [x] Stocks lands on Portfolio when holdings exist
- [x] Statistics: net-worth hero first, vitals rings demoted below it
- [x] Crypto lands on the rig console when a rig is running
- [x] Travel lands on the trip when one is in flight

## Phase 6 — primitive gaps (only where hierarchy needs them)
- [x] Button: NOT created — the one primary per screen uses the existing GradientButton; quiet secondary actions use `Chip size="md"`. Recorded in `tasks/ui-hierarchy.md`.
- [x] Chip disabled: NOT added — Spark's gated option chips are the only case and are local by design.
- [x] AppHeader wordmark: NOT added — competes with the screen's dominant element; Spark/Pulse keep their own.
- [x] `StatTile` `hero` stays the one headline-number treatment; no new variant.

## Phase 7 — raw typography
- [x] Delete the 567 dead `workScreenStyles` keys (122 raw sizes) and move the survivors to Tier tokens
- [x] `OnboardingFloatingButton` raw 20 → scaled; `PrestigeStatsCard` raw literals only where they compete (leave the rest — ratchet, not sweep)
- [x] Lower `rawFontSizes` ceiling in the commit that earns it

## Phase 8 — responsive + accessibility
- [x] 360pt / 390pt / 430pt captures (360 found the truncated primary action and a clipped month - the first fixed, the second logged); Dynamic Type via `maxFontSizeMultiplier` on every new Tier-1 text; labels on every new pressable; reduced motion untouched

## Phase 9 — walkthrough (web export + Playwright, fresh save; state variants via render tests) — done, three rounds; `__tests__/render/stateDrivenHierarchy.render.test.tsx`
## Phase 10 — red team + scores + final report (`tasks/ui-hierarchy.md` §Report) — done; red-team fixes in `407e99b`

## Verification per phase
`npm run type-check` · `type-check:tests` · `lint:errors` · `lint:ratchet` · `ui:ratchet` · `check:routes` · targeted Jest; full `npm test` + `npm run preflight` before the final report. No ceiling raised, no test skipped.

---

# UI Overhaul Master Program 3 — THE 19 PHONE APPS — IN PROGRESS

Audit + design matrix + owner decisions: `tasks/phone-apps-audit.md`.
Program 1 blueprint: `tasks/ui-overhaul-blueprint.md`. Program 2 (asymmetry) was
briefed but **never implemented or merged** — nothing on `main` carries it, so
this program builds on Program 1's primitives only.

Auto-safe classes: PURE LAYOUT / VISUAL STYLE / NAVIGATION STRUCTURE. Everything
that changes what a player can do, what it costs, or what is saved is a
PROPOSAL, not a change.

- [x] Phase 1 — Inventory all 19 apps (entry, LOC, header, tabs, lists, modals, primary action, empties, shared vs local, noise, a11y)
- [x] Phase 2 — Group by purpose + design matrix (audit doc §2–3)
- [x] Phase 3 — Shared patterns: headers ×24, tab bars ×21, stat tiles ×30+, chips ×20+, hero recipe ×14, empties ×9 bespoke, modals ×16 raw
- [x] Phase 4 — Shared primitives (convergence, no forks): `AppHeader` (back + title + right chip), `StatStrip`/`StatTile`, `Chip`, `ProgressBar`, `SectionTitle`, `withAlpha`; `SegmentedControl` gets `scrollable`; `EmptyState` adopted; ErrorBoundary once at the launcher
- [x] Phase 5 — Owner decisions written up as PROPOSALS (Vehicle+Luxury, Gaming+Streaming, one Bank; prestige shop tabs assessed) — NOT implemented
- [x] Phase 6 — High-traffic apps: Bank (hero 9→3 numbers, banners off the list), Stocks (Trade CTA reachable from list, Portfolio grid → hero), Spark (5→3 actions, 11 stats → 4, tab double-count), Pulse (one compose, one header, one tab bar), Contacts (Network hero 6→2), Education (card = Study only), Pets (stage diet, 44pt tiles), Hustle (FAB demoted, segment → SegmentedControl)
- [x] Phase 7 — Remaining apps: Crypto (row = one tap), Real Estate (Details btn gone, KPI 6→3, fake gradient), Dark Web (VIEW gone, in-body backs gone), YouVideo (Channel 12 cells → 3), Streaming (one Go Live, one category grid), Travel (tab a11y, boarding-pass chrome), Political (4 CTAs → 1 + list), Statistics (duplicates gone), Vehicle (fleet card = one tap), Luxury (Details gone, Buy/Acquire → Buy)
- [x] Phase 8 — Header + tab convergence across all 19 (AppHeader + SegmentedControl), tabs get role="tab"
- [x] Phase 9 — Launcher hierarchy audit (grid order, badge policy, locked disclosure)
- [x] Phase 10 — Copy pass: one verb per action (Buy not Acquire, Repair not Restore it), no marketing blurbs
- [x] Phase 11 — Empty / error states on the shared EmptyState; ErrorBoundary parity (Pets, Hustle, Travel, Statistics, Luxury, YouVideo, Streaming were unwrapped)
- [x] Phase 12 — A11y + 360pt: unlabeled cash chips labeled, sub-44pt targets raised, tabs a11y-labeled
- [ ] Phase 13 — Regression: type-check, type-check:tests, lint:errors, lint:ratchet, check:routes, ui:ratchet, npm test, preflight; ratchets lowered where earned, never raised
- [ ] Phase 14 — Red team + 13-category scores + 21-item final report (audit doc §9–10)

---

# UI Overhaul Master Program 1 — IN PROGRESS

Blueprint: `tasks/ui-overhaul-blueprint.md` (full forensic audit + 8-phase plan).
Phase status — audit complete, implementation not started:

- [x] Phase A — Forensic audit (screens, navigation, design system, overlay layer)
- [x] Phase A — Redesign blueprint written (14 sections + metric ratchet table)
- [x] Phase 0 — Foundations: StatBreakdownModal chassis (7 modals → 1, −1,600 dup lines), Card/IconBubble primitives (9 rainbow cards → 1 neutral hairline), single stat-color source, dead-code deletion, ui:ratchet gate (gradients / raw font sizes / heavy weights) wired into preflight
- [x] Phase 1 — Kill the noise: interruption budget (≤2 budgeted grants per game week, player-initiated surfaces exempt), tutorial system fully retired (TutorialManager/SimpleTutorialModal/FirstWeekGuide/enhancedTutorialData/TutorialHighlightContext deleted; FirstSessionCoach is the one teaching surface), WeeklyResultSheet removed (LastWeekRecap + Week Summary switch), duplicate find-job CTA + no_job tip + HeroStrip removed, PremiumCrownButton off Home, Home's four visible={false} modals now conditional
- [x] Phase 2 — HUD de-clutter: savings chip folded into one money breakdown (BankBreakdownModal absorbed), gems gesture inversion fixed (tap=breakdown, +=buy), delta arrows + their 90-line prediction memo removed (projections live in the breakdown modals, now all reading computeHousingWellbeing), Help circle → Settings row, labeled flat 'Next week' button, HUD gradients flattened, dead parent week-dot animations removed
- [x] Phase 3 — Home rebuild: GoalsCard (top-3 objectives across chapter/challenge/live-ops/ambition/scenario/catalogue, same pure helpers, detail cards behind a Show-details disclosure), IdentityCard diet (Health Issues → Health screen, duplicate DailyGemClaim + avatar upsell crown removed, gradients flattened)
- [x] Phase 4 — Work rebuild: one promotion readout, ≤3-chip JobCards with fold, 16 button strings → 5, one crime-standing card + one cap line, identical-color gradient killed, InfoButton modals → subtitles
- [x] Phase 5 — Structure: one AppLauncher + shared catalog (computer 901→79 L, mobile 666→81 L, 28 tile gradients + marketing blurbs gone, locked apps behind one disclosure, pet id canonical), Market flattened to one sectioned list (tabs + filter bar + 5-emoji badge taxonomy removed, badges → 1), Gym moved to Health, Family = header action not fake segment, route dedup + one-door-per-room CI guard
- [x] Phase 6 — Progression: 12 modal booleans → one union, 9 tools → 5 (Your Story hub; paywalls out), duplicate achievements + prestige cards dropped, hero tap resolved to one destination that the label names. Onboarding: start ceremony extracted to useStartLife (Play now enters the game directly, no Perks detour), Ambitions dropped from the wizard (4 steps → 3; AmbitionPickerCard on Home covers it), appearance editor behind 'Edit look', locked perks behind a shelf, menu entrance ~1s → ~0.3s
- [x] Phase 7 — Sub-app pass: done as Master Program 3 (primitives + all 19 converted; the three merges are owner proposals in tasks/phone-apps-audit.md §5)

---

# Live Operations — COMPLETE

Shipped on `claude/deep-life-analytics-system-l44b7j`. Reference: `docs/LIVEOPS.md`.

## Done
- [x] Event model, objective registry (logic compiled in; data references ids).
- [x] Validation: caps, dates, schema version, known objectives; drop per-event.
- [x] Lifecycle state machine + grace period; instance ids keyed on the parsed instant.
- [x] Eligibility: stage, life weeks, subscription (both ways), absence, cooldown, staged rollout.
- [x] Rewards: per-event caps, combined value cap, idempotent ledger, rolling weekly budget.
- [x] Compiled-in catalogue: 6 events across the stage range, all validator-clean.
- [x] Remote content: fetch → validate → cache → fallback, two kill switches.
- [x] The claim as a PURE reducer; reporting split from payment in the UI.
- [x] STATE_VERSION 49 + migration + carve-out round-trip row.
- [x] Discovery card on the home screen; no takeover, no permanent countdown.
- [x] Full analytics funnel + a static guard that every step has an emitter.
- [x] 125 live-ops tests; docs + content calendar + operating loop.

## Bugs found and fixed
1. **Instance ids were keyed on the raw date string** — three spellings of one
   instant gave three ids, so republishing an event with a reformatted date
   would have paid everyone who already claimed it a second time.
2. **`trackEventExpired` / `Progressed` / `Completed` had NO callers** — three of
   seven funnel steps were dead, so "did the work and never got paid" and "how
   many had it expire" were both unanswerable. Now emitted from a session
   observer, with a static test that fails CI if a step loses its emitter.
3. **Side effects inside a `setGameState` updater** — `track()` and `setRefusal`
   ran in the reducer, which React may invoke twice.
4. **FNV-1a avalanched poorly on its last byte** (M9 code) — `exp_a`/`exp_b`
   agreed 36% instead of 50%, so two concurrent experiments would not have been
   independent. Added the finalizer.
5. **`ExperimentService` re-hashed a stale pin** while its comment claimed it
   resolved to control — a mid-flight re-bucketing.
6. **The catalogue's returning event failed my own validator** (365-day window),
   which surfaced the real distinction between scheduled and evergreen kinds.
7. **`useLiveOps` was in `lib/`** and imported values from `contexts/`, which the
   layering rule caught. Moved to `hooks/`.

## Deliberately not done
- **No event hub screen.** Today it would be a screen with three rows.
- **No push notifications for events.** The card is a surface the player chooses
  to look at; the return loop should be worth returning to on its own.
- **No server-authoritative validation.** Caps, ledger and budget are enforced
  against the player's own save, so the blast radius is their own save.
