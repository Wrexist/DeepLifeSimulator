# Active plan — rentable housing, and the wellbeing it was supposed to provide

Owner ask: rent property for health / happiness / energy bonuses, plus "look for
more necessary features".

---

## What I found while scoping it

The feature is not a nice-to-have. Four things are broken or missing, and they
are the same thing seen from four sides.

1. **There is no way to rent a home.** The tenant path EXISTS —
   `applyRentAndHousing` charges rent for any property with
   `status === 'rented' && !owned` — but nothing in the game ever creates one.
   `operations.ts` only ever sets `status: 'rented'` on the LANDLORD side. So the
   only route to a home is buying one.

2. **Which, after the rebalance, is unreachable for most of a life.** The
   cheapest property is $95 000, i.e. 16.6 years on a bottom-rung wage. So a
   character has no access to housing benefits for the first two decades. The
   rebalance made this worse and renting is the bridge that should always have
   been there.

3. **The HUD promises an energy bonus the tick never pays.**
   `TopStatsBar.tsx:501` adds `currentResidence.weeklyEnergy` to the predicted
   weekly energy change. `processWeeklyHousing` applies `weeklyHappiness` only —
   `weeklyEnergy` has no reader anywhere else in shipping code. Every property in
   the catalogue carries the field (2 to 10 per week) and it has never done
   anything. Advertised-vs-actual, exactly the class the audits keep finding.

4. **Housing has no health effect at all**, and being homeless is free. Living
   nowhere costs nothing, so "get a roof over your head" has never been a goal.

Together these are also the missing recurring cost the last rebalance left open:
rent is the bill the arrears system was built for and never received.

---

## Plan

- [x] `lib/realEstate/rentals.ts` — rental ladder priced against the CURRENT
      income scale (bottom-rung career is $110/wk), so the tier choice is a real
      trade rather than an obvious pick.
- [x] `applyHousingWellbeing` weekly reducer: health / happiness / energy from a
      rental OR an owned residence, and a penalty for having neither.
- [x] Rent flows through the arrears bill line, so an unaffordable week becomes
      a debt instead of being silently forgiven.
- [x] `rentHome` / `endRental` actions, atomic per §4.4.
- [x] State + v32 migration + repair mirror + test-helper entry.
- [x] Pay the energy bonus the HUD has been promising, and give owned residences
      the same health/energy treatment as rentals.
- [x] A "Rent" tab in RealEstateApp.
- [x] Tests: the ladder is affordable-but-not-free at each income tier, homeless
      hurts, bonuses land, and the HUD prediction matches what the tick pays.

## Deliberately NOT in this pass

Found while looking, worth doing, but separate decisions:

- **Utilities/groceries as a second recurring bill.** Rent alone may be enough
  pressure; adding two at once makes neither measurable.
- **Roommates** to split rent in exchange for a happiness hit. Good depth, needs
  its own relationship hooks.
- ~~**Eviction**~~ — approved and shipped, see below.

---

## Shipped

`lib/realEstate/rentals.ts` (ladder + pure helpers), `applyHousingWellbeing`
(weekly reducer), `RentalActions` (pure-resolver shape), v32 `rental` field, and
a Rent tab in RealEstateApp placed BEFORE Browse — for most of a life renting is
the only housing a player can reach, so leading with the unreachable option would
make the screen read as "nothing here for you".

The ladder, priced against the measured income scale ($110/wk bottom rung):

| Tier | Rent | Needs | Health | Happiness | Energy |
|---|---|---|---|---|---|
| Shared Room | $45 | — | 0 | +1 | +1 |
| Bedsit | $80 | $100/wk | +1 | +2 | +2 |
| Rented Studio | $140 | $220/wk | +2 | +4 | +3 |
| City Apartment | $260 | $400/wk | +3 | +6 | +4 |
| Suburban House | $480 | $750/wk | +4 | +9 | +5 |
| Penthouse Lease | $950 | $1500/wk | +5 | +13 | +6 |

Homeless: −2 health, −4 happiness, −5 energy per week. Survivable by design —
over twenty weeks from full health to zero, so "cannot afford rent" is pressure,
never a dead save.

Two calibrations the tests forced, not chose:

- The bedsit asked $120/wk income against a $110 bottom rung, which left a
  minimum-wage worker exactly ONE option. Lowered to $100.
- The first draft of `RentalActions` returned `success: true` outside the
  updater and tripped the C-9 ratchet. Rewritten to the pure-resolver shape the
  ratchet's own header prescribes, so no variable crosses the updater boundary.


---

## Eviction (approved 2026-08-04)

Four consecutive weeks ending in arrears while renting ends the tenancy. Four
matches `ZERO_STAT_DEATH_WEEKS` deliberately — the game already teaches "four bad
weeks and something breaks", and a second number for the same shape of
consequence is just something else to learn.

This is the first thing in the economy that TAKES something away rather than
dragging on a stat, so three properties matter more than the mechanic, and the
tests assert them directly:

- **Announced.** Silent on week one (crying wolf early is how a warning stops
  being read by week three), then a named, counted-down notice from week two,
  shown on the Rent screen as well as in a toast a player may have dismissed.
- **Escapable at every point.** The counter RESETS to zero the week the balance
  clears, so paying what you owe always buys back the full four weeks. There is
  never a week where the player is doomed but still playing — that shape is what
  makes people abandon a save instead of fighting.
- **Recoverable.** Eviction stops the rent but NOT the debt (wiping it would make
  eviction the cheapest way out of a bad month), and the $45 shared room stays
  under the ~$95 a week street work alone brings in.
