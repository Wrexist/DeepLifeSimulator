# Master Program 7 — NEW LIFE BALANCE — IN PROGRESS

Branch `claude/early-game-survivability-g2ejfj`, on top of Program 6 (`b544fd2`).
Scope: early-game survivability, economic fairness, recovery paths. Programs 1-6
are complete and are not redone. The repository is authoritative; every number
below is read from the code or measured on the real tick.

## Phase 1 — repository and system audit (done; evidence)

The early-game vital loop, as the tick actually runs it (`GameActionsContext.tsx`
~700-960, `preTick.computeDecayInputs`, `applyHousingWellbeing`,
`applyCareerSalaryAndPenalty`):

| system | value | source |
|---|---|---|
| natural decay | base 4 × wealth multiplier × prestige × grace ramp; health ×0.6, happiness ×0.8, fitness ×0.2 (×1.5-4 without gym) | `preTick.ts`, tick ~879-916 |
| wealth multiplier | `100000 / max(1000, netWorth)` clamped 0.5-2.0 → **2.0 for every net worth ≤ $50k** | `computeDecayInputs` |
| grace ramp | `0.25 + 0.75 × min(1, weeksInThisLife / 8)` | `computeDecayInputs` (v43 baseline) |
| full-rate decay, early game | 8/week → −4.8 health, −6.4 happiness, −1.6 fitness | derived |
| homeless penalty | −2 health / −4 happiness / −5 energy every week; every scenario starts with no home | `rentals.ts HOMELESS_PENALTY`, `scenarioData.ts` |
| entry job toll | authored per career, −1 floor, scaled ×(1−0.7×levelProgress); unprofiled −3/−2 | `applyCareerSalaryAndPenalty` |
| energy | +40 regen, minus job toll (−8..−18), minus homeless −5 | tick ~815-853 |
| death | 4 consecutive weeks at 0 health OR 0 happiness (`ZERO_STAT_DEATH_WEEKS`) | tick ~1441/1471 |
| free recovery | Walk +6 hap/+3 hp/−5 en; Meditation +10 hap/+2 hp/−3 en; **no weekly cap** | `initialState.healthActivities`, `ItemActionsContext.performHealthActivity` |
| paid recovery | Yoga $100, Massage $300, Doctor $500 (+25 hp), Therapy $400 | same |
| housing | Shared Room $45/wk (+1/+1/0), Bedsit $80 (needs $100/wk income) … | `RENTAL_TIERS` |
| rent surface | **Market → Housing (tier 0, no device)** since `a67ca7d` (Program 5); Program 6's "computer-only" note is stale | `app/(tabs)/market.tsx:437` |
| poverty | `weeksInPoverty` counts liquid < $500; gates one scholarship event; NO decay multiplier of its own | `applyPovertyTracking` |
| disease | base 0.1-2%/wk × risk (health<50 up to 3×, fitness<30 up to 2×, age<25 ×0.3-0.5), 4-week cooldown | `diseaseGenerator.ts` |

Finding 1 (root cause of the Program 6 death): the "poverty decay" is not a
poverty system. It is the wealth multiplier, which is pinned at its 2.0 ceiling
for every net worth under $50,000 — i.e. for the whole early game of every
scenario except `trust_fund_baby`. "Base 4" is a number nobody in the first
years of a life ever experiences; the real base is 8.

Finding 2: the three drains are independent and additive (no multiplication,
no double count found in the tick). At full grace, a housed-nowhere entry
worker loses 4.8+2+2 = 8.8 health and 6.4+4+3 = 13.4 happiness a week.
Happiness reaches 0 at ~week 9, death at week 13 — the Program 6 measurement.

Finding 3: the free fixes are uncapped and energy-bound only. One walk + one
meditation a week (+16 hap / +5 hp for 8 energy) more than covers the
happiness drain and covers about half the health drain. This is what the
careful Program 6 script did and it survived to week 20 at 68/87.

## Phase 2-6 — starting-state, decay, stacking, recovery, 20-week simulations
Harness: `__tests__/simulation/earlyGamePersonas.sim.test.ts` — the REAL
provider `nextWeek()` on the REAL onboarding seed, seeded `Math.random`, five
personas as weekly policies over the real action functions
(`applyForJob`, `performHealthActivity`, `rentHome`, `performStreetJob`,
`buyFood`, `promoteCareer`). Results below (Phase 6 table) once measured.

## Phase 7 — evidence-based balance changes (each row: one change, one test)
(filled in after Phase 6)

## Phase 8-10 — recovery validation, fresh walkthrough, red team
(filled in after Phase 7)

# Master Program 6 — THE FIRST 30 MINUTES — COMPLETE

Branch `claude/ui-hierarchy-asymmetry-pass-fwqtue`, on top of Program 5
(`cf2bc0f`, verified). Scope: comprehension, consequence clarity, game feel,
pacing, discovery in a FRESH life. No save-format change, no economy/IAP/
subscription change, no new modal, no owner decision overturned. Balance
findings are PROPOSED (Phase 12), not applied.

## Phase 1 — fresh walkthrough (done; evidence)
Method: web export of HEAD (`web-p5`), scripted new player in Playwright
(`scratchpad/play.mjs`, run `play2/`): Play → coach "Find a job" → Apply →
Home → 20× Next week, dismissing whatever pops. Four independent read-only
audits (teaching layer, week-tick visibility, early economy, agency) verified
against the code.

Quick Start seeds `food_courier`: age 20, $1,500, smartphone + bike, no job,
no home (`realEstate: []`, no `rental` → HOMELESS from frame one), health/
happiness/energy 100, fitness 10. `weeksLived` 104, `lifeStartWeek` 104.

Measured passive life (job at week 0, Next week only):

| wk | health | happiness | cash | what the player saw |
|---|---|---|---|---|
| 0 | 100 | 100 | 1,500 | coach "You need work" → Work → Apply → hired instantly → coach "Hired. Now live a week / Got it" |
| 1 | 95 | 91 | 1,642 | +25 gems floater, Daily Reward modal ("Gem +1", "Money bonus $25" — it granted 25 gems and $0), "🌟 Perfect Week!" toast, recap "+$142 · Career +16%", cliffhanger teaser, "Nowhere to live" banner |
| 2–4 | 89→77 | 82→62 | 1,793→2,063 | identical taps; "N decisions waiting" grows (1st-paycheck bonus, windfall never opened); "Career +32% / +48%" |
| 5–6 | 70 | 51 | 3,015 | Chapter 1 complete: +$800 +35 gems, banner names "Progression and Contacts" as newly available (they were open at week 0); lead goal becomes "Have 80+ fitness 0/4 objectives" |
| 7–8 | 62→52 | 39→17 | 3,314 | tip "Feeling down? Do activities you enjoy or socialize!" (no route); disease contracted; ad orb "Full refill"; "Saved" pill over the net-worth figure |
| 9–12 | 42→4 | 0 | 4,240 | "Health is low! Go to Life → Health…"; promotion ready on Work (never surfaced on Home once the tip took the lead) |
| 13 | 0 | 0 | 4,240 | **"You Died — The weight of life became too much." MEDIOCRE, Life Quality 5%.** |

Thirteen taps. In real time roughly 8–15 minutes.

After the changes (same script, new build): tick one shows the coach's
"You earned $142 / That's the loop… Life → Health tops them up for free" and
the recap line "Each week −7 happiness · −6 health · No home · Natural decay ·
Line Cook shifts · free fixes in Health"; no reward modal, no praise toast, one
decision waiting (the starter envelope). The fast-clicker who ignores all of it
still dies on week 13 (the balance, Phase 12). A second script that follows the
recap line each week and does the two free activities ends week 20 alive at
health 68 / happiness 87 / $2,561, having also cured a depression at week 8.

## Phase 2 — minute map (0–30, careful new player, ~2 min per week)
| min | knows | can do | primary goal | decision | consequence seen | feeling | confusion | load | reason to continue |
|---|---|---|---|---|---|---|---|---|---|
| 0–1 | a life, Jan 2025, age 20, $1,500 | Play | none | none | — | curious | low | low | novelty |
| 1–2 | I need a job | Find a job / ambitions / goals | Earn $500 (chapter) | none yet | — | oriented | "0/3 goals" under "Earn $500"; "Hold $5,000 · 0/3 done" | medium | coach CTA |
| 2–4 | jobs pay $110 | pick 1 of 4, Apply | get hired | REAL: ceiling/toll/climb (metadata chips, same pay) | hired instantly, coach flips | competent | none | medium | "live a week" |
| 4–5 | the arrow lives a week | Next week, Got it | wage | Got it (retires the coach for good) | +$142, gems modal, praise toast, vitals −5/−9 unexplained | rewarded + noisy | why did happiness drop? what's a gem? | HIGH (3 surfaces + banner) | money went up |
| 5–10 | tap = money | tap; Work; Life | Earn $500 | none (passive) | recap money only; "Career +32%" reads as weekly | fine → bored | vitals sliding, cause invisible; "decisions waiting" badge | low | chapter bar |
| 10–14 | chapter done (+$800) | tap | "Have 80+ fitness" (impossible) | none | banner names unlocks that already happened | flat | lead goal impossible at fitness 10 | low | none named |
| 14–20 | something is wrong | tip (no route), Health tab if found | Get Promoted 3/4 | find the free fixes (walk/meditate) | happiness 17 → 0; disease | anxious | tip says "socialize" — no route, no "free" | low | promotion (Work only) |
| 20–30 | dying | tap / Health | survive | meditate ×N | health 4 → 0 → death screen | punished | "why?" — the causes were never named | low | new life |

Three questions — Where am I? YES (HUD + identity strip). What can I do? YES at
0–4 min (coach), NO from 5 min (the only routed goal row is pushed out of the
three slots by chapter + challenge + live event). Why should I care? WEAK: the
first consequence (pay) is buried under three simultaneous surfaces, the second
consequence (vital drift) is never explained.

First meaningful decision: which entry job (min 2–4) — real but the differentiator
is in chips, not the headline. First success: first pay (min 4). First setback:
the unexplained happiness slide (min 5–14), then disease (min ~16), then death.

## Phase 3–12 — root causes → changes (each row is one commit; each has a test)
Format: PLAYER MOMENT · PROBLEM · ROOT CAUSE · CHANGE · BENEFIT · RISK ·
BEHAVIOUR · STATE · VERIFICATION.

- [x] **R1 consequence: the drift is invisible.** wk 1–12 · vitals lose ~9 happiness / ~6 health a week, three causes (poverty-doubled decay, no home −4/−2, job toll −3/−2), no surface names any until ≤20 · the recap reports money + career only; the breakdown modals exist behind an un-invited ring tap · `lib/economy/vitalDrift.ts` (pure projection, one source shared with the breakdown modals' formula) + one recap line "Drifting −13 happiness · −9 health a week · no home, shifts, drift" that routes to Life → Health · the player learns the cause and the cure at minute 4 · low · none (display) · none · unit test on the helper + render test on the recap line.
- [x] **R2 teaching stops at the first wage.** min 4 · "Got it" on the 'advance' step retires the coach permanently, so the 'paid' payoff ("That's the loop") never renders · `onAction` calls `retire()` for 'advance' · 'advance' acknowledgement is local (card folds), 'paid' still appears; 'paid' copy adds the second loop in one clause (vitals drift, Life tab tops them up for free) · the loop is closed and the maintenance loop named once · low · coach shows one more card · AsyncStorage flag written one step later · `firstSessionCoach.test.ts` extended.
- [x] **R2 tip copy has no route.** min 14+ · "Feeling down? Do activities you enjoy or socialize!" · no route, vague · tips name the free fix and are pressable (Life → Health) · low · none · none · render test.
- [x] **R4 goal feed: the routed row never shows.** min 5–30 · GoalsCard MAX_ROWS=3 filled by chapter + weekly challenge + live event; the catalogue recommendation (the ONLY row with a destination, incl. "Get your health back up" <60) is 6th · row order · catalogue row is pinned second; a weekly challenge whose objectives all need locked systems is omitted (tier gate mirrors the Apps padlocks) · every glance offers one actionable thing · low · none · none · `goalsCardRows.test.ts` extended.
- [x] **R3 honesty: Daily Reward popup.** min 4 · says "+1 gem" and "$25 money bonus"; grants 25 gems, $0 · hard-coded copy · show `+{rewardAmount} gems`, drop the money row · first reward is believable · none · none · none · render test.
- [x] **R3 honesty: "Perfect Week!" on week 1.** · praise for stats that started at 100 · no life-age condition · celebration gated on ≥4 weeks into this life · none · none · none · unit test.
- [x] **R3 honesty: chapter banner announces old unlocks.** min 12 · "Progression and Contacts and 1 more are now available" when tier 1 was granted by the $500 milestone at week 0 · announcement reads the chapter tier, not the delta · announce only features the completion actually opens (prev tier < chapter tier) · none · none · none · unit test.
- [x] **R3 honesty: recap "Career +48%".** · cumulative progress labelled as a weekly gain · field is cumulative · label "Promotion 48%" / "Promotion ready" · none · none · none · render test.
- [x] **R3 honesty: live-event row "0/3 done".** · a $1,500 player reads "Hold $5,000 in cash · 0/3 done" under a 30% bar · fraction = objectives met · "$1,500 / $5,000" for numeric objectives, "N/M objectives" otherwise · none · none · none · goalsCardRows test.
- [x] **Pacing: three surfaces on the first tick.** min 4 · Daily Reward modal lands on the same tick as the first wage · gate `weeksThisLife < 1` · `< 2`: the first tick belongs to the wage; the reward arrives on tap two (same session, one tap later) · fewer collisions at the one moment that teaches the loop · low (one-tap delay of a free reward) · daily reward one week later on a new life · none · home effect test.
- [x] **Discovery: hire is silent** (pending path) · when an application resolves 1–2 weeks later nothing announces it · `applyCareerApplications` returns no notification · push "Hired: X — $N a week from next week" · low · one banner · none · unit test.
- [x] **Agency: dead starter event.** wk 1 · `starter_luck` condition `weeksInThisLife === 0` can never be true (events roll on `nextWeeksLived`) · off-by-one · `=== 1` · the first decision (save $300 / invest in yourself) lands on tick one as an inbox item, not a modal · low · one more inbox event in week 1 · none · `lifeRelativeGates` test.
- [x] **Honesty: homeless banner** · "Renting even a shared room would help" — the only rent UI is Real Estate, computer-only ($5,000) and tier 2 · copy assumes a mid-game player · name the cost and the free offset instead · none · none · none · unit test.
- [x] **Collision: "Saved" pill over the net-worth figure** (wk 8 capture) · AutoSaveIndicator absolute at `top: insets.top + 70`, right 16 — lands on the identity strip · verify + move below the HUD band or make it non-overlapping · low · none · none · capture.
- [x] **Discovery: the padlocks open on tick one.** wk 1 · Apps grid reads "Locked (6)" at week 0 and "Locked (1)" after ONE Next Week with $1,642 cash, under padlocks that say "Finish Chapter 2: Settling In" (browser capture) · the tick stamped `lifetimeStatistics.peakNetWorth` from preTick's private net worth, which counts owned Market items (bike + smartphone = $1,050), so a $1,500 life "peaked" at $2,550 and `wealthMark`'s ratchet put `unlockTier` at 2 · the peak sample is the canonical `netWorth()` (the HUD's figure); decay still reads preTick's number (both clamp to 2.0 below $50k, so no balance change) · the ladder means what its copy says · low · tier 2 arrives when cash reaches $2,000 (~week 4-5) instead of week 1; peak net worth stops counting furniture · `peakNetWorth` now equals the HUD figure (a stats field, not a schema change) · `__tests__/firstSession/firstTickProgression.test.ts` runs the real provider loop on the real onboarding seed.
- [x] Tests: `__tests__/firstSession/*` — fresh-state truth (quick start seeds), first meaningful decision reachable, consequence visibility (drift line), critical-state prioritisation (tip leads, routed), quiet state (nothing to say → recap silent), simultaneous problems (low health + low happiness + promotion), new-player progression (row order over weeks 1–12), tutorial triggers (coach steps).
- [ ] Gates after each phase; full `npm test` + `npm run preflight` at the end.
- [ ] Red team (new / confused / impatient / text-skipping / fast-clicking / unlucky), five- and thirty-minute tests, scores, report in `tasks/ui-hierarchy.md` §Program 6, lessons appended.

## Phase 12 — PROPOSALS (owner decisions, not applied)
1. **Balance: the passive new life dies at week 13.** Decay is ×2.0 for net
   worth ≤ $50k (`preTick.ts` wealthMultiplier), every scenario starts homeless
   (−4 happiness / −2 health / −5 energy a week), and the entry job tolls
   −3/−2. Together: −13 happiness a week at full grace → 0 at week 9 → death at
   13 with $4,240 in the bank. `rentals.ts:63-69` says the penalty "alone must
   never be able to get there from a healthy start"; it can with the other two.
   Options, cheapest first: (a) no homeless penalty until the player can act on
   it (Real Estate reachable — see 2); (b) wealth multiplier ceiling 1.5 for the
   first 26 weeks of a life; (c) cap total passive drift so 0 is ≥ 20 weeks
   away. Any of these is a number in one file plus a test.
2. **Reachability: renting.** The $45/wk Shared Room exists but `RealEstateApp`
   is `onPhone: false` and tier 2. Either a phone entry for rentals or a Life →
   Home segment. Template/owner decision (Program 3 kept the app map).
3. **Chapter 2** ships two goals a quick-start player has already met (phone,
   "Make a Friend" via seeded parents). Content decision.
4. **Weekly challenges** are all multi-objective mid-game content; for a fresh
   life every one is impossible within its 4-week window. This program only
   hides the row on Home; the card itself is untouched.
5. **Ambition picker at week 1** asks for a lifelong commitment with milestones
   ("own a company", "$100k") unreachable for 30+ weeks. Content decision.

# UI Overhaul Master Program 5 — CONSISTENCY CLOSURE — COMPLETE

Branch `claude/ui-hierarchy-asymmetry-pass-fwqtue`, on top of Program 4
(12 commits, verified). Rules and the closing report: `tasks/ui-hierarchy.md`.
Every item below is PURE LAYOUT / VISUAL STYLE / CONTENT PRIORITY / COPY
unless its row says otherwise; nothing changes what a player can do, what it
costs, or what is saved.

## Phase 1 — remaining Program 4 issues, verified against the code
- [x] Health green vs HUD red — REAL. `app/(tabs)/health.tsx:171-174` and `HealthCard.tsx:52-54` paint health `#34D399`; `SicknessModal` swaps energy/happiness; Statistics calls happiness "Mood" in gold and fitness green. Nine different "low" thresholds exist (25 / 30 / 40 dead / 50 / 15 / 20).
- [x] 13 apps on strip-over-rows — PARTLY. Audit of 15 landings: 7 KEEP (DeepMail, Pulse, Pets, YouVideo, Political, Garage, Spark), 8 escape candidates ranked (Streaming, Real Estate, Bank, Contacts, Dark Web, Education, Hustle, Bank Pro).
- [x] Work chrome — REAL: title → segments → instruction line → fold header → board note → first card.
- [x] Three merges — untouched in `components/launcher/appCatalog.ts`; stay owner decisions.

## Phase 2 — health and semantic state consistency
| Area | Problem | Root cause | Change | Why | State | Behaviour | Risk | Verify |
|---|---|---|---|---|---|---|---|---|
| Vitals everywhere | same number is silent / amber / red on three surfaces | no shared state model; each surface invented thresholds | `vitalState()` in `lib/config/hierarchy.ts` (critical ≤20, low ≤40, fair, good ≥80) | one word, one colour per band | health/energy/happiness/fitness | tips now fire on the CRITICAL band (was 25/25/15) — a UI gate, not gameplay | low | new unit test + stateDrivenHierarchy |
| Health screen, HealthCard, SicknessModal, Statistics, GymCard | identity colours contradict the HUD | local literals | consume `STAT_IDENTITY` | recognition | all vitals | none | low | statIdentity test |
| HUD | dead value-grader with a comment claiming it renders | leftover | deleted | honesty | — | none | none | hudLegibility |
| Pets | pet health graded 50/25 | local curve | `vitalState` | same ladder as the owner | pet health | none | low | render |
- [x] implemented; tests pending

## Phase 3 — chrome budget and Work
- [x] Work: drop the three generic instruction sentences; fold the board note ("4 openings · new in 8 wks") into the fold summary; the crime tab's duplicate cap line becomes its fold summary. Budget after: title → segments → fold header → card.
- [x] Chrome budget recorded per screen in `tasks/ui-hierarchy.md` (Home 0, Work 2, Life 2, Market 1, Health 1).

## Phase 4–5 — template audit and escapes (pure layout; every handler unchanged)
- [x] Streaming: a live session replaces the box-art hero on the dashboard (current activity + history); "Go live" becomes the one saturated button, not a text link
- [x] Real Estate: a property needing repair or sitting vacant hoists above the equity hero as the lead with its action
- [x] Bank: a bill due / negative balance / loan payment this week takes a lead slot above the strip; its section opens
- [x] Contacts: the worst at-risk relationship's triage card leads the Personal tab when any is at risk
- [x] Dark Web: the threat monitor leads (and the console collapses to its balance line) when heat is critical
- [x] Pets: the critical banner sits under the stage; a sick pet is the selected pet
- [x] Garage: low fuel / damage swaps the "View details" bar for the costed Refuel / Repair button
- [x] KEEP with reasons written down: DeepMail, Pulse, YouVideo, Political, Spark, Education (tab already state-chosen), Hustle (hero already tier 1)

## Phase 6 — buttons, copy, contradictions
- [x] `LoadingButton` `secondary` stops aliasing `danger` red: it becomes the flat tonal secondary. Market's Sell uses it.
- [x] `GradientButton` gains `emphasis="secondary"` (tonal, no gradient, no glow). One saturated button per viewport: Work's board (first applicable card only), Health's activity list (only the treatment lead), JobCard/HealthCard take the prop.
- [x] `Chip` `md` meets the 44pt target and reads as an action (weight 600) — it is the quiet action everywhere already
- [x] Red means danger only: HealthCard 'vitality' accent leaves `#EF4444`; "Free" is never red. Crime stays red on purpose (illegal = risk; a real semantic).
- [x] Copy: Buy (not Purchase/Acquire) on shop CTAs and confirms; "Done" for sheet dismissals; one cloud-restore label
- [x] Locked: one treatment — grey lock + reason line; the JobCard double signal ("- Locked" + lock icon) drops the text; lock icons in red/amber go grey; one disabled opacity

## Phase 7 — edge-state hierarchy tests
- [x] collisions (sick + starving + broke + promotion): exactly one lead on Home, Health, Market, Work
- [x] quiet state: goals lead, no tip, no invented urgency; very high vitals show nothing red
- [x] extremes: health 0 with countdown, energy 100, money negative

## Phase 8 — responsive + accessibility: 360 / 390 / 430 captures of every changed surface; labels on every new pressable; `maxFontSizeMultiplier` on new tier-1 text

## Phase 9 — dead code and typography
- [x] delete `CareerPathCard.tsx` (602 L, zero importers), `ui/InfoButton.tsx`, `onboarding/GlassActionButton.tsx`, `AnimatedMoneyNative`
- [x] delete the 148 dead style keys (SettingsModalStyles 111, IdentityCardStyles 11, TopStatsBarStyles 8, …)
- [x] raw font sizes: modal/screen titles at 20–24 → `tier1Title`; hero numbers → `tier1Value`; card titles 16–18 → `tier2`; JailScreen / SmartNotificationCenter bodies → `fontScale()` with scaled line boxes; keep the splash, crash screens, tab-bar label (documented reasons)
- [x] lower `rawFontSizes` and `heavyWeights` ceilings to what is earned

## Phase 10 — red team, walkthrough, scores, report (`tasks/ui-hierarchy.md` §Program 5)

Gates after every phase: type-check · type-check:tests · lint:errors · lint:ratchet · ui:ratchet · check:routes · targeted Jest; full suite + preflight at the end. No ceiling raised, no test skipped.

---

# UI Overhaul Master Program 4 — ASYMMETRY + EDITORIAL HIERARCHY — IN PROGRESS

Branch: `claude/ui-hierarchy-asymmetry-pass-fwqtue`. Programs 1 and 3 are on
`main` (PRs #182, #183). **Program 2 (asymmetry / hierarchy) was briefed and
never implemented** — confirmed: no commit on any branch carries it, the only
mentions are the two "never landed" notes in `tasks/phone-apps-audit.md` and
this file. This program applies that missing judgement to the CURRENT tree.
It does not redo Program 1, undo Program 3, or start another
component-standardization pass. Rules and scales: `tasks/ui-hierarchy.md`.

Auto-safe classes: PURE LAYOUT / VISUAL STYLE / CONTENT PRIORITY / COPY.
Everything that changes what a player can do, what it costs, or what is saved
is out of scope and is called out per screen below as "behaviour: none".

## Phase 1 — repository state (done)
- [x] Program 1 present (Card, StatBreakdownModal, BaseModal, HUD/Home/Work/launcher rebuilds, ui:ratchet)
- [x] Program 3 present (AppHeader, StatStrip/StatTile, Chip, SectionTitle, ProgressBar, KeyValueRow, all 19 apps converted, launcher ErrorBoundary)
- [x] Program 2 missing (no asymmetry work anywhere; every screen still distributes weight evenly)
- [x] `node_modules` installed; baseline web export + screenshots captured for the walkthrough

## Phase 2 — audit findings (done; four independent read-only passes)
- HUD: four saturated fills of equal weight (green cash, indigo gems, blue date, green Next week) → nothing wins; gems (premium currency) reads equal to cash; a value-graded stat colour is computed and never rendered (`TopStatsBar.tsx:245`, comment claims otherwise) so a critical vital looks like a full one apart from the arc.
- Home: IdentityCard is a permanent centred hero (80pt avatar, 2xl name) regardless of state, followed by 4–6 identical list rows of reference data; GoalsCard's three rows are identical in weight though its first row is by construction "the one that matters now"; the lead of the feed never changes with player state.
- Work: no dominant element in any state; hero salary (12.5) is smaller than every list card's (16); the employed job renders twice (hero + its own list card); the hero has no action; screen chrome ("Work", 22/800) is the largest type; `workScreenStyles.ts` has 574 keys of which **7 are used** — 567 dead, 122 of them raw `fontSize` literals (a third of the app-wide 368).
- Health: 14 identical cards; when SICK the three cures are cards 5/7/8 below "Walk in park"; the issues card has the lightest heading on the screen.
- Market: three identical sections; a hungry/low-energy player gets no emphasis on food; a rental row title (18) outranks its section header (17).
- Progress: 50/50 split "hero" (Prestige | Legacy Pass) identical for a pre-prestige player and a level-5 dynasty; achievements completion printed three times.
- Onboarding: MainMenu has a real 48→21→20→17→13→10 ladder (keep). The three wizard screens put a static 24pt header above a 20pt raw-literal CTA above 18pt content — chrome wins.
- Phone apps: 10 of 19 open `banner → StatStrip(3) → SectionTitle → uniform rows`; only Education, Garage and Pulse let state pick what shows first. Weakest five: Crypto, Stocks, Statistics, Luxury, Travel.

## Phase 3 — scales (done: `tasks/ui-hierarchy.md`, tokens in `lib/config/hierarchy.ts`)
- [x] Four-tier weight scale; five-step rhythm scale from `responsiveSpacing`; hierarchy rules

## Phase 4 — main screens (each its own commit; each verified before the next)

| Screen | Problem | Dominant element | State that picks it | Axes | Yields space | Behaviour |
|---|---|---|---|---|---|---|
| HUD | 4 saturated blocks, gems = cash | **Next week** — the only saturated fill | always (primary action) ; a critical vital's number goes danger-red | colour + weight | date box → neutral surface; gems chip → outline; cash chip → neutral surface, white value | none |
| Home | permanent centred identity hero; 3 equal goal rows | **the lead slot**: prestige CTA → urgent tip (health/happiness/energy/money critical) → goal lead row | `isPrestigeAvailable` / `useContextualTip` / GoalsCard row 1 | scale + position + density | IdentityCard → compact left-aligned strip (avatar 48, name, job · status, net worth); its 4–6 reference rows fold into the existing Details disclosure, cash-flow stays visible | none |
| Work | hero without action; job rendered twice; chrome biggest | employed: **the current job hero with its one action** (Promote when eligible, Manage otherwise) ; unemployed: the job board with the lead section open | `canPromote` / `isEmployedHere` / `!currentJob` | scale + position + colour (one CTA) | the employed job's duplicate list card; the 3 local 18pt raw headers → `SectionTitle`; 567 dead style keys | none (same `promoteCareer` / manage sheet) |
| Health | cures buried 5th/7th/8th when sick | sick: **Treatment** (issues + the three cures) leads; healthy: vitals lead | active diseases / critical vitals | position + scale + colour(danger) | cures leave the activities list while promoted (no duplicate) | none |
| Market | hungry player sees Items first | low energy: **Food** leads; else Items | `stats.energy <= 20` (same threshold as HealthIssuesCard) | position + one lead line | housing row title 18 → 16 | none |
| Progress | 50/50 hero, state-invariant | **Prestige** full-width lead; Legacy Pass supporting row | `prestigeAvailable` / claimables promote the sub-line | span + scale | half the hero row | none |
| Onboarding | 24pt static header > 20 CTA > 18 cards | the **CTA** (already the only saturated element) | — | scale | header title 24→18; CTA raw 20 → `fontScale(17)` | none |

- [x] 4.1 HUD
- [x] 4.2 Home (lead slot + IdentityCard strip + GoalsCard lead row)
- [x] 4.3 Work
- [x] 4.4 Health
- [x] 4.5 Market
- [x] 4.6 Progress
- [x] 4.7 Onboarding chrome + shared `ScreenHeader` title to Tier 2

## Phase 5 — phone apps (weakest five only; landing chosen by state, Garage/Education pattern)
- [x] Luxury lands on Collection when anything is owned (Garage rule)
- [x] Stocks lands on Portfolio when holdings exist
- [x] Statistics: net-worth hero first, vitals rings demoted below it
- [x] Crypto lands on the rig console when a rig is running
- [x] Travel lands on the trip when one is in flight

## Phase 6 — primitive gaps (only where hierarchy needs them)
- [x] Button: NOT created — the one primary per screen uses the existing GradientButton; quiet secondary actions use `Chip size="md"`. Recorded in `tasks/ui-hierarchy.md`.
- [x] Chip disabled: NOT added — Spark's gated option chips are the only case and are local by design.
- [x] AppHeader wordmark: NOT added — competes with the screen's dominant element; Spark/Pulse keep their own.
- [x] `StatTile` `hero` stays the one headline-number treatment; no new variant.

## Phase 7 — raw typography
- [x] Delete the 567 dead `workScreenStyles` keys (122 raw sizes) and move the survivors to Tier tokens
- [x] `OnboardingFloatingButton` raw 20 → scaled; `PrestigeStatsCard` raw literals only where they compete (leave the rest — ratchet, not sweep)
- [x] Lower `rawFontSizes` ceiling in the commit that earns it

## Phase 8 — responsive + accessibility
- [x] 360pt / 390pt / 430pt captures (360 found the truncated primary action and a clipped month - the first fixed, the second logged); Dynamic Type via `maxFontSizeMultiplier` on every new Tier-1 text; labels on every new pressable; reduced motion untouched

## Phase 9 — walkthrough (web export + Playwright, fresh save; state variants via render tests) — done, three rounds; `__tests__/render/stateDrivenHierarchy.render.test.tsx`
## Phase 10 — red team + scores + final report (`tasks/ui-hierarchy.md` §Report) — done; red-team fixes in `407e99b`

## Verification per phase
`npm run type-check` · `type-check:tests` · `lint:errors` · `lint:ratchet` · `ui:ratchet` · `check:routes` · targeted Jest; full `npm test` + `npm run preflight` before the final report. No ceiling raised, no test skipped.

---

# UI Overhaul Master Program 3 — THE 19 PHONE APPS — IN PROGRESS

Audit + design matrix + owner decisions: `tasks/phone-apps-audit.md`.
Program 1 blueprint: `tasks/ui-overhaul-blueprint.md`. Program 2 (asymmetry) was
briefed but **never implemented or merged** — nothing on `main` carries it, so
this program builds on Program 1's primitives only.

Auto-safe classes: PURE LAYOUT / VISUAL STYLE / NAVIGATION STRUCTURE. Everything
that changes what a player can do, what it costs, or what is saved is a
PROPOSAL, not a change.

- [x] Phase 1 — Inventory all 19 apps (entry, LOC, header, tabs, lists, modals, primary action, empties, shared vs local, noise, a11y)
- [x] Phase 2 — Group by purpose + design matrix (audit doc §2–3)
- [x] Phase 3 — Shared patterns: headers ×24, tab bars ×21, stat tiles ×30+, chips ×20+, hero recipe ×14, empties ×9 bespoke, modals ×16 raw
- [x] Phase 4 — Shared primitives (convergence, no forks): `AppHeader` (back + title + right chip), `StatStrip`/`StatTile`, `Chip`, `ProgressBar`, `SectionTitle`, `withAlpha`; `SegmentedControl` gets `scrollable`; `EmptyState` adopted; ErrorBoundary once at the launcher
- [x] Phase 5 — Owner decisions written up as PROPOSALS (Vehicle+Luxury, Gaming+Streaming, one Bank; prestige shop tabs assessed) — NOT implemented
- [x] Phase 6 — High-traffic apps: Bank (hero 9→3 numbers, banners off the list), Stocks (Trade CTA reachable from list, Portfolio grid → hero), Spark (5→3 actions, 11 stats → 4, tab double-count), Pulse (one compose, one header, one tab bar), Contacts (Network hero 6→2), Education (card = Study only), Pets (stage diet, 44pt tiles), Hustle (FAB demoted, segment → SegmentedControl)
- [x] Phase 7 — Remaining apps: Crypto (row = one tap), Real Estate (Details btn gone, KPI 6→3, fake gradient), Dark Web (VIEW gone, in-body backs gone), YouVideo (Channel 12 cells → 3), Streaming (one Go Live, one category grid), Travel (tab a11y, boarding-pass chrome), Political (4 CTAs → 1 + list), Statistics (duplicates gone), Vehicle (fleet card = one tap), Luxury (Details gone, Buy/Acquire → Buy)
- [x] Phase 8 — Header + tab convergence across all 19 (AppHeader + SegmentedControl), tabs get role="tab"
- [x] Phase 9 — Launcher hierarchy audit (grid order, badge policy, locked disclosure)
- [x] Phase 10 — Copy pass: one verb per action (Buy not Acquire, Repair not Restore it), no marketing blurbs
- [x] Phase 11 — Empty / error states on the shared EmptyState; ErrorBoundary parity (Pets, Hustle, Travel, Statistics, Luxury, YouVideo, Streaming were unwrapped)
- [x] Phase 12 — A11y + 360pt: unlabeled cash chips labeled, sub-44pt targets raised, tabs a11y-labeled
- [ ] Phase 13 — Regression: type-check, type-check:tests, lint:errors, lint:ratchet, check:routes, ui:ratchet, npm test, preflight; ratchets lowered where earned, never raised
- [ ] Phase 14 — Red team + 13-category scores + 21-item final report (audit doc §9–10)

---

# UI Overhaul Master Program 1 — IN PROGRESS

Blueprint: `tasks/ui-overhaul-blueprint.md` (full forensic audit + 8-phase plan).
Phase status — audit complete, implementation not started:

- [x] Phase A — Forensic audit (screens, navigation, design system, overlay layer)
- [x] Phase A — Redesign blueprint written (14 sections + metric ratchet table)
- [x] Phase 0 — Foundations: StatBreakdownModal chassis (7 modals → 1, −1,600 dup lines), Card/IconBubble primitives (9 rainbow cards → 1 neutral hairline), single stat-color source, dead-code deletion, ui:ratchet gate (gradients / raw font sizes / heavy weights) wired into preflight
- [x] Phase 1 — Kill the noise: interruption budget (≤2 budgeted grants per game week, player-initiated surfaces exempt), tutorial system fully retired (TutorialManager/SimpleTutorialModal/FirstWeekGuide/enhancedTutorialData/TutorialHighlightContext deleted; FirstSessionCoach is the one teaching surface), WeeklyResultSheet removed (LastWeekRecap + Week Summary switch), duplicate find-job CTA + no_job tip + HeroStrip removed, PremiumCrownButton off Home, Home's four visible={false} modals now conditional
- [x] Phase 2 — HUD de-clutter: savings chip folded into one money breakdown (BankBreakdownModal absorbed), gems gesture inversion fixed (tap=breakdown, +=buy), delta arrows + their 90-line prediction memo removed (projections live in the breakdown modals, now all reading computeHousingWellbeing), Help circle → Settings row, labeled flat 'Next week' button, HUD gradients flattened, dead parent week-dot animations removed
- [x] Phase 3 — Home rebuild: GoalsCard (top-3 objectives across chapter/challenge/live-ops/ambition/scenario/catalogue, same pure helpers, detail cards behind a Show-details disclosure), IdentityCard diet (Health Issues → Health screen, duplicate DailyGemClaim + avatar upsell crown removed, gradients flattened)
- [x] Phase 4 — Work rebuild: one promotion readout, ≤3-chip JobCards with fold, 16 button strings → 5, one crime-standing card + one cap line, identical-color gradient killed, InfoButton modals → subtitles
- [x] Phase 5 — Structure: one AppLauncher + shared catalog (computer 901→79 L, mobile 666→81 L, 28 tile gradients + marketing blurbs gone, locked apps behind one disclosure, pet id canonical), Market flattened to one sectioned list (tabs + filter bar + 5-emoji badge taxonomy removed, badges → 1), Gym moved to Health, Family = header action not fake segment, route dedup + one-door-per-room CI guard
- [x] Phase 6 — Progression: 12 modal booleans → one union, 9 tools → 5 (Your Story hub; paywalls out), duplicate achievements + prestige cards dropped, hero tap resolved to one destination that the label names. Onboarding: start ceremony extracted to useStartLife (Play now enters the game directly, no Perks detour), Ambitions dropped from the wizard (4 steps → 3; AmbitionPickerCard on Home covers it), appearance editor behind 'Edit look', locked perks behind a shelf, menu entrance ~1s → ~0.3s
- [x] Phase 7 — Sub-app pass: done as Master Program 3 (primitives + all 19 converted; the three merges are owner proposals in tasks/phone-apps-audit.md §5)

---

# Live Operations — COMPLETE

Shipped on `claude/deep-life-analytics-system-l44b7j`. Reference: `docs/LIVEOPS.md`.

## Done
- [x] Event model, objective registry (logic compiled in; data references ids).
- [x] Validation: caps, dates, schema version, known objectives; drop per-event.
- [x] Lifecycle state machine + grace period; instance ids keyed on the parsed instant.
- [x] Eligibility: stage, life weeks, subscription (both ways), absence, cooldown, staged rollout.
- [x] Rewards: per-event caps, combined value cap, idempotent ledger, rolling weekly budget.
- [x] Compiled-in catalogue: 6 events across the stage range, all validator-clean.
- [x] Remote content: fetch → validate → cache → fallback, two kill switches.
- [x] The claim as a PURE reducer; reporting split from payment in the UI.
- [x] STATE_VERSION 49 + migration + carve-out round-trip row.
- [x] Discovery card on the home screen; no takeover, no permanent countdown.
- [x] Full analytics funnel + a static guard that every step has an emitter.
- [x] 125 live-ops tests; docs + content calendar + operating loop.

## Bugs found and fixed
1. **Instance ids were keyed on the raw date string** — three spellings of one
   instant gave three ids, so republishing an event with a reformatted date
   would have paid everyone who already claimed it a second time.
2. **`trackEventExpired` / `Progressed` / `Completed` had NO callers** — three of
   seven funnel steps were dead, so "did the work and never got paid" and "how
   many had it expire" were both unanswerable. Now emitted from a session
   observer, with a static test that fails CI if a step loses its emitter.
3. **Side effects inside a `setGameState` updater** — `track()` and `setRefusal`
   ran in the reducer, which React may invoke twice.
4. **FNV-1a avalanched poorly on its last byte** (M9 code) — `exp_a`/`exp_b`
   agreed 36% instead of 50%, so two concurrent experiments would not have been
   independent. Added the finalizer.
5. **`ExperimentService` re-hashed a stale pin** while its comment claimed it
   resolved to control — a mid-flight re-bucketing.
6. **The catalogue's returning event failed my own validator** (365-day window),
   which surfaced the real distinction between scheduled and evergreen kinds.
7. **`useLiveOps` was in `lib/`** and imported values from `contexts/`, which the
   layering rule caught. Moved to `hooks/`.

## Deliberately not done
- **No event hub screen.** Today it would be a screen with three rows.
- **No push notifications for events.** The card is a surface the player chooses
  to look at; the return loop should be worth returning to on its own.
- **No server-authoritative validation.** Caps, ledger and budget are enforced
  against the player's own save, so the blast radius is their own save.
