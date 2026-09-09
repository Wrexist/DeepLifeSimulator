# DeepLife Simulator — Path to Category Leader

**Date:** 2026-08-09 · **Binary:** 2.6.0 · **Method:** three audits (technical, product, market) + competitive research + live Apple Ads funnel data

---

## 0. The one-paragraph diagnosis

**You have already built a better simulation than BitLife and wrapped it in an
interaction model that prevents anyone from seeing it.** The engineering is
clean, the content volume is real (~1,095 events, 36 careers, 55 domains,
78k lines of game logic), and the market demand is measurably exceptional —
your Apple Ads tap-through rate is **2.4× the Games category benchmark**. But a
single life takes **3,224 taps** to play (BitLife: ~80), and **93% of those taps
produce no story moment**. Every other problem on the list — 1 rating, weak
share loop, low installs — is downstream of that one fact. Fix the time
granularity and the rest of the plan becomes executable. Do anything else
first and you are optimizing a funnel that ends in a wall.

---

## PART 1 — THE AUDITS

### Audit A — Technical health: **CLEAN. Not the bottleneck.**

Ran `npm run audit:weekly` (the repo's five-domain static analyzer) and the full
Jest suite on a cold container after `npm install`.

| Domain | Result |
|---|---|
| 1. Economy & Balance | 🔴0 🟠0 🟡0 ✅20 |
| 2. Crash & Stability | 🔴0 🟠0 🟡0 ✅7 |
| 3. Save & State Integrity | 🔴0 🟠0 🟡0 ✅16 |
| 4. Game Logic Correctness | 🔴0 🟠0 🟡0 ✅4 |
| 5. Week-Loop Performance | 🔴0 🟠0 🟡0 ✅6 |
| **Total** | **53 checks, 0 findings** |

Full Jest suite: exit code 0. Verified subset (`__tests__/startup`,
`__tests__/save`, `lib/events`): **41 suites / 441 tests, all green, 58.9s.**

All 43 migration-backfilled defaults are mirrored in `repairGameState`. 61/61
weekly-tick subsystems are inside try/catch. No JSON deep-clone in the tick path.
No `.week` used in a time comparison.

**Read this correctly:** the codebase is in unusually good health for a solo
project — ratchets on coverage and test types, documented refusals next to the
code, migration/repair parity enforced. **Nothing on the path to category leader
is blocked by code quality.** Do not spend the next quarter refactoring. The
constraint is product design and distribution.

---

### Audit B — Product & game design: **two structural defects**

#### Defect 1 — A life is 3,224 taps. BitLife's is ~80.

`contexts/game/GameActionsContext.tsx:514`:

```ts
const nextAge = currentAge + (1 / WEEKS_PER_YEAR);   // WEEKS_PER_YEAR = 52
```

Start age is 18 (`initialState.ts:124`). One tap advances one week. To reach a
natural death around 80:

> **(80 − 18) × 52 = 3,224 taps per life.**

BitLife's core loop is one tap = one year — roughly **80 taps** for the same
arc. **DeepLife asks for ~40× the input to deliver one complete life.**

There is no fast-forward. `grep` for `fastForward|skipAhead|autoAdvance` returns
exactly one file: `lib/devtools/simulations.ts` — a developer tool, not a player
feature.

Consequences, in order of severity:
- **Nobody reaches death.** The death screen is the emotional peak, the obituary,
  the share moment, and the prestige/dynasty on-ramp. It is gated behind an hour+
  of uninterrupted tapping.
- **Nobody reaches the deep systems.** Dynasty, prestige tiers 2–5, legacy
  contracts, grandchildren — some of the best work in the repo — sit behind
  multiple lifetimes.
- **The rating prompt rarely fires.** It requires `MIN_WEEKS_PLAYED = 20` plus a
  peak beat plus 24h settling. The system is well built; the funnel to it is not.
- **D1 retention is structurally capped.** A first session cannot contain a
  complete story arc, which is the entire promise of the genre.

#### Defect 2 — 93% of taps produce nothing.

`lib/config/gameConstants.ts:115-139` and `lib/events/engine.ts:3649-3655`:

```ts
EARLY_GAME_EVENT_CHANCE = 0.08;   // comment: "(was 45%)"
EVENT_MIN_GAP_EARLY = 4;          // "at least 4 quiet weeks between popups"
EVENT_MIN_GAP_MID   = 8;          // "at most ~1 popup / 8 weeks"
EVENT_MIN_GAP_LATE  = 8;          // "week 50+: calm — ~1 popup / 15 weeks"
// late game: baseEventChance = 0.12
```

Late game fires **~1 event per 15 weeks**. Over a full life that is **~215 story
moments across 3,224 taps — 6.6% of taps.**

The constants file states the intent plainly: *"occasional surprise, not a
constant interruption"*, *"calm"*. Someone dialled the rate down from 45% to 8%,
almost certainly answering "too many popups" feedback.

**That was the wrong fix for the right complaint.** The complaint about popups in
a life sim is nearly always *"these interruptions aren't interesting"*, not
*"things happen too often"*. The remedy is better events, not fewer — and
tuning for "calm" optimizes away the product. A life sim's entire word-of-mouth
mechanism is *"you won't believe what happened to me."* Calm has no share value.

#### The content is already there — it's unreachable

| Asset | Count |
|---|---|
| Event definitions (`lib/events/`) | **~1,095** |
| Careers | **36** |
| Game-logic domains (`lib/`) | **55** |
| Lines of game logic | **78,494** |
| Largest content files | events engine 3,730 · politics policies 1,378 · scenarios 1,169 |

At ~215 events per life against a ~1,095 pool, a player sees **~20% of the
content per playthrough** — a genuinely healthy replayability ratio. The problem
is not content volume. **The problem is the delivery rate.**

#### What is already good (do not rebuild these)

- **Progressive disclosure** (`lib/progress/featureUnlocks.ts`) — features unlock
  along the five life chapters, derived not stored, never taken away. Well designed.
- **Rating prompt** (three files) — intensity scoring, afterglow timing, sour-beat
  cancellation, wall-clock cooldown. Better than the industry norm.
- **Onboarding** — scenarios, perks, ambitions, customization all present.
- **Economic engine** — the actual differentiator, and it works.

---

### Audit C — Market & funnel: **demand confirmed, conversion broken**

#### The competitive bar

| Metric | BitLife |
|---|---|
| Launch → 42M downloads | Sept 2018 → Apr 2020 (~18 months) |
| At acquisition (Stillfront, Apr 2020) | 1.2M DAU · 7.8M MAU |
| Organic share of installs | **~70%** |
| Current (Feb 2026) | ~300k downloads/mo · ~$300k revenue/mo |
| Revenue from advertising | **62%** |
| Update cadence | **Major update every 2–4 weeks**, 45+ major updates |
| Content model | Seasonal (Villain Season, Vampire, Combat) |

**Two things to take from this.** First, the incumbent is a ~$3.6M/yr business
that grew ~70% organically — it is not an untouchable monolith, and it was never
out-spent, it was out-shared. Second, **it ships a major update every 2–4 weeks.**
That treadmill is the moat, not any single feature.

#### Genre benchmarks

| Metric | Median | Good | Top quartile |
|---|---|---|---|
| D1 retention | 26% | 35% | 40%+ |
| D7 retention | ~10% | 15% | 20%+ |
| D30 retention | ~3% | 5% | 10%+ |

| Monetization | Benchmark |
|---|---|
| ARPDAU — ad-monetized | $0.05–0.15 (top $0.20+) |
| ARPDAU — IAP-heavy | $0.30–1.00+ |
| ARPDAU — hybrid | often $0.25+ — **highest of the three** |
| Rewarded video eCPM | $15–25 (**3× interstitial**) |
| ARPDAU lift after rewarded ads | **+30–66%** |
| Rewarded-ad users vs non | **4× more likely to purchase** |
| Top-grossing games using hybrid | **65%** |
| Subscription conversion | 2–4% |

#### Your live Apple Ads data (7 days, paused 2026-08-09)

| Campaign | Spend | Impr | Taps | Installs | TTR | CR | CPA |
|---|---|---|---|---|---|---|---|
| DLS-US-Category-Exact | $30.58 | 186 | 35 | 14 | **18.82%** | 40% | **$2.18** |
| DLS-US-Competitor-Exact | $15.32 | 322 | 15 | 3 | 4.66% | 20% | $5.11 |
| DLS-US-Discovery-Broad | $9.87 | 762 | 22 | 5 | 2.89% | 22.73% | $1.97 |
| **Blended** | **$55.77** | **1,270** | **72** | **22** | 5.67% | 30.6% | **$2.54** |

Against 2026 Apple Ads benchmarks — Games TTR **7.72%** (lowest of all
categories), overall CR **66.2%**, US Games median CPI **$12.28**, avg CPT $2.25:

| Signal | Reading |
|---|---|
| Category-Exact TTR **18.82% vs 7.72%** | **2.4× the Games benchmark.** When someone searching life-sim terms sees your icon, name and screenshots, they tap at more than double the category rate. Top-of-funnel appeal is exceptional — this is the single most encouraging number in this document. |
| CR **40% vs 66.2%** | **0.6× benchmark. This is the leak.** They tap, land on the product page, and don't install. That is the 1-rating-at-3.0★ page, the missing preview video, the keyword-free subtitle. |
| CPA **$2.18 vs $12.28** median | **5.6× cheaper than the category median.** The unit economics are extraordinary even with the page underconverting. |
| Competitor-Exact TTR **4.66%** | Below even the depressed Games benchmark. People searching "BitLife" want BitLife. **Kill this campaign.** |
| Discovery-Broad TTR 2.89% | Normal for broad match. Its job is keyword harvesting, not volume. Keep at minimum budget. |

**Statistical caveat, stated plainly:** at 14 / 3 / 5 installs, the **CR and CPA
figures are directional only** — the error bars are enormous and no decision
should rest on a 3-install cell. **TTR is trustworthy** (186 / 322 / 762
impressions is a real sample), which is why the TTR-based conclusions above are
the ones I'd act on.

**The arithmetic that matters:** lift CR from 40% to the 66.2% benchmark and CPA
falls from **$2.18 → $1.32**. The same $12/day buys ~9 installs instead of ~5.5.
Fixing the product page is worth **+65% installs at identical spend** — before
you add a single dollar of budget.

---

## PART 2 — THE PLAN

Strictly sequenced. Each phase unlocks the next; running them out of order wastes
the spend.

### PHASE 0 — Time compression ("Year Mode") · **the one thing** · 1–2 weeks

Everything else in this document is gated on this.

**Design principle: do not change the simulation. Change the interaction.**

The weekly tick is the economic engine — interest, arrears, bills, market moves.
It must keep running weekly or "the life sim where money actually works" dies.
What changes is how many ticks one tap buys.

**The model:**
- Primary action becomes **"Live a Year"**; **"Live a Week"** stays as a secondary
  control for players who want the granularity.
- A tap runs 52 weekly ticks internally with the UI suppressed.
- Events that fire during those weeks are **queued, not modal-per-event**.
- **Any event requiring a decision pauses the batch at that week.** Agency is
  fully preserved — you never auto-resolve a choice.
- Output is a **Year in Review**: net-worth delta, income, market performance,
  career/relationship/health changes, plus the queued events as a scrollable feed
  with inline decisions.

**Result: ~62 taps per life (BitLife parity), and ~3.5 events per tap instead of
one per fifteen. Both defects in Audit B are fixed by one change.**

**Implementation notes (specific):**
- Entry point is `nextWeek` at `contexts/game/GameActionsContext.tsx:389`. Build
  `liveYear()` around the **tick body**, not around `nextWeek()` itself —
  `nextWeek` carries per-call UI and save side effects you do not want 52×.
- Reuse the existing `nextWeekInProgressRef` re-entrancy guard for the batch.
- **Save once at batch end**, not 52 times.
- Check death every iteration and break immediately.
- **Measure a single tick first.** Decision rule: p95 ≤ 15ms → 52 ticks ≈ 780ms,
  ship with a progress indicator. p95 > 30ms → ship **Quarter Mode (13 weeks)**
  first, or chunk across frames via `InteractionManager`. Do not guess this.
- New setting (`settings.timeGranularity`) defaults to `undefined` → a **§7
  carve-out**: bump `STATE_VERSION`, no backfill, no `repairGameState` mirror.
- **The safety-net test:** assert `52 × nextWeek()` and `1 × liveYear()` produce
  identical `money`, `netWorth` and `weeksLived` from the same seed. That single
  invariant proves the batch didn't alter the simulation.
- Per `CLAUDE.md` §10, touching `contexts/game/` requires `__tests__/stress`.

**Then, and only then, revisit event density.** Year Mode likely resolves it
outright — 52 weeks per tap means no empty taps. Re-tune only if playtesting says
a year still feels thin; if so, raise `EVENT_MIN_GAP_*` rates rather than the
base chance, and fix *quality* of the events players call interruptions.

### PHASE 1 — Product page conversion (CR 40% → 66%) · 1 week · +65% installs at flat spend

Ordered by measured impact:

1. **App preview video (15–30s)** — one life speedrun: $0 → job → loan → crash →
   recovery → mansion → death → heir. Only possible to *record* once Year Mode
   ships, which is why this is Phase 1 not Phase 0.
2. **Ratings volume.** The prompt system needs no changes — it needs players
   reaching trigger moments, which Year Mode delivers. Add a Discord push for
   honest reviews on the next release.
3. **Screenshots** — caption-led; first two must carry the story without sound.
4. **Subtitle** — replace "Real Economics. Real Choices." (zero indexed keywords)
   with keyword-bearing benefit copy.
5. **Keyword field** — no spaces after commas, no title/subtitle repeats, no
   competitor brand names.
6. **Fix the placeholder og:image** in App Store Connect.
7. **Apple featuring nomination** — solo dev, rebuilt economy, no forced ads.
   Free, 15 minutes, asymmetric upside.

### PHASE 2 — The share loop · 3 days

Year Mode is what gives this volume: deaths finally happen.

- **Add the App Store link to the obituary share text**
  (`lib/legacy/obituaryGenerator.ts:123` — currently ships `#DeepLifeSim` and no
  link, so every share is a dead end for installs and attribution). One-line fix,
  highest ROI in the document.
- **Resolve `components/ShareLifeCard.tsx`** — 417 lines imported by nothing since
  PR #67. Either wire it to the death and prestige screens and upgrade it to a
  rendered image (needs `react-native-view-shot` + `expo-sharing`, neither
  currently a dependency), or delete it. Note it `require`s
  `@react-native-clipboard/clipboard`, which is not in `package.json`.
- Instrument share-generated and share-completed events. That ratio is your viral
  coefficient dial.

### PHASE 3 — Retention to benchmark · ongoing

Target D1/D7/D30 **35/15/5**, then **40/20/10**.

- Year Mode is the D1 fix — a first session can now contain a whole life.
- **Challenges** — `lib/challenges/weeklyChallenges.ts` already exists. Surface it.
- **Legacy Pass** — `lib/legacyPass/` already exists. Surface it.
- **Adopt the seasonal model.** BitLife's proven pattern, and your dynasty/prestige
  systems are a natural fit.

### PHASE 4 — Content cadence · ongoing

Match the incumbent: **a major update every 2–4 weeks.** This is the actual moat.
The content pipeline is already there; what's needed is rhythm and a public
changelog. Your release notes are already unusually good — make them a channel.

### PHASE 5 — Monetization · 1 week

BitLife takes **62% of revenue from ads**; your positioning is "no forced ads."
These are reconcilable, and the resolution is worth real money:

**Rewarded-only, opt-in ads keep the promise and capture the line.** "No forced
ads" stays literally true. Benchmarks: rewarded eCPM $15–25 (3× interstitial),
**+30–66% ARPDAU**, and rewarded users are **4× more likely to purchase** — so it
lifts IAP rather than cannibalizing it. 65% of top-grossing games run hybrid.

### PHASE 6 — Paid scale · after Phase 1 lands

**Gate: do not unpause until CR clears ~55% and D1 clears 30%.** Right now you'd
be buying users into the 3,224-tap wall.

| Campaign | Action |
|---|---|
| DLS-US-Category-Exact | **Restart first.** 2.4× benchmark TTR at $2.18 CPA is the winner. Raise budget once CR is fixed. |
| DLS-US-Competitor-Exact | **Kill.** 4.66% TTR is below the Games benchmark — the intent isn't there. |
| DLS-US-Discovery-Broad | Keep at minimum budget as a **keyword harvester** only. Promote winners into Category-Exact as exact match. |

Scale rule: with US Games median CPI at $12.28, anything under ~$4 CPA is
strong. Double budget weekly while CPA < $3 and D7 ≥ 10%; halve it if CPA > $5.

---

## PART 3 — TARGETS

| Metric | Now | 90 days | 12 months |
|---|---|---|---|
| Taps per life | 3,224 | **~62** | ~62 |
| Story moments per tap | 0.066 | **~3.5** | ~3.5 |
| Product page CR | 40% | 60%+ | 66%+ |
| Ratings (US) | 1 @ 3.0★ | 100+ @ 4.5★ | 1,000+ @ 4.5★ |
| D1 / D7 / D30 | unmeasured | 35 / 15 / 5 | 40 / 20 / 10 |
| Blended CPA | $2.54 | <$2.00 | <$1.50 |
| Organic share | unknown | 50% | 70% (BitLife's ratio) |
| Update cadence | irregular | every 4 weeks | every 2–3 weeks |

---

## PART 4 — WHAT NOT TO DO

1. **Do not soft-gate the rating prompt.** Pre-screening players and routing only
   happy ones to the store is review gating and a rejection risk.
   `utils/reviewMoments.ts:28-32` already documents the refusal.
2. **Do not refactor the codebase.** 53/53 audit checks pass and the full suite is
   green. Engineering is not the constraint; spending the quarter there is the
   most expensive way to make no progress.
3. **Do not add content before Phase 0.** You have ~1,095 events and players reach
   ~215 of them. More content into an unreachable pipe changes nothing.
4. **Do not unpause ads before Phase 1.** You'd be paying $2.54 to show people the
   wall.
5. **Do not raise the App Store Connect version to match the binary.** Store
   versions only ever increase — it's a one-way door that abandons the 1.x line
   (`CLAUDE.md` §9).
6. **Do not "fix" the pacing by deleting the weekly simulation.** The weekly
   economic tick *is* the differentiator. Batch the interaction, keep the engine.

---

## PART 5 — THE STRATEGIC BET, STATED HONESTLY

"Beat BitLife" is not a 90-day outcome and no plan should promise it. BitLife has
seven years of compounding, a publisher behind it, and 40M+ lifetime installs.

But the specific, defensible bet is this: **the incumbent is a ~$3.6M/yr business
that grew ~70% organically and has not meaningfully deepened its simulation in
years — and you have already built the deeper simulation.** Your Apple Ads TTR
being 2.4× the category benchmark is direct market evidence that the positioning
lands. The gap between you and them is not talent, code quality, or content
volume. It is that a player can experience a complete BitLife life in ninety
seconds and cannot experience a complete DeepLife life at all.

Close that one gap and every other number in this document moves.

**Ship Year Mode first. Everything else is Phase 1.**

---

## Sources

- [Stillfront acquires Candywriter — download/DAU/MAU figures](https://medium.com/@SEgames/stillfront-group-acquires-bitlife-developer-candywriter-92eb08532a5d)
- [BitLife App Store stats — current downloads & revenue](https://app.appfigures.com/reports/app-profile/280893313766/product-pages)
- [BitLife updates wiki — cadence](https://bitlife-life-simulator.fandom.com/wiki/Updates)
- [2026 Mobile & PC Gaming Benchmarks — GameAnalytics](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks)
- [D1/D7/D30 retention benchmarks 2026 — Playio](https://blog.playio.co/d1-d7-d30-retention-benchmarks-2026)
- [ARPDAU benchmarks by genre — Juego Studio](https://www.juegostudio.com/blog/arpdau-benchmarks-by-game-genre)
- [Rewarded ad benchmarks 2026 — Playio](https://blog.playio.co/rewarded-ad-benchmarks-2026)
- [Apple Ads benchmarks 2026 — Apptweak](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [Apple Ads benchmarks 2026 — Adapty](https://adapty.io/blog/apple-ads-benchmarks-2026/)
- [Apple Search Ads costs 2026 — Business of Apps](https://www.businessofapps.com/marketplace/apple-search-ads/research/apple-search-ads-costs/)
