# R7 Phase 2 step 2.2a — pet weekly tick extracted (complete)

> Second extraction in the `nextWeek()` refactor. Same pattern as step 2.1: snapshot baseline first, extract verbatim, verify zero drift.

---

## What landed

| File | Change |
|---|---|
| **NEW** [contexts/game/actions/weekly/applyPets.ts](contexts/game/actions/weekly/applyPets.ts) | Exports `tickPetsForWeek(prevPets, rolls)` — the pure pet-per-week update map. Byte-faithful copy of the previous inline `.map()` body. |
| [contexts/game/GameActionsContext.tsx](contexts/game/GameActionsContext.tsx) | Pet `.map()` body (~57 lines) replaced with a 4-line `tickPetsForWeek(prevState.pets, {...})` call. Surrounding side-effect blocks (death notifications, alive-pet happiness bonus) stay inline. |
| [__tests__/refactor/subsystemEquivalence.test.ts](__tests__/refactor/subsystemEquivalence.test.ts) | 4 new tests covering empty / undefined / null inputs + a 7-pet "all code paths" case (healthy / hungry / starving / sick / dying / dead / elderly). |

---

## Why scope shrunk from "pets + vehicles" to "pets only"

The original Phase 2 step 2.2 was "pets + vehicles in one batch." After reading the actual code, the scope had to shrink:

- **Pets**: the per-pet `.map()` body has NO side effects on `newStats` / `pendingNotifications`. The downstream blocks DO have side effects but live AFTER the map. Clean extraction target.
- **Vehicles**: the per-vehicle `.map()` body mutates `newStats.money` (weekly cost), pushes to `pendingNotifications` (accident), and mutates `newStats.health` + `newStats.money` again (accident damage). Cleanly extracting it requires the `WeekContext` shape from the audit plan's section B that hasn't been built yet.

Splitting into 2.2a (pets, this step) and 2.2b (vehicles, future) keeps each step's risk low and snapshot battery green.

---

## Why this is safe

Same three layers as step 2.1:

1. **Source identity.** The new `tickPetsForWeek` is a verbatim copy of the inline map body — same conditions, same constants, same destructured `preRolls` indices. The `PET_LIFESPANS` lookup, the sickness type array, the death-threshold logic — all unchanged.
2. **Type-check clean.** `tsc --noEmit` → exit 0, 0 errors.
3. **Zero snapshot drift.** Snapshots captured BEFORE the GameActionsContext change (test added against the new exported helper). After the change: 46/46 pass with no diffs.

One trade-off: the helper's input type is `PetTickRolls = { petSickness: number[]; petSicknessType: number[] }` — a narrow slice of `PreRolls` rather than the full object. This makes the helper testable in isolation and the call site explicit about which rolls each subsystem consumes.

---

## What stays inline (deferred)

The two blocks AROUND the extracted `.map()` still live in `GameActionsContext.tsx`:

1. **Newly-dead pet penalty + notifications** (lines ~1968-1974 in the new layout):
   ```ts
   const newlyDeadPets = updatedPets.filter(p => p.isDead && !(prevState.pets || []).find(op => op.id === p.id)?.isDead);
   if (newlyDeadPets.length > 0) {
     newlyDeadPets.forEach(pet => {
       newStats.happiness = Math.max(0, newStats.happiness - 20);
       pendingNotifications.push({...});
     });
   }
   ```
2. **Alive-pet happiness bonus** (lines ~2027-2033):
   ```ts
   const alivePets = updatedPets.filter(p => !p.isDead);
   const petHappinessBonus = alivePets.reduce(...);
   if (petHappinessBonus > 0) {
     newStats.happiness = Math.min(100, newStats.happiness + petHappinessBonus);
   }
   ```

Both mutate `newStats` and `pendingNotifications` — the audit plan's `WeekContext` shape (a structured sink for stat deltas + notifications) is the right home for these. They move out in step 2.3 (the `WeekContext` setup step) or 2.6 (relationships/family/etc., where similar side effects converge).

---

## Verification

```
npx tsc --noEmit -p tsconfig.typecheck.json   → exit 0, 0 errors
npx jest __tests__/refactor --runInBand        → 51 passed, 46 snapshots passed (zero drift)
npx jest __tests__/startup --runInBand         → 64 passed
npx jest __tests__/integration --runInBand     → 96 passed (zero regression)
```

Total: 211 tests across the three suites, 46 snapshots, zero drift.

---

## Next: Phase 2 step 2.2b — vehicles (via WeekContext)

Vehicles need the `WeekContext` shape before they can be extracted cleanly. Options:

- **Step 2.2b (immediate):** stand up a minimal `WeekContext` interface — `{ newStats: GameStats; pendingNotifications: Notification[]; }` — and a mutating helper signature `applyVehicleTickWeek(prev, rolls, ctx) => Vehicle[]`. Extract vehicles with the mutating side-effect pattern. This unlocks subsequent extractions (relationships, family, etc.) that all share the same need.
- **Defer to step 2.3:** combine the WeekContext setup with the first cross-cutting reducer (e.g. relationships). Vehicles join the pipeline at that point.

Recommendation: do the minimal WeekContext setup as step 2.2b. It's a small surface area and unlocks every remaining extraction. Estimated 1-2 hours.

Alternatively, the user can pick a different priority (e.g. the network/sync items from Phase 5, or the documentation queue items SB-1 / SB-2 / SB-5 / Phase 3 from `tasks/round7-phase1-action-items.md`).
