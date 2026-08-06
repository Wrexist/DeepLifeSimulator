# 10 features to deepen DeepLife — ranked

Companion to `game-audit-2026-08-05-findings.md`. Every item below hooks a system
that **already exists and already ships**; none is a new pillar bolted on the
side. Where a feature needs a `STATE_VERSION` bump it says so explicitly, per
CLAUDE.md §7.

**Ranking criterion:** `(player impact × fit with existing systems) ÷ build cost`,
with a thumb on the scale for anything that answers *"what am I working toward?"*
— the owner's stated gap.

**The problem being solved, in one line:** the game flattens around week 900–1,100
of a ~4,200-week life, and nothing anywhere is gated on `prestigeLevel >= 2`.

| # | Feature | Impact | Cost | Migration? |
|---|---|---|---|---|
| 1 | Conglomerate / Holding Company | ★★★★★ | M | No | **✅ SHIPPED** |
| 2 | Dynasty Tree (Legacy Points) | ★★★★★ | S–M | No | **✅ SHIPPED** |
| 3 | Prestige-Gated Content Tiers 6–10 | ★★★★★ | S + content | No | **✅ SHIPPED (layer + first tier)** |
| 4 | Legacy Contracts | ★★★★☆ | M | **Yes** | **✅ SHIPPED (v33)** |
| 5 | Career Capstones (Board Seat / Emeritus) | ★★★★☆ | S | No | **✅ SHIPPED** |
| 6 | Luxury Collections & Curator | ★★★☆☆ | S | No | **✅ SHIPPED** |
| 7 | Operating Overhead | ★★★★☆ | M | Maybe | **◐ PARTIAL — made visible, not yet a decision** |
| 8 | Wealth-Scaled Events + Tycoon pack | ★★★☆☆ | M | No | **✅ MECHANISM SHIPPED** |
| 9 | Dynasty Rank, surfaced | ★★★☆☆ | S | No | **✅ SHIPPED** |
| 10 | Grandchildren | ★★★★☆ | M–L | **Yes** | **✅ SHIPPED (v34)** |

---

## 1. Conglomerate — multiple companies per type — ✅ SHIPPED

> **Shipped 2026-08-05** as `lib/business/subsidiaries.ts`: up to 3 companies
> per type, each costing 2.5× the last, so three of everything runs to >$20M of
> foundings against the old $2.47M ceiling.
>
> **The balance risk turned out not to exist**, which is the finding worth
> recording. `PER_SOURCE_CAPS.companies` is a hard **$200k/wk ceiling on total
> company income**, and the five maxed originals already produce ~$238k/wk
> before it. So every subsidiary adds **cost and no income**, and trips the
> existing multi-company efficiency penalty sooner (4+ → 90%, 7+ → 80%,
> 11+ → 70%). The feature is a pure late-game **sink** — exactly what the
> economy audit found missing, since not one existing cost scales with wealth.
> `incomeScale` and `audit:economy` both stayed green.
>
> No migration: the FIRST company of a type keeps the bare `companyType` id, so
> every existing save's companies, upgrades and Hustle overlays keep resolving.
> Only the second onward are suffixed `-2`, `-3`. `buyCompanyUpgrade` already
> looked the catalogue up by `company.type` rather than by id, so subsidiaries
> got the right upgrade tree for free.
>
> Two things needed care. The id, the owned-count and the escalated price are
> all computed OUTSIDE the `setGameState` updater, so the per-type cap is
> re-checked against `prev` inside it (§4.4) — otherwise a concurrent founding
> could buy a third at the second's price. And the create screen quoted the flat
> catalogue cost, which would have advertised a price the action no longer
> charges; it now derives from the same `subsidiaryCost` helper, with a test
> asserting both call sites agree.
>
> Still open from the original proposal: the **Holding Company meta-layer**
> (Shared Services / Group Treasury / M&A Desk upgrades that scale all
> subsidiaries). Deliberately left out — it would add income, which is the one
> thing the cap makes pointless and the one thing that would need a real
> rebalance.


**Hooks:** `contexts/game/company.ts`, `companyUpgradeCatalog.ts`, Hustle app.

Today `id: companyType` means you own at most one factory, one AI lab, one
restaurant, one property firm, one bank. Total cost to 100% completion:
**$12.0M**, with a ~50-week payback. The deepest money engine in the game is
finite and finishes early.

Change the id to `${companyType}-${n}` and add a **Holding Company** meta-layer:
each subsidiary beyond the first costs 2.5× the last, and a Holding Co. upgrade
line (Shared Services, Group Treasury, M&A Desk) scales *all* subsidiaries at
once. The multi-company efficiency penalty in `passiveIncome.ts` already exists
and finally becomes a real trade-off instead of a silent tax.

**Pros**
- Converts the single best system from finite to open-ended — the highest
  structural leverage on this list.
- Exponential cost curve gives an *indefinite* money sink, which §4 of the audit
  identifies as the thing the economy most lacks (not one current sink scales
  with wealth).
- No migration: the ids are new, so old saves keep their single companies and
  simply gain the option to found a second.
- Reuses the entire existing upgrade catalog — new content is mostly numbers.

**Cons**
- Risks making money *easier* if the efficiency penalty isn't tuned hard; must
  ship with `incomeScale` re-run and probably new coverage floors.
- The Hustle app UI assumes one company per type; the list and detail screens
  need real layout work.
- More weekly-tick iteration — watch the nested-loop density ceiling the perf
  audit tracks.

---

## 2. Dynasty Tree — turn Legacy Points into an actual tree — ✅ SHIPPED

> **Shipped 2026-08-05.** Six upgrades / 340 points became **17 nodes across
> four branches** (Wealth, Blood, Name, Craft) with prerequisite edges, running
> 25 → 3,600 for a tree total of ~8,700 — so a 1,000-week life (~5,050 points)
> can buy most of a branch but not the tree. The original six ids are unchanged
> and are now the branch roots, so no existing save loses a purchase. No
> migration: `legacyUpgrades: string[]` already shipped at v29.
>
> **The bigger find along the way:** the shop had no purchase UI at all.
> `purchaseLegacyUpgrade` shipped in `MoneyActionsContext` and the modal showed
> the point balance — but *no screen ever called the action*, so the entire
> system was unreachable in the app. Same class as `getDynastyTier` and
> `lib/automation/`. Added a Dynasty tab to `PrestigeShopModal`, plus a
> reachability test, because this is the third time `lessons.md` has recorded
> "is it called?" being a different question from "does it work?".
>
> Depth goes on the Wealth branch specifically because `prestigeExecution`
> clamps stat and reputation bonuses to 100 — a 900-point "+35 health" node
> would be mostly wasted. Money is the only unclamped effect.
>
> One design correction: my own test asserted "exactly one root per branch". It
> failed, correctly — Blood carries parallel health/fitness lines and Craft
> carries intelligence/happiness, which is a real tree shape and gives a choice
> *within* a branch. The rationale was wrong, not the data; the assertion is now
> the invariant that matters (no branch unreachable or empty).


**Hooks:** `lib/legacy/legacyShop.ts`, `legacyUpgrades: string[]` (already
migrated and repaired at STATE_VERSION 29).

Legacy points accrue **quadratically** — 1,275 by week 500, 5,050 by week 1,000 —
against a shop that costs **340 points in total** and is bought out by week ~260.
The currency is dead for three-quarters of a long life, and from generation 2
onward every heir starts with the whole shop already purchased.

Replace the flat 6-item shop with a **40–60 node tree** across four branches
(Wealth / Blood / Name / Craft), escalating 25 → 25,000, with prerequisite edges.

**Pros**
- Highest content-per-line-of-code on this list. The storage shape (`string[]` of
  owned ids) and the derived-balance pattern (lifetime earned − spent) need
  **zero change** — it is pure data expansion.
- Fixes a currency that is currently inert for 75% of a long life.
- Gives prestige a visible, permanent artifact that survives every reset — the
  clearest possible answer to "what am I grinding toward?"
- Ships incrementally: 15 nodes is already a real feature.

**Cons**
- Needs a tree UI with prerequisite edges; the existing shop list won't do. (The
  skill-tree modal is a usable visual precedent.)
- Balancing 40+ node effects against an economy that already has a 1.5× prestige
  income cap takes real care — easy to accidentally break the cap's intent.
- Big data authoring job, even if the code is small.

---

## 3. Prestige-gated content tiers 6–10 — ✅ SHIPPED (the layer + its first tier)

> **Shipped 2026-08-05** as a SEPARATE axis, not tiers 6–10 on `UnlockTier`.
> The chapter spine saturates early — `unlockTier` returns 5 for anyone who has
> prestiged at all *or* simply reached `weeksLived >= 120` — so extending that
> enum would make the veteran shortcut skip five tiers at once. Progression past
> the chapter arc keys on `prestige.totalPrestiges` instead, via
> `PRESTIGE_UNLOCKS` / `isPrestigeFeatureUnlocked` / `prestigeUnlockRequirement`,
> mirroring the existing API shape (including the deliberate "unregistered id is
> UNLOCKED" default).
>
> Its first entry is `feature:conglomerate` at tier 1: founding a **second**
> company of a type requires having prestiged once. That is the first thing in
> this codebase ever gated on prestige — a repo-wide grep for `prestigeLevel >=`
> previously found only cosmetic UI checks.
>
> The "new content only" rule from the Cons below was respected literally: the
> gate bites on `ownedOfType > 0`, so the first company of every type is
> untouched and no existing player loses anything. Conglomerate itself shipped
> in the same batch, so nobody had it to lose.
>
> **Still open:** tiers 2–5 have no entries yet. The table and the padlock
> plumbing exist; what they need is content, which is what #4/#7/#8/#10 are for.


**Hooks:** `lib/progress/featureUnlocks.ts` (already derives tiers),
`prestige.totalPrestiges`.

The unlock spine hard-stops at `weeksLived >= 120`. **Nothing in the entire
codebase is gated on `prestigeLevel >= 2`** — a repo-wide grep finds only
cosmetic UI checks. Prestige #5 is mechanically identical to prestige #2.

Add tiers 6–10 to the existing `FEATURE_UNLOCKS` table, gated on
`totalPrestiges` rather than chapters: tier 6 = Conglomerate (#1), 7 = frontier
ventures, 8 = the Dynasty board, 9 = Ascension.

**Pros**
- The unlock machinery, padlock copy, requirement strings and "you just unlocked
  X" beat **all already exist** — this is plumbing, not new architecture.
- Directly answers "why prestige a 5th time", which today has no answer.
- Makes every other item on this list land harder, because each becomes a
  *reveal* rather than something present from week 1.
- No migration; `totalPrestiges` is already persisted.

**Cons**
- Worthless on its own — it is a gating layer, so its value is entirely the
  content behind it. Sequence it *with* #1/#2, not before.
- Gating existing content behind prestige would enrage current players; these
  tiers must gate **new** content only.
- Needs care so a returning player with 8 prestiges doesn't get five tiers
  dumped on them at once.

---

## 4. Legacy Contracts — the missing 10-hour goal — ✅ SHIPPED (STATE_VERSION 33)

> **Shipped 2026-08-05.** 14 contracts across five metric chains (prestiges,
> generations, peak net worth, lifetime weeks, companies founded), paying Legacy
> Points into the Dynasty Tree — so #2's supply and this item's demand compose
> into one economy rather than two screens. The longest, "Prestige 25 times", is
> the genuinely multi-session goal the depth audit found missing.
>
> **Progress is DERIVED, not stored** — every metric reads a value the save
> already tracks and that only ever increases. So nothing can drift out of sync,
> a tick that runs twice cannot double-credit, and an existing save loads with
> its contracts already part-complete: a 12-generation dynasty gets credit for
> work it did before this shipped, rather than starting from zero.
>
> Only the claimed ids are stored. Concrete default (`{ claimedIds: [] }`) → a
> REAL migration backfill **and** a `repairGameState` mirror, both tested,
> including a structurally-wrong value and not just a missing key.
>
> Two test corrections were needed, both of the "pinned the wrong thing" kind:
> `luxuryHoldingsMigration` hard-pinned `STATE_VERSION === 32`, making it a
> tripwire that fails on any correct future bump (the C-11 suite had already
> been fixed for this exact reason); and my own suite used `as GameState`
> casts, which Hard Rule #3's static guard flagged — correctly, since a
> spread-and-cast is how a test ends up asserting on a shape that no longer
> exists. It now mutates a `createTestGameState()` instance instead.


**Hooks:** `lib/challenges/weeklyChallenges.ts` (objective/`checkCurrent` shape
is already right), `lib/ambitions/progress.ts` (sticky-milestone reconciliation).

Nothing in the game takes more than a few hours. Ambitions are consumed
permanently (inert after life 8), scenarios pay out on first prestige only,
weekly challenges rotate on a real-time clock and repeat verbatim after ~3
months. **There is no repeatable, scaling, multi-life goal anywhere.**

Multi-objective contracts that persist across prestige and escalate in tiers:
*"Own 3 maxed banks across 3 generations"*, *"Bank $1B in a single life"*,
*"Reach 50 prestiges"*. Paid in Legacy Points, feeding #2.

**Pros**
- The only item here that directly answers "is there anything that takes 10+
  hours?" — the owner's explicit ask.
- Reuses the weekly-challenge objective shape almost verbatim.
- Creates demand for the Legacy Points that #2 creates supply for — the two
  compose into an actual economy.
- Naturally endless: tiers can keep escalating.

**Cons**
- **Needs a migration.** `legacyContracts: {id, tier, progress}[]` has a concrete
  stored default (`[]`), so it takes a real backfill *and* a `repairGameState`
  mirror, plus inclusion in `createTestGameState` — all in the same change.
- Cross-life progress tracking is the fiddliest state in the game; reconciliation
  bugs here would be save-corrupting.
- Risks becoming a chore list if the objectives aren't genuinely interesting.

---

## 5. Career capstones — Board Seat and Emeritus — ✅ SHIPPED

> **Shipped 2026-08-05** on the five advanced ladders (CEO, Research Scientist,
> Creative Director, Investment Banker, Surgeon), which topped out at 13–16
> years of tenure and then never moved again. Two rungs each: **Board Seat** at
> 20 years in the same career and an **Emeritus** title at 30.
>
> Pure data — `experienceRequired` is a shipped field that `promotionGating`
> already enforces, so no new gating logic. The tests drive the real
> `getPromotionEligibility` rather than re-reading the catalogue, so the gate is
> proven to bite at 19 vs 20 years.
>
> Note: this covers the five ADVANCED ladders. Extending the 30 base ladders is
> follow-up — their salaries vary per career, so it is a real authoring job
> rather than a mechanical one.
>
> One existing test needed correcting, not working around: it pinned
> `levels.length` to exactly 6, while its own name and rationale were about
> ladders no longer being *short*. The exact pin made a floor read as a ceiling
> and blocked adding any career tail.


**Hooks:** `lib/careers/promotionGating.ts`, `Career.levels[]`.

36 ladders × 6 rungs, but only 18 of 216 rungs carry an `experienceRequired`
gate, and a base ladder is finished in ~100 weeks. Careers — the thing a life sim
is *about* — have no tail.

Add a 7th and 8th rung to every ladder, unlocked only at 1,500+ weeks of
cumulative career tenure read from `prestige.lifetimeStats.totalWeeksLived`:
**Board Seat** (income continues after retirement) and **Emeritus** (a permanent
account-level bonus).

**Pros**
- Almost entirely data. `experienceRequired` already exists and is already
  enforced by the gating code.
- Cross-life tenure makes prestige *feel* cumulative in the most thematic place
  possible — your career follows you.
- Fixes retirement, which today is strictly *less* content than working (10 elder
  activities, pension capped at $5,000/wk against a $238k/wk empire).
- No migration.

**Cons**
- 36 ladders × 2 rungs = 72 new entries of copy, salary and requirements — real
  authoring effort even though it's "just data".
- Income ceilings move; needs `incomeScale` re-run.
- "Board Seat pays after retirement" interacts with the pension cap and needs a
  deliberate answer.

---

## 6. Luxury Collections & Curator tiers — ✅ SHIPPED

> **Shipped 2026-08-05** as `lib/luxury/collections.ts` (7 sets: four tier sets
> derived from the catalog's own `tier` field, two thematic sets cutting across
> tiers, and the full-catalog Curator set), surfaced in the Luxury app's
> Collection tab and wired into the reputation soft target and hosting payoff.
> No migration — membership is derived from the existing `luxuryItems` id list.
>
> Two balance guarantees are pinned by tests: sets grant **no cash** (luxury
> stays a sink), and the reputation bonus is clamped by the same
> `LUXURY_REPUTATION_CAP` the per-item path already respects.
>
> One design correction during the build: the hosting bonus was initially folded
> into `guests.multiplier`, which broke that field's documented +60% ceiling —
> caught by the existing `hosting.test.ts`. A completed set raises the *host's
> standing*, which is a different concept from *who turns up*, so it now applies
> in `quoteEvent` and deliberately does not scale event **cost** (completing a
> collection must never read as a punishment).


**Hooks:** `lib/luxury/catalog.ts`, the `luxuryHoldings` sidecar
(STATE_VERSION 24), `lib/luxury/hosting.ts`.

The luxury catalog is already the best-designed late-game sink in the repo:
$1.22B of purchases, $255,620/wk *net* drain, yields deliberately held below each
item's own upkeep. It just has no completion meta.

Add **set bonuses** — own all 3 entry-tier items → a Collector title and a
hosting multiplier; own all 12 → **Curator**, with a permanent prestige floor.

**Pros**
- Cheapest real win here. `luxuryHoldings` is an additive sidecar keyed by item
  id, so the bonus layer needs **no migration at all**.
- Collection-completion is a proven grind motivator and fits the fantasy exactly.
- The hosting system already reads the whole collection, so the plumbing exists.
- Makes the game's best existing sink more attractive, which helps §4.4.

**Cons**
- Small on its own — it's a multiplier on existing content, not new content.
- Only meaningful to players already past $100M, i.e. a narrow audience until
  #1/#3 widen the late game.
- Set bonuses that grant income risk undermining the "yields stay below upkeep"
  discipline that makes the catalog work.

---

## 7. Operating Overhead — replace the passive-income soft cap — ◐ PARTIAL

> **Shipped 2026-08-05: the visibility half.** `passiveIncomeEfficiency` and
> `getOperatingOverhead` are exported from `lib/economy/passiveIncome.ts`, and
> the soft cap now derives its multiplier from that SAME helper — so the number
> a readout shows and the number actually charged share one implementation and
> cannot drift, which is the advertised-vs-actual class these audits keep
> finding.
>
> **No balance change.** A test reproduces the original inline math across the
> whole curve as a behavioural oracle, so the refactor is provably
> behaviour-preserving; `incomeScale` and all 512 economy tests stayed green.
>
> **Deliberately NOT shipped: the management purchase ladder** (Group COO,
> property managers, family office) that turns the drag into a decision. That is
> the half that genuinely moves the money axis — it needs `incomeScale`
> re-tuning and new ratchet floors, and it is the wrong thing to bolt on at the
> end of a large branch. The visibility work is its prerequisite and is done.


**Hooks:** `lib/economy/passiveIncome.ts`.

Passive income is silently multiplied by `0.9^floor((netWorth − 10M) / 10M)`,
floored at 0.25. **$10M is also the prestige threshold** — so the economy starts
throttling at exactly the number where the game congratulates you. At $150M net
worth a $238k/wk empire pays $59.5k/wk, for reasons the player is never told.

Swap it for a visible **Operating Overhead**: a weekly cost scaling with
holdings, reducible by *buying management* — a Group COO, property managers, a
family office.

**Pros**
- Same net effect on the curve, but it becomes a **decision with a purchase
  ladder** instead of an invisible tax. The player can fight back.
- Creates exactly the wealth-proportional sink the economy audit identifies as
  entirely absent.
- Removes the game's most demoralising hidden mechanic.
- Composes perfectly with #1 (a conglomerate is what generates overhead).

**Cons**
- **Touches the money axis directly** — the highest-risk item here. Needs
  `incomeScale` re-run, new ratchet floors, and probably a save-compat pass.
- Existing players suddenly see a large weekly cost line that did not exist; this
  needs careful framing or it reads as a nerf even though it is net-neutral.
- May need a state field for purchased management (migration).

---

## 8. Wealth-scaled events + a Tycoon event pack — ✅ MECHANISM SHIPPED

> **Shipped 2026-08-05:** `lib/events/moneyScaling.ts` plus a `moneyPct` field
> on `EventChoiceEffects`, wired into `resolveEvent` in the week loop. A choice
> declaring `moneyPct` resolves to the LARGER of its authored flat figure and
> that fraction of net worth, keeping the flat sign — so an early-game player
> still sees the hand-tuned number and a wealthy one sees something they can
> feel. `money` is a floor, not a default that gets overwritten.
>
> Two caps, neither overridable by a template: any single event is bounded to 5%
> of net worth (so a mis-authored `0.9` cannot wipe a player out) and to $50M
> absolute. That is how percentage-based negative events stop feeling like a bug.
>
> **It is a strict no-op today**, and a test asserts that: no shipped template
> declares `moneyPct`, so all ~400 resolve to exactly `effects.money` as before.
> That is the property that made it safe to land without a rebalance —
> `incomeScale` and `audit:weekly` stayed green.
>
> **Still open: the content.** The ~40-event Tycoon pack (hostile takeovers,
> regulator investigations, activist investors, a $40M lawsuit) is the bulk of
> this item and is not written. The mechanism it needs now exists, and adopting
> it is a one-field edit per choice.


**Hooks:** `lib/events/engine.ts`, the `LifeStagePack` type.

~400 event templates, all with **flat** money effects capped at ±$150,000. A
"$200 unexpected bill" fires at $200M net worth. The best content volume in the
repo becomes rounding noise exactly when the player has the most time to read it.

Add `moneyScale: 'flat' | 'networth'` to event effects, plus a `tycoon` pack
gated on net worth ≥ $50M: hostile takeovers, regulator investigations, activist
investors, a $40M lawsuit, a foundation ask.

**Pros**
- Reuses the weighted picker and life-stage weight boost wholesale; the
  mechanism is genuinely small.
- Restores narrative tension to the flattest stretch of the game.
- Scales forever by construction — no re-tuning as the ceiling moves.
- No migration.

**Cons**
- Writing ~40 good events is the real cost, and event copy is the hardest content
  to write well.
- Percentage-based negative events at high net worth can feel punitive; needs
  caps and probably an insurance/mitigation counterplay.
- Only 3 event chains exist today, so the pack risks feeling like disconnected
  one-shots without chain authoring too.

---

## 9. Surface the Dynasty rank — ✅ SHIPPED

> **Shipped 2026-08-05.** `getDynastyTier` had six ranks and zero consumers —
> a working, persisted, cross-life score no player had ever seen. Now rendered
> in `LegacyOverviewTab` with the score, the band progress, and the distance to
> the next rank, plus three ranks added above Legendary (Storied House,
> Immortal Line, Mythic Dynasty). `calculateDynastyScore` was exported and
> hardened against partial `dynastyStats` (it called `.forEach` on arrays an
> older save may not have).
>
> Thresholds were **derived from the growth curve, not chosen**: my first pass
> used 1,800 / 3,000 / 5,000 and the accompanying test caught that 5,000 is
> unreachable — a deep-but-plausible family (60 generations, $2B combined
> wealth, 15 legendary heirlooms held 30 generations) scores ~2,700. The ladder
> now runs 1,500 / 2,000 / 2,600.


**Hooks:** `lib/legacy/dynasty.ts`, `dynastyStats` (already persisted, already
updated on inheritance).

`getDynastyTier` computes 6 tiers with titles and descriptions from generations,
wealth, reputation and achievements. It has **zero consumers**. This is a
working, persisted, cross-life progression bar that no player has ever seen.

Show it, then add tiers 7–10 above `legendary` at 2,500 / 5,000 / 10,000 / 25,000
dynasty score, each with a permanent account-level perk.

**Pros**
- Nearly free — the calculation ships today and is already fed correct data.
- Gives multi-generational play a legible score, which it completely lacks.
- Natural home on the Progress screen next to prestige.
- No migration.

**Cons**
- Small in isolation; it's a *readout*, and readouts don't hold players by
  themselves. Its value depends on tiers 7–10 having real perks.
- Adding another progression bar next to prestige, Legacy Pass, chapters,
  ambitions and challenges risks worsening the "four parallel objective systems"
  problem the noise audit flags. **Only ship this alongside consolidating those.**

---

## 10. Grandchildren — ✅ SHIPPED (STATE_VERSION 34)

> **Shipped 2026-08-05**, scoped deliberately: grandchildren are LIGHTWEIGHT
> records on `ChildInfo`, not a second full NPC simulation. No NPC careers, no
> NPC marriages, no recursion past one level.
>
> That scope is what defused the two Cons below. Births are rolled inside the
> pass the tick ALREADY makes over children (`applyChildAging`), so no nested
> loop is added — the perf audit tracks nested-loop density in the weekly path
> and it stayed green. `MAX_GRANDCHILDREN_PER_CHILD` makes the tree provably
> finite, with a test that runs 6,000 weeks and asserts the bound holds while
> still producing some.
>
> Births are DETERMINISTIC — a hash of the child's identity and the absolute
> week, no `Math.random` (asserted with a spy) — so reloading a save cannot
> reroll a birth, and different children don't all deliver in lockstep.
>
> Genetic traits pass down one more generation, which is the point: the 13
> authored traits previously terminated at the heir.
>
> Migration is a CARVE-OUT (default `undefined`): version bumped, no backfill,
> no `repairGameState` mirror. Writing an empty array onto every child of every
> save would churn the whole family tree for no behavioural gain. The
> `weeksLived` parameter on `applyChildAging` is optional, so every existing
> caller and test kept working untouched.
>
> **Still open:** the family-tree UI at three generations, and the
> Patriarch/Matriarch activity set. The data and the score input exist.


**Hooks:** `lib/legacy/familyTree.ts`, `lib/parenting/catalog.ts`,
`family.children[]`.

Children age out and simply stop being content. There is nothing for
grandchildren, and the 13 genetic traits already defined and displayed have
nowhere left to go.

Let adult children marry and produce grandchildren with inherited traits, give
the player a Patriarch/Matriarch role with its own activity set, and make living
descendants a dynasty-score input (feeding #9).

**Pros**
- The strongest *emotional* payoff on this list, and the one most on-genre for a
  life sim — the reason players stay past the money game.
- Reuses the genetic-trait system, which is built and currently terminal.
- Makes old age content-rich rather than content-poor, fixing the "retire into
  less to do" problem from a second angle.
- Compounds with #9 and #4 to make multi-generational play the real endgame.

**Cons**
- **Needs new state on `Relationship`** → a real `STATE_VERSION` bump with
  migration, `repairGameState` mirror and `createTestGameState` inclusion.
- Recursive family structures are the easiest place in this codebase to write an
  unbounded loop in the weekly tick — the perf audit's nested-loop ceiling is a
  live constraint.
- The largest design surface here: marriage, careers and lifespans for NPCs the
  player doesn't control.
- Family-tree UI at 3+ generations is a genuinely hard layout problem.

---

## Honourable mention — Ascension (beyond prestige 10)

The prestige point multiplier already stops at level 10. Open an **Ascension**
track above it: each ascension resets prestige bonuses but grants one permanent
perk from a ~25-item pool (*"companies may be founded twice"*, *"the passive soft
cap floor is 0.4"*). This is the structural answer to an endgame that has none,
and the natural home for the tier 6+ unlocks in #3.

Left off the main list only because it is the **largest** item and should follow
#1–#3 rather than lead them — it is most valuable once there is content worth
ascending *for*.

---

## Recommended sequencing

**Wave 1 — cheap, no migrations, immediate.**
#2 Dynasty Tree · #5 Career Capstones · #6 Luxury Collections · #9 Dynasty rank.
All data-only or near-data-only, all reuse shipped state fields.

**Wave 2 — the structural fix. This is where "why prestige again?" gets an answer.**
#1 Conglomerate · #3 Prestige tiers · #4 Legacy Contracts.

**Wave 3 — pacing and tension. Touches the money axis; re-run `incomeScale` and
the coverage ratchet after each.**
#7 Operating Overhead · #8 Wealth-scaled events.

**Wave 4 — big bets.**
#10 Grandchildren · Ascension.

---

## Two things to do *before* Wave 1

Neither is a feature, and both will otherwise undercut everything above.

1. **The interruption queue** (findings §4.1). Seven surfaces can stack on one
   "Next Week" press. Every feature added here adds another popup to an
   unmanaged pile.
2. **Consolidate the objective systems** (findings §5). There are already four
   parallel goal systems on the Home screen alone — Life Chapters, Ambitions,
   Weekly Challenges, and an invisible `goalSystem` that only ever appears as a
   completion popup. Adding Legacy Contracts and Dynasty rank to *that* makes the
   confusion worse, not better. Pick Life Chapters as the spine (it already
   drives `featureUnlocks`) and make the others feed it.
