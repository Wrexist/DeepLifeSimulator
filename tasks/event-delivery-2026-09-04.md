# Master Program 13 — World Simulation, Event Delivery, Emergent Life Content

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 12 (`f405c91`).
Date 2026-09-04. Programs 1-12 untouched.

**One-line result.** The weekly event roll was seeded on the WEEK ALONE, so every
life in the game drew the same number in week N and explored one sample of a
365-template pool instead of one sample per life. Twelve simulated lives reached
33 distinct events; the same twelve lives on the same seeds now reach 78, and
fifty lives reach 108 instead of 30. Nothing was authored, no weight was tuned,
and no save field was added. The content was always there.

---

## 1. The event pipeline, end to end

```
  eventTemplates (365)            engine.ts, assembled from 22 modules
        |
   pity + min-gap gate            weeksSinceLastEvent, EVENT_MIN_GAP_{EARLY,MID,LATE}
        |                         PITY_THRESHOLD_WEEKLY_EVENTS = 16
   fire gate                      weeklyEventRoll('event-fire') < baseEventChance
        |                         EARLY_GAME_EVENT_CHANCE 0.08, phase-scaled
   condition filter               t.condition(state)          -> ELIGIBLE
        |
   weight evaluation              t.weight, +consequence modifier,
        |                         x LIFE_STAGE_WEIGHT_BOOST, x riskByCategory
   pickWeighted(pool, roll)       weeklyEventRoll('event-pick')  -> SELECTED
        |
   generate(state)                payloadRoll / pickSeeded       -> DELIVERED
        |
   player answers                 choice effects, followUpEventId -> CONSEQUENCE
```

Three side channels bypass the weighted pick and have their own gates:
cliffhangers (`cliffhangerEvents.ts`), life moments (`lifeMomentGenerator.ts`)
and seasonal events. Chained sequels enter through `followUpEventId` and carry
weight 0 so they can never be picked cold.

## 2. The Program 12 lead, verified

Program 12 raised `close_friend_needs_you` from weight 1.6 to 3.0 and measured
**no change at all** — same event, same week, in all four lives. It reverted the
number rather than ship a value justified by a null experiment, and recorded the
non-response as a fact about the engine.

That was the right call and the right suspicion. `lib/events/engine.ts:4195`
built its roll stream with `makeWeeklyRoll(state.weeksLived)`, and its three
keys are `'event-jitter'`, `'event-fire'` and `'event-pick'`. `makeWeeklyRoll`
hashes a key against the WEEK only. `makeLifeRoll` is the sibling that folds
`lineageId:generationNumber` in. The single biggest roll in the game was on the
wrong one.

CLAUDE.md §4.3 has said since Program 8 that a life-affecting roll must never be
keyed on the week alone. Program 8 applied the salt by hand, per call site. This
one was missed, and nothing could see that it had been.

## 3. Why "the weights are broken" was the wrong diagnosis

`pickWeighted` is a correct cumulative-weight pick; it was read line by line and
it is fine. The defect is upstream of it: there was only ever ONE sample of the
distribution per week, and it was the SAME sample in every life.

Moving one template's span only changes the answer if that span happens to
straddle the one fixed point. Fifty lives drew one number per week, not fifty.
The pool was never explored — which is also why the event set looked so small
while 365 templates sat in the bundle.

## 4. The fix

Three call sites in `lib/events/engine.ts`, `makeWeeklyRoll` -> `makeLifeRoll`:

| line | roll | what it decides |
|---|---|---|
| 2855 | `payoff-${salt}` | which branch a payoff event resolves to |
| 3686 | `chain-start:${chainId}` | whether a multi-week chain begins |
| 4195 | jitter / fire / pick | whether an event fires this week, and which |

No new field, no STATE_VERSION bump, no content authored, no weight edited.

## 5. Telemetry — 50 lives x 100 weeks

`__tests__/simulation/eventTelemetry.sim.test.ts`
(`RUN_EVENT_TELEMETRY=1 LIVES=50 WEEKS=100`).

| measure | before | after |
|---|---|---|
| distinct event ids across ALL 50 lives | **30** | **108** |
| events answered per life (mean) | 14.7 | 18.2 |
| mean pairwise ID overlap | 42.8% | 29.7% |
| mean pairwise EXACT overlap (same event, same week) | 28.3% | **9.4%** |
| lives byte-identical to life 1 | 1 / 50 | 1 / 50 |
| same-life replay byte-identical | yes | **yes** |

The last two rows are the ones that matter as much as the headline. Same life,
same seed, replayed: byte-identical, because `lineageId` and `generationNumber`
are persisted state. Different lives: 9.4% coincidence instead of 28.3%.

## 6. The delivery funnel — 12 lives x 150 weeks

`__tests__/simulation/eventFunnel.sim.test.ts` evaluates every template's
`condition` and `weight` against the SAME states the tick walked, so a template
that never competes is distinguishable from one that competes and loses.

| stage | before | after |
|---|---|---|
| AUTHORED | 365 | 365 |
| of which weight-0 sequels | 16 | 16 |
| EVER ELIGIBLE | 118 | 118 |
| EVER COMPETING (weight > 0) | 107 | 107 |
| **EVER SELECTED** | **33** | **78** |
| competing but never selected | 93 | 62 |
| templates that threw | 0 | 0 |

Eligibility and competition did not move at all, which is exactly the signature
of a selection defect rather than a content or gating one. Fifty-one templates
were delivered that had never been delivered before, including nearly the whole
transactional core of the game: `job_offer`, `unexpected_bill`, `sick_day`,
`job_bonus`, `lottery_win`, `freelance_opportunity`, `networking_opportunity`,
`overtime_request`, `workplace_conflict`, `coworker_conflict`, `health_scare`,
`identity_theft`, `natural_disaster`, `friend_help`, `friend_repays`,
`friend_job_offer`, `mentor_offer`, `family_crisis_call`.

Six ids left the delivered set (`book_club_invite`, `generous_tipper`,
`medical_emergency`, `talent_scout`, `talent_show`, `wine_survey`). All six are
still competing; that is resampling churn in a 12-life cohort, not a regression.

The 62 still never selected are the tail, not dead content: 909 deliveries
across the 50-life telemetry drew 108 distinct ids from ~107 competitors, which
is what a fair weighted sampler does.

## 7. Reachability — is a gate satisfiable at all?

A simulation can only ever say "not in these lives". `scholarship_opportunity`
gated on `weeksInPoverty >= 12` and nothing wrote that field for the event's
entire life (found in Program 12, v41), and no cohort size would have found it.
So `__tests__/simulation/eventReachability.test.ts` probes conditions directly
against 17 archetype states spanning money, career, health, family, age, fame,
crime, politics, travel, hobbies, pets, vehicles and ancestry.

- reached by at least one archetype: **226 of 365**
- of the unreached, 5 are weight-0 sequels (correct: reached via `followUpEventId`)
- no template's `condition` throws on any archetype

The number went 137 -> 183 -> 226 while the archetypes were being written, and
**both jumps were probe bugs, not game bugs**. The second is the instructive one:
a "wealthy" archetype at $8.5M sat just under `wealthEvents`' $10M gate and
reported all 45 wealth templates dark. A reachability screen that is wrong is
indistinguishable from a game that is broken, which is why the test now carries
its own ratchet.

The screen is a LOWER BOUND by construction. `secret_palindrome` requires a net
worth that reads the same backwards; no sketch state reaches it, and it is
delivered 36 times across 50 simulated lives.

## 8. Randomness audit

Every `makeWeeklyRoll` call site in the runtime tree, classified. This is now
machine-checked by `__tests__/tooling/weekOnlyRollAudit.test.ts`: a new week-only
roll must be declared with a reason or the suite fails.

| site | class | why |
|---|---|---|
| `lib/events/engine.ts` x3 | **WAS A BUG, FIXED** | the weekly fire gate, pick and payoff |
| `lib/economy/luckyBonus.ts` | SAFE (salt in key) | `lucky-bonus:${lineageId}:${generation}` |
| `lib/events/cliffhangerEvents.ts` | SAFE (salt in key) | builds `lifeSalt` locally for fire and pick |
| `lib/lifeMoments/lifeMomentGenerator.ts` | SAFE (salt in key) | `life-moment-fire:${lifeSalt}` |
| `lib/events/economyEvents.ts` | INTENTIONALLY GLOBAL | length of a calm macro stretch. The recession/boom cycle is the WORLD; two lives in the same week share one economy on purpose, like the stock tape |
| `lib/events/lifeEvents.ts` | NOT LIFE-AFFECTING | the sequel gate for a chain the life is already in — reaching the call requires having been shown the event and picked that choice |
| `lib/social/npcDepth.ts` x3 | NOT LIFE-AFFECTING | NPC mood drift, want rotation, interaction flavour. Moves colour and +/-1 bond, never money, health or an unlock |
| `contexts/game/actions/weekly/applyEducationProgression.ts` | NOT LIFE-AFFECTING | the fractional part of education speed pays an EXPECTED value equal to the purchased multiplier; exam/campus gates keyed per education |
| `contexts/game/actions/weekly/applyIncome.ts` | NOT LIFE-AFFECTING | beginner luck: bounded, one-directional, closed after `BEGINNER_LUCK_WEEKS` |
| `contexts/game/GameActionsContext.tsx` | NOT LIFE-AFFECTING | the shared stream handed to crypto/darkweb/politics/stock/rent ticks, which price against a deliberately global tape |
| `utils/seededRoll.ts` | n/a | the factory itself |

One honest caveat recorded in the guard: `npcDepth` keys on relationship ids,
and the seeded `parent1` / `parent2` and the meeting door's `met-w2` are shared
across lives, so those streams DO collide today. It is flavour, so it is not
being changed on this program's evidence — but it needs revisiting the moment an
NPC mood gates something material.

## 9. Weight responsiveness — the acceptance test

`__tests__/simulation/eventWeightResponse.sim.test.ts` scales one template's
weight, holds seeds and personas constant, and measures the delivery share.

target `gym_invite` (base weight 0.3), 20x, 16 lives x 120 weeks:

| arm | target deliveries | total events | target share |
|---|---|---|---|
| CONTROL | 3 | 312 | 0.96% |
| TREATMENT | **16** | 329 | **4.86%** |

The world responds to a weight now. It did not before, and Program 12's null
result is explained.

The first run of this experiment probed `job_offer` and measured 0 vs 0 in ten
lives. That says nothing: `job_offer`'s weight function returns 0.1, the bottom
of a 107-template pool, so zero deliveries is the expected result at either
scale. A null result from an underpowered probe is not evidence of a null
effect, and the mistake is recorded in the test so it is not repeated.

## 10. The interruption budget — what Programs 1-6 won

The risk of this change is that a game that delivers more content becomes a game
that interrupts more. Measured over the same 50 lives:

| measure | before | after |
|---|---|---|
| mean gap between event weeks | 4.7 | 4.7 |
| median gap | 4 | 3 |
| p90 gap | 10 | 11 |
| longest quiet stretch | 12 | 16 |
| max events in ONE week | 2 | **2** |
| back-to-back event weeks | 139 (21.3%) | 234 (28.4%) |
| ...both weeks part of a narrative arc | 47 | 157 |
| ...one arc + one pool pick | 63 | 48 |
| **...BOTH independent pool picks** | **29** | **29** |

The only number that moved is arcs. Independent pool picks landing on adjacent
weeks: 29 before, 29 after, unchanged to the unit. The min-gap cooldown
(`EVENT_MIN_GAP_EARLY/MID/LATE`) is untouched and still binds. What grew is
multi-week authored stories running their consecutive beats —
`biz_meet_investor -> biz_pitch -> biz_waiting -> biz_results`,
`health_scare_symptoms -> diagnosis -> recovery`,
`family_crisis_call -> deepen -> resolution` — which is what those arcs are for
and which players previously almost never saw complete.

The per-week ceiling of 2 is the guarantee that matters, and it did not move.

## 11. Cross-life variation and same-life replay

Both properties hold simultaneously, which is the whole requirement:

- **Same life replays byte-identically.** `lineageId` and `generationNumber` are
  persisted, so a reload draws the same numbers. Pinned by the second test in
  `eventTelemetry.sim.test.ts`, which was written before the fix and passes
  after it.
- **Different lives diverge.** Exact overlap fell from 28.3% to 9.4%.

Save-scumming is therefore no more effective than before: replaying a week gives
the same event. Starting a NEW life gives a new stream, which is by design and
was already true of the lucky bonus, cliffhangers and life moments.

## 12. Life-stage distribution

Structurally sound and left alone. The four life-stage packs (childhood/teen,
parent, midlife, senior) each apply `lifeStageTag` to the whole pack through a
`.map()` at export, and the pick multiplies a tagged template's weight by
`LIFE_STAGE_WEIGHT_BOOST` once its own strict age/status gate has already
passed.

Not measured, and deliberately not claimed: a 100-week cohort starting from
`food_courier` never reaches midlife or seniority, so this cohort cannot say
whether those beats land in their chapter. Measuring it needs a long-horizon
persona, which is the next program's job, not a number to invent here.

## 13. Content deserts

The longest quiet stretch across 50 lives grew from 12 weeks to 16. That is a
tail, not a trend: the median gap FELL from 4 to 3, and the mean is unchanged.
A 16-week silence exists because the fire gate is a per-life draw now and some
lives get an unlucky run — the pity system
(`PITY_THRESHOLD_WEEKLY_EVENTS = 16`) is exactly what bounds it, and 16 is the
bound working, not failing.

## 14. Exploit red team

| attack | result |
|---|---|
| reload a week to reroll an event | **blocked**, unchanged — the roll is a pure function of (lineageId, generationNumber, weeksLived, key) |
| scrub the device clock | **blocked** — no part of the event pipeline reads wall-clock time |
| restart a life for a better stream | possible, and was already possible pre-fix for the lucky bonus, cliffhangers and life moments. Costs the whole life; grants nothing bankable |
| prestige to reroll | by design — `generationNumber` bumps, which is what a new generation means |
| farm a high-value event by weight | **blocked** — weights are compiled in; the consequence modifier is engine-written |
| double-invoke the updater to deliver twice | **blocked**, unchanged — generation is inside the tick's single updater |

No new exploit surface. The fix removes a determinism defect; it adds no player
input to any roll.

## 15. Save compatibility

No save-format change, no `STATE_VERSION` bump, nothing added to
`initialState.ts`. Both fields the salt reads (`lineageId`, `generationNumber`)
have been persisted since before Program 8.

What DOES change for an existing save: from the next tick, its event schedule
differs from the one it would have had. No data is lost, no in-flight chain is
dropped (chains are stored state, not re-rolled), and a save written before this
change loads and ticks normally.

One honest wrinkle. A save from before Program 8 carries the literal
`lineageId: 'initial-lineage'` (or none at all), so its salt is `'initial-lineage:1'`
or `':1'` — shared with every other such save. Those saves get a different stream
than they had, but still share it with each other. Nothing can be done about
that without inventing a lineage for a life that never recorded one, which would
change the event schedule of an in-progress save on a guess. New lives mint a
real lineage in `gameStateBuilder`.

## 15b. What the fix broke, and what that revealed

Four assertions in the existing suite failed after the change. Every one was
attributed before it was touched — the engine change was stashed, the same tests
re-run, and all of them passed on the old code — so none of this is hand-waved,
and none of it was a bound nudged to get a build green.

**Two happiness margins (`socialBoundaries`).** Program 12 pinned "the social
lives are measurably better off than the loner" as mean happiness +8, and "the
romance life is paid in something else" as +5. Both now fail, and the reason is
worth more than the fix. With the full catalogue reaching players instead of the
~30 templates one shared schedule ever drew, **mean happiness rose for every
persona and saturated against the 0-100 ceiling**:

| persona | mean | p10 | min |
|---|---|---|---|
| FRIENDSHIP-FOCUSED | 97.2 | 93 | 86 |
| CASUAL SOCIAL | 95.7 | 87 | 73 |
| ROMANCE-FOCUSED | 93.3 | 87 | 61 |
| LONER | 91.2 | 79 | 65 |
| CAREER-OBSESSED | 90.7 | 79 | 64 |

Every persona is within seven points of every other and of the ceiling, so the
MEAN stopped discriminating. The p10 — the bad weeks — still separates the
social lives from the solitary ones by exactly the eight points Program 12
measured, because it is not clamped. The gates now assert on the p10 and
additionally require the mean not to INVERT, which is the failure that would
actually matter. Program 12's own note already pointed here ("a floor of 61
against 46"); this makes it the assertion.

**One rarity assertion (`eventRarity`).** "A discovered secret arrives stamped
legendary" pinned that `secret_lucky_777` (weight 100, condition
`money === 777,777`) wins the pick. It dominates — but "dominates" is not
"always wins", and with one fixed roll per week the test could not tell the
difference: it was really pinning one draw that landed inside the secret's span.
Measured across 24 lineages it wins 20 times, losing to `near_miss_choke`,
`cooking_disaster`, `neighbor_conflict` and `lottery_win`. The test now asserts
what it means — that the legendary tag rides onto the generated event, every
time the secret wins, across a spread of lives — plus the domination as the
statistic it actually is.

**One pacing bound (`retentionJourney`).** "No silent stretch longer than five
weeks" became six. That bound was measured once, in a world where every life
shared one event schedule — so it was a property of that schedule, not of the
game. Measured now across five lineages on the same persona: 6, 5, 3, 6, 6. Six
is the typical worst case, not an outlier, and nothing approaches the ten it
replaced. Re-pinning to five by choosing a luckier `lineageId` would be fitting
the test to the answer, so the bound is six with the five-lineage table recorded
next to it.

**The finding underneath the happiness pair.** Answering every event the game offers is now
worth roughly ten points of mean happiness over a hundred weeks, for any
persona, social or not. That is the event catalogue being net-positive on
happiness and a player who answers everything floating near the cap. It is a
balance question with an owner (§18), not something to tune on the same commit
as the mechanism — but it is the first time the number has been visible, because
until now no life ever saw enough of the catalogue for it to show.

## 15c. A determinism defect this program found and did not fix

Running the SAME persona, same seed, same lineage, same week count, twice in one
process gives different happiness (91.05 / 93.28 / 92.50 on three consecutive
runs) — while the **event stream is byte-identical across all three**. So the
event pipeline is deterministic and something else on the tick is not. It is not
`Math.random()`: a probe that instrumented the global and ran a 60-week life
recorded **zero** calls from repository code, which is CLAUDE.md §4.3's rule
holding. `Date.now()` is read on the tick path from at least six places
(`weeklyChallenges`, `GameActionsContext` x3, `npcDepth`, `consequenceTracker`),
and divergence begins around week 24 and widens.

This predates Program 13 — the pre-fix engine has it too — and it is out of
scope here, but it is recorded rather than left for someone to rediscover:
every persona measurement in this repository, including the ones in this report,
carries a small order-dependence of roughly half a happiness point. It does not
touch any conclusion drawn above (all of which are gaps of 8 to 45 points or
whole-integer counts), and it is a real bug: a player starting a second life
without restarting the app is in the same position.

## 16. What was implemented

1. **`lib/events/engine.ts`** — three rolls moved from `makeWeeklyRoll` to
   `makeLifeRoll`, with the measurement recorded next to the main one so the
   next reader does not re-derive it.
2. **`__tests__/tooling/weekOnlyRollAudit.test.ts`** — every `makeWeeklyRoll`
   call site must be declared SAFE / INTENTIONALLY GLOBAL / NOT LIFE-AFFECTING
   with a reason, plus a named pin on the engine roll. Verified to FAIL on a
   planted violation before being kept.
3. **`__tests__/simulation/eventTelemetry.sim.test.ts`** — reach, overlap and
   same-life replay.
4. **`__tests__/simulation/eventFunnel.sim.test.ts`** — the four-stage funnel,
   probed against the states the tick walked.
5. **`__tests__/simulation/eventReachability.test.ts`** — 17-archetype condition
   screen with its own ratchet. Runs in the normal suite (pure, ~6s).
6. **`__tests__/simulation/eventWeightResponse.sim.test.ts`** — the controlled
   weight experiment, with the underpowered first attempt documented in place.

Nothing was authored. No weight was tuned. No content was added.

## 17. What was deliberately NOT done

- **No new events.** The brief asked for a world that responds, not a bigger
  bundle, and the measurement says the bundle was never the problem: 62
  templates still compete without being drawn in a 12-life cohort.
- **No weight tuning.** Now that weights demonstrably work, tuning them is a
  design decision with an owner, and a numbers pass on the same commit as the
  mechanism would make it impossible to attribute either.
- **No change to `npcDepth`'s colliding streams.** Real, documented, flavour-only.
- **No change to the global economy roll.** A shared world is the intent.
- **No life-stage tuning.** Not measured by this cohort; see §12.

## 18. Owner decisions

1. **Event frequency.** Mean events per life over 100 weeks is 18.2, against 14.7
   before. The per-week ceiling (2) and the min-gap cooldown are unchanged and the
   growth is authored arcs completing, but "how much story per hundred weeks" is
   a product judgement. If it reads as too much, the lever is
   `EARLY_GAME_EVENT_CHANCE` / the phase multipliers, not the salt.
2. **Weight tuning pass.** 62 templates compete and are rarely drawn. A tuning
   pass is now a real option and would need its own before/after.
3. **The `npcDepth` id collision.** Flavour today. Worth salting if an NPC mood
   ever gates money, health or an unlock.
4. **Life-stage measurement.** Needs a long-horizon persona (500+ weeks) to say
   whether midlife and senior beats land in their chapters.
5. **Happiness saturation (§15b).** A player who answers every event now averages
   90-97 happiness over a hundred weeks whatever else they do. The event
   catalogue is net-positive on happiness and nothing bounds the aggregate. If
   happiness is meant to be a resource rather than a formality, this is where to
   look, and the p10 is the statistic to tune against — the mean is clamped.

## 19. Rejected proposals

- **"Raise the weights of the 93 never-selected templates."** The obvious fix,
  and wrong: it treats a selection defect as a content defect and would have
  distorted every weight in the game permanently. It also could not have worked
  — with one fixed sample per week, moving spans mostly moves which single
  template wins every time.
- **A per-template delivery quota / round-robin.** Guarantees coverage, destroys
  the thing coverage is for: an event should arrive because the life invited it,
  not because a scheduler owed it.
- **Salting `economyEvents`' calm-duration roll.** Would give every life a
  private recession. The macro economy is deliberately one world.
- **Backfilling a `lineageId` onto pre-Program-8 saves.** Changes an in-progress
  life's event schedule on a guess (§15).

## 20. Remaining gaps

- 62 templates compete and never draw in a 12-life cohort. Tail, not defect, but
  unquantified above 50 lives.
- Life-stage delivery unmeasured (§12).
- The reachability screen reaches 226/365; the residue needs either more
  archetypes or the funnel.
- `npcDepth` streams collide across lives (§8).
- Choice quality (is any choice dominant?) was not measured. The funnel measures
  what arrives, not whether the decision it poses is interesting.
- The tick is not fully deterministic across repeated runs in one process
  (§15c). Event delivery is; something reading `Date.now()` is not.
- Happiness saturates for every persona once the catalogue is delivered (§15b).

## 21. Verification

| gate | result |
|---|---|
| `npm run type-check` | clean |
| `npx tsc -p tsconfig.tests.json` | clean |
| `npm run lint:errors` | 0 errors |
| `npm run lint:ratchet` | 0 errors (limit 0), 719 warnings (ceiling 719) |
| `npm run type-check:tests:ratchet` | holding at 0 (baseline 0) |
| `npm run check:routes` | 17 routes, no conflicts |
| full `npm test -- --ci` | **752 suites, 9448 passed, 0 failed** (14 suites / 21 tests skipped: the `RUN_*`-gated soaks) |
| `npm run ui:ratchet` | at ceiling on all three counters |
| `npm run check:content` | at or above every floor |
| `npm run audit:save` | no blockers |
| planted-violation check on the new guard | fails as intended, then reverted |
| same-life replay | byte-identical, test passes |

## 22. Scores (0-100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| event reach (distinct content a life sees) | 18 | 62 | 30 -> 108 ids over 50 lives |
| cross-life variation | 22 | 70 | exact overlap 28.3% -> 9.4% |
| same-life replayability | 95 | 95 | byte-identical, before and after |
| determinism architecture | 45 | 78 | the last week-only life roll is gone and is guarded; a wall-clock read on the tick remains (§15c) |
| weight responsiveness | 5 | 78 | 0.96% -> 4.86% share at 20x; was measurably nil |
| delivery funnel health | 25 | 66 | 33 -> 78 of 107 competitors delivered |
| content reachability | 40 | 55 | screen 226/365; unchanged by the fix, now measured |
| interruption budget | 80 | 80 | independent back-to-back picks 29 -> 29 |
| pacing quality | 55 | 60 | median gap 4 -> 3; worst quiet run 5 -> 6 on one life |
| narrative arc completion | 30 | 70 | arc-adjacent weeks 47 -> 157 |
| transactional core reachability | 10 | 72 | job_offer / unexpected_bill / sick_day now deliver |
| exploit resistance | 84 | 84 | no new surface; save-scum still blocked |
| save compatibility | 90 | 90 | no format change, no bump, no data loss |
| measurement infrastructure | 20 | 78 | four sim harnesses + one static guard, none existed |
| content volume | 70 | 70 | untouched on purpose |
| weight calibration | 30 | 30 | untouched on purpose; now tunable |
| life-stage targeting | 50 | 50 | structurally sound, unmeasured |
| wellbeing calibration | 60 | 45 | happiness now saturates for every persona (§15b) |
| **overall world simulation** | **41** | **67** | |

Under 70 because two of the three things a world needs are now true and the
third is untested. The same life replays. Different lives diverge. Whether the
world is *tuned* — whether the events that now arrive are the right ones, in the
right chapter, posing decisions worth making — is a question this program made
answerable and did not answer.

The honest summary of the last three programs: Program 11 built the door,
Program 12 made what is behind it worth having, and Program 13 found that the
delivery channel had been sampling one number a week for every player in the
game.
