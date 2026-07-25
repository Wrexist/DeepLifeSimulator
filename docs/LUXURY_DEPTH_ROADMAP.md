# Luxury & Collectibles — Depth Audit and Roadmap

**Status:** Phases 1–5 delivered. See "Delivered" below for what shipped and what
is deliberately still open.
**Scope:** `lib/luxury/`, `contexts/game/actions/LuxuryActions.ts`,
`components/computer/LuxuryApp.tsx`, and every system they should touch and don't.

The complaint driving this: buying a luxury item is a transaction, not an
experience. You pay $120M for a private island, and the island never appears
again except as a line item draining $60,000 a week. Nothing is built on it,
nothing happens there, nothing else in the game knows it exists.

This document is four audits and a five-phase roadmap. Every claim is grounded
in a file path so it can be checked rather than believed.

---

## Delivered

| Phase | What shipped | Where |
|---|---|---|
| 1 | `luxuryHoldings` sidecar (`STATE_VERSION` 24) — per-item state, additive, `luxuryItems` still the ownership source of truth | `contexts/game/types.ts`, `utils/saveMigrations.ts` |
| 2 | The private island mints a real `RealEstate` and inherits the whole property stack. Six estate-scale room additions including a **helipad** and **airstrip** | `lib/luxury/operations.ts`, `lib/realEstate/housing.ts` |
| 3 | Aircraft ladder (helicopter $2.5M → light jet $12M → private jet), pilot licence (`STATE_VERSION` 25), and basing: an airstrip takes the jet from 30% to 60% faster trips | `lib/vehicles/aircraft.ts`, `lib/travel/transportation.ts` |
| 4 | Yield (~54% of upkeep offset) + appreciation, some items gaining and some losing value. Net worth reads the appreciated value | `lib/luxury/catalog.ts`, `contexts/game/actions/weekly/applyLuxuryItems.ts` |
| 4b | Verbs: race the horse, book a track day, loan the diamond. Completion bar retuned from 3 items/$25M to 6/$150M | `lib/luxury/verbs.ts` |
| 5 | Hosting — dinners, parties and galas at venue items, where the REST of the collection decides who turns up. Brand partnerships read the collection | `lib/luxury/hosting.ts`, `lib/social/brandPartnerships.ts` |

**Still open**, deliberately, from Phase 5's original list:

- **Life moments / memories** for big purchases (`lib/lifeMoments/`) — buying the
  island should be a story beat, and is not one yet.
- **Prestige** — a completed collection still means nothing across lives.
- **Luxury-gated events** in `lib/events/` — hosting covers "who comes to your
  party", but there are still no invitations OUT (a gala you get invited to, the
  owners' enclosure, a box at the stadium).

---

# Part 1 — Audits

## Audit A — What luxury actually does today

The whole system is **five touchpoints**. That is the complete list of places
in the codebase where owning a luxury item changes anything:

| # | Where | What it does |
|---|---|---|
| 1 | `LuxuryActions.ts` | Buy: money out, id appended to `GameState.luxuryItems`. Sell: 60% back (`LUXURY_RESALE_FRACTION`). |
| 2 | `GameActionsContext.tsx:1339` | Weekly: `applyLuxuryItemsForWeek` deducts upkeep. |
| 3 | `GameActionsContext.tsx:1349` | Weekly: a reputation **soft target** — a full collection lets reputation drift toward ~84, never pinned. |
| 4 | `lib/progress/achievements.ts:153` | Net worth counts 60% of sticker price. |
| 5 | `achievementsData.ts` (×3) | Three achievements: own 5, hit $100M of luxury, complete "Luxury Life". |

That is it. `grep -rn "luxuryItems"` returns nothing else outside the module,
its tests, and its own UI.

**The shape of the problem:** ownership is stored as `string[]` — a flat list of
ids. There is no per-item state, so there is *nowhere to put* a built house, an
airstrip, a horse's race record, or a painting's appreciation. The data model
itself forecloses depth. Everything in Phase 1 below exists to fix that.

## Audit B — Integration audit: the systems already built that luxury ignores

This is the most actionable finding. The game already contains rich systems that
luxury items should obviously plug into, and the wiring is simply absent.

### B1. Real estate — a full property-development stack, unused by luxury

`lib/realEstate/housing.ts` already implements everything a private island or
penthouse would need:

- `UPGRADE_TIERS` — 4 levels, $10k → $50k, each with rent and upkeep deltas
- `ROOM_ADDITIONS` — 6 buildable rooms (guest room, home office, gym, garden, game room, library) with costs and happiness
- `DECOR_ITEMS` — 16 furnishings across bedroom/living/kitchen/bathroom/outdoor
- `calculatePropertyHappiness`, `calculateMaintenanceCost`, `appreciatePropertyValue`
- `condition` decay + maintenance, neighborhood market cycles (`market.ts`), mortgages (`mortgage.ts`), tenancy and rent-out (`tenancy.ts`)

The `RealEstate` type carries `upgradeLevel`, `rooms[]`, `interior[]`,
`condition`, `currentValue`, `status: 'vacant' | 'owner' | 'rented'`.

**Nothing in luxury references any of it.** The private island ($120M), the
trophy penthouse ($180M) and the vineyard estate ($15M) are all *properties* in
everything but data type. This is the single biggest missed connection in the
feature, and it is the one the roadmap opens with.

### B2. Travel — a transport modifier system with an aircraft-shaped hole

`lib/travel/transportation.ts` → `transportationMods(state)` already combines:

- the **active vehicle's** `speedBonus` (0–50% faster trips), gated on condition ≥ 20 and fuel ≥ 10
- politics policy effects (`travelCostReduction`, `commuteTimeReduction`)

…into `costMultiplier` and `durationMultiplier` for every trip.

A **$65M private jet contributes exactly zero** to this. Neither does the $32M
yacht or the $300M mega-yacht. The player owns the fastest transport in the game
and still travels at civilian speed and civilian prices.

Related gap: `lib/vehicles/vehicles.ts` has `type: 'plane'` in the union and
**no aircraft templates at all** — no helicopter, no plane. The progression the
user described (helicopter → jet) has a slot reserved for it and nothing in it.

### B3. Social — brand partnerships that don't know you own a hypercar

`lib/social/brandPartnerships.ts` exists. Luxury ownership is the most natural
possible input to brand-deal eligibility and rates, and there is no link.

### B4. Life moments / story — no luxury narrative

`lib/lifeMoments/` generates narrative beats and memories. Buying a private
island is one of the largest events in a life and produces no moment, no memory,
no story entry.

### B5. Events — no luxury-gated content

`lib/events/` has no conditions keyed on luxury ownership. There is no gala you
get invited to for owning art, no charity auction, no regatta.

### B6. Prestige — luxury feeds reputation but not prestige

Luxury contributes to a reputation soft target only. The prestige system
(`lib/prestige/`) — the actual cross-life progression — ignores it.

## Audit C — Economy audit

Numbers computed from `lib/luxury/catalog.ts`:

| Metric | Value |
|---|---|
| Items | 12 |
| Total sticker price | **$1,222,550,000** |
| Total weekly upkeep | **$556,820/wk** ($28.95M/yr) |
| Upkeep as % of price | 1.73% – 3.90% per year (median ~2.6%) |
| Resale | 60% of sticker (`LUXURY_RESALE_FRACTION`) |
| Total happiness (all 12) | 36 |
| Total prestige (all 12) | 84 |
| "Luxury Life" completion | 3 items **or** $25M owned |

Findings:

**C1. Upkeep is well-tuned; leave it alone.** ~2.6%/yr is a believable carrying
cost and the comment in the catalog shows it was set deliberately. Nothing in
this roadmap should raise it — new depth must pay for itself in *utility*, not
by making the sink deeper.

**C2. Luxury is 100% dead capital.** Every item is a pure negative-yield asset:
you pay sticker, you lose 40% instantly on resale, and you bleed upkeep forever.
The only return is 1–5 happiness and a reputation drift. For a late-game player
with $1B, that is not a decision — it is a formality. **The fix is not more
happiness. It is making items produce something**: income, access, capability,
or time.

**C3. The completion bar is far too low.** "Luxury Life" completes at 3 items or
$25M — reachable with the two cheapest items plus one more, i.e. ~2% of the
catalog's total value. The screenshot the user sent shows `0 / 3 collectibles`
as the headline goal. The endgame of a $1.2B collection announces itself as a
three-item errand.

**C4. Nothing appreciates.** Art, watches, diamonds and vineyards are the
canonical appreciating assets and all of them are modelled as depreciating
(60% resale, flat forever). Meanwhile `lib/realEstate/housing.ts` already has
`appreciatePropertyValue` and `market.ts` has full cycle machinery.

## Audit D — Interaction audit: the verbs are missing

Count the verbs available on a luxury item today: **Buy. Sell.** That is the
entire interaction surface, and `sell` is a mistake-undo rather than gameplay.

Compare to what the same objects support in the systems they resemble:

| Object | Verbs elsewhere in the game | Verbs in luxury |
|---|---|---|
| Property | buy, upgrade, add rooms, decorate, maintain, rent out, mortgage, sell | — |
| Vehicle | buy, insure, refuel, repair, set active, crash, sell | — |
| Business | found, hire, upgrade, expand | — |
| Luxury item | | **buy, sell** |

A luxury item is currently the least interactive object in the game despite
being the most expensive.

---

# Part 2 — Design principles

Rules the roadmap holds itself to. Each one exists because it is easy to violate.

1. **Every item must earn a verb.** If a phase adds an item with no action
   attached, it has added a line item, not a feature.
2. **Utility over stats.** Depth must come from *capability* (access, speed,
   income, unlocks), not from bigger happiness numbers. Stat inflation is the
   lazy version of this and it is explicitly out of scope.
3. **Reuse, don't rebuild.** The island reuses `lib/realEstate/housing.ts`. The
   jet reuses `transportationMods`. Every new subsystem is a bug farm; every
   reused one is already tested.
4. **Never a trap.** A player who buys a thing and ignores it must not be
   punished beyond the upkeep they already agreed to. Depth is opt-in.
5. **Old saves keep working.** Every new field is optional; every migration
   backfills. See the migration rule in `CLAUDE.md` — new `initialState` fields
   need a `STATE_VERSION` bump, a migration, `repairGameState` backfill, and
   inclusion in `createTestGameState`.
6. **Sinks stay sinks.** Making luxury productive must not turn it into the best
   ROI in the game. Target: a fully developed collection roughly *breaks even*
   on upkeep, so it stops being a pure drain without becoming an income engine.

---

# Part 3 — Roadmap

Five phases, ordered so each one is shippable alone and unblocks the next.

---

## Phase 1 — Per-item state (the foundation)

**Problem it solves:** `luxuryItems: string[]` has nowhere to store anything. No
other phase is possible until this changes.

**Steps**

1. Introduce `luxuryHoldings?: Record<string, LuxuryHolding>` on `GameState`,
   where `LuxuryHolding` carries at minimum:
   `{ acquiredWeek: number; condition?: number; currentValue?: number; upgrades?: string[]; propertyId?: string; }`
2. Keep `luxuryItems: string[]` as the **ownership source of truth**. The new
   record is an additive sidecar keyed by the same ids — so every existing
   consumer (net worth, achievements, upkeep, the completion check) keeps
   working untouched.
3. Migration: `STATE_VERSION` 23 → 24. Backfill `luxuryHoldings` for anything
   already in `luxuryItems` with `acquiredWeek: 0, condition: 100`.
4. Mirror the backfill in `repairGameState` (`utils/saveValidation.ts`) and add
   the field to `__tests__/helpers/createTestGameState.ts`.
5. Sync `DEV.md` / `WORKFLOW.md` (they carry the canonical `STATE_VERSION`).

**Files:** `contexts/game/types.ts`, `contexts/game/initialState.ts`,
`utils/saveMigrations.ts`, `utils/saveValidation.ts`, `lib/luxury/operations.ts`,
`__tests__/helpers/createTestGameState.ts`, `DEV.md`, `WORKFLOW.md`

**Risk:** low-medium — it is a save-format change, which is the highest-blast-radius
kind. Mitigated by keeping the old array authoritative.

**Done when:** an old save loads, reports identical net worth and achievements,
and gains a populated `luxuryHoldings`.

---

## Phase 2 — The island becomes real estate (the user's headline ask)

**Problem it solves:** you buy a $120M island and cannot set foot on it.

**Design:** certain luxury items are *land*. On purchase they mint a real
`RealEstate` entry and hand the player the entire existing property stack.

**Steps**

1. Add `developable?: { propertyName: string; baseValue: number; slots: number }`
   to `LuxuryItem`. Applies to: `private_island`, `vineyard_estate`,
   `trophy_penthouse`.
2. On purchase of a developable item, create a `RealEstate` with
   `owned: true, upgradeLevel: 0, rooms: [], interior: []` and store its id in
   the holding's `propertyId`.
3. Surface the existing property UI for it: `UPGRADE_TIERS` (build out the
   compound), `ROOM_ADDITIONS`, `DECOR_ITEMS`, maintenance and `condition`.
4. Add island/estate-flavoured entries to `ROOM_ADDITIONS` — a boat house, a
   staff wing, a helipad *(this is the hook Phase 3 needs)*, a private dock, a
   vineyard cellar.
5. Let the developed island count toward property happiness and appreciate via
   `appreciatePropertyValue`, so development converts dead capital into a real
   asset — directly answering Audit C2 and C4.
6. Optional stretch: `status: 'rented'` — charter the island out when you're not
   there, using the existing `tenancy.ts` rent flow.

**Files:** `lib/luxury/catalog.ts`, `lib/luxury/operations.ts`,
`contexts/game/actions/LuxuryActions.ts`, `lib/realEstate/housing.ts`,
`components/computer/LuxuryApp.tsx`

**Risk:** medium — touches the real-estate list, which the Real Estate app also
renders. Needs care that a luxury-minted property doesn't appear as a normal
buyable listing.

**Done when:** buying the island produces a property you can upgrade, furnish
and maintain, and the Real Estate app shows it as owned.

---

## Phase 3 — Aircraft: helicopter → airstrip → jet (the user's second ask)

**Problem it solves:** the $65M jet does nothing, and there is no rung below it.

**Steps**

1. **Add aircraft to the vehicle catalog.** `lib/vehicles/vehicles.ts` already
   has `type: 'plane'` in the union and zero templates. Add:
   - **Helicopter** (~$2.5M, the cheaper step the user asked for) — high
     `speedBonus`, high `weeklyFuelCost`, needs a helipad to be based anywhere
   - **Turboprop / light jet** (~$12M) — the rung between helicopter and the
     $65M private jet
2. **Add a pilot's licence**, mirroring `hasDriversLicense`
   (`contexts/game/types.ts:2158`) — `hasPilotLicense?: boolean`, bought through
   education like the driving licence. This is the gate that makes aircraft feel
   earned rather than purchased.
3. **Build the airstrip.** A room addition / upgrade on a developable property
   (Phase 2). Owning `private_jet` **without** somewhere to base it means it
   costs full upkeep and gives reduced benefit; with an airstrip it is fully
   operational. This is the exact mechanic the user described and it makes two
   separate purchases combine into a third thing.
4. **Wire aircraft into `transportationMods`.** Extend it to read owned aircraft
   and luxury air assets, not just `activeVehicleId`. A jet should cut trip
   duration hard and trip cost not at all (fuel is expensive) — a *time* saving,
   which is the scarcest resource in a life sim.
5. Helipad on the yacht/mega-yacht — the catalog descriptions already mention a
   helipad on the mega-yacht.

**Files:** `lib/vehicles/vehicles.ts`, `lib/travel/transportation.ts`,
`contexts/game/types.ts`, `lib/realEstate/housing.ts`, `lib/luxury/catalog.ts`

**Risk:** medium — `transportationMods` feeds trip pricing; changes there need
balance tests so a jet doesn't make travel free.

**Done when:** a helicopter is buyable at a mid-game price, a licence gates it,
an airstrip can be built, and owning a jet visibly shortens trips.

---

## Phase 4 — Items that produce, not just cost

**Problem it solves:** Audit C2 — every item is negative-yield.

Per-item verbs, each reusing an existing system:

| Item | New verb | Reuses |
|---|---|---|
| `racehorse` | **Race it.** Entry fee, seeded odds off condition/training, purse + reputation on a win. A trainable asset with a record. | `lib/randomness/deterministicRng` |
| `fine_art_collection` | **Appreciates.** Value drifts with a market cycle; sell high. | `lib/realEstate/market.ts` cycles |
| `rare_watch_collection` | **Appreciates + wearable** — a small reputation bonus in social/dating/business contexts. | market cycles + reputation |
| `vineyard_estate` | **Produce vintages.** Seasonal yield → weekly income, quality varies by year. | weekly tick |
| `luxury_yacht` / `mega_yacht` | **Charter it out** when unused — offsets upkeep. | `tenancy.ts` rent model |
| `sports_team_stake` | **Season performance** — a seeded season, playoff runs, dividend on a good year, reputation swings. | weekly tick + events |
| `private_island` | **Host events** (see Phase 5). | events |
| `trophy_penthouse` | **Host events**, plus a real-estate-grade appreciation. | Phase 2 |
| `museum_diamond` | **Loan to a museum** — a small fee and reputation while on display; unavailable to sell while loaned. | new, small |
| `supercar` | **Track days** — reputation, small crash risk. | `lib/vehicles/accidents.ts` |

**Balance target (principle 6):** a fully developed collection should roughly
break even against its $556,820/wk upkeep — not turn profitable.

**Risk:** medium-high — this is the largest phase and the easiest to over-tune.
Ship item-by-item, each behind its own tests.

---

## Phase 5 — The collection becomes a social life

**Problem it solves:** Audits B3, B4, B5 — luxury is invisible to the rest of
the game's world.

**Steps**

1. **Host events.** With an island/penthouse/yacht, throw a party: costs money,
   grants reputation, relationship gains with attendees, chances at NPC and
   business opportunities. Reuses `lib/events/`, relationships, `lifeMoments`.
2. **Luxury-gated invitations.** Owning art gets you into a gala; the racehorse
   gets you into the owners' enclosure; the team stake gets you a box. Content
   that *only exists* because of what you own.
3. **Brand partnerships.** Feed luxury ownership into
   `lib/social/brandPartnerships.ts` — a hypercar and a watch collection make
   you a different proposition to a brand.
4. **Life moments + memories.** Buying the island, winning with the horse, the
   first flight in the jet all become story beats via `lib/lifeMoments/`.
5. **Prestige.** A completed collection should mean something across lives.
6. **Raise the completion bar** (Audit C3) — retune "Luxury Life" so it reflects
   a real collection, with intermediate milestones so it stays motivating.

**Risk:** low-medium, mostly additive content.

---

## Sequencing

```
Phase 1 (state)  ──┬── Phase 2 (island → real estate)  ──┬── Phase 3 (aircraft, needs helipad/airstrip)
                   │                                     │
                   └── Phase 4 (productive items)  ───────┴── Phase 5 (social, events, prestige)
```

Phase 1 blocks everything. Phase 2 unblocks Phase 3's airstrip. Phases 4 and 5
are independent of each other and can ship item-by-item.

**Recommended first slice:** Phase 1 + the `private_island` half of Phase 2.
That is the smallest change that turns a purchase into a place, and it proves
the sidecar-state pattern before anything else depends on it.

---

## Appendix — per-item opportunity matrix

| Item | Price | Developable | Produces | Social | Transport |
|---|---|---|---|---|---|
| Rare Watch Collection | $250K | — | appreciation | wearable rep | — |
| Museum-Grade Diamond | $600K | — | loan fee | museum credit | — |
| Fine Art Collection | $1.2M | — | appreciation | gala access | — |
| Hypercar | $2.5M | — | — | track days | small speed |
| Thoroughbred Racehorse | $6M | stable | race purses | owners' enclosure | — |
| Vineyard Estate | $15M | **yes** | vintages | tastings | — |
| Luxury Yacht | $32M | helipad | charter | parties | sea travel |
| Private Jet | $65M | needs airstrip | — | — | **big time saving** |
| Private Island | $120M | **yes** | charter | parties | needs airstrip/dock |
| Trophy Penthouse | $180M | **yes** | appreciation | parties | — |
| Mega-Yacht | $300M | helipad | charter | parties | sea travel |
| Pro Sports Team Stake | $500M | — | season dividends | box seats, huge rep | — |
