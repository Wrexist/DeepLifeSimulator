# Master Program 12 — Relationship Depth, Social Value, Meaningful Consequences

Branch `claude/deep-life-social-systems-xtuu69`, on top of Program 11 (`10001ab`).
Programs 1–11 untouched.

Program 11 put people into the player's life. Program 12 asked whether they
matter, measured the answer, and found it was **no** — in a stronger and more
literal sense than Program 11 had inferred.

---

## 1. Current social architecture

Unchanged from Program 11 §1 (that map is still accurate). What this program
adds is the VALUE layer on top of it: `lib/social/closeness.ts` is now the one
definition of what a bond score means, and every consumer reads it.

## 2. Current relationship lifecycle

Also unchanged: meet (three doors, §4.7 of CLAUDE.md) → interact → bond → the
partner ladder (30/50/60/70/80) or, for a friend, nothing. What changed is the
last part.

## 3. Relationship value by score — the measurement

The controlled experiment: nine cohorts, identical policy, identical seed,
identical scenario, differing ONLY in who was in the life and at what bond, with
the bonds re-stamped every week so decay could not confound it
(`__tests__/simulation/relationshipValue.sim.test.ts`, 250 weeks).

**Before this program:**

| cohort | net worth | happiness | mean happiness | health | energy | tier |
|---|---|---|---|---|---|---|
| NOBODY | 14,856 | 96 | 81.7 | 0 | 96 | 3 |
| ONE AT 45 | 14,856 | 96 | 81.7 | 0 | 96 | 3 |
| ONE AT 60 | 17,656 | 96 | 81.7 | 0 | 96 | 3 |
| ONE AT 75 | 17,656 | 96 | 81.7 | 0 | 96 | 3 |
| ONE AT 90 | 17,656 | 96 | 81.7 | 0 | 96 | 3 |
| ONE AT 100 | 17,656 | 96 | 81.7 | 0 | 96 | 3 |
| FIVE AT 60 | 17,656 | 96 | 81.7 | 0 | 96 | 3 |
| TWENTY AT 45 | 14,856 | 96 | 81.7 | 0 | 96 | 3 |
| FIFTY AT 45 | 14,856 | 96 | 81.7 | 0 | 96 | 3 |

Read that table twice. **Happiness, health and energy are byte-identical**
whether a life contained nobody, one soulmate, or fifty acquaintances. The only
difference anywhere in it is $2,800 and one chapter — which is exactly the
Chapter 2 bundle for crossing bond 60 once (`ch2_someone_close`, added in
Program 11).

So the answer to the §5 question, measured rather than argued:

- **45 buys nothing.**
- **60 buys a one-off $2,800, once, forever.**
- **75, 90 and 100 buy exactly what 60 buys.** Not "less"; the same.

### 3.1 The root cause

Not weak wiring — **one-directional wiring**. The only connection between
relationships and wellbeing in the entire codebase was
`applyRelationshipHealth`, which could subtract 25 for a breakup, 10 for a
disappointed partner, 8 for a friendship fading and a standing 1/week (capped 3)
for estrangement, **and could add nothing at all**. `familyHappiness` is a
declared field with no production writer. The game modelled relationships as a
pure liability: they could cost you happiness and never give any.

### 3.2 After

| cohort | mean happiness before → after |
|---|---|
| NOBODY | 81.7 → **81.7** |
| ONE AT 45 | 81.7 → **81.7** |
| ONE AT 60 / 75 / 90 / 100 | 81.7 → **86.2** |
| FIVE AT 60 | 81.7 → **94.1** |
| TWENTY AT 45 | 81.7 → **81.7** |
| FIFTY AT 45 | 81.7 → **81.7** |

**One close friend now beats fifty acquaintances** (86.2 vs 81.7), and the loner
is untouched (81.7 → 81.7) — they lose nothing they had.

## 4. Friendship findings

The friend ladder had exactly ONE rung and it was a penalty (25, the neglect
threshold). Above it, 30/50/60/80 changed only Pulse feed cosmetics, a goal-card
counter, party guest ORDER and an achievement tally. Nothing above 25 changed
what the player could DO. The partner ladder, by contrast, has six real rungs
(30 · 40 · 50 · 60 · 70 · 80). Romance had depth; friendship had a number.

### 4.1 The second root cause: a free ratchet

`Call` cost nothing, was capped at once per contact per week, and paid a **flat
+3 at every score**, against the only downward pressure in the system (−2 per
fully-ignored want cycle ≈ −0.5/week). Measured consequence: the CASUAL SOCIAL
persona — which rings its contacts once every four weeks and does nothing else —
sat at an **average bond of 100 across 23 relationships** by week 250.

Everybody anyone ever rang reached the top of the scale. That is why quantity
dominated quality, and it is why the upper half of the scale could not be given
a meaning: everybody was already at the top of it. Every comparable ladder in
this repository already diminishes (`raiseRelationship` 8→2, `wantBonus`
4/2/1/0, food satiety full/half/quarter). The free interaction was the one that
did not.

Fixed with `closenessFalloff` — full value to 45, tapering to a quarter at 100.
The measured ladder now:

| climb | ringing EVERY week | ringing every FOUR weeks |
|---|---|---|
| 10 → 45 (recovery) | 14 weeks | — |
| 45 → 60 (close) | 6 weeks | 49 weeks |
| 60 → 80 (trusted) | 13 weeks | **never** |
| 80 → 100 | 35 weeks | **never** |

Recovery stays cheap (the Program 11 property). Somebody who rings when they
think of it plateaus just above `close`. **Consistency buys depth; headcount
does not.**

## 5. Romance findings

The partner ladder was already the healthy one and is untouched. Two notes:
`proposeToPartner` (the 80-gate) has **zero UI callers** — the Contacts app
routes proposals through the ring modal to `proposeMarriage` (60-gate) — so it
is dead code of the same class as the three verbs deleted in Program 11.
Reported, not deleted (§20 of the last program's list is long enough).

## 6. Family findings

`closeCircle` deliberately **excludes children** and includes parents. Every
child starts at `NEWBORN_BOND` (75) by construction, so counting them would hand
the entire wellbeing model to anyone who had a baby; and a seven-year-old is not
who you lean on. Including parents is what lets a loner who calls their mother
have somebody — the "relationships are optional" rule pointing the right way.

## 7. Social opportunity findings

Before: **one** support event existed in ~400 templates and it ran the wrong way
(the player supporting a PARTNER through job loss). Nothing in the game ever
supported the player. That is the whole reason a relationship could not answer
"why does this person matter?" with anything but a number.

Added `lib/events/friendSupportEvents.ts` — four templates, one shape (crisis +
a named friend + a choice between leaning on them and not), instantiated against
the three crises the game actually produces:

| event | fires when | pays in |
|---|---|---|
| `friend_gets_you_seen` | ill and health < 45 | **health** (never cash) |
| `friend_has_a_lead` | jobless after having worked | **reputation** (never cash) |
| `friend_covers_a_bill` | arrears or homeless AND broke | cash, capped at $400 |
| `close_friend_needs_you` | you have somebody, and money | it costs YOU $300 |

Every one requires a **trusted** bond (80), not merely close (60) — which is
what gives the upper half of the scale its job, and what keeps the loner's life
intact: a player with no close bonds never sees these and loses nothing.

## 8. Social consequence graph

```
  consistency (weekly contact)
        ↓  [closenessFalloff: diminishing, so this is the only route up]
  BOND 60 "close"  →  +1 happiness/wk each, capped +3   →  resilience
        ↓  [another ~13 weeks of the same]
  BOND 80 "trusted" →  somebody shows up in a crisis     →  health / reputation / cash
                    →  somebody asks YOU for help        →  a decision that costs money
        ↓  [leaning on them costs 12 bond]
  back under 80    →  the door closes until it is rebuilt
```

The loop closes on itself: help is real, help is bounded, and taking it spends
the thing that made it available.

## 9. Quality vs quantity

Answered in §3.2. Before: FIFTY AT 45 and ONE AT 100 were identical (both worth
nothing), and headcount bought more NOTIFICATIONS (45 vs 18 journal entries over
250 weeks) — the game's only response to more relationships was more spam.
After: one close bond beats fifty acquaintances, the cap binds at three, and the
falloff means the fiftieth acquaintance cannot be upgraded cheaply.

## 10. Social persona results (twelve personas, 250 weeks, seed 1)

| persona | close bonds | avg bond | mean happiness | net worth | died |
|---|---|---|---|---|---|
| LONER | 0 | 3 | 74.5 | 50,946 | no |
| CAREER-OBSESSED | 0 | 3 | 76.7 | 52,786 | no |
| WEALTH MAXIMIZER | 0 | 3 | 75.3 | 55,541 | no |
| SOCIAL + CAREER | 3 | 56 | 78.8 | 50,982 | no |
| RISK-TAKER | 9 | 59 | 89.4 | 54,050 | no |
| ROMANCE-FOCUSED | 1 | 33 | 93.5 | 23,348 | no |
| CASUAL SOCIAL | 25 | 99 | 94.4 | 52,156 | no |
| FRIENDSHIP-FOCUSED | 38 | 100 | 95.0 | **552** | no |
| FAMILY-FOCUSED | 11 | 100 | 98.3 | 21,810 | no |
| SOCIAL OPTIMIZER | 32 | 95 | 95.0 | **16** | **yes** |
| SOCIAL BUT BROKE | 16 | 100 | 99.5 | 325,252 | no |
| TEXT SKIPPER | 0 | 45 | 38.9 | 4,542 | **yes** |

Two rows need a caveat, stated rather than buried:

- **SOCIAL BUT BROKE runs on `immigrant_story`**, not `food_courier` like the
  others, so its wealth is not comparable. Its $325k came from the musician
  career ladder reaching $2,120/week — `passive`, `invested` and `property` are
  0 for the entire run. Nothing social caused it.
- **CASUAL SOCIAL is the remaining imbalance**: the same money as the loner and
  +19.9 mean happiness, for free Calls every four weeks. See §19.

## 11. Loner results (§18, the critical test)

Over 250 weeks the LONER **survives, stays housed, reaches tier 5, ends with
more money than every social life on the same scenario, and its happiness is
byte-identical to what it was before this program** (74.5 → 74.5). No forced
romance, no forced friendship, no chapter it cannot finish (`ch2_someone_close`
is satisfiable by calling a parent — Program 11), no unavoidable social cost.
Gated by `socialBoundaries.test.ts`.

## 12. Relationship-focused results

FRIENDSHIP-FOCUSED ends on **$552** against the wealth life's $55,541 — a 100×
gap — for +19.7 mean happiness. SOCIAL OPTIMIZER, which holds everyone and pays
to see all of them, **dies broke at $16**. Social investment is not costless and
over-investment is fatal. That is the tradeoff §17 asked for.

## 13. Economic interaction

No relationship grants money on a timer. The support system's only cash branch
is capped at $400, requires real arrears AND a broke player AND a trusted bond,
and costs 12 bond — so the lifetime cash a single friendship can ever be worth
is under $2,000, tested. Program 11's partner-income fix was re-verified under
every state §9 names (several partners, breakup, rematch, save/load round trip,
new life, malformed input): `__tests__/social/partnerIncomeBounded.test.ts`.

## 14. Retention interaction, and a finding about the event engine

The support events fire — measured 1 per life in 4/4 probe lives, out of 42–48
events answered per 250-week life. But the cadence did not respond to tuning:
**doubling `close_friend_needs_you`'s weight from 1.6 to 3.0 changed nothing —
the same single occurrence, in the same week 591, in all four lives.**

That is not variance. The weekly event pick is deterministic in the WEEK and is
not salted per life on this path, so every life draws the same event on the same
week whatever the weights say. It is the same class Program 8 fixed for the
disease and pre-roll streams and evidently did not reach here; it affects all
~400 templates, not these four. **Reported, not fixed** — it needs its own
measurement program. The weight was reverted to a value justified by the pool it
sits in rather than one tuned against an experiment that did not respond.

## 15. Story generation findings

The journal over 250 weeks is still **100% NPC life-event flavour** ("got a new
hairstyle", "is obsessed with a new TV show") — Program 11's finding, unchanged.
The support events add the first entries that are ABOUT something, but at ~1 per
life they do not yet change the character of the record. §19.

## 16–17. Exploits discovered and fixed

| exploit | status |
|---|---|
| A free Call ratchets any contact to bond 100 forever — headcount beats depth, and no upper band can mean anything | **FIXED** — `closenessFalloff` |
| The support cash branch as a repeatable income | **PREVENTED BY DESIGN** — capped $400, needs real arrears + broke + trusted, costs 12 bond; lifetime ceiling per friendship under $2,000, tested |
| A child farmed for wellbeing (every newborn starts at 75) | **PREVENTED** — children excluded from `closeCircle`, tested |
| Quantity farmed for wellbeing | **PREVENTED** — capped at 3 close bonds |
| Partner income (Program 11) under multiple partners / breakup / rematch / save-load / new life / malformed data | **RE-VERIFIED**, 10 tests |

## 18. Implemented changes

1. **`lib/social/closeness.ts`** — one definition of what a bond means
   (`estranged` 25 / `known` 45 / `close` 60 / `trusted` 80), the close circle,
   and the capped weekly contribution. No new save field.
2. **The wire runs both ways** — `applyRelationshipHealth` returns
   `happinessSupport`, accumulated and capped in the tick exactly like the
   neglect drag it mirrors (+1 each, cap +3, against a decay of 4).
3. **`closenessFalloff`** — a free catch-up is worth less to somebody you
   already see. The root-cause fix for quantity-over-quality.
4. **`lib/events/friendSupportEvents.ts`** — four templates, gated on a real
   crisis AND a trusted bond, bound to the actual person by `relationId`.
5. **The Happiness breakdown names the circle**, reading the same function the
   tick applies, and shows the line at ZERO too so a player with acquaintances
   learns what the missing line is worth.
6. **Measurement**: the controlled cohort experiment, five new personas (the
   §38 set is complete), the story probe, and four new gates.

No new save fields. No migration. `STATE_VERSION` stays at 50.

## 19. Owner decisions (§36)

1. **A free Call has no time cost.** This is the cause of the one remaining
   imbalance: CASUAL SOCIAL gets the loner's money AND +19.9 happiness because
   ringing people costs nothing at all. Every other action in the game costs
   energy. Giving `Call` a small energy cost would close it — but it changes an
   energy budget Programs 7 and 10 balanced, so it is not a call to make
   silently.
2. **The event pick is not life-salted** (§14). Fixing it changes every event in
   the game.
3. **Support events are delivered by the random event channel**, which gives
   them ~1 appearance per life. Deterministic delivery (the life-moment pity
   shape) would make the feature reliably visible, but that is a new tick
   subsystem, which §33 says to avoid without a strong reason.

## 20. Rejected proposals

- **Paying a friend bonus in cash.** §10 forbids it and Program 11 removed the
  one relationship that paid a salary.
- **Capping relationship count.** §22 says depth should matter more than count;
  the falloff and the cap achieve that without taking anything away.
- **Strengthening decay** to stop the ratchet. Program 11 measured neglect as
  already nearly invisible, and more decay is the maintenance chore §21 forbids.
  The falloff fixes the ratchet from the other end.
- **Tuning `close_friend_needs_you`'s weight up.** The experiment showed no
  effect (§14); shipping the number anyway would have been a change justified by
  nothing.

## 21. Remaining gaps

1. Free Calls make wellbeing cheap for a patient player (§19.1).
2. The journal is still almost entirely NPC flavour (§15).
3. 60 and 100 now differ (through `trusted` at 80), but 80 and 100 do not.
4. The crisis events reach only players who reach crises — correct by design,
   and it means most competent lives will not see three of the four.
5. One seed per persona; the tables are shapes, not distributions.

## 21b. Verification

- `npm run type-check` 0 · `npm run type-check:tests` 0 · `npm run lint:errors` 0
- `npm run lint:ratchet` 0 errors / **719 warnings at the ceiling of 719** (held,
  not raised) · `npm run ui:ratchet` OK at ceiling · `check:routes` 17 routes OK
- `npm test -- --ci`: **750 suites passed, 0 failed · 9,443 tests passed, 17
  skipped · 308 snapshots passed**
- `npm run preflight`: **ALL PREFLIGHT CHECKS PASSED**, exit 0
- Program 12's own suites: `closeness` 14/14 · `bondFalloff` 11/11 ·
  `friendSupport` 23/23 · `partnerIncomeBounded` 10/10 · `socialBoundaries`
  12/12 (8 from Program 11, 4 new)
- Seven `subsystemEquivalence` snapshots updated deliberately — the
  `applyRelationshipHealth` result gained `happinessSupport`, and the recorded
  values are themselves the assertion (1 only for the friend at 100; 0 for the
  breakup, the disappointed partner, the failing partner and the estranged
  family member).

## 22. Scores (0–100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| relationship depth | 20 | 55 | three bands now do different things; 80–100 still flat |
| friendship value | 15 | 58 | was measurably zero; now wellbeing + who shows up |
| romance value | 58 | 60 | untouched; still the healthiest ladder |
| family value | 66 | 68 | parents count, children correctly do not |
| social agency | 72 | 78 | the loner is byte-identical; over-investment is fatal |
| social variety | 42 | 48 | four new templates against ~400 |
| social consequences | 46 | 66 | the wire runs both ways and the crisis path exists |
| story generation | 55 | 58 | real events, rarely delivered (§14) |
| player clarity | 40 | 62 | the breakdown names the circle, and names it at zero |
| quality vs quantity | 20 | 72 | one close bond now beats fifty acquaintances |
| loner viability | 72 | 80 | measured unchanged, and now gated |
| social player viability | 55 | 70 | viable, costly, and fatal if overdone |
| retention value | 45 | 50 | limited by the event channel, not by the content |
| economic balance | 78 | 80 | no timer pays; the cash branch is bounded and tested |
| exploit resistance | 78 | 84 | the free ratchet was the last open one |
| long-term social value | 30 | 60 | a bond is worth having and worth keeping |
| **overall social system** | **53** | **66** | |

Under 70 because the delivery channel, not the design, is now the limit: the
game finally has things worth saying about the people in a life and can only say
them about once per life. That is the next program's problem, and it is an
engine problem, not a social one.
