# Economy + Progression + Long-Term Life Balance — 2026-09-03 (Master Program 10)

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 9
(`a227a0b`). Owner brief: map the whole economy, simulate nine economic
personas on the real tick over 20/50/100/250 weeks, derive the life stages
from measurement, audit prices and rewards, test for dominant strategies and
shock recovery, fix only what the evidence supports, and report honestly.
The prior economy audit (`tasks/economy-audit-2026-08-25.md`) is the
baseline; the "known concerns" in the brief were VERIFIED here, not assumed.

Method: every number below is either read from source (with the file named)
or measured by `__tests__/helpers/earlyGameSim.ts` driving the production
`nextWeek()` through the real action modules. New tooling this program:
`__tests__/helpers/economyPersonas.ts` (the nine personas),
`__tests__/simulation/economyPersonas.sim.test.ts` (the 20/50/100/250 soak,
`RUN_ECONOMY_PERSONAS=1`), `economyStrategies.sim.test.ts` (equal-capital
comparison, `RUN_ECONOMY_STRATEGIES=1`), `economyShocks.sim.test.ts`
(shock + recovery, `RUN_ECONOMY_SHOCKS=1`), and the gates in
`__tests__/simulation/economyBoundaries.test.ts`.

---

## 1. Economy map (every flow, from source)

| flow | mechanic | numbers | source |
|---|---|---|---|
| Employment | 30 careers × 6 levels, weekly salaries; entry tier 8 ladders at $110 | fast_food 110→230, retail 110→250, janitor 110→200, musician 110→2,120 (tenure-gated), teacher 220→1,100 (business degree), nurse 300→1,250, software 1,100→3,000 (CS or masters + computer), doctor 1,700→4,800 (PhD/med school), lawyer 1,400→4,000, corporate 1,750→… (MBA), celebrity/politician rep-gated | `lib/careers/careerData.ts`, `jobMarket.ts` |
| Promotions | progress +5/wk × early boost (2.5 first 20 wks, 1.5 to 40) × performance (0.3–1.3) × pace × perks; promote at 100 | first rung ~8–13 weeks, later rungs 13–25 weeks; pay steps 10–30% | `applyCareerProgress.ts`, `promotionGating.ts` |
| Raises | `requestRaise` +8%/step to ×2.0 at performance ≥ 45 | | `lib/careers/raisePremium.ts` |
| Tax | marginal weekly brackets 0/10/20/30/40% at $200/$1k/$5k/$25k | entry tier pays 0; $1,100/wk pays $100 (9%); $3,000/wk pays $480 (16%) | `lib/economy/constants.ts` |
| Engagement faucets | lucky bonus 1%×10 / 5%×3 / 14%×0.5 of (salary+passive), capped base $25k, taxed at marginal rate; play streak +2%/tick to +20%; beginner luck $15–40/wk for 20 weeks | EV ≈ +32% (lucky) +20% (streak) of gross income — untaxed below $200/wk | `GameActionsContext.tsx`, `lib/economy/luckyBonus.ts`, `applyIncome.ts` |
| Renting | 6 tiers $45/$80/$140/$260/$480/$950 per week, income proof 0/100/220/400/750/1,500; homeless −2 hp −4 hap −5 en per week | | `lib/realEstate/rentals.ts` |
| Property | 8 residential $95k–$8M, 4 commercial $620k–$2.4M; mortgage 6.5% base (±credit, PMI +0.5% at 10% down), 15y/30y; property tax 1.2%/yr (commercial 2.4%); tenancy 0.15%/wk of value (7.8%/yr gross) long-term, airbnb 0.28% with 20% vacancy hazard; appreciation 0.1%/wk × cycle (0.2–4.0) | studio: $19k down, ~$110/wk mortgage, $22/wk tax | `catalog.ts`, `mortgage.ts`, `carryingCosts.ts`, `tenancy.ts`, `market.ts` |
| Vehicles | $15k–$250k, licence $500 at 16+, fuel + maintenance weekly (idle 25% fuel), insurance 26-week terms, accidents 1–3%/wk | | `lib/vehicles/*`, `VehicleActions.ts` |
| Luxury | 12 items $250k–$500M, weekly upkeep, resale 60%, tier 5 | | `lib/luxury/catalog.ts` |
| Health | walk/meditation free; yoga $100; massage $300; doctor $500 (cures curable + 26 wk management); therapy $400; hospital $2,000; experimental $12,000; vacation $16k; retreat $30k; flu shot $50 | | `initialState.ts` healthActivities |
| Food | $5–$40, satiety curve (meals 4–6 half, 7+ quarter) | | `lib/economy/foodSatiety.ts` |
| Fitness | gym $300 + $50/session; walk +1, yoga +2 | | Program 8 |
| Dating / marriage | dates $0–$500, gifts $50–$2,000, weddings $200–$100k + $150/guest, divorce 15–35% settlement + $5k lawyer | | `DatingActions.ts`, `weddingVenues.ts` |
| Family | children: no weekly cost line; partner contributes 25% of their income above $50/wk | | `applyIncome.ts` |
| Pets | $2k–$18k + $15/wk food | | `lib/pets/*` |
| Savings | 3% APR (5% with financial planning, hard cap 5.5%), soft cap $500k at 25% efficiency | | `lib/economy/constants.ts`, `applySavingsInterest.ts` |
| Loans | personal 12%, auto 8%, business 10%, mortgage 6.5%, student 6% (5y); credit-score adjustment; DTI cap 43%; max 6 active | | `lib/banking/operations.ts`, `LoanActions.ts` |
| Credit cards | starter $500 … platinum $25k, APR ≥ 5% | | `banking/operations.ts` |
| Stocks | 25 symbols, 7%/yr log drift + 1%×vol premium, weekly walk seeded per life, 2% fee both ways, dividends quarterly (0–6.1%/yr), 25% capital-gains at sale | | `lib/economy/stockMarket.ts`, `StockActions.ts`, `taxLedger.ts` |
| Crypto | 8 coins, regimes stable/volatile/bull/bear (mean 0.10%/0/1.5%/−1.2% per week), spread 0.2–1%, 25% gains at year end | | `lib/crypto/marketModel.ts` |
| Companies | founding $50k factory / $90k AI / $130k restaurant / $200k real estate / $2M bank (needs Entrepreneurship $30k, 72 wks); starting income $1,500–$4,000/wk; upgrades $10k–$250k × 1.5^level, +$220–$660/wk each with 10%/level efficiency decay; per-company cap $200k + $5k/employee; scandals above $3k/wk | | `contexts/game/company.ts`, `companyUpgradeCatalog.ts`, `passiveIncome.ts` |
| Mining | rigs $2.5k–$50M, 71-week payback, cap max($100k, capital/71) net of power $0.40/unit/wk | | `lib/economy/constants.ts` |
| Street jobs | legit: panhandle $25 (60%, 5 en) … lawn mowing $90 (90%, 35 en), delivery (bike) 90%; crime tier with jail risk | ~$2–3 per energy point | `initialState.ts` |
| Education | 11 programmes: high school $0/104 wks, police $12k/30, legal $18k/46, entrepreneurship $30k/72, business $48k/90, CS $72k/104, masters $90k/120, MBA $120k/150, law $132k/156, med $150k/180, PhD $180k/208; merit 10–80% off by GPA of PAID programmes; poverty scholarship $18k credit; student loan 6%/5y | | `lib/education/programs.ts`, `scholarships.ts` |
| Chapters | 7 chapters; completion bundles $800 / $2,800 / $7,000 / $14,000 / $35,000 / $76,000 / … plus gems | ch3 needs $10k saved + partner + first investment + career L3; ch4 $50k + business + degree + L5; ch5 $200k + perfect stat + child + prestige-ready | `lib/progress/lifeChapters.ts` |
| Unlock tiers | tier = chapters done, or wealth milestones $2k / $10k / $50k; tier 2 opens Education/Stocks/Real Estate/Social/Spark/Pet, tier 3 Crypto/Vehicle/Travel/Company, tier 4 Gaming/Streaming, tier 5 Onion/Political/Luxury | | `lib/progress/featureUnlocks.ts` |
| Events | ~8–12%/wk, 4/8-week gaps, pity 12–16; 301 money effects; large payouts are politics/celebrity/startup-payoff/secret gated | cliffhangers 7%/wk (10% first 12 wks): boss meeting $500–1,000, mysterious letter $2,000, lawyer $3,000, repeatable | `lib/events/*`, `cliffhangerEvents.ts` |
| Ambitions | 8 ambitions, payoff $60k–$300k + gems + prestige points, milestone 1 needs tier 2–5 | | `lib/ambitions/catalog.ts` |
| Prestige | threshold $10M × 1.25^n; 100 points per $1M + achievements; multipliers to ×2 | | `lib/prestige/*` |
| Legacy / dynasty | legacy points, contracts, vault/endowment/trials/seat (~$9.7B of sinks) | | `lib/dynasty/*` |
| Inflation | 3%/yr price index (initialState) applied to company founding/upgrades, miners, food, items; NOT to rent, property, education, luxury or salaries | | `lib/economy/inflation.ts` |
| Passive soft cap | ×0.9 per $10M net worth above $10M, floor 25% (+2%/management level to 45%) | | `passiveIncome.ts` |

## 2. Money flow map

**Sources (weekly, in tick order):** job salary → passive rows (rent, companies, mining net of power, patents, streaming, social, political, each capped) → soft cap → income multipliers (prestige, gold, perks, macro) → progressive tax → engagement bonuses (lucky, streak, taxed at the marginal rate) → beginner luck (first 20 weeks) → partner share → savings interest → stock dividends (quarterly) → event payouts (resolved by tap) → chapter/goal/achievement/ambition/contract bundles (on completion).

**Sinks (weekly):** rent or mortgage + property tax + maintenance → loan autopay (43% DTI ceiling at origination) → vehicle fuel/maintenance → luxury upkeep → pet food → diet plans → subscriptions → arrears (`overdueBalance`) when cash cannot cover a bill. There is **no cost-of-living line**: a housed player with no assets pays only rent. Food, health and fitness are voluntary purchases.

**Conversions:** cash ↔ savings (free), cash → stocks (2% each way + 25% gains), cash → crypto (spread), cash → property (down payment + closing 6% at sale + 15% gains), cash → education (permanent unlock), cash → company (illiquid; income stream), cash → items/vehicles (resale 50% / depreciating), gems ↔ nothing in the economy except revive.

**Caps and brakes:** per-source passive caps, per-company cap, mining cap, savings soft cap $500k, engagement base cap $25k, net-worth soft cap $10M, `MONEY_CEILING`, 40% top bracket.

## 6. Price audit — what a purchase costs in weeks of income at the stage it is offered

"Stage income" is the measured gross weekly pay of the persona who is at that
stage (§3), not the doc's number. Net of rent, the entry tier keeps roughly
$65–120/wk plus the engagement faucets (≈ +$40/wk); the degree tier keeps
~$800/wk; the software tier ~$2,000/wk.

| purchase | price | entry ($110–200/wk) | certificate/degree ($550–1,250/wk) | software/professional ($1,100–4,800/wk) | verdict |
|---|---|---|---|---|---|
| shared room / bedsit rent | $45 / $80 per week | 41% / 73% of a $110 wage | 4–7% | <2% | fair: rent is THE early bill and nothing else is mandatory |
| studio rental (income proof $220) | $140/wk | unreachable until L4–5 | 11–25% | 5% | the proof gate does its job |
| sandwich / steak | $15 / $40 | 14% / 36% of a day-one wage | trivial | trivial | fair with satiety |
| doctor | $500 | 4.5 weeks of gross wage; 5–8 weeks of surplus | under a week | hours | **the one early price that decides lives** (§9) — affordable from ~week 6 because of windfalls |
| hospital / experimental | $2,000 / $12,000 | 18 / 109 weeks | 2–10 | 1–4 | hospital reachable at entry only after the chapter bundles |
| gym + session | $300 + $50 | 3 weeks + 45%/session | trivial | trivial | fitness upkeep at entry costs ~40% of surplus |
| bike / smartphone / suit / computer / bed | $450 / $600 / $1,200 / $5,000 / $1,500 | 4–45 weeks of wage; computer is 25–45 weeks | 1–8 weeks | trivial | the computer is the real entry-tier wall for software/legal/accountant |
| police academy / legal studies | $12k / $18k | 60–110 weeks of surplus (3–5 years); the poverty scholarship ($18k credit) covers both | 10–20 weeks | 4–10 weeks | reachable at entry only via the scholarship or the windfall stack |
| business degree | $48k (10-y loan $124/wk) | loan payment = 95–113% of a $110–130 wage | cash: 40–90 weeks | cash: 10–40 weeks | **debt at 1.6–4× income with repayment from day one** (§10 P2) |
| CS / masters | $72k / $90k (loan $186 / $232 per wk) | loan payment 1.4–2.1× wage | 15–20% of a degree-tier wage | cash in 25–80 weeks | same |
| MBA / med / law / PhD | $120k–$180k | — | loan $310–$465/wk (25–85% of wage) | cash 40–160 weeks | a professional ladder is a two-rung climb, by design |
| entrepreneurship + factory | $30k + $50k (inflated) | — | 65–145 weeks of surplus | 25–75 weeks | the active-path premium (B1) is bought with ~1.5 years of a degree-tier life |
| studio apartment (10–20% down) | $9.5k–$19k down, ~$110/wk mortgage + $22/wk tax | proof and DTI refuse it | 20–35 weeks; payment ≈ the studio rent | 5–17 weeks | rent-vs-buy neutral in the measurement (§8): buying saves rent, costs tax + interest |
| economy sedan + licence | $15.5k + fuel | 75–140 weeks | 12–28 weeks | 3–14 weeks | HIGH-SPENDER bought one at week ~110 and it cost him ~$70/wk after |
| pet | $2k–$18k + $15/wk | 10–90 weeks | 2–30 weeks | trivial | fine |
| wedding | $200–$100k | courthouse is a day's wage | château is a year | — | fine |
| luxury tier | $250k–$500M | — | — | first item = 1–4 years of a top wage | the tier-5 sink is sized for company income, not wages |
| prestige | $10M | — | — | ~50–100 years of the top wage | unreachable on wages alone by design; needs companies/equities |

Verdicts that matter: (1) the entry tier's only mandatory bill is rent, so
survival is cheap and every other early price is a CHOICE; (2) the doctor is
the one purchase that turns a life around and it costs four to five weeks of
wage, which the windfall stack makes affordable by week 6; (3) education is
the only rung that costs more than a year of income at the stage it is
offered, and the loan that makes it reachable starts charging on day one.

## 3. Economic personas — measured on the real tick (seed 1; seeds 2–3 at 100 weeks in §3.1)

Nine policies in `__tests__/helpers/economyPersonas.ts`, each a thumb reacting
to what the screen shows. All share the Program 7 "average" reflexes (take the
first job the board offers, promote when Work shows it, rent the shared room
from week 4, one free fix when a ring reads under 50, answer what the game
raises) plus **see the doctor when sick and $500 is on hand** — without that
last reflex every seed-1 persona died at week 32–34 of a critical back
injury caught at fitness 0 while holding $6k–$16k (§9). Scenario
`food_courier` (age 20, $1,500) except POOR START (`immigrant_story`, age 25,
$200).

| persona | wk 20 cash / netW | wk 50 | wk 100 | wk 250 | job at 250 | housing | edu | status |
|---|---|---|---|---|---|---|---|---|
| POOR START ($200, musician offered) | $6.3k | $17k | $47–59k (seeds 2–3), $12k (seed 1, no doctor) | **$352k** | musician L5 **$2,120/wk** | shared room | none | alive |
| AVERAGE WORKER | $14k | $12k | **$17–22k** | **$52k** | janitor L5 $200/wk | bedsit | none | alive |
| CAREER CLIMBER (business degree on loan, wk 5) | $13k / **−$34k** | $7k / −38k | $11k / −31k (degree 3 wks out) | $64k / **−$29k** | teacher L5 $1,100/wk | rented house | business + masters, $93k debt | alive |
| HIGH-SPENDER | $13k | $1.2k | $11k | $12k / $14k | janitor L5 | bedsit + sedan + cat | none | alive |
| SAVER ($300 float, rest to savings) | $15k | $16k | $20–21k | $68k (all savings) | janitor L5 | shared room | none | alive |
| INVESTOR ($500 float, blue chips) | $14k | $17–18k | $25–36k | $80k (pre-fix market) | janitor L5 | shared room | none | alive |
| RISK-TAKER ($300 float, TSLA/NVDA, then crypto) | $14k | $18k | died wk 33 / 53 | — | janitor L2–3 | shared room | none | **dies** (cannot fund the $500 doctor) |
| OPTIMIZER (musician/farmer, CS on loan, software, stocks) | $14k / −$58k | $13k / −55k | $4.5k / −36k (CS 16 wks out) | **$594k** | software L5 $3,000/wk | rented apartment | CS, $44k debt left | alive |
| TEXT-SKIPPER | died wk 15 | | | | | homeless | | dies (Program 7, fair) |

Where the money went over 250 weeks (spend by category): AVERAGE WORKER
other $6.3k (event choices) + health $5.5k + housing; HIGH-SPENDER vehicle
$16k + health $14k + pets $9.5k; SAVER deposits $71k; INVESTOR buys $66k;
OPTIMIZER buys $389k of stock (worth $635k at 250, pre-fix market) + $5.3k
items + $3.2k food.

### 3.1 Variance across lives (seeds 2 and 3, 100 weeks)

POOR START $47k / $59k · AVERAGE $17k / $17k · CLIMBER −$40k / −$39k ·
HIGH-SPENDER $14k / $13k · SAVER $21k / $20k · INVESTOR $36k / $25k ·
RISK-TAKER died week 53 on both · OPTIMIZER −$42k / −$39k (still studying).
The ordering is stable across lives; the dispersion is in the market
(INVESTOR ±20%) and in which ENTRY job the board offers (§5).

### 3.2 What the weekly tick actually pays an entry worker

For the AVERAGE WORKER, weeks 21–100 (beginner luck over), the tick's cash
delta minus (salary − bills): median **+$27/wk on a $145/wk gross (19%)**,
mean +$99/wk (68%) because of six lucky-bonus spikes of $470–$1,430 (the
1% ×10 and 5% ×3 tiers). The play streak adds +2% per TICK to +20% — it
counts weeks advanced inside 48 h, not days played, so any regular player
holds the +20% permanently from the tenth week. Below $200/wk none of this is
taxed. It is the prior audit's "authored engagement dial"; it is also roughly
a third of an entry wage, and it is why an entry life is never actually short
of cash after week 6 (§4).

## 4. Life stages — thresholds from the runs

| stage | measured entry condition | when the personas got there | what defines it |
|---|---|---|---|
| **Survival** | homeless, cash < $1k, no job | weeks 0–4 | rent is the only bill; the job board and the $45 room decide the week |
| **Stability** | housed, job, cash ≥ $500 (doctor affordable) | week 5–8 (all employed personas) | Chapter 1 bundle ($800 at week 6–7 = 7 weeks of wage) + starter windfalls |
| **Comfort** | tier 3 (wealth mark ≥ $10k), nothing mandatory left to buy | week 14–20 | Chapter 2 bundle ($2,800 at week 13–14 = **21 weeks of wage**) + the first inheritance |
| **Plateau** (the doc's "success" never arrives on an entry ladder) | ladder ceiling, $120–$300/wk surplus, tier 3 | week 80–100 | janitor L5 $200/wk; $17–22k at week 100; **no next rung on screen** (§5, fixed in §13) |
| **Success** | second-tier career ($550+/wk) | musician L3 at week ~50 (if offered); teacher at week ~105 (climber); software at week ~116 (optimizer) | only via the job-board lottery or a $12k–$90k qualification |
| **Wealth** | $200k+ | optimizer ~week 170; musician ~week 200; nobody else in 250 weeks | requires a $1,100+/wk career AND investing the surplus |
| **Prestige** | $10M | no persona; the 10-year archetype sim reaches $3.3M as an investor, $2.6M as a tycoon | by design a business/equity number, not a wage number |
| **Legacy** | prestige tiers 2–5 | — | out of a first life's reach on wages, as the dynasty design intends |

The boundaries that matter are the two that the doc did not name: the
**comfort cliff** at week ~14 (money stops mattering for the entry tier for
a year) and the **plateau** at week ~80 (the ladder ends and nothing points
onward). Everything between them is cash accumulating with no decision
attached.

## 5. Progression spine — per path, with the dead ends

```
ENTRY ($110)  ──promotions 8–25 wks──▶  ceiling $180–250 (fast food, retail, janitor, truck, farmer, chef, electrician)
   │                                          └── DEAD END: no rung on screen; $120/wk surplus for the rest of the life
   ├── musician (if the board offers it): ceiling $2,120 via tenure gates 40/100/170 wks  ─▶ SUCCESS by week ~50–200
   ├── certificate $12k–18k (police, legal; fitness 50 / $5.6k of items)  ─▶ ceiling $900–950
   ├── business degree $48k / 90 wks  ─▶ teacher $1,100, nurse $1,250 (fitness 40), bank/accountant (items)
   ├── CS $72k / 104 wks (+ $5k computer)  ─▶ software $1,100 → $3,000
   ├── masters $90k  ─▶ therapist / vet / architect; MBA $120k ─▶ corporate; med/law $130–150k ─▶ doctor $4,800 / lawyer $4,000
   └── reputation 20–30  ─▶ politician staff / celebrity (no tuition; reputation is a separate axis)
SUCCESS ($1,100–4,800/wk) ──▶ surplus $800–3,500/wk ──▶ property (studio $19k down) · stocks · entrepreneurship $30k + company $50k–$2M
WEALTH ($200k–$10M) ──▶ companies (per-company cap $200k/wk) · equities (the one uncapped channel) ──▶ PRESTIGE $10M ──▶ DYNASTY
```

Dead paths found: (1) the entry-ladder plateau above — five of nine
personas live it; (2) `ch_investment_news` cliffhanger: its gate tested
`Array.isArray(s.stocks)` on an object, so it had never fired for any save
(§13); (3) Chapter 3 needs a partner, so for every persona the CHAPTER spine
stops at 2 while the WEALTH tiers carry progression instead — chapters 3+ are
a social-axis spine by design, and the tier-1 "meeting someone" question
stays an owner decision as instructed (not implemented); (4) the student loan
is the only rung financed by debt and it starts charging on day one (§10).

## 7. Reward audit — every payout in weeks of the income it lands on

| reward | amount | when the personas earned it | in weeks of THEIR wage at that moment | verdict |
|---|---|---|---|---|
| Chapter 1 bundle | $500 + 3 × $100 (+35 gems) | week 6–7 | 7 weeks of $110 | generous but early; it funds the room and the first doctor |
| Chapter 2 bundle | $2,000 + 4 × $200 (+90 gems) | week 13–14 | **21 weeks of $130** | the spike the brief asked about — confirmed. It is what lifts every persona to $10k+ / tier 3 by week 20 and is the single reason cash stops mattering for the entry tier for the next 60 weeks. Not changed (Programs 8–9 tuned Chapter 2 twice; whether it should be a fraction of income is an owner call, §11) |
| Chapter 3 bundle | $5,000 + 4 × $500 | nobody in 250 weeks (needs a partner) | would be 5–6 weeks of a $1,100 wage, 35 weeks of a $200 one | sized for the degree tier; unreachable on the entry tier, and the partner goal is the real gate |
| Chapter 4 / 5 | $14,000 / $35,000 | not reached | | require a business ($80k) / $200k net worth — bundle ≈ 10–17% of the goal itself |
| Chapters 6–10 | $76k / $182k / $480k / $1.44M / $4.8M | | | at $1M–$10B net worth these are 3–8% of the goal: garnish, not fuel |
| `starter_luck` / `first_paycheck_bonus` / `surprise_windfall` | $150–300 / $150 / net-worth scaled ($900 measured at week 6) | weeks 1–6 | 1.5–8 weeks of wage | fine; they are the bridge to the first rent |
| Cliffhanger inheritances | $2,000 (wk > 10) and $3,000 (wk > 25) | seed 1: **weeks 16 and 19 (same letter twice)**, then 13 / 167 after the fix | 15 / 27 weeks of an entry wage each | **repeatable before this program** — ~$40/wk expected at ANY income, a third of an entry wage. Fixed: once per life (§13) |
| Boss-meeting cliffhanger | $500–1,000 | ~1%/wk with a job | 4–8 weeks of an entry wage, hours at the top | repeatable by design (a bonus) — kept |
| Lucky bonus | ×0.5 / ×3 / ×10 of weekly income at 14% / 5% / 1% | six spikes of $470–$1,430 in 80 weeks for the janitor | EV +32% of gross, untaxed under $200/wk | authored engagement dial (2026-08-25 verdict) — reported, kept |
| Play streak | +2% per tick to +20% | permanent from week 10 for anyone who plays every 2 days | +20% of gross | counts ticks, not days; reported, kept |
| Savings-goal completion | 1% of target, cap $500 | — | | fine |
| Ambitions | $60k–$300k + gems + prestige points | milestone 1 needs tier 2–5 | | sized for the mid game |
| Election victory fund | 1.2 × campaign cost | | | fixed in the prior audit |

Reward integrity checks (Program 8's ledger tests still green): chapter
bundles pay once and never on reload; promotions pay nothing; the engagement
bonuses are taxed at the marginal rate; event payouts land only on the tap.

## 8. Dominant-strategy and opportunity-cost test

`economyStrategies.sim.test.ts`: the same life, software L0 ($1,100/wk),
$30,000 of capital at week 0, five deployments, 150 weeks (pre-fix market):

| strategy | netW @26 | @52 | @104 | @150 | what the capital became |
|---|---|---|---|---|---|
| hold cash | $79k | $162k | $374k | $544k | — |
| savings 3% | $80k | $163k | $376k | $547k | +$3k |
| blue-chip stocks | $79k | $164k | $387k | $565k | +$21k (this tape; 19%/yr market) |
| studio, 20% down, live in it | $76k | $159k | $390k | $556k | rent saved ≈ mortgage + tax; +$12k |
| studio, 20% down, let it | $73k | $154k | $378k | $539k | 7.8% gross yield − 6.5% mortgage − 2.2% carrying ≈ 0; −$5k |
| entrepreneurship → factory (+2 machinery) | $46k | $119k | $368k | **$671k** | $2,461/wk passive by 150; +$127k |

Verdicts: at $30k the deployment is nearly irrelevant next to the salary and
its engagement multipliers ($544k in 150 weeks from an $1,100→$3,000 wage);
the active business is the only choice that changes the slope, and it is the
one that costs the most and pays out last — the intended premium (B1). Rent
vs buy is neutral within noise. The 10-year archetypes at $500k
(`economyStrategySim.manual.test.ts`, pre-fix): idle $0.5k · worker $677k ·
top worker $1.74M · saver +$156k over worker · investor **+$2.65M** ·
landlord +$71k · tycoon +$1.87M — the investor beat the tycoon, which is the
market defect in §10, not a strategy.

Opportunity cost the personas paid: the CLIMBER's $48k degree cost a net
−$41/wk for 90 weeks (payments during study) and paid +$900/wk afterwards —
payback ~53 weeks after graduation; the OPTIMIZER's $72k CS degree paid back
in ~30 weeks of software wages. The HIGH-SPENDER's sedan ($15.5k + ~$70/wk)
and cat ($9.5k + $15/wk) cost him ~$40k of the AVERAGE WORKER's $52k over 250
weeks: spending has a price and the price is legible.

## 9. Economic shocks and recovery (`economyShocks.sim.test.ts`)

AVERAGE WORKER, shock at week 60 ($17k cash), 150 weeks:

| shock | trough cash | cash back to $17k | netW back | arrears | min hp | final netW (control $37k) |
|---|---|---|---|---|---|---|
| job loss, no rehire for 8 weeks | $16k | week 69 | week 69 | 0 | 45 | **$48k** (the re-hire's early-career boost re-climbs a fresh ladder faster) |
| illness (pneumonia) | $16k | 61 | 61 | 0 | 46 | $36k (one $500 doctor visit) |
| wallet emptied to $50 | $197 | **137** (77 weeks) | 137 | 0 | 47 | $20k |
| $8,000 bill | $8.7k | 100 (40 weeks) | 100 | 0 | 47 | $29k |
| portfolio halves at week 80 (investor) | $364 | 88 | 111 (31 weeks) | 0 | 34 | $40k |

Every shock recovers, monotonically, with no arrears and no death: the
entry economy has no spiral because it has no leverage — rent is the only
standing bill and the wage covers it three times over. Recovery is slow in
proportion to the wage (a $17k loss takes 77 weeks at $200/wk), which is
honest. Job loss is nearly free because entry ladders are flat and a fresh
ladder climbs at 2.5× for 20 weeks. The one shock the personas cannot absorb
is the one measured in §3: illness with less than $500 on hand (RISK-TAKER
dies twice at weeks 33/53 with $300 in the wallet and $13k in crypto).

## 10. Long-run stability and the content economy

- **No non-finite value, no negative cash, no arrears** across 9 personas ×
  250 weeks × 3 seeds (dump scan) and the 10-year archetypes.
- **Equities compounded at 19.3%/yr** (equal-weight, 40 lives; NVDA 31.7%)
  against the file's documented ~9–11.5% — the log-normal step carried a
  hidden +σ²/2 (4.2%/yr at 4% vol, 16.6% at 8%) on top of the authored risk
  premium. This is why the 2026-08-25 audit saw equities become "the one
  uncapped channel" past $10M and why its $500k investor out-earned its
  tycoon. Fixed (§13): 9.6%/yr mean, 9.4% median; a single high-vol name now
  has a negative MEDIAN and a positive MEAN, which is what a gamble is.
- **Dead currency:** gems have no economic sink but revive; legacy points
  only matter across prestige. Unchanged, by design.
- **Unreachable tiers on wages:** prestige ($10M) needs ~50–100 years of the
  top wage; luxury ($250k–$500M) opens at tier 5 (week 120 for everyone) but
  the first item is 1–4 years of a top wage. Both are sized for company
  income; the doc says so. Reported, not changed.
- **Inflation** (3%/yr on the price index) touches company founding, upgrades,
  miners, items and food but not rent, tuition, property or luxury: prices
  drift apart over a long life (a factory costs $77k by week 800, the studio
  still $95k). Cosmetic at the horizons measured; noted for the next pass.
- **Content that is trivial by the time it unlocks:** pets ($2k–$18k at tier
  2 ≈ 10–90 entry weeks) and the sedan ($15.5k at tier 3) are the two
  purchases a plateaued entry worker can actually make; both are pure
  spending. Everything else on the tier-2/3 shelf (stocks, property,
  companies, crypto) needs either a wage the entry tier does not have or a
  qualification the feed never pointed at — the gap §13's goal closes.
- **Content unaffordable at its tier:** property (studio $19k down + income
  proof) at tier 2, companies ($80k) at tier 3, luxury at tier 5 — correct
  ordering, just steep; the wealth-milestone tier ladder ($2k/$10k/$50k/$200k)
  is well ahead of the purchases it unlocks.

## 11. The brief's known concerns — verified, not assumed

| concern | verdict | evidence |
|---|---|---|
| early-game survivability previously broken | **holds after Programs 7–8** for anyone who reacts; the one remaining killer is illness with < $500 on hand | §3, §9: RISK-TAKER dies at 33/53 with $300 float; every other employed persona lives 250 weeks |
| chapter reward spikes | **confirmed for Chapter 2**: $2,800 at week 14 = 21 weeks of the wage it lands on; Chapter 1 = 7 weeks | §7 |
| ~$43,000 by week 100 for a working life | **not what the build does**: an entry-ladder life is worth $17–22k at week 100 (3 seeds), $47–52k at week 250; a musician $47–59k at 100; a degree/CS path is NEGATIVE at 100 (in debt, still studying) and $500k+ at 250 | §3 |
| promotions every 13–25 weeks: meaningful? | five promotions by week 100 on every ladder; on the entry ladders they are worth +$20–30/wk each, so the sixth rung is the "meaningful" one and it does not exist — the ceiling ($180–250) is the problem, not the cadence | §5 |
| mid-game aspiration weak | **confirmed, and located**: weeks 20–100 on an entry ladder have money and no decision; the first rung off the ladder was affordable from week ~20 and nothing on the feed said so | §4, fixed §13 |
| "meeting someone" missing at tier 1 | chapters 3+ are a social spine and stall for every economic persona; **not implemented, per instruction** — the wealth tiers carry economic progression without it | §5 |

## 12. Proposals, ranked (impact × confidence ÷ complexity)

1. **Stock drift convexity** — PROBLEM: equities compound at 19%/yr, 2× the documented target; EVIDENCE: 40-life Monte Carlo, the 10-year investor beating the tycoon; ROOT CAUSE: log-normal step with μ set to the target and no σ²/2 correction, plus the risk premium; STAGE: wealth → prestige; PERSONAS: INVESTOR, OPTIMIZER, every $10M+ life; CHANGE: subtract σ²/2 in `weeklyLogDriftFor`; EXPECTED: 9.6%/yr mean (measured), investor no longer beats the business path; EXPLOIT RISK: none (returns fall); REGRESSION RISK: three single-tape drift tests were coin flips and are now multi-life statistics; TEST: `stockMarketDrift.test.ts`. **Implemented.** Score 9 × 0.95 ÷ 2.
2. **Repeating inheritances** — PROBLEM: two once-in-a-life windfalls re-fire forever; EVIDENCE: same letter at weeks 16 and 19; ROOT CAUSE: no repeat guard on cliffhangers (pool events got one on 2026-08-25); STAGE: entry → comfort; PERSONAS: all; CHANGE: once per life via `eventLog`; EXPECTED: −$40/wk of standing windfall at every income; EXPLOIT RISK: none; REGRESSION RISK: none (boss meeting and the others unchanged); TEST: `cliffhangerWindfalls.test.ts`. **Implemented.** 7 × 0.95 ÷ 1.
3. **`ch_investment_news` never fires** — PROBLEM: dead content; ROOT CAUSE: `Array.isArray` on an object; CHANGE: read `holdings`; TEST: same file. **Implemented.** 4 × 1.0 ÷ 1.
4. **The plateau has no signpost** — PROBLEM: the entry ladder ends at week ~80 with $120/wk and nothing to aim at; EVIDENCE: §3–4; ROOT CAUSE: the goal catalogue only recommends FINISHING a degree; CHANGE: `soon_get_qualified` SOON goal for entry-ladder workers with the Education app open, measured against the cheapest paid programme; EXPECTED: the certificate rung appears on the feed from week ~20 with a moving bar; EXPLOIT RISK: none (no reward attached beyond the goal ledger); REGRESSION RISK: catalogue invariants (movable progress) extended with two probe states; TEST: `getQualified.test.ts`, `goalCatalogue.test.ts`, `economyBoundaries.test.ts`. **Implemented.** 7 × 0.8 ÷ 2.
5. **Student loan repayment during study** — PROBLEM: the only debt-financed rung charges from day one at 6%/10y with no DTI check ($124/wk on a $130 wage; a $180k PhD would be $466/wk on $110); EVIDENCE: CLIMBER −$41/wk for 90 weeks, cash pinned at the doctor threshold; ROOT CAUSE: `enrollInProgram` builds the loan directly, bypassing `quoteLoan`; CHANGE (proposed): defer repayment until completion, interest-free while enrolled — needs an optional `repaymentStartsWeeksLived` on `Loan` (a v50 carve-out) and an autopay skip; EXPECTED: the degree path stops bleeding during study without gating the poor out of education; EXPLOIT RISK: enrol-and-withdraw to park a free loan — the withdraw path must start repayment; REGRESSION RISK: save format. **Not implemented — owner decision (design + schema).** 6 × 0.7 ÷ 4.
6. **Chapter 2 bundle = 21 weeks of wage** — CHANGE (proposed): scale chapter money to a fraction of the completing player's weekly income with the authored figure as a cap; **not implemented** — Programs 8–9 tuned Chapter 2 and the bundle is what funds the first doctor and the first certificate. 5 × 0.5 ÷ 3.
7. **Play streak counts ticks** — a permanent +20% for regular players; reported, kept (engagement dial; the prior audit's verdict stands).
8. **Entry-job lottery** — musician ($2,120 ceiling) vs janitor ($200) is a 7× lifetime-income difference decided by a 4-slot random board at week 1; the tenure gates make it a fair bet, but the board never says "ceiling"; it does show growth pace. Proposed: nothing this program — the goal fix makes the janitor's exit visible instead.
9. **Inflation touches only some prices** — reported for a later pass.
10. **Illness under $500** — the doctor is the one purchase that decides a life; no change proposed beyond what Program 8 did (managed care), because the windfall stack makes $500 available by week 6 for anyone who does not spend it.

## 13. Fixes implemented (priority order: formulas → exploits → dead progression → tradeoffs → aspiration)

| # | fix | files | test |
|---|---|---|---|
| 1 | Log-normal convexity subtracted from the weekly stock drift; `expectedAnnualReturnFor` exported and documented | `lib/economy/stockMarket.ts` | `lib/economy/__tests__/stockMarketDrift.test.ts` (multi-life statistics; expectation asserted in the designer's unit) |
| 2 | Inheritance cliffhangers once per life (`resolvedThisLife`, derived from `eventLog`) | `lib/events/cliffhangerEvents.ts` | `lib/events/__tests__/cliffhangerWindfalls.test.ts` |
| 3 | `ch_investment_news` gate reads `stocks.holdings` | same | same |
| 4 | `soon_get_qualified` goal | `lib/goals/catalogue.ts` | `lib/goals/__tests__/getQualified.test.ts`, catalogue invariants |
| 5 | Economic boundary gates on the real tick | `__tests__/simulation/economyBoundaries.test.ts` | itself |

Measured after: INVESTOR $80k → $63k at 250 weeks (seed-1 tape, below the
new mean); OPTIMIZER $594k → $506k; AVERAGE WORKER $52k → $47k (one letter,
one lawyer, weeks 13 and 167 — each once). No save-format change:
`STATE_VERSION` stays 49; every change is value-only or derived from state
the save already carries.

## 14. Red team (what the fixes could open)

- **Once-per-life via `eventLog`:** the log is capped at 500 entries; at the
  authored cadence (~1 event / 9 weeks, plus resolutions) it holds ~60 years,
  longer than any life. A player who could purge the log could re-arm the
  inheritance; nothing exposes a purge. A new life (prestige) legitimately
  gets both again — intended.
- **Drift correction:** lowers returns, so no farm opens; the peek-and-reload
  foresight stays exactly as the prior audit accepted it.
- **The new goal:** carries no cash reward; the goal ledger's achievement
  bookkeeping is the existing one. A player can hover in eligibility forever
  by never enrolling — a goal, not a faucet.
- **Harness actions** go through the production action modules with the
  arguments the screens pass; nothing new is reachable from the UI.
- Re-checked and still closed: gate→grant atomicity on every action the
  harness drives (deposit, stock buy, property, enrol, company, licence,
  vehicle, luxury, loan, pet), the market's per-life seed, the engagement
  base cap and marginal tax.

## 15. Tests added or changed

`__tests__/helpers/earlyGameSim.ts` (economic actions, columns, spend
tracking, event debounce), `__tests__/helpers/economyPersonas.ts` (new),
`__tests__/simulation/economyPersonas.sim.test.ts`, `economyStrategies.sim.test.ts`,
`economyShocks.sim.test.ts` (new, env-gated soaks), `economyBoundaries.test.ts`
(new gates), `lib/economy/__tests__/stockMarketDrift.test.ts` (rewritten
statistics), `lib/events/__tests__/cliffhangerWindfalls.test.ts` (new),
`lib/goals/__tests__/getQualified.test.ts` (new), `goalCatalogue.test.ts`
(two probe states).

## 16. Remaining risks (owner decisions, not defects)

1. Student-loan deferment (§12.5) — schema change.
2. Chapter 2's bundle size relative to wage (§12.6).
3. The play streak's +20% counting ticks (§12.7).
4. The week-1 job lottery's 7× spread (§12.8).
5. Chapters 3+ need a partner; the tier-1 "meeting someone" path is unbuilt by instruction.
6. Inflation's uneven reach (§10).
7. The RISK-TAKER archetype (a $300 float) dies of a curable illness in every seed — the doctor's $500 is the entry tier's real minimum balance and nothing on screen says so.

## 17. Scores (0–100, honest)

| axis | score | why |
|---|---|---|
| Economy map completeness | 90 | every flow read from source with numbers; inflation's reach and the political/celebrity ladders read but not simulated |
| Early-game economy | 78 | survivable, legible, one mandatory bill; the comfort cliff at week 14 is generous |
| Mid-game economy | 55 → 64 | the plateau is real and now signposted; the debt rung still charges during study |
| Late-game economy | 70 → 76 | equities no longer 2× the documented rate; the $10M–$100M band unchanged |
| Progression integrity | 85 | rewards pay once; chapters and tiers consistent; the dead cliffhanger fixed |
| Price fairness | 74 | prices scale with the stage they are offered at; the doctor and the computer are the two walls |
| Reward fairness | 66 | Chapter 2 = 21 weeks of wage; inheritances now once; lucky/streak an authored +50% |
| Strategic choice | 72 | no dominant deployment at $30k; business is the slope; rent-vs-buy neutral |
| Exploit resistance | 88 | the repeating windfall closed; no printer found on the actions the harness drives |
| Shock recovery | 82 | every shock recovers monotonically, no spirals, no arrears |
| Long-run stability | 84 | finite everywhere over 250 weeks × 27 runs; caps hold |
| Aspiration | 52 → 63 | the plateau now has a goal; the social spine and the job lottery remain |
| Content economy | 68 | tier-2/3 shelves are steep for the entry wage; luxury/prestige correctly sized for business |
| Measurement tooling | 88 | nine personas, strategies, shocks on the real tick; JSON dumps |
| **Overall** | **71** | the economy is honest and stable; the story of an entry life between week 20 and week 100 is the gap |

## 18. Files changed

- `lib/economy/stockMarket.ts` (drift convexity, `expectedAnnualReturnFor`) · `lib/economy/__tests__/stockMarketDrift.test.ts`
- `lib/events/cliffhangerEvents.ts` (`resolvedThisLife`, once-per-life inheritances, `ch_investment_news` gate) · `lib/events/__tests__/cliffhangerWindfalls.test.ts`
- `lib/goals/catalogue.ts` (`soon_get_qualified`) · `lib/goals/__tests__/getQualified.test.ts` · `lib/goals/__tests__/goalCatalogue.test.ts`
- `__tests__/helpers/earlyGameSim.ts`, `__tests__/helpers/economyPersonas.ts`, `__tests__/simulation/economyPersonas.sim.test.ts`, `economyStrategies.sim.test.ts`, `economyShocks.sim.test.ts`, `economyBoundaries.test.ts`
- `tasks/todo.md`, `tasks/lessons.md`, `CLAUDE.md` §4.3, this report

## 19. How to reproduce every number

```
RUN_ECONOMY_PERSONAS=1 WEEKS=250 npx jest economyPersonas --silent=false      # §3, §4
RUN_ECONOMY_PERSONAS=1 WEEKS=100 SEEDS=2,3 npx jest economyPersonas --silent=false   # §3.1
RUN_ECONOMY_STRATEGIES=1 npx jest economyStrategies --silent=false           # §8
RUN_ECONOMY_SHOCKS=1 npx jest economyShocks --silent=false                   # §9
RUN_ECONOMY_SIM=1 npx jest economyStrategySim --silent=false                 # §8 (10-year archetypes)
npx jest economyBoundaries stockMarketDrift cliffhangerWindfalls getQualified # gates
```

## 20. What this program did not do, on purpose

No nerf without a measurement; no price raised; no progression slowed; no
grind or timer added; no unrelated system touched; no save-format change; the
tier-1 "meeting someone" path left to the owner as instructed; the engagement
dials (lucky bonus, play streak) and Chapter 2's bundle reported with numbers
and left for a design decision.

## 21. Next program candidates

1. Student-loan deferment (§12.5) — the one debt rung, with a schema note.
2. The week-1 job lottery — show the ceiling on the board card, or seed one
   "climber" ladder into every board.
3. Inflation's reach (§10).
4. The $10M–$100M band, now that equities are no longer 2× the target.
