# DeepLife Simulator — Implementation Plan to Overtake BitLife

**Date:** 2026-08-09 · **Binary:** 2.6.0 · **Companion to:** `tasks/category-leader-plan-2026-08-09.md`

This is the execution document. Six audits, four blockers, eight workstreams,
each with concrete changes, acceptance criteria and the tests that prove them.

---

## PART 1 — AUDIT RESULTS (6 audits)

### Audit 1 — Technical health · **CLEAN**

`npm run audit:weekly`: **53 checks across 5 domains, 0 findings.** Full Jest
suite exits 0. Verified subset: 41 suites / 441 tests green in 58.9s.

**Conclusion: code quality is not a constraint. Do not refactor.**

### Audit 2 — Tick performance · **MEASURED — Year Mode is GO**

Wrote `__tests__/performance/tickTiming.bench.test.ts`, which mounts the real
`GameProvider` and times the production `nextWeek()`.

| Window | Mean | p50 | p95 |
|---|---|---|---|
| Early (weeks 1–100) | 5.38ms | 4.00ms | 11.00ms |
| **Late (weeks 501–600)** | **3.54ms** | **3.00ms** | **5.00ms** |

- **A 52-tick batch costs ~184ms.** A 13-tick batch costs ~46ms.
- State is 467KB at week 600 and grows **linearly**, not exponentially.
- **Late ticks are cheaper than early ones** — no state-size degradation.

These are *pessimistic* numbers: Node + react-test-renderer's `act()` overhead,
not a release Hermes build.

> **Decision: ship full 52-week Year Mode. No chunking, no Quarter Mode
> fallback, no `InteractionManager` splitting.** 184ms sits far below the
> ~500ms perception threshold, and it resolves into a "Year in Review" screen,
> so it reads as a deliberate result rather than lag.

**Bonus finding:** the stress harness mocks `saveQueue` because a real save is
HMAC-SHA256 over a ~100KB payload and costs ~6s in Node. Year Mode saves **once
per 52 ticks instead of 52 times**, so it is likely *cheaper* end-to-end than
52 individual taps, not more expensive.

### Audit 3 — Product pacing · **BLOCKER**

`GameActionsContext.tsx:514` — `nextAge = currentAge + (1 / 52)`, start age 18.

**3,224 taps per life. BitLife: ~80.** Late-game events fire once per ~15
weeks. **~215 story moments across 3,224 taps — 6.6%.**

### Audit 4 — Content quality · **BLOCKER — the deepest finding**

Sampled the event corpus and quantified it. Three defects, all systemic:

| Measure | Result |
|---|---|
| Happiness effects with \|Δ\| < 10 (of 708 total) | **445 — 63%** |
| Happiness effects with \|Δ\| ≥ 20 | **43 — 6%** |
| Cliffhanger resolutions: positive vs negative | **22 vs 8 — 73% positive** |

**Defect A — Outcomes are too small to matter.** 94% of emotional outcomes move
happiness by under 20 points on a 0–100 scale, and the weekly tick regresses
stats anyway. A representative event:

> *"A car ran a red light and missed you by inches. Your heart is pounding."*
> → "That was way too close..." (−3 happiness) · "Thank goodness I looked both
> ways!" (+2 happiness)

Nothing about that life is different afterwards.

**Defect B — Choices are mood-picks, not decisions.** Both options above are
*reactions*. The player selects a feeling, not an action, and the outcomes differ
by 5 happiness. A choice that doesn't branch isn't a choice.

**Defect C — The game defuses its own drama.** Cliffhangers set up conflict and
then resolve it happily 73% of the time:

> Teaser: *"You saw a suspicious message on your partner's phone…"*
> Resolution: *"Turns out your partner was texting a jewelry store about a gift
> for your anniversary."*

Nobody screenshots that. **Conflict is the product.** This is the same
risk-aversion that dropped the event rate from 45% to 8% "for calm" — and calm
is the one thing a life sim cannot afford, because its entire distribution
mechanism is *"you won't believe what happened to me."*

### Audit 5 — Navigation & information architecture · **BLOCKER**

| Surface | Count |
|---|---|
| Tabs | **9** (`home, work, apps, life, mobile, computer, progression, market, health`) |
| Tabs visible to a brand-new player | **8 of 9 are tier 0** |
| Sub-apps (computer 11 + mobile 11) | **~22** |
| Files containing `<Modal` | **96** |
| Components | **239** |
| Largest screen | `work.tsx` at 1,618 lines |

**BitLife runs on one screen** — a scrolling life timeline — plus a bottom bar
of ~5 icons. DeepLife has **~31 top-level destinations and 96 modals.**

`featureUnlocks.ts` already identified this ("a brand-new player used to land on
NINE tabs and twenty-six apps") and gated the *apps* — but **left 8 of 9 tabs at
tier 0**, so the tab bar problem is essentially unsolved. Three of those tabs
(`apps`, `mobile`, `computer`) are all app launchers, which is redundant
navigation for the same job.

### Audit 6 — Market & funnel · **DEMAND CONFIRMED, CONVERSION BROKEN**

From the live Apple Ads data: Category-Exact TTR **18.82% vs a 7.72% Games
benchmark (2.4×)**, CPA **$2.18 vs a $12.28 US Games median**, but conversion
**40% vs a 66.2% benchmark**. Full analysis in the companion document.

---

## PART 2 — THE FOUR BLOCKERS

Everything above collapses to four things, in dependency order:

| # | Blocker | Fixed by |
|---|---|---|
| **1** | **TIME** — 3,224 taps to live one life | W1 Year Mode |
| **2** | **STAKES** — events are too rare, too small, too safe | W2 Content overhaul |
| **3** | **NAVIGATION** — 9 tabs, 22 apps, 96 modals | W3 IA collapse |
| **4** | **CONVERSION** — product page loses 60% of taps | W5 Store page |

W1 and W2 are the product. W3 makes it legible. W4–W8 distribute it.

**Critical ordering note:** W1 without W2 is a trap. Year Mode makes players see
~3.5 events per tap instead of one per fifteen — which, if those events are
±3 happiness mood-picks, means *exposing the weakness faster*. **W1 and W2 must
ship together.**

---

## PART 3 — THE WORKSTREAMS

### W1 — Year Mode · the unlock · ~1.5 weeks

**Goal:** ~62 taps per life instead of 3,224, with the weekly economic
simulation completely untouched.

**Principle: do not change the simulation, change the interaction.** The weekly
tick is the differentiator — interest, arrears, bills, market movement. It keeps
running weekly. Only the number of ticks per tap changes.

**Changes:**

1. **`contexts/game/actions/weekly/` — extract the tick body.** Today the tick
   lives inside the `nextWeek` `useCallback` at `GameActionsContext.tsx:389`.
   Lift the pure state transition into `runWeeklyTick(prev): TickResult` so it
   can be called in a loop. `nextWeek` becomes `runWeeklyTick` + save + UI.
   *This is the only structural refactor in the entire plan, and it is required.*

2. **New `liveYear()` action.** Loops `runWeeklyTick` up to 52 times over a
   single `setGameState` updater. Rules:
   - **Break immediately on death.** Check after every iteration.
   - **Break on any event requiring a decision.** Return the partial batch with
     `weeksAdvanced < 52`; the player decides, then resumes.
   - **Accumulate events into a digest array** rather than pushing each to
     `pendingEvents`.
   - **Save once**, after the loop, not 52 times.
   - Reuse the existing `nextWeekInProgressRef` re-entrancy guard.

3. **`YearInReviewModal`** — the new primary result surface. Net-worth delta,
   income, market performance, career/relationship/health changes, then the
   queued events as a scrollable feed with inline decisions. This replaces the
   modal-per-event experience and becomes the screenshot artifact (see W4).

4. **HUD:** primary button becomes **Live a Year**; **Live a Week** stays as a
   secondary control.

5. **`settings.timeGranularity: 'week' | 'year' | undefined`** — default
   `undefined` (= year). Per `CLAUDE.md` §7 this is a **carve-out**: bump
   `STATE_VERSION` to 38, **no backfill, no `repairGameState` mirror**. An absent
   key already means the default.

**Acceptance criteria:**
- A life from 18 to natural death takes **≤ 70 taps**.
- A 52-week batch completes in **< 400ms** on device.
- No decision is ever auto-resolved.

**Tests (required):**
- **The invariant test:** `52 × nextWeek()` and `1 × liveYear()` produce
  identical `money`, `netWorth`, `weeksLived` and `stats` from the same seed.
  *This single test proves the batch did not alter the simulation.*
- Batch halts on death; halts on a decision event; resumes correctly.
- `__tests__/stress` — mandatory, per `CLAUDE.md` §10, for any `contexts/game/` change.
- The tick benchmark already added guards the 52× cost.

**Risk:** Medium. It touches the most protected code in the repo. The invariant
test is what makes it safe — write it *first*.

### W2 — Content overhaul · ships with W1 · ~2 weeks, then continuous

**Goal:** every event that fires is worth a screenshot.

**The content bar — four rules, all testable:**

1. **Stakes floor.** Every event outcome must clear one of: `|Δhappiness| ≥ 15`,
   money ≥ 5% of net worth, or a **state change** (job lost, relationship ended,
   disease acquired, criminal record, asset gained/destroyed). No more ±3 nudges.
2. **Choices must diverge.** No two choices on one event may share the same sign
   *and* similar magnitude. If both options are "feel slightly different about
   it", it is not a choice — cut one and make the other cost something.
3. **Cliffhangers must land badly ≥ 40% of the time.** Currently 27%. A teaser
   that always resolves happily trains players to stop caring.
4. **Consequence tails.** Events set a flag that a *later* event reads. This is
   what makes a life feel authored rather than sampled — and the save format
   already supports it (`consequenceProgression` exists in the weekly path).

**Changes:**
- Re-tune the **~445 sub-10-point effects** against rule 1. Bulk mechanical pass.
- Rewrite the **19 cliffhanger resolutions** to hit the 40% bad-outcome floor.
- Raise the base event rate. With Year Mode a player sees 52 weeks per tap, so
  the "too many popups" constraint that drove 45% → 8% **no longer applies** —
  the popups are now batched into the Year in Review. Recommend returning
  `EVENT_MIN_GAP_*` to roughly one event per 4–6 weeks (~9–13 per year-tap),
  presented as a digest.
- Add **darkly comic, high-stakes events** — the genre's native register. This is
  the writing work, and it is the highest-leverage content investment available.

**Acceptance criteria:**
- Median absolute happiness effect across the corpus **≥ 15** (currently < 10).
- Cliffhanger bad-outcome rate **≥ 40%** (currently 27%).
- Zero events where all choices share sign and magnitude.

**Tests — a content-quality ratchet** (same idiom as the coverage and
type-check ratchets this repo already runs): a suite that walks the event corpus
and asserts the three numbers above, with floors that may only be raised.
`scripts/check-content-quality.js`, wired into preflight.

**Risk:** Low technically, high in taste. Ship behind a flag and A/B if possible.

### W3 — Navigation collapse · ~1 week

**Goal:** 9 tabs → **5**; make the game legible in one screen.

**Target IA** (mirrors the genre's proven shape without copying it):

| Tab | Absorbs |
|---|---|
| **Life** | home + life + the Year in Review timeline — *the main screen* |
| **Work** | work + education |
| **Money** | market + bank + stocks + crypto + real estate |
| **World** | apps + mobile + computer merged into **one** app grid |
| **You** | health + progression + achievements + prestige |

**Changes:**
- Merge `apps`, `mobile`, `computer` into a single **World** grid. Three tabs
  doing one job is the clearest redundancy in the app.
- Make **Life** a scrolling timeline — the life story as a feed. This is both the
  navigation fix and the screenshot surface (W4).
- Gate tabs by tier properly: a new player should land on **3 tabs**, not 8.
  `featureUnlocks.ts` already has the machinery; it just isn't applied to tabs.
- Audit the **96 modal files** for merge candidates. Every breakdown modal
  (`BankBreakdownModal`, `EnergyBreakdownModal`, `HappinessBreakdownModal`,
  `HealthBreakdownModal`, `GemsBreakdownModal`) is the same component with
  different data — collapse into one `StatBreakdownModal`.
- Split `work.tsx` (1,618 lines) and `home.tsx` (1,011 lines).

**Acceptance criteria:**
- ≤ 5 tabs. New player lands on ≤ 3.
- Any core action reachable in ≤ 2 taps from Life.
- `npm run check:routes` clean (route collisions ship as production-only crashes).

**Risk:** Medium-high — this is the largest UI diff. `__tests__/render` and
`__tests__/startup` are the guards. **Do not use `React.lazy()` in the merged
screens** — `CLAUDE.md` §5 documents a production Hermes crash from exactly that.

### W4 — Death, share loop & the Life Card · ~4 days

Year Mode is what gives this volume: deaths finally happen.

- **Add the App Store link to the obituary share text** —
  `lib/legacy/obituaryGenerator.ts:123` currently emits `#DeepLifeSim` and no
  link. Every share is a dead end for installs and attribution. **One line,
  highest ROI in the plan.**
- **Resolve `components/ShareLifeCard.tsx`** — 417 lines imported by nothing
  since PR #67. Either wire it to the death and prestige screens and render it
  as an image (needs `react-native-view-shot` + `expo-sharing`, neither currently
  a dependency; it also `require`s `@react-native-clipboard/clipboard`, which is
  not in `package.json`), or delete it.
- **Make the Year in Review shareable.** It is generated ~62 times per life
  versus once at death — a far bigger share surface than the Life Card.
- Instrument share-generated / share-completed. That ratio is the viral dial.

### W5 — Store page conversion · ~1 week · **+65% installs at flat spend**

Ordered by measured impact: app preview video (only *recordable* once Year Mode
ships) → ratings volume → caption-led screenshots → keyword-bearing subtitle →
keyword field → fix the placeholder og:image → Apple featuring nomination.

### W6 — Retention systems · ongoing

Target D1/D7/D30 **35/15/5** → **40/20/10**. Year Mode is the D1 fix.
`lib/challenges/weeklyChallenges.ts` and `lib/legacyPass/` already exist and are
under-surfaced. Adopt the seasonal model — the incumbent ships a major update
every 2–4 weeks and that treadmill is the real moat.

### W7 — Monetization · ~1 week

Rewarded-only, opt-in ads keep "no forced ads" literally true while capturing the
line that is 62% of the incumbent's revenue. Benchmarks: rewarded eCPM $15–25
(3× interstitial), ARPDAU +30–66%, rewarded users 4× likelier to purchase.
Infrastructure already exists (`AdRewardOrb`, `RewardedAdModal`, `AdMobService`).

### W8 — Paid scale · after W5

**Gate: do not unpause until CR ≥ 55% and D1 ≥ 30%.** Restart Category-Exact
first, kill Competitor-Exact (4.66% TTR is below benchmark), keep Discovery-Broad
at minimum as a keyword harvester.

---

## PART 4 — SEQUENCE

| Weeks | Ship | Gate to proceed |
|---|---|---|
| **1–3** | **W1 + W2 together** | ≤70 taps/life; median effect ≥15; batch <400ms |
| **3–4** | **W3** navigation collapse | ≤5 tabs; routes clean; render+startup green |
| **4–5** | **W4** share loop + **W5** store page | Preview video live; CR ≥55% |
| **5–6** | **W6** retention + **W7** rewarded ads | D1 ≥30% |
| **6+** | **W8** paid scale, then continuous W2/W6 | CPA <$3 at D7 ≥10% |

**W1+W2 is the release.** Everything before it is preparation; everything after
it is amplification. Treat it as the relaunch.

---

## PART 5 — WHAT NOT TO DO

1. **Do not ship W1 without W2.** Year Mode surfaces events 15× faster; if they
   are still ±3 mood-picks it exposes the weakness rather than the depth.
2. **Do not soft-gate the rating prompt.** Review gating, rejection risk;
   `utils/reviewMoments.ts:28-32` documents the refusal.
3. **Do not refactor beyond the W1 tick extraction.** 53/53 audit checks pass.
4. **Do not use `React.lazy()` in the merged screens** (§5 — shipped a crash).
5. **Do not unpause ads before W5.**
6. **Do not delete the weekly simulation to fix pacing.** Batch the interaction,
   keep the engine — the weekly economy *is* the moat.
7. **Do not raise the App Store Connect version to match the binary** (§9).

---

## PART 6 — THE HONEST FRAME

The incumbent is a **~$3.6M/yr business that grew ~70% organically** and has not
meaningfully deepened its simulation in years. You have already built the deeper
simulation — 1,095 events, 36 careers, 55 domains, a real economy — and market
data confirms the positioning lands at **2.4× the category tap-through rate**.

Three things stand between that and category leadership, and none of them is
talent or code quality:

> A player can live a complete BitLife life in ninety seconds.
> They cannot live a complete DeepLife life at all.
> And when something does happen, it moves a bar by three points.

**Ship W1 and W2 together. That is the release that changes the trajectory.**
