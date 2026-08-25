# Ultimate economy audit — sources, sinks, dominance, exploits (owner program, 2026-08-25)

Owner brief: the "ULTIMATE ECONOMY" master program — audit the entire
TIME->WORK->MONEY->ASSETS->PROGRESSION loop, fix confirmed exploits and
displayed-vs-applied lies, prefer structural fixes, simulate long horizons,
and report with scores. Approach: automated audit layer first (clean), then
five parallel deep audits (money flow, investments, careers/education/skills,
exploit red team, late-game sinks), every load-bearing claim re-verified
against source before any change (lessons.md rule), plus a NEW committed
long-horizon strategy simulator driving the real tick.

## P1 — honesty + faucet defects (verified in source, fix now)

- [x] E1. Lucky bonus + play streak: untaxed, uncapped engagement income.
      EV +32%/wk (1%%x10, 5%%x3, 14%%x0.5) + streak up to +20%%, credited AFTER
      the tax base is fixed and after arrears settle, base = salary+passive
      so it scales forever ($5M untaxed taps at $500k/wk). Fix: (a) cap the
      qualifying base at the top tax threshold x1 ($25k/wk — the per-source-cap
      idiom), (b) withhold marginal income tax on both bonuses via the ONE
      canonical calculateIncomeTax (delta method). Probabilities/multipliers
      unchanged — the delight stays, the bypass closes. Measured in the sim:
      junior dev accumulates 126%% of gross salary.
- [x] E2. Company crypto miners: income paid, power bill never charged.
      The $0.20/unit/day electricity formula exists only in expenses.ts (UI)
      + a literal copy in IdentityCard.tsx; no tick counterpart (warehouse
      rigs got this exact fix, H-2). Fix: single source helper for company
      miner power cost; net it inside the company-miner passive row (floor 0);
      point expenses.ts + IdentityCard at the same helper.
- [x] E3. sellCrypto (dev-only path) counts sale proceeds as lifetime money
      EARNED (feeds Chapter 1 goals / contracts). Align with isIncomeReason.
- [x] E4. Vehicles displayed != applied (3 ways): tick charges full fuel for
      every vehicle, UI shows 25%% for idle; UI shows weekly insurance the tick
      never charges; accident premium for the active vehicle never applies
      (activeVehicleId never passed). Scope after reading; align tick and UI
      on one shared calculator.

## P2 — exploit closure + structural balance

- [x] E5. campaign() approval-refund loop (flagged 2026-08-23, now closed per
      this program): campaignFunds has NO positive consumer (election formula
      does not read it despite its comment), deposits are ~100%% recoverable
      via the 25%%/wk skim, so approval 50->100 costs ~$0 net. Fix: weekly cap
      on campaign() approval purchases (politics.lastCampaignWeek marker,
      STATE_VERSION 48->49 stub carve-out), + correct the false comment.
- [x] E6. Cross-life universal market script: stock seed is weeksLived:index
      with no per-save salt — every save/life/heir replays the same price
      tape ("NVDA moons at week 700" works in every life). Salt with
      lineageId:generationNumber (the C1 luck-roll precedent). Value-only,
      future walks only.
- [x] E7. Free-GPA merit farm: high_school costs $0, farms highestGpa to 4.0,
      -> 80%% off every later programme ($180k PhD for $36k). Merit basis now
      excludes zero-cost programmes.
- [x] E8. computer_science ($72k) gates NOTHING (software wants masters; the
      programme description promises "software engineering track"). Root-cause
      fix: software accepts CS as an alternative to masters if requirements
      support OR cheaply; else honest description + flag.

## P3 — measurement + report

- [x] E9. Committed long-horizon strategy simulator
      (__tests__/simulation/economyStrategySim.manual.test.ts, env-gated):
      GameProvider-mounted, drives real nextWeek() for 7 archetypes x 10y.
      First results recorded in the report.
- [x] E10. Regression pass: type-check both trees, lint:errors, routes, full
      relevant suites; new tests per fix.
- [x] E11. Final report tasks/economy-audit-2026-08-25.md: economic model,
      flows, stage analysis, career/business/investment balance, dominant
      strategies, exploits found/fixed, sim results, scores, remaining risks
      (flagged-not-fixed: musician entry-tier dominance, celebrity/politician
      vs degree ladders, wealth-scaling recurring costs, FIRE celebration,
      $10M-$100M dead zone, tera miner dead content, peek-ahead determinism).

---
---

# Future-improvements program — balance, content, memory surfaces (owner: "do all the good and fit the game", 2026-08-24)

Owner approved the previously-flagged balance calls plus the top-10 future list.
Scope judgement per item (Impact x Depth / Complexity, S70): everything below
FITS; the two structural rewrites (full action-point economy, carrying ghosts
into brand-new games as mechanics) stay out, replaced by fitting lightweight
versions (hustle verbs cost energy; an out-of-save archive keeps the memory).

## P1 — Balance triad (the dominant-strategy fixes)

- [x] B1. Company upgrade ROI retune. Every income upgrade pays back in ~20
      weeks (~260%/yr) vs stocks 7-11%/yr — the single dominant strategy.
      Target: ~45-week payback at level 1 (~115%/yr, still clearly the best
      ACTIVE path, no longer 26x stocks); cost x1.5^level + the existing
      10%/level efficiency haircut keep later levels diminishing. Value-only
      catalogue change (bonuses are baked into weeklyIncome at PURCHASE), so
      existing companies keep every dollar they already earn — only new
      purchases price at the new curve (the dark-web seed precedent). Base
      founding deals unchanged (they are the "start a business" fantasy and
      carry education + capital gates). Test: catalogue-wide payback ratchet
      (no income upgrade under 40-week L1 payback).
- [x] B2. Food satiety (closes the $1.60/point infinite energy printer).
      NEW `weeklyFoodPurchases?: number` (top-level, default undefined,
      STATE_VERSION 47 -> 48, stub migration, NO backfill, no repair mirror —
      absent already means "nothing eaten this week"; stamping a count would
      deny a player their full-strength meals). Reset with the other weekly
      counters in the tick. Effect multiplier by count this week: 1-3 full,
      4-6 half, 7+ quarter. buyFood becomes ONE atomic updater (recheck price
      against prev, charge, apply scaled restores, bump the counter — fixes
      its gate->grant shape too) and RETURNS what was applied so the market
      toast stays honest; market shows a "well fed" hint from the same
      helper. CLAUDE.md/DEV/WORKFLOW version lines synced + v48 entry.
- [x] B3. Health/happiness finally touch lifespan. Old-age death ramps from a
      LONGEVITY PIVOT derived from the already-shipped calculateLifeExpectancy
      (display-only until now), clamped [72, 92], instead of the fixed 80.
      A cared-for life ramps later (up to 92); a neglected one earlier (never
      below 72 — S27: a gradient, not a punishment cliff). Vitality skill and
      immortality unlocks unchanged. Tests: pivot clamps; healthy outlives
      neglected in expectation at the same age.

## P2 — Content and memory

- [x] C1. Chain-start roll off Math.sin (last non-deterministic event roll;
      Hermes vs V8 can disagree) -> makeWeeklyRoll, salted by chainId.
- [x] C2. Sequels remember WHO. `PendingChainedEvent.relationId?` carried from
      the source event through followUpFromChoice and stamped onto the
      delivered sequel — so a sequel's relationship effects hit the actual
      friend who borrowed the money instead of falling back to the spouse.
      (Appended nested data — no migration.)
- [x] C3. ~10 new sequels on high-frequency events via the one-line API, mixed
      tones (bills, warmth, consequences): gym invite -> training buddy,
      charity donate -> recognition, mentor accept -> mentor's test,
      school fees paid -> report card, car self-repair -> the fix fails,
      lottery party -> new friend, wedding wait -> partner cools, borrow
      refuse -> friend manages alone, festival attend -> photo memory,
      investment tip taken -> outcome. Each sequel weight 0, seeded outcomes
      where uncertainty reads better.
- [x] C4. Chapters 6-7 + 3 DREAM goals. Ch6 "Established" (weeks 100-250):
      $1M wealthMark, top of any career ladder, 20 achievements, turn 40.
      Ch7 "A Life Sealed" (250+): $10M wealthMark, 40 achievements, 3
      companies founded THIS life (lifetimeStatistics.totalCompaniesFounded —
      monotonic), turn 60. Rewards on the ch5 curve. DREAM goals:
      business empire (5 companies), the Legacy Contracts board (claimed /
      total — the audit's "buried behind six tabs" fix), a life well lived
      (lifeQuality score to 80 — the non-wealth dream).
- [x] C5. Hustle verbs cost energy (the fitting slice of a time budget):
      launchCampaign -8, hireCandidate -5 — managing a business now draws on
      the same weekly budget as street jobs and dates. Preview/commit
      resolvers stay atomic; UI copy shows the cost.

## P3 — Memory surfaces

- [x] S1. "This Life" timeline: pure lib/progress/lifeTimeline.ts merging
      careerHistory (start/end), notable eventLog entries, journal, births +
      marriage into one chronological list; LifeTimelineModal + a Progress
      launcher tile. The data always existed; it was never assembled (S11).
- [x] S2. Death-without-heir stops erasing the record. buildLifeRecord gains
      `name`; "Start New Game" appends the finished life to an out-of-save
      AsyncStorage archive (utils/lifeArchive.ts, capped, the
      premiumValueTracking pattern — NOT a save-format change), and
      LegacyTimeline's empty state shows those remembered lives.

## Verify + ship

- [x] V1. Tests per item; type-check both trees; lint:errors + ratchet;
      routes; full Jest.
- [x] V2. Commit + push to claude/deep-life-gameplay-redesign-1lcoa4.

## Still deliberately NOT doing

- Full action-point / hours-per-week economy — C5 + B2 + career tolls give
  the tradeoff without rewriting every action module.
- Nerfing existing companies' banked income — retune reaches new purchases.
- Carrying archive lives into new games as MECHANICS — memory only (S2).

---
---

# Gameplay depth pass — core loop, memory, honesty (owner program, 2026-08-24)

Owner brief: the "ULTIMATE CORE GAMEPLAY" program — audit the game as a designer,
find where the core loop fails to deliver, implement the highest-leverage fixes
(Impact x Depth / Complexity, brief S70), and report. Approach: four parallel
deep audits (weekly loop, events, progression/identity, economy tradeoffs), every
load-bearing claim re-verified against source before any change (lessons.md rule).

## What the audit established (verified, file:line in the final report)

- The simulation is deep (65 tick subsystems) but ~90% of weeks produce no
  authored moment and no decision; every feedback channel was individually
  quieted after popup-fatigue reports. Depth must come from anticipation,
  memory and honesty - NOT more popups.
- Event memory is written 3x (eventLog, choiceHistory, memories) and read in
  only ~10 places. The declarative chain API (`EventChoice.followUpEventId`)
  has ZERO producers and consumers - authoring a sequel requires hand-writing
  a stages[] array in engine.ts, which is why only 3 chains exist in ~398 events.
- previousLives entries carry 7 fields; LegacyTimeline already renders 9 more
  that nothing writes; lifeQuality() and classifyLife() are computed at death
  and DISCARDED. No cross-life self-comparison exists anywhere.
- The lucky-bonus roll is `(weeksLived*777+42)%100` - a fixed 100-week schedule
  identical for every player and life. Cliffhanger timing is the same class.
- Two live P1 bugs: `stats.money` inside event effects goes through the 0-100
  stat clamp (policy_voting vote_yes sets a politician's CASH to ~$100;
  tech_startup_success same), and lifeMomentGenerator's coffee-break unlock
  targets `networking_opportunity`, which has no payoff template - the promised
  introduction never arrives.

## Plan

### A. Correctness first (priority order S11)

- [x] A1. Stat-clamp cash destruction. Consumer: the stats loop in
      `resolveEvent` must skip `money`/`gems` (currencies, not 0-100 stats).
      Producers: `policy_voting` moves the policy money effect to top-level
      `effects.money`; `tech_startup_success` folds its +200 into the flat
      charge. Regression test proven red on the old code.
- [x] A2. Orphaned payoff: add a `networking_opportunity` payoff template using
      the established `payoffReady` pattern (engine.ts ~2560), honoring the
      unlock flag already written into existing saves.
- [x] A3. Stale C-11 comment in GameActionsContext (legacy points HAVE a sink
      since v29) - correct it so the next audit doesn't inherit the lie.

### B. Anticipation (brief S44) - the loop's forward edge

- [x] B1. New collectors in `lib/anticipation/engine.ts`: elections
      (`politics.nextElectionWeek`, in office or campaigning) and unanswered
      letters (`expiresAtWeek` on mail-routed events, via lib/events/routing
      selectors). Both are real tick-enforced dates that today land as
      surprises. Tests per collector.
- [x] B2. Surface the cliffhanger teaser in `LastWeekRecap` (home strip) - today
      it only shows in the triple-gated WeeklyResultSheet, so the game's one
      "tune in next week" beat is usually invisible.

### C. Variance that is actually variance

- [x] C1. Luck roll -> `makeWeeklyRoll(weeksLived)` salted with
      `lineageId:generationNumber`: still deterministic per week (StrictMode/
      save-scum safe), no longer a public 100-week schedule shared by every
      player. Same fix for the cliffhanger timing roll (`(seed*997+31)%100`).
      Distribution + determinism tests.

### D. Event memory people can feel (S15-S16)

- [x] D1. Implement `EventChoice.followUpEventId` (+ `followUpDelayWeeks`) -
      the dead declarative API. `resolveEvent` queues it into the EXISTING
      `pendingChainedEvents` pipeline; the delivery path learns to generate a
      follow-up from the main template pool when the id is not in
      FOLLOW_UP_EVENTS. One line to give any of ~398 templates a sequel.
- [x] D2. Prove it with content: 2 follow-up arcs on existing high-frequency
      events (friend_help "lend" -> the friend repays with interest or asks
      again; wedding "marry" -> the honeymoon bill / a warm callback).
- [x] D3. `oncePerLife` template flag checked against eventLog in the selector,
      applied to the narrative one-shots (secret events, old-friend returns)
      so the same "first meeting" cannot repeat and break fiction.

### E. A life you can look back on, and beat (S9-S11, S52-S53)

- [x] E1. `buildLifeRecord(oldState)` in `lib/legacy/` - ONE builder used by
      both prestige paths, stamping what death already computes: lifeQuality
      score+verdict, ribbon, careerHistory titles, spouseName, children/
      properties/companies counts, totalWeeksWorked. Fills the 9 fields
      LegacyTimeline has always rendered but never received. No migration:
      entries are appended data, old entries simply lack the keys and the
      renderer already guards absence.
- [x] E2. Personal-best comparison in LegacyTimeline: best life called out, and
      the CURRENT life's standing against it ("You've already passed Gen 2's
      $4.2M"). The question a returning player actually asks.

### F. Honest choices (S55, S67)

- [x] F1. WeeklyEventModal choice preview: show relationship deltas, karma
      direction and the four `special` effects (fired / disease / free
      education / warning) - today the preview spoils trivial numbers while
      hiding the consequential effects entirely.

### H. Career tradeoffs made real (S6, S8, S22 - advertised vs actual)

- [x] H1. `lib/careers/jobMarket.ts` authors per-career `weeklyToll` (energy /
      health / happiness) and `growth` pace, and the work tab RENDERS both on
      the job card - but the tick applies a uniform -3 happiness / -2 health to
      every career and a flat progress rate of 5. Wire the authored profiles
      into `applyCareerSalaryAndPenalty` (toll, scaled by the existing
      seniority factor so the top of the ladder stays lighter) and
      `applyCareerProgress` (growth pace multiplier). Careers without a
      profile keep exactly today's numbers. This is the same
      advertised-vs-actual class the prestige shop fixes were - the design
      data exists, correct and differentiated; it needs its consumer.
- [x] H2. Tests: profiled careers differ from each other and from the uniform
      fallback; unprofiled careers unchanged; card copy matches what the tick
      now charges.

### G. Verify + ship

- [x] G1. Tests for every change; type-check both trees; lint:errors; routes.
- [x] G2. Full Jest suite.
- [x] G3. Commit + push to `claude/deep-life-gameplay-redesign-1lcoa4`.
- [x] G4. Final report per brief S77 (core fantasy, loop, scores, top-10).

## Deliberately NOT doing (S70 - and flagged in the final report)

- Company upgrade ROI retune. Upgrades pay back in ~20 weeks (~260%/yr) vs
  stocks at 7-11%/yr - the dominant strategy in the game. Retuning it moves
  every business player's income; owner's balance call. FLAGGED.
- `buyFood` as an uncapped energy printer (~$1.60/point, no weekly cap) -
  capping it is a nerf to every player; owner's call. FLAGGED.
- Health/happiness not affecting lifespan (old-age death is age-only while
  `calculateLifeExpectancy` is display-only) - wiring it changes every death;
  owner's call. FLAGGED.
- A global weekly action/time budget - a structural redesign of the whole
  action layer, not a drive-by.
- New chapters 6+ / more DREAM goals - content design; Legacy Contracts
  already own the late game.
- More event popups or higher event frequency - playtested decision, stays.
- Story mode / batched ticks - removed after playtesting (v38), stays removed.

---
---

# Full audit + production hardening pass (owner request, 2026-08-23) — DONE

Owner asked for the full bug-hunt / incomplete-feature / hardening sweep.
Approach: all automated gates first (everything green at the start — 641
suites / 8438 tests, both type-check trees, lint ratchets, routes, weekly
audit), then three parallel deep audits over the code newest on main
(politics v47, Spark v45, the prestige rewiring), each finding re-verified
against source before any fix (lessons.md rule).

## Fixed this pass (each verified, each with a regression test)

- [x] A1 **P1 — prestige builders aliased `initialGameState`.** The reset and
      child builders spread the singleton and hand-cloned only
      stats/date/settings, while `applyStartingBonuses` writes THROUGH
      `newState.stocks/companies/vehicles` — so `starting_investment_portfolio`
      compounded per prestige within a session and `starting_company`/
      `starting_vehicle` leaked into brand-new games. Now `freshInitialState()`
      (guarded structuredClone, the repairGameState pattern). Test proven red
      on the old code: `__tests__/prestige/prestigeStateAliasing.test.ts`.
- [x] A2 **P1 — party standing was capped at 50 by construction.**
      `policySupportDelta` had zero callers AND the platform arrays used a
      vocabulary PolicyType doesn't contain (`environment`, `business`,
      `realEstate`, `defense`) — so endorsement (60), party funding, Party
      Chair (70) and Cabinet Secretary (55) were unreachable, and the Career
      tab counted down to a number the code could not produce. Wired the delta
      into `enactPolicy`'s updater AND the policy-vote event path
      (indistinguishable-downstream rule); platform arrays now typed
      `PolicyType[]` and corrected. `partyStandingWiring.test.ts` pins that
      every platform category is carried by ≥1 real policy and that
      endorsement is reachable from baseline in two favored enactments.
- [x] A3 **HIGH — pre-v47 party members loaded at 0 standing.**
      `readPartySupport` read an ABSENT key as 0 — under the primary-challenge
      floor, maximum election penalty, then PERSISTED by the weekly drift.
      Three doc sites promised a fresh-member baseline the code didn't have.
      Absent now reads `startingSupport`; a stored 0 stays 0.
- [x] A4 **P2 — appointment reputation farm.** Alternating two posts (+5/+8,
      no cooldown) reached the 100 clamp in six taps; reputation feeds the
      election roll and its up-to-$5M rewards. Reputation from a post now
      lasts only while it is held: swap nets the difference, resign gives the
      bump back. No save-format change needed.
- [x] A5 **P3 — pension + salary double-draw.** A retired President could win
      a council seat and draw the $6,000/wk max pension on top of the new
      salary forever. `getPoliticalPensionWeekly` now pays only out of office;
      the record (and title) survives and payment resumes on leaving.
- [x] A6 **P3 — `formAlliance` gate→grant non-atomicity** (+ same-id
      `Date.now()` double-append). Rewritten as preview/commit over a new pure
      `resolveFormAlliance` (the C-9 sound fix; ratchet stays at 101).
- [x] A7 **P3 — `runForOffice` career append unguarded** — two same-batch
      calls appended two `political` career entries that desync. Inner
      `prev`-recheck added.
- [x] A8 Weekly-audit warnings cleared: the 10 `as GameState` casts and the
      hand-built WeekContext stub in tests replaced with typed factory shapes
      (`zeroPreRolls`, complete `PulseVerifiedPro`).
- [x] A9 Stale comments that misled about shipped features (bill-pay "until
      the UI ships" pair; "buyCrypto is a stub" ×4); startup perf report now
      goes through `logger` like the rest of the file.
- [x] A10 Dark-web vendor seed residue (value-only change reaches new games
      only): documented as accepted at the seed site — no exact migration
      exists (no purchase record; old- and new-seed saves share v47).

## Flagged to the owner (deliberately not changed)

- Campaign↔embezzlement loop: `campaign()` has no weekly cap, so approval can
  be bought and ~recovered via the 25%/wk skim over time. Bounded by scandal
  heat (+6%/wk cap) so the expected cost is real; a per-week campaign cap
  would close it cleanly if wanted.
- `playConversationOption` returns `success:true` (+`relationshipId`) on a
  same-batch rejected double tap — state is safe; reporting only. Same class
  as the 101 ratcheted C-9 instances.
- `politics.activePolicies[]` is write-only (no policy sets `duration`);
  dead weight, and a trap if expiry is ever assumed to work.
- Dead-but-harmless: `retiredTitle()`, `appointmentBarsOffice()` (decoy
  helpers), `HeirGenerator`, `LeaderboardModal` (no production render site).
- Console clusters in boot-path files (`_layout.tsx`, native wrappers) left
  as-is: logger may be suppressed where those diagnostics matter most.

---

# Deferred items — "do all that's left" (owner, 2026-08-23)

- [x] L1. `starting_energy`: keep the +20 heir grant, ADD +25% energy regen for
      the first year of every life — real on the reset path at last.
- [x] L2. Scenario `rewards.achievement`/`title`: delete the dead fields (no
      consumer, ids in no catalogue) so the schema stops implying a reward path.
- [x] L3. FEATURE_FLAGS: delete the three zero-reader flags (`analytics`,
      `bootBreadcrumbs`, `weeklyEvents`) with NOTE comments; drop the unused
      import in GameActionsContext; sync CLAUDE.md's Sentry sentence.
- [x] L4. Legacy Name branch: deep nodes state the 100 reputation cap.
- [x] L5. Perk income scoping: crime_boss → street-job payouts, landlord →
      rental income, financial_guru → career salary; excluded from the global
      product so nothing double-applies; copy restored to the scoped promises.
- [x] L6. Enforce `career.requirements.reputation` (2 careers), waived by
      early_career_access like the rest of the block.
- [x] L7. Tests, full suite, push (updates PR #157). (Landed as the PR #157
      merge; box left unticked at the time.)

---

<!-- `tasks/todo.md` is a single active-plan file that each branch rewrites. The
     ACTIVE plan is first; finished plans are kept below it rather than dropped,
     so a merge finds complete records instead of a diff. -->

# Prestige balance pass + incomplete-feature audit (owner request, 2026-08-23)

Owner: "fix this the best way and balanced... also audit for more bugs and
features that incomplete or not working."

## A. Income cap — from silent hard clamp to a soft cap (balanced)

- [x] A1. Replace the hard `min(1.5, sum)` with: full effect to +50%, excess at
      25% effectiveness, absolute ceiling 2.0x. Fully stacked catalogue
      (3.35x raw) lands at ~1.96x — every purchase now grants SOMETHING, the
      snowball stays tamed (was heading to 3.35x uncapped).
- [x] A2. Shop banner + card notes read the new shape automatically via
      `incomeGainFromPurchase`; update copy to explain diminishing returns.
- [x] A3. Update the pinned tests (`incomeCapVisible`, `prestigeShopEffects`).

## B. The three inert bonuses — wire real, cost-proportionate effects

- [x] B1. `early_item_access` (4,000, rare) → item shop prices −15%. Charge and
      display through ONE helper (§4.4 advertised-vs-actual).
- [x] B2. `early_real_estate` (6,000, epic) → property purchase prices −10%.
- [x] B3. `auto_manage_properties` (5,000, rare) → rental income +15%.
- [x] B4. Update catalogue descriptions, empty the inert registry (leave the
      mechanism), re-enable purchase, update tests.

## C. Parallel audit (agents)

- [x] C1. Every remaining prestige bonus id: verified wired with a real call
      chain, or flagged.
- [x] C2. Gold upgrades + onboarding perks: advertised vs actual.
- [x] C3. Incomplete features repo-wide: empty branches, uncalled predicates,
      TODO/stub systems.
- [x] C4. Verify agent findings myself before fixing (lessons.md rule).

## C-results — what the three agents found and what was done

Fixed this pass (each verified against source before touching):
- `starting_real_estate` (12,000 pts) DEAD — filtered an always-empty state
  array; now grants the cheapest catalogue property, built like a purchase.
- `achievement_progress_multiplier` (4,000×2) DEAD, zero callers — re-wired as
  +20%/level on the prestige points achievements pay.
- `skill_gain_multiplier` (3,000) DEAD — wired into pursuit XP beside the gold
  skill_mastery upgrade.
- `social_master` + `reputation_gain_multiplier` bypassed by the two
  highest-volume relationship paths — now applied on dates and gifts;
  reputation_gain_multiplier's copy corrected to the relationship wiring it
  has always had.
- Education speed quantization (ceil) — fractional deterministic roll; the
  paid tiers are distinguishable again.
- `familyBusinesses` dropped by the prestige RESET path (killing
  legacy_business income) — carried now, without a generation increment.
- Repurchase sink: 11 boolean bonuses purchasable forever at flat cost for
  zero effect → maxLevel: 1.
- `SKILL_BOOST` IAP ($12.99) — REAL-MONEY no-op (looped the deleted hobbies
  system) → re-pointed at pursuits, +3 levels each, honest copy.
- `applyPerkEffects` + `buyStarterPack`/`buyGoldPack`/`buyRevival` — dead code
  shaped like wiring for real SKUs → deleted, pinned deleted.
- Policy votes (`effects.policy`) never enacted the bill → wired into
  resolveEvent via calculateActivePolicyEffects.
- Federal Judge required `law_degree` (an id in no catalogue) → `law_school`.
- Real Estate Hustler's advertised driver license never granted →
  `hasDriversLicense` flag set from the scenario item.
- `requiresItem` discovery gate silently passed unknown ids → blocks now.
- Legacy buffs (mentor/luckyCharm): three consumers, zero writers → two new
  legacy-shop nodes (A Family Mentor 250, The Heirloom Charm 220) stamp timed
  buffs on the heir.
- Copy honesty: Stable Life, Eventful Life, astute_planner, crime_boss,
  landlord, UNLOCK_ALL_PERKS, PrestigeInfoModal's hand-copied effect strings.

Left to the owner (deliberately not done):
- `starting_energy` / the health/happiness/energy halves of `perfect_start`
  and `starting_stats_*` are no-ops on the RESET path because a fresh life
  already starts at 100 — they bite on the heir path and via fitness. Fixing
  would mean lowering baseline start stats (a big balance change) or
  re-designing the bonuses.
- Scenario `rewards.achievement`/`rewards.title` — data with no code behind
  it, invisible to players (cards advertise gems only). Wiring it is content
  design.
- `FEATURE_FLAGS.weeklyEvents`/`analytics`/`bootBreadcrumbs` have zero
  readers; `analytics` is documented in CLAUDE.md as a deliberate hard-disable
  so left alone.
- Legacy shop Name-branch reputation totals can overflow the 100 clamp
  (documented in the file header as accepted).
- Perk income multipliers remain unscoped by source (cards now say so).

## D. Verify + ship

- [x] D1. Full suite, type-check both trees, lint, routes.
- [ ] D2. Commit + push to claude/new-session-17ah17.

---

# Prestige shop — tester bug report (BBQ, 2026-08-23)

Reported: "Prestige shop does not work. The unlock all careers from start, start
with all educations completed, start companies without education needed, wealth
master synergy does not apply to revenue, multiplier income benefits cap at 50%
making multiple income buffs moot and wasteful which applies to bonuses not yet."

## Verified findings (repro'd in a scratch test before writing any fix)

- [x] F1 `early_education_access` (3,000 pts, "Start with all educations completed")
      grants NOTHING. `applyUnlockBonuses` maps over `gameState.educations`, which
      is `[]` for every new life — the list only grows when the player ENROLLS
      (`lib/education/operations.ts`). Mapping an empty array completes nothing.
- [x] F2 `legacy_education` (15,000 pts, "Future generations start with all
      educations") is the same code shape in `applyLegacyBonuses` — same result.
- [x] F3 `early_career_access` (5,000 pts, "Unlock all careers from start") lifts
      ONLY the `education` requirement. `fitness` and `items` still gate, so the
      advertised "all careers" is false for 8 of the 15 education-gated careers.
- [x] F4 `synergy_wealth_master` (18,000 pts) never shows the income-cap warning.
      `isIncomeBonusWasted` probes `getIncomeMultiplier([bonusId])` on an EMPTY
      list to decide "is this an income bonus"; the synergy needs 2+ income
      bonuses to do anything, so the probe returns 1.0 → "not an income bonus" →
      no warning, while the cap eats it whole. This is the tester's "wealth master
      synergy does not apply to revenue" AND "which applies to bonuses not yet".
- [x] F5 `early_company_access` — NOT reproduced. Wired correctly in all three
      gates (`company.ts`, `CompanyActions.createCompany`, `CreateCompanyScreen`).
      Covered by a regression test rather than a fix.

## Plan

- [x] 1. Extract the education programme catalogue out of
      `components/mobile/EducationApp.tsx` into `lib/education/programs.ts`
      (`lib/` may not import values from `components/`, CLAUDE.md §5).
- [x] 2. F1/F2: complete every catalogue programme from the catalogue, not from
      the player's empty enrolment list. One shared helper for both bonuses.
- [x] 3. F3: one `meetsCareerRequirements` helper in `lib/careers/`, used by both
      `work.tsx` and `JobActions.applyForJob`, where `early_career_access` lifts
      the whole `CareerRequirements` gate. Kills the UI/action drift too.
- [x] 4. F4: `isIncomeBonusWasted` must ask "does this bonus enter the income sum
      AT ALL" against the UNCAPPED multiplier, so a prerequisite-gated bonus is
      classified correctly. No hardcoded id list.
- [x] 5. Tests for each, plus the F5 regression test.
- [x] 6. type-check + full prestige/career/education suites.

## Deliberately NOT changed (owner's call — flagged in the report)

- The `INCOME_MULTIPLIER_CAP = 1.5` itself. CLAUDE.md documents it as deliberate
  anti-snowball design. The bug was the shop being silent about it, not the cap.
- Blocking a zero-effect purchase. `prestige_bonuses_all` measures completion
  against `PURCHASABLE_PRESTIGE_BONUSES`; refusing the sale would make a
  25,000-point achievement uncompletable — the exact trap the existing comment
  in `prestigeBonuses.ts` warns about.
- `career.requirements.reputation` is enforced NOWHERE (2 careers carry it).
  Adding the gate would newly BLOCK existing players, so it stays as-is.


---
---

# Previously completed plans (kept for the record)

---
---

# Plan — Discord-as-code: `discord/` — 2026-08-23 — DONE

## The ask

Stop hand-building the Discord server. Keep the structure (roles, categories,
channels, permissions, onboarding, pinned copy) as data in this repo, and have
one idempotent command reconcile a live guild against it. Later: change one
line, re-run, done. Plus release posting wired to the same release copy Apple
gets.

## Shape

`.mjs`, zero new dependencies, run by `node` directly — the same pattern as
`marketing/aso/metadata.mjs` + `scripts/check-aso.mjs` (data file + validator)
and `scripts/lib/ascClient.mjs` (a REST client with a `dryRun` guard on the
CLIENT, not on each call site). Node 22 has global `fetch`.

- `discord/server.mjs` — the desired state. Roles, categories, channels,
  onboarding prompts, progression roles.
- `discord/copy.mjs` — the pinned document bodies (welcome, rules, links,
  this-week, bug-report template) and the release-post renderer.
- `discord/api.mjs` — `DiscordClient`: REST, bot auth, 429/rate-limit handling,
  `dryRun` recording every write.
- `discord/plan.mjs` — PURE. desired + live → an ordered operation list.
  Name normalization, permission-overwrite derivation, orphan detection.
- `discord/cli.mjs` — `validate | sync | backup | restore | announce | release`.
- `__tests__/tooling/discordPlan.test.ts` — the pure half, offline.

## Decisions worth writing down

1. **Permission bits are BigInt.** `1 << 35` is `8` in JavaScript — bitwise ops
   are 32-bit. Half of Discord's permission flags live above bit 31
   (`SEND_MESSAGES_IN_THREADS` is 1<<38, `MODERATE_MEMBERS` 1<<40), so a
   `Number` implementation silently grants/denies the wrong thing. Pinned in a
   test.
2. **Match channels GLOBALLY by normalized name, not per-category.** Matching
   inside the parent means reorganizing a category *creates a duplicate*
   instead of moving the channel. Normalization is type-aware: Discord
   lowercases text/forum/announcement names and turns spaces into dashes, but
   leaves voice and category names alone.
3. **`previousNames`** on a channel/role, so a rename in the config is a rename
   on the server rather than a new channel plus an orphan.
4. **Sync never deletes.** `--prune` moves orphans into a hidden archive
   category. A channel's history is unrecoverable and a config file is not a
   good enough reason to lose it.
5. **Nothing writes without `--apply`** (the `asc-release.mjs` convention).
6. **Phases.** Every channel carries `phase: 'launch' | 'growth'`. Default sync
   builds `launch` only (~22 visible channels); `--phase growth` unlocks the
   rest. Empty channels make a server look dead.
7. **Documents are embeds keyed by `footer.text`.** That is the stable marker
   that lets a re-run EDIT the welcome post instead of posting a second one.
8. **The release post uses `APPLE.storeVersion`, not `package.json` version.**
   Players see the App Store version record (1.5.x); `package.json` is the
   binary (2.10.x) and the two deliberately differ (CLAUDE.md §9). Announcing
   the binary version to players would be wrong, so a test pins it.

## Steps

- [x] `discord/server.mjs` — desired state. 26 roles, 9 categories, 46 channels
- [x] `discord/copy.mjs` — 8 documents + the release renderer
- [x] `discord/plan.mjs` — pure diff engine
- [x] `discord/api.mjs` — REST client
- [x] `discord/cli.mjs` — validate / sync / backup / restore / announce / release
- [x] `discord/README.md`
- [x] `__tests__/tooling/discordSync.test.ts` — 42 tests
- [x] npm scripts (`discord:*`), `.github/workflows/discord.yml`, `.gitignore`

## Verified

Against an in-memory Discord (a fake `fetch` that mimics the API, including
Discord's own lowercasing of text-channel names):

- Build from empty → **76 writes**, 34 channels, 26 roles.
- Run it again → **0 writes.** Same at growth phase (26 writes, then 0).
- Dry run → 0 writes, full plan printed.
- `--prune` → the hand-made channel is moved under a hidden `🗄️ ARCHIVE`,
  still exists, and **no DELETE is ever sent**.

Repo gates, all green: `type-check` · `type-check:tests:ratchet` (0, held) ·
`lint:errors` · `lint:ratchet` (0 errors / 798 warnings, ceiling held) ·
`check:routes` · `__tests__/tooling/` (17 suites, 259 tests).

## What changed from the plan

Two unconditional writes had to be removed before the second run was actually
free: the bulk position PATCH and the onboarding PUT were both re-sent every
time. The onboarding one mattered — re-sending it re-runs the join flow for
members who already finished it — so `planOnboarding` now compares only the
fields we send and reports `changed: false`.

`renderReleasePost` REFUSES copy that would not fit rather than slicing it to
4096. Silent truncation is the failure `scripts/check-aso.mjs` exists to prevent
on Apple's side, and a release post that stops mid-sentence in front of the
whole community is worse than a command that will not send.

One trap found while typing the config — see `tasks/lessons.md` 2026-08-23.

---

<!-- Two plans, both finished, both landed on 2026-08-22. `tasks/todo.md` is a
     single active-plan file that each branch rewrites, so a merge finds two
     complete records rather than a diff. Neither is dropped: the income work
     below is this branch's, the subscription-funnel work follows it. -->

# Plan — Work tab: the ladder question, and three bugs found answering it — 2026-08-22 — DONE

## The ladder question: already handled, my earlier claim was wrong

I told the user BBQ's save "can't reach the capstones without a migration".
Not true. `repairGameState` (`utils/saveValidation.ts` ~line 904) already
reconciles every saved ladder against the catalog on load — it adopts the
catalog `levels` whenever the catalog is LONGER, preserves level/progress/
raiseMultiplier, and clamps the level index. It runs on every load path
(`loadGame` and CloudSync both go through `hydrateLoadedState` → repair), and
it is covered by `__tests__/actions/careerPromotionGating.test.ts`.

Verified by probe: a 6-rung surgeon save comes back with 8 rungs, level index 4
("Surgical Director") intact, repair logged. So BBQ's "Lv 5/6" is simply a
build that predates the capstone rungs; the next update fixes it with no work
from us. Nothing to do — and the git history here is a shallow clone rooted at
0a8fd34, which is why `git log -S` appeared to date both changes to one commit.

## What the search DID turn up — all three in the reported family

- [x] **A. The "Current Job" hero shows base pay next to the raise percentage.**
      `work.tsx:952` `currentJobSalary = currentJobLevel?.salary` — raw base,
      rendered at :1009 as `$13,000/wk · Lv 5/8 · +100%`. It prints the base and
      the premium side by side without applying one to the other. This is the
      most prominent income surface on the screen, and the previous commit made
      it worse by fixing the card below it and not this. → `paidWeeklyCareerSalary`.

- [x] **B. Three careers render nowhere.** `work.tsx:917`
      `advancedIds = ['politician', 'celebrity', 'athlete']` excludes them from
      "Standard Careers", but the "Advanced Careers" section iterates
      `ADVANCED_CAREERS`, which is `ceo · research_scientist ·
      creative_director · investment_banker · surgeon` — a different set. So
      politician, celebrity and athlete are filtered out of the only screen that
      can apply for them. All three are live content: achievements read their
      level (`achievementsData.ts`), ambitions read them (`POLITICS_CAREERS`,
      `FAME_CAREERS`), and `events/engine.ts:524` gates an event on holding one.
      → exclude the ids the Advanced section actually renders.

- [x] **C. The five real advanced careers render TWICE once applied.** They are
      pushed into `gameState.careers` on apply, so they pass the `basicCareers`
      filter and render via `renderCareerCard` (real level, real pay, "Manage
      Job"), AND again from the catalog via `renderAdvancedCareerCard` at
      `levels[0].salary` with the button "Working". For BBQ that is
      "Surgical Director $26K/wk" and "Resident $1,150/wk" on one screen — a 22x
      disagreement, which is exactly the report. → one card per career: the
      Advanced section delegates to `renderCareerCard` for a career the player
      has already applied to or holds, and keeps the catalog stub only for ones
      they have not.

- [x] D. `renderAdvancedCareerCard`'s reward is `$${salary.toLocaleString()}/wk`
      off `levels[0]` — a fourth money format with no multipliers. → same
      `formatMoney(paidWeeklySalaryForLevel(...))` as everywhere else.

- [x] E. Test + full verification.

## Verification
- `type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓ · `check:routes` ✓
- Full Jest: **621 suites / 8136 tests pass**, 308 snapshots, 1 skipped.
- New `__tests__/economy/workTabCareerLists.test.ts` (9) — pins the PARTITION,
  not the literal: the derived id set matches the catalog, the two catalogs are
  disjoint, and every catalogued career lands in exactly one list.
- New case in `__tests__/save/hydrateLoadedState.test.ts` — the ladder question
  answered end to end. `careerPromotionGating` already covered `repairGameState`
  in isolation; what was uncovered is the step AFTER it, where this function
  merges onto `initialGameState` and could have taken `careers` from the wrong
  side and undone the repair silently. Both load paths run through here.

## Follow-up: one more, found by asking "is anything left?"
- [x] **`PoliticalApp` quoted the ANNUAL political ladder as "/wk".** The Politics
      app renders the whole 7-rung ladder with `formatMoney(salaryWeekly)}/wk`
      off `POLITICAL_CAREER.levels[i].salary`, which is annual: a President read
      **$100K/wk** against the $1,923 the tick pays, a Local Council Member
      **$800/wk** against $15. Worst instance of the three, because that ladder
      exists to weigh an office against its campaign COST — and the cost side was
      always real. Third screen to read this field raw; routed through
      `paidWeeklySalaryForLevel`, which owns the conversion. 3 tests added to
      `paidWeeklySalary.test.ts` (24 total).

## Checked and deliberately left alone
- `work.tsx:929` sorts careers by `levels[0].salary` — ordering only, never shown.
- Hustle employee salaries (`CompanyTile`, `HireEmployeeModal`, `CompanyDetailScreen`)
  are per-employee weekly wages the player sets, a different quantity entirely.
- `HealthBreakdownModal` / `HappinessBreakdownModal` / `DeathPopup` read
  `levels[level].name` — titles, not money.

## Final verification
- `type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓
- Full Jest: **621 suites / 8139 tests pass**, 308 snapshots, 1 skipped.

# Active plan — Political Life expansion (player request, 2026-08-21)

Source: support email from a player who asked for "a focus on being a president …
campaign retirement and other positions you can have that pay, you can choose to
steal stake money, join political parties or other things that concern with
government."

What already exists in `lib/politics/`: the six-rung office ladder, elections and
re-election, scandals, PAC clean/dirty fundraising, lobbyists, policies,
alliances, government contracts, office perks. What the request names and the
game does NOT have is below.

**Not doing: monthly ticks.** The player asked for months instead of weeks. That
is story mode (v38), which shipped to TestFlight and was REMOVED after
playtesting. Rebuilding it is a reversal of a playtested decision, not a feature
request to fill — flagged to the owner instead.

## Plan

- [x] 1. Save format: five optional fields on `PoliticsState`, one carve-out
      migration, `STATE_VERSION` 46 → 47 (stub migration, no backfill, no
      `repairGameState` mirror — every default is `undefined` and every value
      would be a guess that hands out or takes away something real).
- [x] 2. `lib/politics/parties.ts` — party standing that means something.
      `partySupport` 0-100, endorsement threshold, a real cost to switching
      sides, and party-machine campaign funding the player has not paid for.
- [x] 3. `lib/politics/appointments.ts` — paid positions that are not the
      ladder: Party Chair, Ambassador, Cabinet Secretary, Federal Judge,
      Lobbyist, Corporate Board Seat. Eligibility, weekly pay, reputation and
      party-support consequences. One at a time.
- [x] 4. `lib/politics/embezzlement.ts` — divert campaign / PAC money into
      personal cash. Bounded per week, builds heat, heat feeds the EXISTING
      scandal roll so getting caught uses the machinery already there.
- [x] 5. `lib/politics/retirement.ts` — stand down voluntarily with a pension
      scaled by highest office × terms × approval, keeping the title.
- [x] 6. Wire the weekly tick: heat decay, party-support drift, embezzlement as
      a scandal driver.
- [x] 7. Wire income: appointment salary and pension through the ONE political
      income path (`getPoliticalWeeklySalary`), so the $50K/wk political
      per-source cap still binds and nothing mints money outside it.
- [x] 8. Actions in `PoliticalActions.ts`, all charge/credit in ONE updater (§4.4).
- [x] 9. A "Career" tab in `PoliticalApp` for party, appointments, embezzlement
      and retirement.
- [x] 10. Tests per module + a save round-trip test for the new fields.
- [x] 11. `npm test`, `type-check`, `type-check:tests`, `lint:errors`.

## Done

All eleven steps landed. Added after the plan was written, at the owner's request:

- [x] 12. Fix the annual-vs-weekly `/wk` mislabel across every career surface.
      `Career.levels[].salary` is WEEKLY on every ladder except `political`,
      which is ANNUAL — so a President was shown "$100,000/wk" and paid $1,923.
      One shared `displayWeeklySalary` converter, applied at six surfaces plus
      the promotion record at its SOURCE, with a source-level ratchet
      (`__tests__/careers/annualSalaryDisplay.test.ts`) so a new screen cannot
      reintroduce the raw read.

      Worth recording: an earlier survey reported that `PoliticalApp` "correctly
      divides by WEEKS_PER_YEAR". It does not — its variable was NAMED
      `salaryWeekly` and held the raw annual figure. CLAUDE.md §8 says not to
      trust a survey claim without re-reading the source; this is the second
      time that has paid.

- [x] 13. Harden to the C-9 / ARCH-1 contract. The first cut of the four new
      actions rejected from inside their `setGameState` updaters and then
      returned `{ success: true }` unconditionally — the shape
      `__tests__/refactor/updaterResultRatchet.test.ts` ratchets against, and it
      caught all four plus a `let applied` capture. Rewritten as preview/commit
      over five pure resolvers in `lib/politics/lifeOperations.ts`, which is the
      sound fix that file prescribes. The ratchet stayed at 101 — it was not
      raised.

## 2026-08-21 — follow-up pass (owner request)

- [x] Work tab lands on Career, not Street Hustle. Career is also the first
      segment now, and the one-shot effect that used to force the tab is gone
      (with Career as the default its only firing would land on the tab already
      shown, leaving a `setGameState` on every Work open for a broke player).
- [x] Three prestige bonuses verified dead and registered in
      `lib/prestige/inertBonuses.ts`, so the shop warns before taking 15,000
      points. The product call — wire, remove, or re-purpose — is the owner's
      and stays open.
- [x] Closed the blind spot that hid them: `prestigeBonusReaders` no longer
      counts a hollow reader (an empty guard body, or a predicate nothing
      calls) or a description surface as wiring.
- [x] Deleted the five uncalled helpers that made them look wired, and lowered
      the lint ceiling 842 → 797 in the same commit.
- [x] Fixed an id-collision bug found via a flaky suite: four call sites minted
      `${prefix}_${Date.now()}_${rand(0..999)}`. For pets a collision was
      silently destructive — the duplicate-id guard dropped a genuine second
      purchase, took no money, and still reported "Welcome Rex!".

# Pass 2 — the same shape, audited across the economy — 2026-08-22

Asked: does "two places compute one quantity" appear elsewhere? Yes, and the
biggest instance in the game was on the same panel as the reported bug.

## Found: "Weekly Cash Flow" was not the player's cash flow
Three costs the tick charges had NO representation in `calcWeeklyExpenses`:

| line | charged by | size |
|---|---|---|
| luxury upkeep | `applyLuxuryItems` | up to **$556,820/wk** (full collection) |
| pet food | `applyPets` | $15/wk per living pet |
| subscriptions | `applySubscriptions` | Pulse Verified Pro + Spark Premium |

…and luxury **yield** (up to $301,200/wk, credited by the same subsystem) was
missing from the income side. Net: a collector's Cash Flow was optimistic by
more than a quarter of a million dollars a week. Two further lines —
`studentLoans` and `incomeTax` — were inside the TOTAL but had no row, so the
itemisation did not add up to the figure printed above it.

- [x] `lib/subscription/billing.ts` — `isInGameBillable` / `isPrepaidThisWeek`
      moved down out of `applySubscriptions` (lib cannot import from contexts),
      plus `totalSubscriptionWeeklyCharge`. The tick imports them back.
- [x] `PET_WEEKLY_FOOD_COST` moved to `lib/pets/lifecycle.ts`, re-exported from
      `applyPets` so its importers are untouched.
- [x] `calcWeeklyExpenses` gains `luxury` / `pets` / `subscriptions`, each
      computed by calling the CHARGING subsystem's own function — never by
      restating its rules.
- [x] `IdentityCard` gains the five missing rows and the luxury-yield income
      line. Yield is added at the DISPLAY layer, not to `calcWeeklyPassiveIncome`
      — the tick consumes that function's `.total` directly (`applyIncome.ts`)
      while `applyLuxuryItems` credits the yield separately, so folding it in
      would pay it twice. A test guards that reasoning.
- [x] `__tests__/economy/cashFlowCompleteness.test.ts` — 11 tests.

## Checked, no divergence found
- Net worth — already single-sourced (`canonicalNetWorth`); its own comment
  records killing a "sixth divergent basis".
- Company income — already single-sourced (`companyIncomeFactors`).
- Political office pay — `getPoliticalWeeklySalary`, one copy, now read by the
  Politics app too (previous commit).
- Vehicles / diet / mining / rent / loans — already in the breakdown.
- `applyContentMemberships` — no direct `stats.money` mutation found; left
  alone rather than guessed at.

## Verification
- `type-check` ✓ · `type-check:tests` ✓ · `lint:errors` ✓
- Full Jest: **622 suites / 8150 tests pass**, 308 snapshots, 1 skipped.
- App boots clean in the web preview with every change in place (no page
  errors beyond the expected `Unsupported platform: web` from IAP). Driving the
  automated browser deeper than the perks screen was blocked by an overlay
  intercepting the tap, so the Cash Flow panel itself is verified by tests and
  by the provider-tree mount test, not by eye.


# Plan — DeepLife+ subscription funnel: honest pricing, honest offers, measurable funnel (2026-08-22) — DONE

## Audit summary (what already exists)

The subscription system is NOT a stub. `lib/subscription/deepLifePlus.ts` is the plan/benefit
source of truth, `services/SubscriptionService.ts` owns entitlement (with the MON-1/MON-3 fixes
already in place), `components/SubscriptionModal.tsx` is a designed paywall with an annual
default, a value stack, trust row, Restore/Manage/Terms/Privacy and a compliant legal
disclosure. Benefits are truthful — all seven are really granted (ad-free, 250/day gems,
+25% income via `applyCareerSalaryAndPenalty`, Legacy Pass premium, cosmetics, welcome gems,
VIP support via `HelpModal.handleContactSupport`).

Things the brief asks for that are ALREADY satisfied and need no work:
- Paywall frequency / dismissal control (§29-30): every paywall entry point is user-initiated
  (crown, gem shop, daily gems, progression). The one auto-shown upsell (`PremiumPassPromo`)
  already has a blocking-moment guard, an 8-week cooldown, once-per-session and the shared
  `useInterruptionSlot` priority queue. Nothing to add.
- No fake discounts/countdowns/scarcity anywhere (§0). `lib/offers/pricing.ts` already encodes
  "never claim a discount you cannot prove".
- Restore, Manage, cancellation route, auto-renew disclosure (§25-27) all present.

## Defects found (this is the work)

P1. PRICES ARE HARDCODED USD. `DEEP_LIFE_PLUS_PLANS[].price` comes from the static
    `SUBSCRIPTION_CONFIGS` map ('$4.99' / '$49.99'). Every price on the paywall — plan cards,
    CTA, legal disclosure, lifetime row, `yearlyPerWeek()` "just $0.96/week",
    `yearlySavingsPercent()` "SAVE 17%" — renders that constant. A non-US player is shown a
    price and a currency they will not be charged, and the savings % is computed from USD
    figures so it can be simply false in a storefront with different price tiers. The gem shop
    already resolves live localized prices; the paywall is the one money surface that does not.
    (§42, §44, §45, §48, §62)

P2. NUMERIC STORE PRICE IS DESTROYED AT THE ADAPTER. `normalizeProduct` in
    `services/expoIapAdapter.ts` overwrites `price` with a display string, and nothing else
    carries the number. So `lib/offers/pricing.ts` (reads `priceAmount`) and GemShopModal's
    `storePriceInfo` (same) can NEVER fire — the offer discount badge and the currency-honest
    gems-per-unit line are both dead code today. Both were written correctly; the data just
    never arrives.

P3. THE TRIAL IS PROMISED ON UNKNOWN ELIGIBILITY. `trialEligible = introStatus !== 'ineligible'`,
    so 'unknown' shows a CTA reading "Start for $0.00 Today" and a banner reading "no charge".
    RC returns 'unknown' for ALL of Android, RC-disabled builds, and any failed call. A player
    who already used their trial taps a $0.00 promise and is charged immediately. There is also
    no check that the PRODUCT carries a free trial at all — `DEEP_LIFE_PLUS_FREE_TRIAL_DAYS = 7`
    is a hand-maintained constant that the store never validates. (§14, §49, §62)

P4. THE FUNNEL IS UNMEASURABLE PAST THE CTA. Only `paywall_open_tapped`, `paywall_viewed`,
    `paywall_cta_tapped` exist. No purchase result, plan selection, dismissal, restore,
    activation or first-premium-value event. §38 says find the biggest drop-off first — the
    CTA→purchase step, normally the biggest, is invisible. (§37, §38, §58)

P5. NO ACTIVATION MOMENT. On success the modal sets a one-line `message` string and leaves the
    player on the paywall. No welcome, no "here is what you unlocked", no route to a first
    premium win. (§32, §33)

## Tasks

- [x] T1  `services/expoIapAdapter.ts`: preserve the numeric price as `priceAmount` (additive;
          `price` stays a string so no existing reader changes). Unblocks P2's dead code + P1.
- [x] T2  NEW `lib/subscription/planPricing.ts` — pure, no service imports (lib layering rule):
          resolve a plan's display price from a loaded store product; per-week and savings%
          computed ONLY from same-currency numeric store prices; store-reported free-trial
          detection (iOS intro-offer fields + Android pricing phases).
- [x] T3  `services/RevenueCatService.ts`: `getSubscriptionStoreProducts()` so the paywall has a
          second price source in RC-driven builds where the expo-iap catalog may be empty.
- [x] T4  `components/SubscriptionModal.tsx`: wire live prices with explicit
          loading / unavailable / loaded states — never print a price we cannot stand behind.
- [x] T5  Trial decision matrix: store-confirmed offer × per-user eligibility. Only a confirmed
          -eligible user sees the "$0.00 today" promise.
- [x] T6  `lib/analytics/events.ts` + paywall: complete the funnel (plan selected, dismissed,
          purchase started/succeeded/failed/cancelled, restore x3, premium_activated,
          first_premium_value, intro_offer_shown).
- [x] T7  Premium activation moment: post-purchase welcome state listing what was unlocked and
          pointing at the first premium win.
- [x] T8  Tests: pure pricing/trial logic + paywall render smoke + adapter numeric preservation.
- [x] T9  Verify: npm run type-check, type-check:tests, lint:errors, targeted suites. Show output.

## Deliberately NOT doing

- Inventing new premium features/tiers (§3, §10, §34, §35). The brief says only implement perks
  that genuinely improve the game; new premium content is a product decision for the owner and
  would balloon this diff. Recommendations go in the final write-up instead.
- A/B experiment infrastructure (§39-41). No experiment framework exists; building one is its
  own project. The roadmap goes in the write-up.
- Changing prices, trial length or plan structure — owner's call, and they are configured in
  App Store Connect, not here.

## What shipped

**T1 · `services/expoIapAdapter.ts`** — `normalizeProduct` now keeps the numeric price as
`priceAmount` alongside the display string. This was a latent defect beyond the paywall: the
featured-offer discount badge (`lib/offers/pricing.ts`) and the gem shop's currency-honest
gems-per-unit line both read `priceAmount`, so both were unreachable code on every live
storefront. Two regression tests pin it.

**T2 · NEW `lib/subscription/planPricing.ts`** (+ 37 tests) — pure resolution of display price,
per-week framing, savings percentage and store-reported trial length. Derived claims return
empty/0/null whenever their inputs cannot support them: cross-currency savings are refused, the
per-week line is silent without a numeric amount, and the trial length comes from the product's
own introductory offer. Per-week rounds UP and savings FLOOR, so neither can under-state a price
or over-state a discount. Formatting is reused from the store's own string (no `Intl`, no
currency table), so symbol, symbol position and separators stay correct in every storefront.

**T3 · `services/RevenueCatService.getSubscriptionStoreProducts()`** — a second price source, so
an RC-driven build with expo-iap off still has real prices. Without it the new "never print an
unproven price" rule would have blanked the paywall in the one configuration that can charge.

**T4/T5 · `components/SubscriptionModal.tsx`** — live localized prices everywhere (cards, CTA,
lifetime row, legal disclosure, accessibility labels), all reading ONE resolved value so the
button and the disclosure can never quote different figures. Four explicit CTA states
(loading / store-disabled / unavailable→retry / buy); a purchase is only offered when a real
store price is in hand. The config USD price now appears solely where no store exists at all
(Expo Go, web preview) with the CTA disabled — mirroring how `GemShopModal` already degrades.
Trial copy splits into promise / conditional / none, and the "100% RISK-FREE" seal rides only on
a confirmed promise.

**T6 · Funnel** — 9 new events plus a `purchase_cancelled` / `purchase_failed` split in
`IAPService` (a `cancelled` flag added to `PurchaseResult`, set on both the RevenueCat and native
paths). The funnel now runs unbroken from surface tap to first premium use.

**T7 · Activation moment** — a post-purchase welcome state listing what was unlocked, with the
CTA turning into the way out. `first_premium_value` is recorded once per install
(`utils/premiumValueTracking.ts`, AsyncStorage-latched so it is not a save-format change) when a
member collects the 250-gem member drop.

**Red team** — the purchase and restore handlers now latch on a REF rather than the `busy` state:
`setBusy(true)` does not update `busy` until re-render, so two taps in one batch could both have
opened a store sheet (the gate-then-act shape from CLAUDE.md §4.4).

**Removed** — `yearlyPerWeek()` / `yearlySavingsPercent()` and their USD parsing helpers in
`deepLifePlus.ts`. Deleted rather than deprecated: a helper that silently answers in the wrong
currency is exactly what gets reached for again. A comment records where they went and why.

## Verification
- `npm run type-check` ✓ · `npm run type-check:tests` ✓ · `npm run lint:errors` ✓
- Targeted: `lib/subscription` (37 new) · `__tests__/monetization` · `__tests__/services` ·
  `lib/analytics` · `lib/offers` → 37 suites / 338 tests ✓
- `__tests__/render` + `__tests__/startup` → 55 suites / 488 tests ✓
- Full suite ✓ (see the final report)

## Left to the owner (deliberately not done)
- New premium features / tiers / a content calendar — product decisions, and the brief's own rule
  is to add only perks that genuinely improve the game.
- A/B experiment infrastructure — none exists; building it is its own project.
- Price, trial length and plan structure changes — configured in App Store Connect, not here.
- Win-back promotional offers — needs App Store Connect offer configuration plus a signing
  endpoint before any app-side work is meaningful.

### Still open for the owner

- Story mode / monthly ticks (the player's other ask) — v38, removed after
  playtesting. Not rebuilt.
- Income caps made visible but not retuned: $200K/wk company ceiling, and
  `ops_management` lifting the soft-cap floor only 25% → 45%.
- The three inert prestige bonuses: wire, remove, or re-purpose.
