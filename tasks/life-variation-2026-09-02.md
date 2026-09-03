# Life variation, disease fairness, progression integrity — Master Program 8 (2026-09-02)

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 7 (`3bfee78`).
Programs 1–7 untouched. No save-format change (no new field; `lineageId` has
been on `GameState` since v1 and is now minted rather than left at its
placeholder). No IAP/subscription/monetization change. Every number below is
measured on the production `nextWeek()` through the persona simulator
(`__tests__/helpers/earlyGameSim.ts`) with the game's OWN randomness where the
question is about randomness (`seedMathRandom: false`).

---

## 1. Randomness architecture — before

| source | seed | per-life? | reproducible? | player impact |
|---|---|---|---|---|
| `buildPreRolls()` — application delay, breakups, police, miners, disease complications, pets, luxury, vehicle accidents | `Math.random()` | — | **no** | a reload re-rolled the week; two devices disagreed |
| old-age death draw | `Math.random()` | — | **no** | same |
| `generateRandomDisease` | `Math.sin(weeksLived×1000 + year×100)` | **no** | yes | every Quick Start with health ≤ 80 at week 7 got Depression at week 7 |
| six event payloads (`lucky_coin`, tiers…) | `Math.sin(weeksLived×777+42)` etc. | **no** | yes | the same "variable" amount for every life on the same week |
| `payloadRoll` (event packs) | `makeWeeklyRoll(weeksLived)` | **no** | yes | same |
| `makeWeeklyRoll` streams that fold `lineageId:generationNumber` (stocks, lucky bonus, cliffhangers, life moments, Spark, jobs board) | week + "life salt" | **no in practice** | yes | see the root finding |
| `deterministicRng` commit log (street jobs, applications, dating, luxury) | `rngCommitLog.seed` → falls back to `lineageId:generation` | **no in practice** | yes (persisted) | |

**Root finding.** `initialState.lineageId = 'initial-lineage'` — the comment says
"will be replaced with a UUID on first load"; nothing ever did. Every new game,
and every prestige *reset* (which keeps lineage and generation on purpose),
carried the same salt. The seeded architecture the codebase had already adopted
was sound; its seed was never minted. "Unlucky" was a schedule, and the
schedule was the same for everyone.

## 2. Randomness architecture — after

- `gameStateBuilder` mints `lineageId` (`mintId('life')`) per new life; the
  prestige reset mints a fresh one (the preserved family-tree JSON keeps its
  own id; only an EMPTY tree is built from the new one); the heir path keeps
  the lineage and bumps the generation. `lifeSalt(state)` and
  `makeLifeRoll(state, weeksLived)` in `utils/seededRoll.ts` are the one
  spelling.
- Disease gate / occurrence / pick rolls, `payloadRoll`, and the six inline
  `Math.sin` payloads key on the life and the week.
- `buildPreRolls(seed, timestamp)` is a pure function of the life salt and
  the week, built **inside** the updater from `prevState` — StrictMode-safe by
  construction and identical on reload and across devices. Only the timestamp
  is wall-clock (captured outside, as before). The old-age draw uses the same
  stream.
- Nothing about the commit log or the save format changed; a pre-existing
  save keeps its `'initial-lineage'` salt so none of its rolls move.

## 3. Same-seed reproducibility (measured, live RNG)

| run | result |
|---|---|
| one life (text-skipper, 20 weeks) × 3, before | cash 4602 / 4488 / 4488 — **not reproducible** |
| one life × 20, after (`lifeVariation.sim`) | **1 distinct fingerprint** (every week's cash, vitals, fitness, housing, job, illnesses) |
| careful persona (acts every week) × 2, after | identical (CI gate) |

## 4. Different-life variation

| run | result |
|---|---|
| 6 lineage ids, before | 6 identical illness histories (`wk19: Alcohol Addiction` ×6) |
| 12 young lives, after | 12 distinct lives (CI gate) |
| 12 lives at 45, after | ≥ 8 distinct illness histories (CI gate) |
| 50 lives at 20, after | 50 distinct; 20 fell ill in 20 weeks; first-illness week spread 2–19; 12 different first illnesses; 0 deaths; cash $4.6k–7.2k |
| 50 lives at 40, after | 50 distinct; 41 fell ill; first illness spread across weeks 1–19, 16 kinds; **4 deaths** (organ failure ×1, diabetes ×2, low health ×1) — §7 |

## 5. Quick Start repetition

Before: every Quick Start shared one salt, so with the same taps it was one
life. After: `lifeReproducibility.test.ts` asserts 20 consecutive seeds mint 20
distinct salts.

## 6. Disease probability curves (occurrence per eligible week)

Before (summed template chances × overall multiplier × per-template terms):

| age · fitness · health | before | after |
|---|---|---|
| 18 · 10 · 100 | 2% (gate) | 1.8% |
| 20 · 0 · 75 | 10.3% | 2.1% |
| 25 · 10 · 100 | 2% (gate) | 5.0% |
| 25 · 0 · 75 | **34.3%** | 6.0% |
| 30 · 10 · any | **35% (cap)** | 5.5% |
| 30 · 50 · 100 | 22.3% | 3.5% |
| 40 · 0 · any | **35%** | 7.4% |
| 40 · 100 · 100 | 22.9% | 2.9% |
| 50 · 50 · 100 | 17.2% (lower than 40 — the age curve restarted at 50) | 5.4% |
| 60 · 0 · 40 | 35% | 11.1% |
| 60 · 100 · 100 | 22.7% | 5.4% |

After: `occurrence = 0.03 × calculateDiseaseRisk(health, fitness, age) ×
immunity coverage`, capped at 0.35 (never binds: the multiplier's own cap is
5.0 → 15%). The template curves pick WHICH illness. The Help copy has said
"base 1–2% multiplied by risk factors" since it was written; the code now does
that. Age is continuous at 50 (was +0.8 at 49, +0.0 at 50).

## 7. Age fairness (careful persona, 52 weeks, pinned lineage)

| age | before (P7 model) | after |
|---|---|---|
| 30 | ill 33/52, 2+ at once 26 wks, min hp 34 | ill 10/52, never 2 at once, min hp 97 |
| 35 | ill 18/52, min hp 85 | ill 9/52, min hp 97 |
| 40 | ill 45/52, **health 0 at week 52** | ill 7/52, min hp 93 |
| 45 | **died week 33** (organ failure) | ill 4/52 |
| 50 | ill 16/52, min hp 48 | ill 11/52, min hp 31 (one 12-week eating disorder) |
| 60 | ill 29/52, min hp 75 | ill 16/52, min hp 95 |

Average persona (reacts to a Low ring, never sees a doctor), 50 lives, 20
weeks, age 40: 4 of 50 die — two of unmanaged diabetes, one of organ failure
(critical, 10-week countdown, minAge 40), one of plain low health after a
pneumonia. An 8% early-death rate for a 40-year-old start who never opens the
Health tab's treatment lead is recorded here as the honest number; the
careful and managed personas at 40 do not die.

## 8. Disease treadmill — definition and result

Treadmill := expected interval between onsets ≤ typical recovery length, so
illness is continuous. Before: occurrence 35%/eligible week + 4-week cooldown
counted from ONSET → an onset every ~7 weeks against recoveries of 3–20 weeks
→ 2–3 concurrent conditions at 40 (measured 27 of 52 weeks with ≥ 2). After:
occurrence 3–10% + cooldown from RECOVERY (tick and doctor's cure) → an onset
every ~15–40 weeks, illnesses sequential (CI gate: four clear weeks after
every recovery over 78 weeks at age 55). Recovery lowers future risk twice:
the clear spell, and, for chronic conditions, managed care stops the fitness
drain (§9).

## 9. Fitness findings

| item | before | after |
|---|---|---|
| decay brackets | `weeksSinceLastGym > 0` always true → the ×1.0 "base" bracket unreachable; a weekly gym-goer paid ×1.5 forever | `> 1`: trained this week = base; ×1.5 from the first missed week (real-tick test) |
| ways up | gym only: $300 membership + $50/session (+5) | walk +1 (free), yoga +2 ($100), gym unchanged; Health tab shows the fitness chip |
| `FITNESS_INCREASING_ACTIVITIES` | reset the gym timer, increased nothing | true to its name |
| chronic drain | arthritis −5, diabetes −5, asthma −4, HBP −3 fitness/week, for life, managed or not → fitness pinned at 0, multiplier ×2 for life | under managed care the fitness drain is 0 (other symptoms still halved); unmanaged unchanged |
| disease link | fitness counted in the overall multiplier AND per template | overall multiplier (occurrence) once; template term weights the pick |

Fresh life at 20, 12 weeks: idle → fitness 0; three walks a week → > 10.

## 10. Recovery loop (measured)

RISK (multiplier readable on the Health tab, Help copy now accurate) →
WARNING (Health ring, treatment lead) → ACTION (walk/meditate free, doctor
$500 = cure roll or 4 weeks' management, hospital 12 weeks) → RECOVERY
(natural 1–20 weeks) → LOWER RISK (4 clear weeks; managed fitness stops
falling). Age 40, 100 weeks, careful + monthly doctor while ill: alive, min
health > 20, end health > 50, fitness off the floor (CI gate). Age 40, 100
weeks, careful WITHOUT the doctor: arthritis at week 38 → health 0 by week
100 — the challenge is real and the lever is one tap.

## 11. Unreachable-state findings

- Fitness base bracket (fixed, §9).
- The disease "healthy and young" fast path (`< 1.2 && health > 80 && age <
  30`): retired with the summed model; the multiplier itself lands a young,
  fit, healthy life at 1–2%.
- Age-50 restart in both age curves (fixed).

## 12. Chapter 2 reward ledger (real tick, `progressionIntegrity.test.ts`)

| step | before | after |
|---|---|---|
| frame one, phone-seeded scenario | "Buy a Smartphone" ✓ (seeded), "Make a Friend" ✓ (seeded parents) — 2 of 4 | "Make a Friend" ✓ only — 1 of 4 |
| week ~5 | chapter opens; "Save $2,000" completes on cash | same |
| the promotion tap (~week 14) | last goal → `applyChapterProgress` pays `$2,000 + 4 × $200 = $2,800` + wage in ONE tick | same mechanism, but the last goal is now the earned bed or the promotion |
| next tick / reload | $0 (`completedChapters` persisted, `already.includes`) | same, pinned |
| the promotion itself | $0 (pinned) | $0 |

**Exact cause of "$2,800 on one promotion":** the chapter bundle is granted
when the LAST goal completes, and with two of four goals pre-ticked the
promotion was the last goal. Not a duplicate, not an exploit — a sequencing
consequence of pre-completed goals. Per-goal rewards are bundled by design
(`LifeChapterCard` shows the bundle); the notification names the chapter.

## 13–14. Pre-ticked goals

| goal | pre-ticked for | verdict | action |
|---|---|---|---|
| ch1 Earn $500 / Get Hired / Survive 4 Weeks | none (fixed in P5/P6) | earned | — |
| ch2 Buy a Smartphone | 8 of 15 scenarios | legitimate starting state, unearned reward | → "Buy a Bed" (never seeded, $1,500, in-window, changes a week) |
| ch2 Make a Friend | all 15 | intentional (documented deadlock with Spark at tier 2) | kept, recorded |
| ch2 Save $2,000 | trust_fund_baby, real_estate_hustler ($5k), tech_prodigy ($3k) | legitimate starting wealth | kept (a wealth goal for a wealthy start is the scenario's premise) |

## 15. Reward exploit findings

- Chapter bundle: paid once; a second tick and a reload pay nothing (gate).
- Promotion: pays nothing itself (gate).
- Reload of a pre-completion state: re-completes on the same tick and pays
  once — deterministic, not farmable.
- Reload re-roll: every tick draw is now a function of the save, so reloading
  and re-ticking a week yields the same accident, the same illness, the same
  application delay. Save-scumming a bad week no longer works.
- Weekly challenge and login rewards: covered by existing tests (untouched).

## 16. Ambition picker

What the player knows at each candidate moment:

| moment | job | wage seen | home | consequence seen | systems the milestones need |
|---|---|---|---|---|---|
| frame one (before) | no | no | no | no | all tier 2–5 |
| after week 1 | maybe | once | no | slide named | same |
| after Chapter 1 (~week 6, after) | yes | 6× | usually | slide, fix, hire, chapter reward | tier 1 open, tier 2 next |

Decision: the picker renders once Chapter 1 is complete (`ambitionPickerReady`).
Nothing about the ambitions themselves changed; a life that already chose one
is unaffected.

## 17. Implemented (one commit each)

1. Per-life seed: minted `lineageId`, `lifeSalt`/`makeLifeRoll`, salted disease and event rolls, pure seeded `buildPreRolls` + old-age draw. (Also the fitness bracket `> 1`.)
2. Disease occurrence = base × overall risk × coverage; age continuous at 50; cooldown from recovery and cure; Help copy.
3. Walk/yoga fitness; managed care stops chronic fitness drain; Chapter 2 bed goal; ambition picker after Chapter 1; harness pins lineage from seed and records chapters.
4. Tests: `lifeReproducibility`, `fitnessAndRecovery`, `progressionIntegrity`, `diseaseCurves`, `pickerTiming`; layoff fixtures by outcome; two equivalence snapshots (recovery stamp).

## 18. Proposed, not implemented

- Age-40 average-persona mortality (8% in 20 weeks without a doctor) — an
  owner call on critical-disease pick weights at 40+ (organ failure minAge 40,
  10-week countdown).
- Per-goal rewards paid as each goal completes instead of bundled — a reward
  UX change (`LifeChapterCard` shows the bundle today).
- "Make a Friend" as a real goal once a tier-1 route to meet someone exists.
- `deterministicRng` commit-log seed is still minted lazily from the first
  committed roll; it falls back to the (now unique) life salt, so it works,
  but a single minting point would be tidier.

## 19–21. Long-run simulations (live RNG, careful persona, food_courier)

| age | 20 wks | 50 wks | 100 wks |
|---|---|---|---|
| 20 | hp 94 ha 95 fit 15 $5.1k janitor/1 | hp 97 fit 21 $10.2k janitor/3 | hp 97 ha 96 fit 31 $18.2k janitor/5 · ill 6/100 |
| 40 (no doctor) | hp 92 fit 15 $6.5k | hp 36 fit 0 $19.1k | **hp 0** $50.1k · ill 68/100 (arthritis wk 38, unmanaged) |
| 40 (monthly doctor while ill) | — | — | alive, hp > 50, fitness off the floor (gate) |
| 60 | hp 99 fit 15 $5.1k | hp 99 fit 21 $13.7k | hp 97 ha 94 fit 31 $39.4k · ill 7/100 |
| text-skipper | died wk 15 (happiness) | — | — |

No runaway: cash grows linearly with wage and chapter/challenge windfalls
($800–$2,000 each, 5–8 over 100 weeks); no NaN, no negative spiral; the
only late-game treadmill found is an UNMANAGED chronic condition, which is a
decision, not a script.

## 22. Red team

- **Predictable life:** gone — 50 lives, 50 histories; a repeat player cannot
  memorise week 7.
- **Scheduled disease:** gone — first-illness weeks spread 1–19.
- **Treadmill:** gone at every tested age for the careful persona; unmanaged
  chronic conditions remain a slow decline with a one-tap lever.
- **Unfair age scaling:** the age-50 restart fixed; the multiplier is monotonic
  18 → 75 (gate).
- **Dead fitness logic:** the base bracket, the "fitness-increasing" list, and
  the chronic fitness floor — all three now do what they say.
- **Duplicate rewards / reload exploits:** none found; reload now reproduces
  the week instead of re-rolling it.
- **Speedrunner:** windfalls are chapter bundles only; the bed goal removes
  the pre-ticked half of Chapter 2's.
- **Exploit hunter:** free activities are energy-bound (unchanged); a walk's
  +1 fitness is 5 energy — 8 walks a week is +8 fitness for 40 energy, well
  under one $50 gym session's rate.

## 23. Remaining risks

- The base 3% and the multiplier's shape are now the ONE calibration knob;
  the curve tests bound them, but the "right" number is a product decision.
- Older-start mortality for a player who never uses the doctor (§7).
- Saves written before this branch keep the shared `'initial-lineage'` salt
  until their next prestige; those lives are as scripted as before (no
  migration by design — moving a live save's salt would re-roll its future).

## 24. Verification

- `npm run type-check` 0 · `npm run type-check:tests` 0 · `npm run lint:errors` 0 ·
  `lint:ratchet` 0 errors / 722 warnings (ceiling 722, unchanged) · `ui:ratchet`
  OK at ceiling · `check:routes` 17 routes OK.
- `npm test` (CI mode, after every change): 735 suites, **9,297 passed, 0
  failed**, 308 snapshots (7 updated on purpose across Programs 7–8: five
  decay-multiplier fixtures, two disease-recovery stamps).
- `npm run preflight`: ALL PREFLIGHT CHECKS PASSED (14 PASS lines), lint,
  ratchets, content and live-ops checks OK — exit 0.
- Soaks (manual, `RUN_LIFE_SIM=1` / `RUN_EARLY_GAME_SIM=1`): §3, §4, §19–21.

## 25. Scores (0–100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| life variation | 15 | 78 | one salt for every life → 50 of 50 distinct; illness weeks spread; wealth spread |
| reproducibility | 35 | 92 | pre-rolls and old-age draw were `Math.random`; now byte-identical ×20 with the live RNG |
| disease fairness | 30 | 72 | curve matches the Help copy; young 1–2%, unfit 40 → 7%; critical-at-40 mortality remains |
| age fairness | 25 | 70 | monotonic, continuous at 50; careful 30–60 all alive and mostly well |
| fitness system quality | 30 | 66 | reachable base bracket, free gains, chronic floor breakable; the gym is still the only fast route |
| recovery quality | 45 | 75 | four clear weeks after every recovery; managed care breaks the chronic loop |
| progression integrity | 50 | 75 | Chapter 2 has one pre-ticked goal (documented) instead of two; bundle paid once |
| reward integrity | 60 | 80 | ledger on the real tick; promotion pays nothing; reload reproduces rather than re-rolls |
| exploit resistance | 60 | 78 | save-scum re-roll closed by construction; no duplication found |
| long-run stability | 40 | 70 | 100-week runs linear, no NaN; unmanaged chronic decline is the one slow loop and it has a lever |
| **overall system integrity** | **40** | **75** | |

What keeps it under 80: the disease base and multiplier shape are a single
calibration knob with product-level judgement still owed; pre-existing saves
keep the shared salt until they prestige; older-start mortality for a player
who never opens the Health tab.
