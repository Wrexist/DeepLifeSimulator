# Retention journey — Master Program 9 (2026-09-03)

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 8 (`6fbdbf4`).
Programs 1–8 untouched. Nothing here is a timer, a streak, a popup or a wall;
every change strengthens a loop that already existed. Numbers come from the
persona simulator on the production tick, 100 weeks, answering every decision
the game raises (`__tests__/simulation/retentionJourney.sim.test.ts`, run with
`RUN_RETENTION_SIM=1`); the code map comes from the systems named in §14.

**Session model used for the day map.** A "Next week" tap with light play is
about a minute; a session is 10–20 weeks (Program 6's 30-minute map covered
weeks 0–13). Day 1 ≈ weeks 0–15, Day 3 ≈ week 40, Day 7 ≈ week 100, Day 14 ≈
week 200, Day 30 ≈ week 400+ (or a second life). The repository cannot
measure real retention; these are the in-game milestones a returning player
meets, and every claim below is about what the game shows at those weeks.

---

## 1. The retention journey as it stood (measured)

Per-week signal map, careful persona, 100 weeks (a signal = a new decision in
the inbox, a cliffhanger, a promotion ready or taken, an unlock, a chapter
step, a change in the recommended goals, a new week-ahead row, a life moment,
a relationship change, an illness):

| measure | before | after |
|---|---|---|
| silent weeks (no signal) of 100 | 51 | 40 |
| dead zones (≥ 3 silent weeks) | 10 | 3 (34–36, 42–44, 90–92) |
| longest silent stretch after week 10 | 10 | 5 |
| goal-row changes | 1 | 21 |
| life moments met | 1 (the 52-week pity) | 9 |
| week-ahead rows added | 5 | 15 |
| chapters completed by week 100 | 1 | 2 (Chapter 3 active) |
| inbox events | 14 | 14 (unchanged — see §18) |
| cliffhangers | 4 | 4 |
| relationship changes | 0 | 0 (§21) |

Weeks 1–9 are dense (the starter events, the coach, the first pay, Chapter 1,
the first promotion at ~week 13). From week 15 on, a working life's regular
signals were a promotion every 13–25 weeks, an inbox event every ~9 weeks and
the weekly-challenge rotation — and a goal card that never changed.

## 2–6. Day 1 → Day 30 map

| stage | ≈ weeks | primary motivation | primary goal | uncertainty | progress signal | reason to return | biggest drop-off risk |
|---|---|---|---|---|---|---|---|
| first 5 min | 0–1 | "what is this life?" | get a job (coach) | will I be OK? | first wage on tick 1, recap line names the drift | the loop is named: work → drift → free fixes | the four-surface first tick (fixed in P6) |
| first session | 0–15 | stabilise: room, wage, vitals | Chapter 1, then the routed goal | can I stop the slide? | ring colours, drift line, Chapter 1 reward, first promotion ~wk 13 | a promotion in reach; Chapter 2's home + promotion; the starter envelope's outcome | the vitals slide for a text-skipper (P7: dies wk 15–20, fairly) |
| Day 1 end | ~15 | "I settled in" | Chapter 2 → tier 2 unlock | what opens next? | chapter bundle + "Spark, Education, Stocks, Real Estate unlocked" | the newly opened apps; the ambition picker (after Ch 1) | **was**: Chapter 2 stalled on one purchase; **now**: it completes at the promotion for anyone housed |
| Day 3 | ~40 | a direction | ambition milestone 1; Chapter 3 (save $10k, partner, invest, career 3) | which ladder is mine? | rotating SOON goal (promotion / property / someone / friendships), level 3 at ~wk 30 | a life moment every ~20 weeks; the board turning over; Chapter 3 steps | the mid-game was a job-and-wait loop (§7); now 3 short dead zones |
| Day 7 | ~100 | identity: career at max rung, $20–45k, housed | Chapter 4 (net $50k, business, degree, career 5) | what is the next ladder? | tier 3 (company, crypto, vehicles, travel) via the $10k wealth mark at ~wk 36–48 | education / business / property as SOON goals; ambitions' second milestones | no social thread without opening Spark (§21) |
| Day 14 | ~200 | wealth or family or fame | Chapter 5 (net $200k, perfect stat, family, prestige-ready) | can I finish this life well? | net-worth ladder; life-quality dream goal from week 52 | prestige preview; legacy contracts | "number goes up" if the player has one income source (§9) |
| Day 30 | 400+ / life 2 | legacy | prestige, heir, dynasty | what carries over? | prestige shop, legacy points, family tree | a NEW seeded life that is not the same life (P8) | the second life replaying the first (fixed in P8) |

## 7. Retention dead zones (measured)

Before: weeks 22–24, 34–36, 54–56, 66–68, 70–72, 78–80, 82–84, 86–88, 90–92,
94–96 (careful); the same shape for average and strategic. Root causes:

1. **Frozen goal recommendation.** `recommendGoals` was a pure max per
   horizon; "Earn your next promotion / Reach a fortune" won every week from
   week 6 to 100 while "Find someone", "Buy your first property", "Deepen
   your friendships" and "Raise a family" were eligible and never shown.
2. **Life moments effectively off.** 1.5%/week + 52-week pity = one a year;
   19 of 20 authored moments never met.
3. **Chapter spine stalled.** Chapter 2's bed (P8) was never bought by a
   persona that did not open the Market; Chapter 3 never activated; the app
   grid opened only through the wealth milestones.
4. **Unannounced recurring decision.** The job board turns over every 8 weeks
   with no Home signal.

After: 34–36, 42–44, 90–92 remain (3 weeks each). What fills the rest is
existing content shown in turn, not new interruptions.

## 8. Short-term loop — "what should I do now?"

Every week offers: the routed NOW goal (savings ladder / health / happiness /
arrears), the Health tab's free fixes, Market purchases (food, bed, gym,
housing tier), street jobs, the promotion tap when ready, and any waiting
decision (inbox events, letters with a 4-week deadline, life moments). The
recap names the drift and its causes. A week without a new signal is still a
week with a decision available; what was missing was a REASON to look — the
frozen card. Verdict: sound, now surfaced.

## 9. Mid-term loop — "what am I working toward?"

Chapters (visible, achievable, unlock the app grid), the SOON goal (now
rotating), ambitions (after Chapter 1), the career ladder (6 rungs, promotion
every 8 → 14 → 20 weeks as the early boost fades). Progress is visible on every
one. "Number goes up" risk: a single-income life sees net worth climb
linearly ($20k at 100 weeks on a janitor's wage, $46k for the strategic
persona) with the next ladder — property, business, education — behind apps
the player must open. The rotating SOON goal now names those doors.

## 10. Long-term loop — "what kind of life am I building?"

| horizon | what exists | reachable by |
|---|---|---|
| 20 weeks | first promotion, Chapter 2, a room, tier 2 apps | everyone housed and employed |
| 50 weeks | career level 3–4, Chapter 3, first property / partner / investment, ambition milestone 1 | a player who opens two apps |
| 100 weeks | career max rung, Chapter 4 (business, degree), tier 3 apps, life-quality goal | the strategic persona had $46k and every entry rung |
| multiple lives | prestige, heir, dynasty tiers, legacy contracts, family tree | the prestige-ready Chapter 5 goal |

## 11. Personal story systems

| system | produces | cadence measured |
|---|---|---|
| life moments (20 templates, choices with consequences + memories) | "I took a risk and…" | 1/100 wks → 9/100 wks |
| cliffhangers (28, conditioned on partner/job/wealth) | "…and then next week" | 4/100 |
| inbox events (271 templates + letters with deadlines) | "I chose to…" | 14/100, 5 of them in weeks 1–9 |
| diseases (P8: per-life, sequential) | "my character recovered from…" | 1–3/100 for a young careful life |
| chapters / promotions / unlocks | "I finally…" | 5 promotions, 2 chapters |
| relationships / family | "I built my life around…" | 0 for every persona (§21) |

Number-only systems: the savings ladder as the perpetual NOW goal; net worth
as the perpetual DREAM (both now rotate or share the slot).

## 12. Boredom findings

The repeated action is "Next week" with nothing to decide: 51 of 100 weeks
before, 40 after, and 5 consecutive at most now. The free-fix taps (walk,
meditation) repeat weekly by design — they are a maintenance cost, and the
recap tells the player why. The weekly challenge card rotates every 4 weeks
but is mid-game content (hidden below tier 2 since P6).

## 13. Player segments

| segment | supported by | gap |
|---|---|---|
| builder / wealth | savings ladder, property (tier 2), business (tier 3), net-worth chapters | fine |
| career | 30 ladders, promotion cadence, job-board turnover (now announced), education for advanced ladders | fine |
| social / roleplayer | Spark, Pulse, Contacts favours, family, life moments | nothing before tier 2; parents are the only relationships for 15+ weeks |
| risk | street jobs, crime skills, dark web (tier 5), stocks/crypto | fine, late |
| completionist | achievements, collections, legacy contracts | fine |
| ambition-driven | 5 ambitions with 4 milestones each, after Chapter 1 | milestones 2+ are tiers away; progress reads on the card |

## 14. Existing underused systems (found, before adding anything)

Life moments (§11), the goal catalogue's SOON/DREAM entries (never shown),
the job-board rotation (never announced), Chapter 3+ (never reached by a
persona), the 271 event templates (~1 fire / 9 weeks by design, §18), the
ambition catalogue (after Chapter 1, milestone 1 needs tier 2–5 systems).

## 15–16. Proposals and ranking (impact × confidence ÷ complexity)

| # | proposal | segment | stage | impact | confidence | complexity | rank | done |
|---|---|---|---|---|---|---|---|---|
| 1 | Chapter 2 asks for a home, not a bed | all | Day 1 | high (the spine) | high (measured stall) | low | 1 | ✅ |
| 2 | SOON/DREAM spotlight rotation | all | Day 3–7 | high | high (measured freeze) | low | 2 | ✅ |
| 3 | life moments at the authored 2–3/yr | roleplayer / all | Day 3+ | med-high | high (author's own comment) | trivial | 3 | ✅ |
| 4 | announce the job-board turnover | career | Day 3+ | medium | medium | trivial | 4 | ✅ |
| 5 | a tier-1 way to meet someone (Contacts intro on a personal contact, or a "meet people" Health activity) | social | Day 1–3 | high | medium | medium-high | 5 | proposed |
| 6 | raise inbox-event cadence mid-game (min gap 8 → 5, 12% → 15%) | all | Day 3+ | medium | low (events are modals; the dial-down was a player complaint) | low | 6 | rejected for now |
| 7 | "Make a Friend" as a real goal once #5 exists | all | Day 1 | medium | high | tied to #5 | 7 | proposed |
| 8 | first-milestone ambitions reachable at tier 1 (a reputation or savings rung) | ambition-driven | Day 3 | medium | medium | medium | 8 | proposed |
| 9 | show the recap's cliffhanger teaser rate to the owner as a dial | — | — | low | — | — | — | note |

## 17. Implemented

See the commit `Retention: the goal row rotates…` — four changes, each in an
existing system, no new field, no migration, no new surface; tests in
`lib/goals/__tests__/spotlight.test.ts`, `lib/lifeMoments/__tests__/cadence.test.ts`,
`lib/anticipation/__tests__/engine.test.ts`, `__tests__/simulation/progressionIntegrity.test.ts`,
and the journey gates in `__tests__/simulation/retentionJourney.test.ts`.

## 18. Deliberately rejected

- **More inbox events.** They arrive as modals; the 8-week gap and the 8–12%
  gate were set after players reported a popup every week. Raising cadence
  would trade a measured complaint for an unmeasured gain.
- **Daily rewards, streaks, notifications, timers.** Not retention.
- **New goal content.** The catalogue already had unseen entries.
- **Moving the weekly challenge earlier.** All mid-game bundles; P6's gate stays.

## 19. Persona results (100 weeks, after)

| persona | outcome | chapters | moments | goal-row changes | dead zones |
|---|---|---|---|---|---|
| text-skipper | dies wk 20 (fair — P7) | 1 | 0 | 4 | none in 20 weeks |
| average | dies wk 81 (Substance Abuse, critical, never saw a doctor — P8 note) | 2 | 3 | 19 | 2 |
| careful | alive, $23k, janitor 5/5 | 2 | 9 | 21 | 3 |
| strategic | alive, $46k, farmer 5/5 | 2 | 9 | 21 | 3 |

Segments the simulator cannot drive (social, risk via apps) are assessed from
the code in §13.

## 20. Red team

- **Leaves after 10 minutes:** the first tick names the loop (P6); the coach's
  job → wage → room path works. Risk remains for a player who reads nothing.
- **Leaves after Day 1:** was the Chapter 2 stall + a frozen goal card; now
  Chapter 2 completes at the promotion and opens tier 2.
- **Returns for a week, then bored:** weeks 15–100 had ten 3-week dead zones;
  now three. The board turnover and rotating goal give a reason to look.
- **Completionist:** 20 life moments now reachable in a life; collections,
  contracts and achievements unchanged.
- **Casual:** a session of 10 weeks always crosses at least one chapter step,
  promotion, moment or goal change.
- **Hardcore optimizer:** cash still grows linearly on one income; the next
  ladders are behind apps the goal row now names. No exploit found in the
  changes (all derived, none grant anything).

## 21. Remaining retention risks

1. No social thread before tier 2: the parents are the only relationships for
   the first 15+ weeks and "Make a Friend" is pre-ticked (documented). Proposal #5.
2. Inbox events: ~1 per 9 weeks mid-game by design; the story pool is large
   and rarely drawn.
3. The average persona still dies at ~week 80 of a critical illness it never
   treated — a fair consequence, but a Day-7 loss for a player who never
   opens the Health tab.
4. Ambition milestone 1 needs tier 2–5 systems for four of five ambitions.
5. The day mapping assumes 10–20 weeks a session; real session length is not
   measured in the repository.

## 22. Verification

- `npm run type-check` 0 · `npm run type-check:tests` 0 · `npm run lint:errors` 0 ·
  `lint:ratchet` 0 errors / 722 warnings (ceiling 722, unchanged) · `ui:ratchet`
  OK at ceiling · `check:routes` 17 routes OK.
- `npm test` (CI mode): 738 suites, **9,312 passed, 0 failed**, 308 snapshots
  (none changed by this program).
- `npm run preflight`: ALL PREFLIGHT CHECKS PASSED (14 PASS lines), lint,
  ratchets, content and live-ops checks OK — exit 0.
- Journey gates: `__tests__/simulation/retentionJourney.test.ts` 5/5; Program 7
  and 8 gates re-run green after the Chapter 2 change (34 + 16 + 8 + 4).

## 23. Scores (0–100, honest)

| dimension | before | after | basis |
|---|---|---|---|
| first session | 60 | 62 | P6/P7 work; unchanged here except Chapter 2 |
| Day 1 motivation | 50 | 66 | Chapter 2 completes; tier 2 opens; ambition after Ch 1 |
| Day 3 retention | 40 | 60 | goal row rotates; moments; board announced |
| Day 7 retention | 35 | 55 | Chapter 3 reachable; dead zones 10 → 3 |
| Day 30 retention | 40 | 48 | prestige/legacy exist; second life now different (P8) |
| short-term motivation | 55 | 64 | decisions available; reasons to look surfaced |
| mid-term motivation | 35 | 62 | rotating SOON goal from existing catalogue |
| long-term motivation | 45 | 50 | ladders exist; milestone 1 far for most ambitions |
| personal story potential | 40 | 58 | moments 1 → 9 per 100 weeks; per-life seeds |
| progression satisfaction | 50 | 60 | chapter spine moves; bundle causality clear (P8) |
| variety | 35 | 55 | goal rotation, moments, board turnover |
| boredom resistance | 30 | 50 | silent weeks 51 → 40, longest 10 → 5 |
| return reasons | 40 | 58 | week-ahead rows 5 → 15; moments; chapter steps |
| **overall retention design** | **42** | **57** | |

Under 60 because the social loop is absent for the first tier, the event
pool is drawn rarely by design, and the mid-game still has 40 silent weeks
of 100.
