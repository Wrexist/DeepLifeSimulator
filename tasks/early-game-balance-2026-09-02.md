# Early-game balance — Master Program 7 (2026-09-02)

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 6 (`b544fd2`).
Scope from the brief: early-game survivability, economic fairness, recovery
paths. Programs 1–6 untouched. No save-format, IAP, subscription or
monetization change. Every number below is read from the code or measured on
the real tick; the measurement harness ships with the branch.

Method: `__tests__/helpers/earlyGameSim.ts` drives the production
`nextWeek()` (GameProvider-mounted) on the real onboarding seed of a scenario,
with a scripted player that acts each week through the real action functions
(`applyForJob`, `performHealthActivity`, `rentHome`, `performStreetJob`,
`buyFood`, `promoteCareer`). `Math.random` is seeded, so a persona + seed
reproduces. Six personas (`__tests__/helpers/earlyGamePersonas.ts`), five poor
starts, 20 weeks. Print the tables with
`RUN_EARLY_GAME_SIM=1 npx jest earlyGamePersonas --silent=false`
(`SCENARIO=`, `PERSONAS=B,A`, `SEEDS=`, `WEEKS=`, `FITNESS=` filters).

---

## 1. Starting state (every scenario)

| field | value | source |
|---|---|---|
| health / happiness / energy | 100 / 100 / 100 | `gameStateBuilder` over `initialState.stats` |
| fitness | 10 (+ perk boosts; `fit` trait higher) | same |
| cash | $150 (second_chance) … $50,000 (trust_fund_baby); Quick Start $1,500 | `scenarioData.ts` |
| home | **none** — `realEstate: []`, no `rental` → homeless from frame one, all 15 scenarios | `computeHousingWellbeing` |
| job | none; the board always shows ≥ 1 eligible opening at $110/wk | `getJobBoard` |
| age → `weeksLived` | 18 → 0, 20 → 104, 25 → 364, 30 → 624 (`lifeStartWeek` = same) | `computeWeeksLived` |
| locked | apps by chapter tier; Market (food, gym, **Housing**) and Life → Health are tier 0 | `featureUnlocks.ts` |

Pinned by `earlyGameSurvivability.test.ts` §1 for all 15 scenarios: full
vitals, homeless, the $45 Shared Room signable on day one (income requirement
0, cash ≥ $45 in every scenario), an eligible job on the board.

## 2. Early penalties (per week, as the tick applies them)

| drain | health | happiness | energy | visible? | actionable? |
|---|---|---|---|---|---|
| natural decay (BEFORE) | −4.8 | −6.4 | — | recap line, breakdown modals | **no** — wealth multiplier ×2 below $50k net worth (years away) |
| natural decay (AFTER) | −2.4 | −3.2 | — | same | wealth only ever slows it |
| no home | −2 | −4 | −5 | recap line, "Nowhere to live" banner (week 1, every 8) | yes — Market → Housing, $45/wk |
| entry job toll | −2 (default) / authored | −3 (default) / authored (musician +4) | −8…−18 | job card chips, recap line | yes — job choice |
| fitness decay | fitness −1.6…−6.4 (×1.5–4 without gym) → **0 by week 4** | | | HUD ring only | gym: $300 + $50/session |
| disease | −1…−10 health, −5…−10 happiness per illness | | | Health tab treatment lead | doctor $500 (50%), natural 4–8 wks |
| grace ramp | all decay ×0.25 at week 0 → ×1.0 at week 8 | | | no | no (helps) |

Stacking: the three vital drains are **additive** — no multiplication or double
count between them was found in the tick (pinned: one real tick's vital delta
equals the recap projection's sum ±1.5, `earlyGameSurvivability.test.ts` §2).
The stacking that WAS found is inside the disease roll (§5, change 2).

## 3. Early recovery options (tier 0)

| option | cost | effect | cap | where |
|---|---|---|---|---|
| Walk | free, 5 energy | +3 hp, +6 hap, resets gym timer | none (energy) | Life → Health |
| Meditation | free, 3 energy | +2 hp, +10 hap | none (energy) | Life → Health |
| Sandwich / Steak | $15 / $40 | +8 hp +12 en +4 hap / +20 hp +25 en +10 hap | satiety: meals 4–6 half, 7+ quarter | Market → Food |
| Shared Room | $45/wk | removes −2/−4/−5, adds +0/+1/+1 | income req 0 | Market → Housing |
| Yoga / Massage / Therapy / Doctor | $100 / $300 / $400 / $500 | +6 / +8 / +3 / +25 hp; +10 / +15 / +20 / +5 hap | none | Life → Health |
| Street jobs | energy 5–35 | $15–$160, ×1.25 unemployed | 3 per job, 8 per week | Work |

Energy budget: +40/week regen; a walk+meditation pair costs 8, so the free
fixes alone can add +64 happiness / +20 health a week (the recovery persona
does exactly that). A 50 ms double-tap guard in `performHealthActivity` is a
debounce, not a weekly cap — recorded because the first harness run misread it.

## 4. The persona matrix — before and after (seed 1, 20 weeks)

Personas: **B** text-skipper (first job, taps Next Week); **A** average (reacts
to a ring reading Low with ONE free fix, rents from week 4, promotes);
**C** careful (rents week 1, one walk + one meditation a week, eats when
energy < 30); **D** struggling (misses the job for 3 weeks, panhandles, a $40
steak every week, never rents, one fix only at Critical); **E** strategic
(bedsit/room day one, 2+2 free fixes, deliveries, promotes); **R** recovery
(plays like B until the first Critical tip, then 4+4 free fixes, rents,
doctor).

| scenario · persona | BEFORE (P6 balance) | AFTER (this program) |
|---|---|---|
| food_courier · B | **died wk 12** (happiness), $4,128 in hand, Depression wk 7 | **died wk 15** (happiness), $4,602 |
| food_courier · A | alive, **health 4** / hap 47 (dying) | alive, health 30 / hap 51 |
| food_courier · C | alive, 61 / 88 | alive, 96 / 95 |
| food_courier · D | alive, 91 / 33 (hap falling 3.5/wk) | alive, 94 / 86 |
| food_courier · E | alive, 96 / 92 | alive, 97 / 90 |
| food_courier · R | alive, min 46 / 0 → 93 / 92 | alive, min 48 / 15 → 96 / 95 |
| highschool_dropout · B / A / C | died 13 / 8·52 / 77·93 | died 15 / 46·65 / 97·96 |
| immigrant_story (25) · B / A / C | died 14 / **died 16** / **health 0** at wk 20 (4 illnesses) | died 14 / alive 0·99 (edge, §6) / 96·100 |
| second_chance (30) · B / A / C | died 11 / 4·52 / 10·92 | died 12 / 23·53 / 45·95 |
| corporate_intern (21) · B / A / C | died 12 / 8·16 / 96·92 | died 15 / 82·53 / 99·95 |

Seeds 1–6 on food_courier before the change: B died at week 12 on every seed,
A ended at health 3–4 on every seed. Outcomes are near-deterministic because
the disease roll is seeded on `weeksLived` alone (§7.2), not on the life.

## 5. Death causes, and the two root causes

**What killed the Program 6 player.** Happiness: −6.4 (natural) −4 (no home)
−3 (janitor default) = −13.4/wk at full grace → 0 at week 8–9 → four zero
weeks → death at 12–13. Health was on the same slope (−8.8/wk). Depression at
week 7 (−10 hap/wk) turned the slide into a cliff. Cash was irrelevant: $4k
buys nothing automatically.

**Root cause 1 — the wealth multiplier was a flat ×2 (BALANCE).**
`100000 / netWorth` clamped 0.5–2.0 sits at the ceiling for every net worth
under $50,000 — nine years of a $110 wage. "Base 4" was a rate no fresh life
ever lived at; the real base was 8, and that made natural decay the largest
drain on both vitals, ahead of the two drains the player can see and fix.
Invisible ("based on wealth") and unactionable for years. **Change:** ceiling
1.0 (`lib/economy/statDecay.ts`, one function, four readers — the tick, the
recap projection and both breakdown modals, whose copies had drifted: no grace
ramp, no prestige, a different net worth, a flat −2/−3 per career).
Effect: careful 61 → 96, average 4 → 35 (food_courier, before the disease
change); B still dies (12 → 13). Mid-game: a $10k–$100k life now decays at
×1.0 instead of ×1.0–2.0; late game (≥ $100k) unchanged. Risk: mid-game vitals
need fewer taps; accepted — that band has income for every paid fix and the
economy audit already finds money abundant there.

**Root cause 2 — fitness counted twice in the disease roll (STACKED
PENALTY).** `calculateDiseaseRisk` added +1.0 at fitness 0; every template's
chance was then multiplied by its own `fitnessRiskModifier` (1.2–1.8 at
fitness 0) AND by that multiplier. Every scenario seeds fitness 10, which
decays to 0 by week 4, so a fresh 25-year-old carried ×1.67 × ×2.5 — the
disease chance of a 60-year-old — and failed the "healthy and young" gate
(`< 1.2`) that every 18–24 start passes. Measured: the careful age-25 player
caught four illnesses in 17 weeks and hit health 0 at week 18; with fitness
counted once, 96 at week 20. **Change:** fitness removed from the base
multiplier, kept per template (disease-specific, still ×2.2–2.8 at fitness 0,
×0.6 at 100). Age 30+ unchanged — the 35% occurrence cap binds there either way
(§7.1).

Occurrence chance per eligible week (4-week cooldown), from the probe:

| age · health · fitness | twice (before) | once (after) |
|---|---|---|
| 20 · 100 · 10 | 2% (gate) | 2% (gate) |
| 20 · 75 · 0 | 10.3% | 5.1% |
| 25 · 100 · 10 | **35%** | 2% (gate) |
| 25 · 75 · 0 | 35% | 34% |
| 30 · 100 · 10 | 35% | 35% |
| 60 · 90 · 50 | 35% | 35% |

## 6. Recovery times (measured, after)

| from | to | persona | weeks |
|---|---|---|---|
| happiness 15 / health 48, homeless (Critical tip) | ≥ 60/60 | R, food_courier | **1** (74/64 next week), 95/95 in 3 |
| health 7 / hap 47, age 25, Pneumonia | ≥ 60/60 | R, immigrant_story | ≤ 6 (gate) |
| happiness 0 (dying) | 82 | R (pre-change run) | 2 |
| homeless | housed | any | 1 tap, $45, tier 0 |
| health low, $500 | +25 | doctor | 1 tap |

The average-at-25 edge (§4): A rents at week 5, walks once a week only when
health < 50 and never eats or sees a doctor; Pneumonia at week 6 takes health
82 → 34 and it hovers at 0–9 from week 12 with the tip on screen ("food in the
Market helps too") and $2–3k in hand. Alive at 20, dead by ~22 if nothing
changes. Recorded as the honest boundary of "reasonable": one more decision
(a $40 steak, or the doctor once) ends it; the gate asserts alive at 20.

## 7. Findings recorded, not changed (owner decisions)

1. **Disease frequency at 30+.** The occurrence cap (35% per eligible week,
   ~9 illnesses a year) binds for any 30+ life with fitness < 30 — which is
   every 30+ life that does not pay for the gym. `second_chance` (age 30)
   starts on that treadmill at week 2. The careful player still ends week 20
   at 45 health there. A global disease calibration (the summed template
   base chances ≈ 9%/wk before modifiers), not an early-game fix; numbers
   above. Proposal: cap the occurrence at ~20% below age 40, or lift the
   "young" gate's age from 30 to 35.
2. **"Unlucky" is a schedule.** `generateRandomDisease` seeds on
   `weeksLived × 1000 + year × 100` — no life identity — so every Quick Start
   life with health ≤ 80 at weeksLived 111 rolled Depression at week 7. This
   matches the project's RNG convention (`utils/seededRoll.ts` keys on the
   week), so it is not changed silently. Proposal: fold `lineageId` into the
   disease seed (one line; the "same state → same result" test still holds).
3. **Fitness decay never reaches ×1.0.** `weeksSinceLastGym = nextWeeksLived −
   lastGymVisitWeek` is ≥ 1 even for a visit THIS week, so the "1–2 weeks
   ×1.5" bracket is the floor and the "base" rate is unreachable. A
   one-character fix (`> 1`) if the intent is "trained this week = base".
4. **Food is the strong health fix and reads as an energy item.** A $40 steak
   is +20 health (+10 happiness); the free walk is +3. The low-health tip
   names food; the drift line says "free fixes in Health". Fine as tuning;
   worth a chip on the Health tab ("Eat: Market → Food").
5. **Goal system (§24–27 of the brief).**
   - Chapter 2 pre-ticked goals: "Buy a Smartphone" is complete at frame one
     for 8 of 15 scenarios (those seeded with a phone); "Make a Friend" for
     all 15 (the seeded parents — load-bearing, see `lifeChapters.ts`).
     Measured consequence: Chapter 2 completes on the single promotion tap
     at week ~14 and pays **$2,800** (completion $2,000 + 4 × $200) — a
     week-14 windfall larger than 20 weeks of wages, for one action. Root
     cause is the goal checks, not the boxes. Proposal: "Buy a Smartphone" →
     "Own a phone and a computer" or "Buy a bed" (a Market item the seed does
     not grant), and a real tier-1 way to meet someone before "Make a Friend"
     can be tightened.
   - Week-1 ambition picker: `AmbitionPickerCard` renders on Home from frame
     one for any life without an ambition. Milestones ("$100k", "own a
     company") are 30+ weeks away; it is a lifelong commitment asked before
     the first wage. Not added to; proposal: gate the card on Chapter 1
     completion (week ~6), when the player has a job and a room.
   - Weekly challenges: rotated by `weeksLived` from week 0, all
     multi-objective mid-game content; Program 6 already hides the Home row
     below tier 2. Keep hidden; the card itself is untouched.
6. **Renting reachability (Program 6 proposal 2) was stale.** Program 5 had
   already put the ladder on Market → Housing (tier 0). The problem was the
   copy that stopped saying so — fixed here (§8).

## 8. Changes shipped (one per commit, each with a test)

| # | change | kind | file | test |
|---|---|---|---|---|
| 1 | persona simulator on the real tick | measurement | `__tests__/helpers/earlyGameSim.ts`, `earlyGamePersonas.ts`, soak | — |
| 2 | wealth multiplier ceiling 2.0 → 1.0, one shared function | balance | `lib/economy/statDecay.ts`; readers: `preTick.ts`, `vitalDrift.ts`, both breakdown modals | `statDecay.test.ts`, parity in `vitalDrift.test.ts`, equivalence snapshots updated (5) |
| 3 | fitness counted once in the disease roll | balance / stacking | `lib/diseases/diseaseGenerator.ts` | `diseaseLifecycle.stress.test.ts`, `diseaseGenerator.test.ts` |
| 4 | homeless notice names the $45 room and Market → Housing | discovery | `applyHousingWellbeing.ts` | `applyHousingWellbeing.test.ts` |
| 5 | death screen: what sat at zero, what pulled it down, where the fix was | fair failure | `lib/economy/deathCauses.ts`, `DeathPopup.tsx` | `deathCauses.test.ts` |
| 6 | 34 survivability gates on the real tick | tests | `__tests__/simulation/earlyGameSurvivability.test.ts` | itself; 4 of 34 fail on the old numbers |

## 9. Difficulty target (from the evidence, not invented)

- A player who does ONE free thing when a ring reads Low, and rents within a
  month, survives 20 weeks on every poor start (gate §3).
- A player who reads the recap line once and does the two free things it
  names is comfortable (≥ 60/60 throughout; ≥ 30 health on the age-30 start).
- A player who ignores every surface dies — no earlier than week 12, with at
  least five weeks of Critical on screen first, and the death screen names the
  drains and the fix (gate §4). Before: week 12 with a two-week window on
  seed 1, and a screen that said "the weight of life became too much".
- A player who starts recovering at the Critical tip is above 60/60 within
  six weeks (measured: one).

## 10. Red team (personas as adversaries, on the new numbers)

- **Hidden death spiral:** poor → homeless → decay → disease → less
  performance → slower promotion. Every link is named on a surface (recap,
  banner, tip, Health lead); the loop is interruptible for $0 (walk,
  meditation) or $45 (room) at tier 0 from frame one. No loop found that
  needs a locked system to break.
- **Unavoidable failure:** none in 20 weeks for any persona that acts at
  least once at Critical. The 30+ disease treadmill (§7.1) is the closest —
  survivable, expensive, and a calibration question for the owner.
- **False recovery path:** the Real Estate app (computer, tier 2) still
  advertises renting to a player who cannot reach it; Market → Housing is the
  real path and is now the one the notice names.
- **Misleading reward:** Chapter 2's $2,800 on one promotion tap (§7.5).
- **Impossible cost:** the gym ($300 + $50/session) against a $110 wage is
  the only fitness route; with decay halved it is now a slow climb rather
  than a treadmill. Kept.
- **Optimal exploit:** uncapped free activities are bounded by energy
  (+40/wk); 13 meditations a week is +130 happiness for nothing — but
  happiness is clamped at 100 and the only thing it buys is not dying. Steak
  stacking is already satiety-capped. No money exploit found in the first
  20 weeks; the chapter rewards are the only windfalls.

## 11. Verification

- `npm run type-check` 0 · `npm run type-check:tests` 0 · `npm run lint:errors`
  0 · `lint:ratchet` 0 errors / 722 warnings (ceiling 722) · `ui:ratchet`
  152 / 94 / 652 (at ceiling) · `check:routes` 17 routes OK.
- `npm test` (CI mode): 730 suites, **9,271 tests, 0 failed** after the last
  pinned-test update (one run found `diseaseGenerator.test.ts` still asserting
  the double count; updated, suite green).
- `npm run preflight`: ALL PREFLIGHT CHECKS PASSED (11 sections), lint:errors 0, lint:ratchet 722/722, ui:ratchet at ceiling, check:content and check:liveops OK — exit 0.
- Falsification: the 34 gates run against the pre-Program-7 numbers fail in
  4 places (age-25 and age-30 careful, age-25 average, the text-skipper's
  warning window) and pass in 30 — they measure the change, not themselves.

## 12. Scores (0–100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| early-game fairness | 35 | 70 | causes named, priced, reachable; death explained |
| survivability | 30 | 72 | A alive on 5/5 poor starts (was 3/5, two dying); C comfortable 5/5 |
| difficulty | 55 | 62 | inaction still fails; age-30 start still hard |
| consequence clarity | 60 | 78 | breakdown modals now agree with the tick; death screen answers "why" |
| recovery quality | 55 | 74 | free fixes strong; 1–3 weeks from Critical to safe; food/doctor for health |
| economic fairness | 45 | 62 | $45 room affordable everywhere; Chapter 2 windfall and gym pricing remain |
| player agency | 45 | 60 | the loop is interruptible for $0 at tier 0; still few decisions weeks 2–6 |
| death-spiral resistance | 30 | 70 | ×2 removed, fitness double count removed; 30+ treadmill remains |
| new-player experience | 45 | 65 | Program 6 comprehension + a slope the free fixes can hold |
| **overall early-game balance** | **40** | **68** | |

What keeps the overall under 70: the age-30 disease treadmill, the scheduled
disease roll, and Chapter 2's pre-ticked goals — all documented above as
owner decisions with numbers.
