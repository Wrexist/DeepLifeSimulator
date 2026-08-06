# Weekly Audit — 2026-08-06

Static audit (`npm run audit:weekly`): **all 5 domains green, 0 warnings.**
Dynamic backstops (money-conservation, rental ladder, save-migration, arrears,
housing-wellbeing, RentalActions, longRunSaveLoad, performance): **all green.**
Deep qualitative pass via subagents (economy exploits; stability + logic): done.

## Confirmed finding — fixing

- [x] **Eviction clock resettable via move-out → re-rent** (economy, LOW–MEDIUM).
  `resolveEndRental` wipes the whole `rental` record incl. `missedWeeks`; move-out
  is free; re-renting while `overdueBalance > 0` grants a fresh 4-week clock. This
  is a *second* escape that contradicts the developer's documented invariant
  ("the counter resets the week the balance clears… the only one",
  `RentalActions.ts:86-90`) and defeats the shipped eviction feature (3068ede).
  The tier-**swap** variant was already hardened (d5daaf8); the move-**out**
  variant was left open because it discards `missedWeeks` rather than carrying it.
  - [x] Fix: gate re-entry in `canRent` — a landlord won't sign a new lease while
        the player is in default (`!state.rental && overdueBalance > 0`). Scoped to
        `!state.rental` so tier swaps (which carry the clock) are unaffected.
        Move-out stays free/immediate (the escape hatch), and the debt clears off
        income, so it stays recoverable.
  - [x] Add regression tests (move-out → re-rent blocked while owing; allowed once
        clear; tier swap still allowed while owing).

## Non-blocking (filed in PR description)
- Landlord `housingRentalIncome` is untaxed (bounded, not player-settable) — info.
- `economyIncomeMultiplier` has no upper clamp (not player-reachable) — defensive.
- Eviction notice wording attributes arrears to rent even when the shortfall came
  from other bills — cosmetic.
