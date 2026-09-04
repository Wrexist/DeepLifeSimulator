# Master Program 14 — Stat Semantics, Determinism, Long-Run Differentiation

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 13 (`9fe90c5`).
Date 2026-09-04. Programs 1-13 untouched.

**Two results.** The simulation is now deterministic: the same life, replayed,
produces the same life, field for field, week for week — and so does a life
continued from a saved game. That took seven separate fixes and it is gated
three ways. And happiness, which had compressed every persona into the same
90-97 band, now diminishes as it rises, so the top of the scale has to be
earned continuously instead of arrived at and held. The first result is
complete. The second is real, measured, and partial — §11 says exactly how far
it got and where it stopped.

---

## 1. Real-time dependencies found

Program 13 reported, as an open finding, that the tick was not reproducible and
named `Date.now()` as the likely cause. **That was a hypothesis, and it was
wrong.** The first thing this program did was test it: freeze `Date.now` for an
entire persona run and repeat.

```
  real clock:   91.05 / 93.28 / 92.50   identical: false
  frozen clock: 92.50 / 93.28 / 91.57   identical: false
```

Freezing the clock changed nothing, so the clock was not the culprit and the
search had to continue. That correction matters more than the original guess:
a plausible cause named in a report gets inherited, and this one would have
sent the next reader to rewrite every timestamp in the codebase for no gain.

The second thing that failed was the obvious instrumentation. A probe that
replaced `Math.random` before the run recorded **zero** calls — because
`__tests__/helpers/earlyGameSim.ts` assigns `Math.random = mulberry32(seed)`
for its own runs and overwrote the probe. **The simulation harness seeds the
global, so a draw that is unreproducible in the app looks perfectly
reproducible in a test.** That is why the eventual guard is static.

## 2. Determinism problems found

Found by diffing two identical runs field by field, week by week, fixing the
first field that differed, and diffing again. Seven rounds:

| # | site | what it was |
|---|---|---|
| 1 | `generateNPCGoals` (`lib/social/npcDepth.ts`) | two `Math.random()` draws **on the weekly tick**, written into the save |
| 2 | `addMemory` default id | `mem_${Date.now()}_${Math.random()}` |
| 3 | `performHealthActivity` | ten raw draws deciding which disease a health activity cures |
| 4 | Spark match + message ids | `${prefix}-${Date.now()}-${Math.random()}` |
| 5 | `createCheckpoint` | `cp_<week>_<Date.now()>` |
| 6 | Pulse posts | engagement, virality, follower gain, ad revenue, and every post/comment/notification id |
| 7 | `playConversationOption` | defaulted its outcome roll to `Math.random` |

Two of these deserve naming individually.

**`generateNPCGoals` is a direct violation of CLAUDE.md 4.3** ("never add a
`Math.random()` to the tick"), it ran every week for every relationship lacking
goals, and its output is persisted. Its shuffle was also
`pool.sort(() => Math.random() - 0.5)` — an inconsistent comparator, which is
not a shuffle: the permutation depends on the engine's sort and is heavily
biased toward the input order.

**`checkViralChance` (`lib/social/socialMedia.ts`) carried this comment:**

> ANTI-EXPLOIT: Use deterministic hash instead of Math.random() to prevent
> save/reload abuse. Same inputs at same game state = same outcome every time.

and the line under it hashed `Date.now()`. A millisecond timestamp is not "the
same game state"; it is the one input guaranteed to differ on every call. The
seed was a clock-driven coin flip, reloading and re-posting genuinely did
reroll a post into virality, and the note read as protection that was not
there. Ten lines below it, `checkViralChanceFull` had been seeding on
`weeksLived` correctly the whole time.

## 3. Determinism fixes

Every one seeds on the LIFE and the WEEK, the convention CLAUDE.md 4.3 sets:

- `generateNPCGoals` takes a REQUIRED roll (no `Math.random` fallback, because a
  fallback is the hiding place) and shuffles with a real Fisher-Yates.
- `processWeeklyNPCDepth` folds a life salt into every key. Its stream was keyed
  on the week and the relationship id, and the ids that matter here are
  literals shared across lives — `parent1`, `parent2`, the meeting door's
  `met-w2` — so two players' NPCs drifted through identical moods in identical
  weeks. (Program 13's randomness audit classified this file NOT LIFE-AFFECTING
  with exactly that caveat written down; this closes it.)
- Ids became functions of state rather than the clock. `spm-<profileId>` is not
  merely deterministic but more correct: a life holds at most one match per
  dating profile, so the profile IS the identity.
- `applyChoiceConsequences`, `createCheckpoint` and the prestige family-tree
  node id likewise.
- The cure roll, the dark-web hack roll, the Spark conversation roll and the
  whole Pulse posting path take seeded streams.

One behaviour change worth stating plainly: **repeating an action in the same
game week now gives the same answer** rather than a fresh draw. A failed cure,
a caught hack, a flirt that did not land — none can be rerolled by reloading.
That is the intent everywhere else in this repository (every seeded roll is
"no save-scum reroll") and the week is what re-arms it.

## 4. Same-life reproducibility

`__tests__/simulation/simulationReproducibility.test.ts`
(`RUN_REPRO_SIM=1`), five personas, three runs each, 80 weeks, comparing every
field of the whole `GameState` every week:

```
  LONER               3 runs agree on every field, every week   PASS
  CASUAL SOCIAL       3 runs agree on every field, every week   PASS
  ROMANCE-FOCUSED     3 runs agree on every field, every week   PASS
  FRIENDSHIP-FOCUSED  3 runs agree on every field, every week   PASS
  CAREER-OBSESSED     3 runs agree on every field, every week   PASS
```

The only fields allowed to differ are display timestamps (`updatedAt`,
`createdAt`, `lastUsed`...). Each was checked individually, and two that looked
like that class and were NOT — the prestige family-tree node id and the Time
Machine checkpoint id — were fixed rather than excused.

Before the fixes, the same measurement over eight repeats found a divergence
every time, starting as early as week 1.

## 5. Save/load determinism

`__tests__/simulation/saveLoadDeterminism.test.ts` (`RUN_SAVELOAD_SIM=1`): run
to week 25, push the state through `hydrateLoadedState` — the real load path,
not a reimplementation — and continue both branches to week 60.

```
  CASUAL SOCIAL  round-tripped continuation == straight continuation   PASS
  LONER          round-tripped continuation == straight continuation   PASS
  the round trip itself preserves every field the simulation reads     PASS
```

One difference is allowed and it is narrow: `repairGameState` backfills an
absent optional array to `[]`, so `mindset.traits` goes `undefined` -> `[]`.
Every reader defaults an absent array, so the two states behave identically.
The allowance matches only the undefined-to-empty direction — an array that
loses entries still fails.

This is the test that would have caught the carve-out class CLAUDE.md 7
describes ("a carve-out still has to survive the LOAD"), where fields were
written to disk correctly and erased on the way back in.

## 6. Cross-life variation

25 lives, same persona and policy, differing only in `lineageId`, 100 weeks:

| measure | mean | sd | min | max |
|---|---|---|---|---|
| happiness (life mean) | 88.53 | 7.98 | 55.9 | 94.3 |
| health (life mean) | 46.39 | 9.32 | 24.1 | 67.0 |
| net worth (final) | $23,326 | $6,273 | $2,529 | $33,354 |
| events answered | 21.1 | 3.2 | 10 | 28 |

Both halves of 30 hold: **within-life variance is zero and cross-life variance
is not.** A life can end with $2,529 or $33,354 from the same policy.

## 7. The happiness equation, as the code actually runs it

```
  per week, in order:

  1. DECAY      h -= effectiveDecayRate x 0.8 x happinessDecayMul
                effectiveDecayRate = 4 x wealthMul x prestigeMul x graceRamp
                wealthMul  = clamp(100000/netWorth, 0.5, 1.0)
                graceRamp  = ramps in over the first 8 weeks OF THIS LIFE
                happinessDecayMul = 0.5 with the gold upgrade, else 1.0
                => 3.2/week at full grace; 1.6/week above ~$200k net worth
                => THE ONLY RECURRING DRAIN

  2. SUBSYSTEMS ~20 writers add or subtract: relationships, anniversaries,
                housing, savings goals, pets, luxury, diet, education, career
                penalty, pregnancy...  each clamped 0-100 individually

  3. NET GAIN   the net movement since step 1 is scaled by the falloff  <- NEW
                (Program 14; nothing here before)

  4. CLAMP      h = clamp(h, 0, 100)

  outside the tick: event effects (applyEventStatDeltas), player actions
  (applyStatsDelta), and a handful of direct writes, each scaled at its site.
```

## 8. The happiness source ledger

Measured by instrumenting the curve and attributing every positive delta by
call site, over 100 weeks:

| persona | raw inflow | largest source |
|---|---|---|
| CASUAL SOCIAL | 3.46/wk | relationship support 1.71, events 1.75 |
| ROMANCE-FOCUSED | 2.04/wk (through scaled paths) | events 2.02 |
| LONER | 1.97/wk | events 1.97 |

The instrumentation is itself a finding. The first version of the fix was
applied at the two obvious choke points and **barely moved the distribution**,
because those two carry 1-3.5 points a week out of a much larger flow. Chasing
the rest took three more rounds, and the last one — the romance life's weekly
date, writing `stats.happiness` directly in `DatingActions` — is why 11 ends
where it does.

## 9. Saturation root cause

Not the cap. **Happiness gains were linear and unbounded in aggregate against a
single fixed drain, and the 0-100 clamp discarded the surplus** — and with it
every difference between lives.

Over 150 weeks, six personas, before any change:

| persona | mean | p10 | median | weeks >= 95 | weeks with NO change |
|---|---|---|---|---|---|
| ROMANCE-FOCUSED | 98.99 | 100 | 100 | 140/150 | **132/149** |
| FRIENDSHIP-FOCUSED | 98.79 | 95.2 | 100 | 137/150 | 95/149 |
| CASUAL SOCIAL | 98.43 | 95.6 | 100 | 137/150 | 94/149 |
| CAREER-OBSESSED | 88.38 | 68.0 | 97.4 | 81/150 | 58/149 |
| WEALTH MAXIMIZER | 88.38 | 68.0 | 97.4 | 81/150 | 58/149 |
| LONER | 87.41 | 62.8 | 95.8 | 76/150 | 55/149 |

Three things in that table:

- **CAREER-OBSESSED and WEALTH MAXIMIZER are identical to the decimal.** Two
  different lives, one emotional trajectory.
- "Weeks with no change" is the tell. The romance life spent 132 of 149 weeks
  with happiness moving by exactly zero. Not stable — pinned.
- **Weeks below 50: zero, for all six personas.** The bottom half of the scale
  was unreachable in ordinary play.

And the measurement that settles it — the recovery curve, which is also 23's
answer. Starting the same life at four different happiness levels:

| persona | start 20 | start 50 | start 80 | start 100 |
|---|---|---|---|---|
| LONER, mean of last 20 weeks | 93.19 | 93.19 | 93.19 | 93.19 |
| CASUAL SOCIAL | 97.39 | 97.39 | 97.99 | 97.99 |
| FRIENDSHIP-FOCUSED | 97.39 | 97.99 | 96.35 | 96.35 |

A life knocked to 20 reaches 90 in 16-25 weeks and then converges on the
**identical** trajectory. The starting state was not recovered from; it was
erased.

## 10. What was implemented

`lib/economy/happinessGain.ts`, sitting beside `statDecay.ts` because that file
set the precedent for "one place the numbers live":

- `happinessGainFalloff(current)` — 1.0 up to 55, tapering quadratically to 0.2
  at 100.
- `scaledHappinessGain(current, delta)` — scales a gain, **passes a loss through
  untouched**.

This is the answer this repository has already reached twice for the same shape
of problem: `closenessFalloff` (Program 12: a catch-up is worth full value to
bond 45 and a quarter at 100) and food satiety (v48: meals 1-3 full, 4-6 half,
7+ quarter). CLAUDE.md 4.7 states the principle — when one ladder in a family
of ladders is flat, that is the bug.

Applied at four places, and the choice of places is the design:

1. **Once per tick, on the NET movement measured from AFTER decay.** One
   application covers ~20 weekly writers including ones not yet written. From
   *after* decay, not before: netting decay in with the gains would scale the
   decay down too, which the first cut did.
2. `applyEventStatDeltas` — where the event catalogue's happiness lands.
3. `applyStatsDelta` — the action-side choke point.
4. Seven direct writers that bypass all three (dating, luxury, social, jobs,
   food, elder activities).

Threshold 55 rather than `closenessFalloff`'s 45 because these are different
scales: a bond at 45 is an acquaintance, happiness at 45 is a life going badly.
Every persona measured sat at or above 62 at its 10th percentile, so **the
curve does not touch a struggling life at all.**

## 11. What it achieved, and what it did not

| persona | mean | p10 | median | weeks >= 95 | flat weeks |
|---|---|---|---|---|---|
| LONER | 87.4 -> 85.8 | 62.8 -> 62.4 | 95.8 -> 92.2 | 76 -> 67 | 55 -> 46 |
| CASUAL SOCIAL | 98.4 -> 96.2 | 95.6 -> 88.2 | 100 -> 100 | 137 -> **105** | 94 -> 79 |
| FRIENDSHIP-FOCUSED | 98.8 -> 96.5 | 95.2 -> 87.5 | 100 -> 100 | 137 -> **110** | 95 -> 78 |
| CAREER-OBSESSED | 88.4 -> 86.4 | 68.0 -> 65.1 | 97.4 -> 92.8 | 81 -> 72 | 58 -> 44 |
| ROMANCE-FOCUSED | 99.0 -> 98.0 | 100 -> 97.8 | 100 -> 100 | 140 -> 136 | 132 -> 125 |
| WEALTH MAXIMIZER | 88.4 -> 86.4 | 68.0 -> 65.1 | 97.4 -> 92.8 | 81 -> 72 | 58 -> 44 |

- Weeks at the ceiling fell 24-31% for the social personas.
- The spread of persona MEDIANS widened 4.2 -> 7.78, an 85% increase.
- The spread of persona means barely moved: 11.58 -> 12.18.

**What did not change, stated plainly:**

- **ROMANCE-FOCUSED is still pinned.** 136 of 150 weeks at 95+, median 100. Its
  weekly date restores the whole tick's decay even after scaling.
- **CAREER-OBSESSED and WEALTH MAXIMIZER are still identical.** Wealth still
  buys nothing emotionally that a career does not.
- **Weeks below 50 is still zero for every persona.** The bottom half of the
  scale remains unreachable in ordinary play.

## 12. A tuning experiment that produced nothing

Halving `HAPPINESS_GAIN_FLOOR` from 0.2 to 0.1 was measured over the same six
personas and 150 weeks: the spread of means went 12.18 -> 12.29 and the romance
life's weeks at 95+ did not move at all (136 either way). So the floor is not
what is still holding the top of the scale together, and doubling the nerf for
no measured gain would be exactly the blind rebalancing the brief rules out.

Reverted, and the null result is recorded in the module — the way Program 12
recorded its event-weight non-response, which is the note that made Program 13
productive.

## 13. Happiness vs health, energy, wealth

- **Health:** no happiness -> health edge exists in the tick. There is no
  runaway loop to break, and none was added.
- **Energy:** activities cost energy and pay happiness; energy regenerates
  weekly on its own. The loop the brief warns about (activity -> happiness ->
  energy -> more activity) does not close, because happiness does not feed
  energy.
- **Wealth:** money buys decay resistance, not happiness. `wealthMul` halves
  natural decay above ~$200k, which is a real advantage and a bounded one. That
  is also why WEALTH MAXIMIZER and CAREER-OBSESSED land identically: the wealth
  axis has no happiness term of its own.

## 14. Caps, clamps and thresholds

Every 0-100 clamp was left in place. The cap was never the defect — an
unbounded linear inflow underneath it was. What changed is that 100 now has to
be earned continuously.

The one threshold introduced (55) is documented against measured data rather
than chosen: it sits below every persona's 10th percentile, so the curve cannot
make a bad life worse.

## 15. New guards

Both verified by planting a violation and watching them fail, then reverting.

**`__tests__/tooling/simulationDeterminismAudit.test.ts`** — three tiers:
- TIER 1: **no `Math.random()` anywhere in the week loop.** No allowlist.
- TIER 2: every `lib/` module the week loop imports (transitively, value
  imports only) that contains a draw or a clock read must be DECLARED with a
  reason. Writing it found 12 more modules to classify, and one real bug among
  them (the prestige family-tree node id).
- TIER 3: a repo-wide ratchet on the count of files using `Math.random()`
  (ceiling 55), in the shape this repo already uses for lint and coverage.

**`__tests__/tooling/happinessGainAudit.test.ts`** — every file writing a
positive happiness delta must route through `scaledHappinessGain` or be
declared TICK_CHOKE_POINT / NOT_PLAYER / NOT_A_GAIN. This is the guard that
would have saved the three extra rounds described in 8.

**`__tests__/simulation/simulationReproducibility.test.ts`** and
**`saveLoadDeterminism.test.ts`** — the simulation-level gates, `RUN_*`-gated
because they take minutes.

## 16. Red team

| attack | result |
|---|---|
| reload to reroll a failed cure / caught hack / failed flirt | **closed by this program.** All three were `Math.random()` before |
| reload to reroll a post into virality | **closed.** The "anti-exploit" hash was seeded on `Date.now()` |
| scrub the device clock to change simulation outcomes | no simulation path reads wall time; Live Ops windows and the Legacy Pass season are deliberately real-time and cannot manufacture progress |
| repeat an action in one week for a better roll | blocked: same week, same key, same answer |
| farm happiness by clicking more systems | bounded by the falloff: at 95 a gain is worth ~30%, at 100 ~20% |
| drive happiness negative permanently | not reachable: the curve never scales a loss, and recovery below 55 is at full speed |
| grind a knocked-down life back up | intended and preserved: 20 -> 90 in 16-25 weeks |

## 17. Remaining risks

- Happiness is still compressed at the top for lives that actively buy it
  (11). The next lever is the SIZE of individual gains — a tuning pass with
  an owner, not a mechanism change.
- The wealth axis has no happiness semantics of its own (13).
- The bottom half of the happiness scale is still unreachable in ordinary play.
  Nothing here made that worse; nothing here fixed it either.
- The TIER 3 ratchet at 55 files is a ceiling, not a goal. Most of the
  remainder is UI flavour where a seeded draw buys nothing.
- Long-run behaviour was measured to 150 weeks. 250 and 500 were not run.

## 18. Verification

| gate | result |
|---|---|
| `npm run type-check` | clean |
| `npx tsc -p tsconfig.tests.json` | clean |
| `npm run lint:errors` | 0 errors |
| `npm run lint:ratchet` | 0 errors (limit 0), 719 warnings (ceiling 719) |
| `npm run type-check:tests:ratchet` | holding at 0 (baseline 0) |
| `npm run check:routes` | 17 routes, no conflicts |
| `npm run ui:ratchet` | at ceiling on all three counters |
| `npm run check:content` | at or above every floor |
| full `npm test -- --ci` | **755 suites, 9464 passed, 0 failed** (16 suites / 29 tests skipped: the `RUN_*`-gated soaks) |
| planted-violation check, both new guards | fails as intended, then reverted |

Six suites failed on the first full run after the change. Every one was
inspected rather than adjusted: two were em dashes I had introduced (stripped),
one was a test asserting a happiness value would land exactly on 100 (it now
lands at 99.6, and the test is named "clamps stat effects to 100" — the bound
is what it meant), one asserted a housing gap to six decimal places across two
lives now scaled by slightly different multipliers, one asserted an event's +5
lands as exactly +5, and one pinned a function's argument list that gained the
life salt. No assertion was weakened without the reason being written next to
it.

## 19. Scores (0-100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| simulation determinism | 25 | 92 | 7 defects fixed; 3 guards; TIER 1 has no allowlist |
| reproducibility | 20 | 95 | 5 personas x 3 runs x 80 weeks, every field, every week |
| save/load fidelity | 70 | 90 | round-tripped continuation is identical; one documented normalization |
| cross-life variation | 70 | 85 | 25 lives: happiness sd 8.0, net worth sd $6.3k |
| happiness differentiation | 20 | 45 | ceiling weeks -24 to -31%, median spread +85%; romance still pinned |
| happiness fairness | 55 | 72 | the curve cannot touch a life below 55; losses never scaled |
| relationship value | 66 | 66 | untouched; Program 12's wire still measures |
| negative-state quality | 25 | 30 | weeks below 50 still zero for every persona |
| recovery quality | 80 | 80 | 20 -> 90 in 16-25 weeks, deliberately unchanged |
| second-order stability | 60 | 75 | no happiness->health or happiness->energy loop exists to run away |
| stat semantics | 35 | 58 | happiness now means something between 55 and 100; below 55 still unvisited |
| long-run stability | 65 | 75 | stable to 150 weeks; 250/500 unmeasured |
| exploit resistance | 78 | 88 | four save-scum rerolls closed, including one wearing an anti-exploit comment |
| **overall simulation integrity** | **48** | **74** | |

Determinism carries this number and stat semantics holds it down. The
simulation is now a thing you can reason about — the same inputs give the same
life, a save is not a dice roll, and two guards make it hard to lose again.
Happiness is better and not yet good: it has a shape now instead of a ceiling,
but a life that spends on it weekly still tops out, and the bottom half of the
scale is a range no ordinary life visits.

The honest one-line summary: **Program 13 made the world respond, and Program
14 made it respond the same way twice.**
