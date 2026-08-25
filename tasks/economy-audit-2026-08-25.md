# Ultimate Economy Audit — 2026-08-25

Owner program: audit the entire TIME → WORK → MONEY → ASSETS → PROGRESSION
system; fix confirmed exploits and displayed-vs-applied lies; prefer structural
fixes; simulate long horizons; score honestly.

Method: automated audit layer first (`npm run audit:economy` — clean), then
five parallel deep audits (money flow, investments, careers/education/skills,
exploit red team, late-game sinks), every load-bearing finding re-verified
against source before any change (the `tasks/lessons.md` rule — several agent
claims were corrected on re-read), plus a NEW committed long-horizon strategy
simulator driving the real production tick. All fixes below shipped with
regression tests in the same change.

---

## 1. The economic model (as measured, not as documented)

One weekly tick is the economy's heartbeat. The authoritative cash line:
career salary (`applyCareerSalaryAndPenalty`, weekly figures, one shared
`paidWeeklySalaryForLevel` for pay AND display) → passive income
(`calcWeeklyPassiveIncome`: rent [tenancy-realized, $150k/wk cap], companies
[$200k+$5k/employee per-company cap], mining [$100k cap, now net of power],
patents [$75k], streaming [$75k], social [$50k], political [$50k] — then the
$10M-net-worth soft cap ×0.9 per $10M, floor 25%) → income aggregation with
multipliers (prestige, gold ×1.5/×2, perks ≤×2, macro events 0.85–1.15) →
progressive tax (0/10/20/30/40% at $200/$1k/$5k/$25k weekly brackets) → bills
+ arrears (`overdueBalance`) → loan autopay → engagement bonuses (lucky/streak
— now capped and taxed, see §5) → asset ticks (stocks/crypto walks, real
estate tenancy, luxury upkeep).

The economy's shape by stage:

- **Early (weeks 0–100):** genuinely tight and well designed. Entry pay is
  deliberately $110–250/wk, first $200/wk is tax-free, rent $45–80, food
  satiety caps energy conversion, arrears/eviction bite. Constrained but
  hopeful — the target experience holds here.
- **Mid:** mildly inflationary. An established career ($3–4k/wk) outruns every
  mandatory sink; accumulation is bounded by voluntary spending (housing
  ladder, vehicles, education, business capital). Decision density is good:
  upgrades vs stocks vs property vs education is a real portfolio question.
- **Late ($1M+):** strongly inflationary by design intent, braked by the 40%
  bracket, per-source caps and the $10M soft cap. Money stops being scarce
  around $5–10M — which is exactly where prestige unlocks and the dynasty
  ladder (Vault/Endowment/Trials/Seat, ~$9.7B of authored one-time sinks)
  takes over as the money axis.

## 2. What was broken (found → verified → fixed)

### E1 — Engagement income was untaxed, uncapped, and outside every brake (P1)
`GameActionsContext` credits a "lucky bonus" (1% → ×10, 5% → ×3, 14% → ×0.5 of
career+passive income; EV **+32%/wk**) and a play-streak bonus (up to +20%)
AFTER the tax line, after arrears, outside the passive soft cap, on an
uncapped base — the largest unpriced faucet in the game, scaling with the
player forever (a $5M untaxed tap at $500k/wk income). Measured live by the
new simulator: a junior developer accumulated **126% of gross salary** weekly.
**Fix (structural, probabilities/multipliers untouched):** the qualifying base
is capped at the top tax threshold ($25k/wk — the codebase's per-source-cap
idiom), and both bonuses are taxed at the MARGINAL rate of the one canonical
bracket table (`netEngagementBonus` in `lib/economy/luckyBonus.ts`), honoring
Tax Strategy. Below $25k/wk the only change is that the bonus pays tax like
every other dollar. Post-fix the same simulated worker accumulates $1,283/wk
(down ~$100/wk — exactly the withheld tax; the delight below the cap is
deliberately preserved). Tests:
`lib/economy/__tests__/engagementBonusTax.test.ts`.

### E2 — Company crypto miners were pure profit; the power bill was display-only (P1)
The $0.20/unit/day electricity formula existed only in `expenses.ts` (UI) plus
a literal copy in `IdentityCard.tsx`; nothing in the tick charged it — the
same defect the warehouse fix H-2 closed. Meanwhile the expense panel showed
warehouse power at $0.60/unit/wk while the tick charges $0.40. **Fix:** one
source of truth (`lib/economy/minerPower.ts`, $0.40/unit/wk — the rate really
charged), netted against company mining income inside the same passive row
(floored at 0 per company: an unprofitable fleet idles, mirroring warehouse
behaviour), and both display surfaces now read the same helper; the company
rows left the expense breakdown because the income figure is already net.
Tests: `lib/economy/__tests__/minerPower.test.ts`.

### E3 — Asset sales counted as lifetime "money earned"
`updateMoney` tracked EVERY positive delta into
`lifetimeStatistics.totalMoneyEarned` (which feeds Chapter 1's "Earn $X" gem
goal and Legacy Contract metrics) while the `dailySummary` line two rows above
correctly gated on `isIncomeReason`; the dev-only `sellCrypto` path did the
same. Shuffling money (sell/withdraw/loan) must not tick "earned". **Fix:**
both sites now use the same `isIncomeReason` gate the daily summary uses.

### E4 — Vehicles: three ways displayed ≠ applied (P1 honesty)
The tick charged full fuel for every owned vehicle; the expense panel promised
active-full/idle-25%. The panel showed a weekly insurance cost the tick never
charges (the premium is a 26-week upfront TERM). The active-vehicle accident
premium could never fire because the orchestrator never passed
`activeVehicleId` — despite it being a real, player-maintained field. A third
inline copy of the cost formula lived in the banking budget mirror. **Fix:**
one shared formula (`lib/vehicles/runningCosts.ts`: active full fuel, idle
25%) used by the tick, the panel and the mirror; the phantom insurance line
removed; `activeVehicleId` now reaches the tick, so which car you drive is a
real decision (fuel + accident exposure). Tests updated/added in
`applyVehicles.test.ts`; equivalence snapshots deliberately re-baselined.

### E5 — The campaign()→embezzlement approval refund (exploit, flagged 2026-08-23, now closed)
`campaign()` banked the player's spend into `politics.campaignFunds` — a pot
whose ONLY consumers are the weekly party funding (in) and the 25%/wk
embezzlement skim (out); the election formula never read it despite a comment
claiming it did. Deposits were therefore ~100% recoverable while the approval
stayed: approval 50→100 cost ~$0 net and fed 95% election odds and up-to-$5M
election rewards. **Fix (root cause, no new state):** the spend is spent —
`campaign()` no longer banks into the skimmable pot; the pot remains the
party machine's money, which is what embezzlement is designed to steal at
scandal-heat cost. PAC is unaffected (spending PAC is what buys approval, so
parking-and-skimming there earns nothing). The false comment is corrected.
Test: `__tests__/economy/economyAudit20260825.test.ts`.

### E6 — One universal market tape for every life (exploit)
The stock walk's seed was `weeksLived:index` with no per-save salt: every
save, life and prestige heir replayed the SAME price sequence, so "NVDA moons
at week 700" was perfect cross-life foresight. **Fix:** seed salted with
`lineageId:generationNumber` (the lucky-roll precedent). Determinism within a
life — the save-scum protection this seeding exists for — is unchanged;
persisted prices are untouched (value-only, future walks). Test: same file —
different generations diverge on >half the board; same salt reproduces
bit-identically.

### E7 — The free-GPA merit farm (education economy)
High School costs $0, its GPA farms to 4.0 with exams/study groups, and
`meritRate(4.0)` = 80% off any later programme — the $180k PhD for $36k,
collapsing the education-cost axis. **Fix:** merit scholarships now read
`meritGpa` — best GPA among PAID programmes only. The hiring multiplier keeps
the overall best GPA (a good free-education record still gets you hired; it
just doesn't discount tuition), and the UI's advertised rate reads the same
basis the charge does. Tests: `lib/education/__tests__/meritGpa.test.ts`.

### E8 — Two trap purchases: degrees that gated nothing
`computer_science` ($72k, "Software engineering track") opened no career —
software required `masters_degree`; `law_school` ($132k, "Lawyer track")
opened no career at all (only the Federal Judge appointment, which BARS
elected office). **Fix:** `educationAnyOf` on `CareerRequirements` (additive
field, evaluated in the single shared checker): computer_science now opens
software directly, law_school opens lawyer; the existing routes stay valid,
so nobody loses access. This also differentiates education strategy: CS is
the cheap direct route, the masters stays the generalist key. Tests in
`economyAudit20260825.test.ts`.

Also fixed along the way: the hand-rolled partner-income copy in
`IdentityCard` (now reads `householdPartnerIncome`, the paycheck's source —
the exact drift class that produced the 7× FamilyTab bug).

## 3. What the red team did NOT find

The dedicated exploit sweep confirmed the recurring bug classes are closed on
every surface it checked: gate→grant atomicity (items, vehicles, luxury,
hustle, mail, crime, politics, stocks, banking, achievements, events),
buy/sell arbitrage (all sale paths lose on a round trip; stocks pay 2%+2% and
capital gains; crypto pays spread+slippage), device-clock money/gem gates (all
on `weeksLived`), negative/NaN vectors (canonical money paths reject
non-finite and overdraft), and prestige re-claims (achievements, ambitions,
legacy contracts all carried across the reset). No confirmed money printer
remains.

## 4. Simulation (new committed tooling)

`__tests__/simulation/economyStrategySim.manual.test.ts` mounts the real
`GameProvider` and drives the production `nextWeek()` for seven archetypes ×
10 years (the tickTiming.bench pattern; ~30s a run). Run with
`RUN_ECONOMY_SIM=1 npx jest economyStrategySim`. It asserts no-NaN/no-spiral
invariants and prints yearly trajectories.

Pre-fix measurements (equal $500k deployed where applicable, junior-dev job):

| archetype | 10-y net-worth gain | note |
|---|---|---|
| idle (no job) | ~$0.5k | dies ~5×/yr without care — actions are load-bearing |
| worker L0 ($1.1k/wk) | $719k (**$1,384/wk — 126% of gross salary**) | the untaxed lucky/streak channel, measured |
| top worker ($3k/wk) | $1.87M | |
| saver ($500k savings) | +$159k over worker | soft cap holds savings to ~2.8%/yr |
| investor ($500k stocks) | +$322k over worker | ~5%/yr realized + dividends |
| landlord ($500k property) | +$107k over worker | rent net of carrying+tax |
| tycoon ($500k companies) | +$1.5M over worker | business income dominates at this scale (active-path premium, intended post-B1) |

Post-fix run: worker $1,283/wk (the engagement channel now taxed); tycoon
$4,895/wk; landlord $1,489/wk (rent honesty intact); saver unchanged; the
investor swung to +$3.34M on the NEW per-life market tape — direct evidence
that lives now walk different tapes (E6) and that equity outcomes carry real
variance. Ordering at equal capital: active business > equities (high
variance) > property > savings — differentiated by risk, liquidity and
attention, which is the intended shape.

## 5. Balance verdicts (what was NOT changed, and why)

- **Lucky-bonus EV (+32% below the cap) stays.** It is an authored engagement
  dial; the defects were the missing tax and the unbounded base, both fixed.
  Retuning the probabilities is an owner call — flagged.
- **Company upgrades (~115%/yr L1 payback)** remain the best active path by
  design (B1 retune, 2026-08-24). Not touched.
- **Rent vs buy** is genuinely situational: owning is better once bought, but
  the opportunity cost of $95k+ at early-game returns is strong. Healthy.
- **Careers:** tolls/growth differentiation (H1, 2026-08-24) works; remaining
  dominance issues are flagged below rather than nerfed blind.

## 6. Remaining risks — ALL FIXED in the follow-up pass, except one

Owner's follow-up instruction was to fix everything listed here. Eight of the
nine were fixed the same day (see `tasks/todo.md` "Fix what's next"); the
resolution of each is recorded inline below. Item 3 is the exception and the
reason is given in full — it cannot be closed without re-opening a worse hole.


1. **Musician dominates the entry tier** on all five axes (pay ceiling
   $2,120, fast growth, −8 energy, +4 happiness, no gates). Options: an
   instrument item requirement, gig-income variance, or a slower ladder.
2. **Reputation-gated ladders (celebrity $4,600, catalogue politician $3,400
   through full payroll multipliers) dominate every degree ≤$120k**, and the
   pretend-politician out-earns the real President (annual÷52, no premiums).
3. **Save→peek→reload market foresight** is the dual of per-week determinism
   (kept deliberately for StrictMode/save-scum safety). Closing it would need
   load-burned seeds; single-player, self-directed — accepted.
4. **Tera miner ($50M) is dead content** under the $100k/wk fleet cap
   (~0.7%/yr); giga marginal. Reprice or let top tiers raise the cap.
5. **No recurring cost scales with wealth unless volunteered** (housing tops
   at $950/wk rent; no property tax). The soft cap throttles income instead.
   A deliberate design posture — but it means idle wealth is perfectly safe.
6. **$10M–$100M first-life dead zone:** passive income throttles at exactly
   the prestige threshold while Seat wings price at $400M–$5B; equities become
   the one uncapped channel. Consider a first-life bridge sink or opportunity
   tier.
7. **FIRE is computed and never celebrated** (`fireTracker` consumed by one
   display + the age-45 retirement gate). The "passive income ≥ expenses"
   moment — the money axis's core fantasy — deserves a life-moment/achievement.
8. **Election win rewards** ($10k→$5M at 2–2.5× campaign cost, ≤95% odds) are
   positive-EV cash no civilian path matches — now that approval must be paid
   for honestly (E5), re-check whether the ladder needs its own cost.
9. `Company.electricalBill` is a dead field (no reader, no writer) — remove or
   wire on next schema pass. `PER_SOURCE_CAPS.stocks` caps a hardcoded-zero
   stream (documented in place).
   **FIXED.** The bet this job was built on — the worst wage for the best
   ceiling — had lost its first half: `MIN_ENTRY_WEEKLY_SALARY` put the busker
   on the same $110 as everyone else, leaving best ceiling, lightest toll,
   only positive happiness toll and fastest growth, with no downside at all.
   The downside is restored in TIME, not in a gate (the hiring bar stays open,
   which `jobMarket.test.ts` requires so the bet exists on day one): slowest
   pace in the tier, early rungs barely clearing minimum wage, and tenure
   gates of 40/100/170 weeks on the top three rungs. `fast_food` takes over
   the 'fast' pace — quickest climb, lowest ceiling — so the tier finally
   spans a real curve.
   **FIXED.** The rule is now THE GATE SETS THE CEILING, pinned by
   `lib/careers/__tests__/gateSetsTheCeiling.test.ts`: teacher 600→1,100,
   nurse 700→1,250, police 550→900, legal 660→950, so tuition finally buys
   something no free ladder can reach. Nothing was nerfed to get there — the
   dominated ladders were raised. The catalogue `politician` (which topped at
   $3,400/wk THROUGH payroll multipliers while the actual elected President
   draws $1,923 flat) is now the political STAFF track it should always have
   been: Field Organizer → Chief of Staff, ceiling $1,500, and it no longer
   claims offices you can only win at an election.
   **NOT FIXED — and deliberately so.** Verified again in source: the walk is
   seeded on `weeksLived` (+ the per-life salt), and the board is snapshotted
   into the save and restored on load, so save → advance → read prices →
   reload → advance replays the identical week. Every available fix is worse
   than the disease. Seeding on anything that differs after a reload re-opens
   the reload-until-a-good-week farm this determinism was built to close.
   Hiding the outcome until after the commit is impossible when the player
   owns the save file. Raising fees until a one-week peek stops paying taxes
   every honest trade to punish a self-directed, single-player exploit that
   costs nobody else anything. Left open, on purpose, with the reasoning here
   so the next audit does not spend a cycle rediscovering it.
   **FIXED.** The price ladder was never the problem — every tier from basic
   to tera is authored at ~71 weeks of its own gross output. The FLAT $100k/wk
   cap was: a giga grosses $140k and a tera $700k, so the cap clipped them to
   100/500-week paybacks and a second big rig earned literally nothing.
   `miningIncomeCap` now scales with the capital actually deployed
   (capital ÷ 71), keeping the $100k floor for every fleet under ~$7.1M — i.e.
   everyone the cap was written for — while making the whole ladder share one
   honest payback. Mining still cannot out-run that payback however much
   hardware is bought, which is what the cap was protecting.
   **FIXED.** Property tax: 1.2%/yr of current value on every OWNED unit,
   earning or not (`lib/realEstate/carryingCosts.ts`). A studio owner pays
   ~$22/wk, a penthouse owner ~$1,846 — mandatory, predictable, proportional,
   and it gives buy-vs-rent a carrying cost on both sides at last. The tenancy
   tick's old 2.2%/yr was authored as "~1.2% tax + ~1% maintenance", so it now
   keeps only the maintenance half and no landlord is billed twice. Charged
   through `housingUpkeep`, so it settles via the existing bills/arrears path
   and appears in the expense breakdown — displayed equals applied.
   **FIXED (the guidance half).** The wealth ladder jumped $10M → $100M with
   nothing in between, which is exactly the band that goes quiet; $25M and
   $50M rungs now sit in the gap so there is always a next target. The deeper
   content question — what a first-life player DOES between those numbers —
   remains a design brief rather than a defect.
   **FIXED.** `financialIndependence()` is the mechanical version of the
   question — does weekly passive income cover the weekly cost of this life,
   after tax on that income — built from the same canonical helpers the Cash
   Flow card displays, and floored at this file's own baseline cost of living
   so an empty life cannot qualify. Surfaced twice: a 250-gem achievement
   ("Financially Independent") and a DREAM goal, so it is a visible target on
   the home feed rather than a number on a stats screen.
   **FIXED.** Cost and reward were separate hand-written tables and had
   drifted to 2-3x, i.e. +$2.75M expected on a single presidential tap. The
   victory fund is now DERIVED from the campaign cost at 1.2x, so winning
   roughly recoups the campaign and running for office is about the office.
   **FIXED.** Deleted. Company rig electricity is a real cost now, charged
   where the income is paid rather than accrued as a bill nobody ever billed.
   `PER_SOURCE_CAPS.stocks` stays as documented dead weight.

## 7. Scores (0–100, honest)

| axis | score | rationale |
|---|---|---|
| Economy depth | 82 | 9+ income systems, real sinks at every magnitude to ~$1B |
| Economic stability | 78 | early tight, mid mildly inflationary, late braked by caps; engagement faucet now priced |
| Strategic choice | 74 | portfolio questions real at mid-game; entry-tier career choice still solved (musician) |
| Career balance | 62 | tolls/growth wired, but rep-gated ladders dominate degree ladders |
| Business balance | 76 | upgrade dominance intended and bounded; scaling decisions exist (subsidiaries, caps) |
| Investment balance | 72 | no universal winner below $10M; late-game converges on equities |
| Progression | 80 | chapters 1–7, goals, prestige, dynasty — layered and paced |
| Long-term balance | 70 | $10M–$100M dead zone; post-$100M guidance thin |
| Replayability | 78 | per-life market tapes (new), prestige meta, contracts |
| Exploit resistance | 88 | red team found no printer; campaign loop closed; regression tests dense |
| Casual accessibility | 75 | early game readable; passive caps invisible until surfaced (overhead line exists) |
| Optimizer depth | 73 | peek-ahead accepted; otherwise optimization stays interesting past week 100 |
| **Overall economy** | **77** | |

## 8. Files changed

- `lib/economy/luckyBonus.ts` (+cap, +marginal-tax helper) · `contexts/game/GameActionsContext.tsx` (engagement bonuses capped+taxed; vehicles get activeVehicleId; market salt; budget mirror shares formula)
- `lib/economy/minerPower.ts` (new) · `lib/economy/passiveIncome.ts` (company mining nets power) · `lib/economy/expenses.ts` (mining/vehicle display = applied; insurance line removed) · `components/IdentityCard.tsx` (shared helpers; partner income single-sourced)
- `contexts/game/MoneyActionsContext.tsx` (earned-income gate)
- `contexts/game/actions/weekly/applyVehicles.ts` + `lib/vehicles/runningCosts.ts` (new)
- `contexts/game/actions/PoliticalActions.ts` (campaign loop closed)
- `lib/economy/stockMarket.ts` (per-life seed salt)
- `lib/education/gpa.ts` (+`meritGpa`) · `contexts/game/actions/EducationActions.ts` · `components/mobile/EducationApp.tsx`
- `lib/types/requirements.ts` (+`educationAnyOf`) · `lib/careers/careerRequirements.ts` · `lib/careers/careerData.ts`
- Tests: `engagementBonusTax`, `minerPower`, `meritGpa`, `economyAudit20260825`, `applyVehicles` (updated), `economyModifiersRound3` (pattern), subsystem snapshots re-baselined; simulator `economyStrategySim.manual.test.ts` (new, env-gated).

No save-format change was needed: every fix is value-only or additive-optional
(`educationAnyOf` is catalog data, not stored state), so `STATE_VERSION` stays 48.
