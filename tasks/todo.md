# Active plan — three product decisions unblocked (2026-08-01)

The owner chose the "wire it as designed" option for all three systems that
were promising effects no code applied. Each ships as its own commit with its
own regression suite, proved red against the pre-fix tree.

## C-1 — Commitment system: wire the promised bonuses and penalties

The modal already shows the player concrete percentages. `commitmentSystem.ts`
already computes them. Only the call sites are missing: `getEffectiveEnergyCost`
and `getEffectiveProgressGain` have zero production callers, penalties are never
applied, and only hobby XP receives a bonus.

- [x] Add one shared entry point to `commitmentSystem.ts` so all four areas
      resolve bonuses+penalties identically (and a plain multiplier form for
      the career rate chain, which is multiplicative not integer).
- [x] career → `applyCareerProgress.ts` progress rate
- [x] hobbies → `PursuitActions.ts` energy cost (progress already wired)
- [x] relationships → `DatingActions.ts` date energy + relationship boost
- [x] health → `ItemActionsContext.performHealthActivity` energy cost
- [x] Regression suite; prove red; full gate — 15/20 red pre-fix, 418 suites green

## C-2 — Family business: make Brand and Reputation do something

`manageFamilyBusiness` charges for three actions that raise `brandValue` and
`reputation`. `brandValue` is rendered as a meter and read by nothing else;
`reputation` is read by nothing at all.

- [x] Brand scales the business's weekly income
- [x] Reputation shifts event/scandal odds, reusing the `hustleLogic`
      `scandalSpawnChance` pattern rather than inventing one
- [x] Regression suite; prove red; full gate — 3/18 wiring assertions red, 419 green

## C-3 — Legacy Points: a sink

Earned every 10 weeks and from four elder activities; never spent or shown.

- [ ] A small shop spending points on the heir's starting position
- [ ] Surface the balance so the player knows they have it
- [ ] STATE_VERSION bump only if a new stored field is required — check the
      §7 carve-out rules before writing any migration
- [ ] Regression suite; prove red; full gate

## Standing constraints

- Every behavioural fix proved RED against the pre-fix tree before green.
- Every suite carries a control asserting what must NOT change.
- Gate before each commit: `tsc` on both configs (test ratchet 182),
  `eslint --quiet`, full Jest, `npm run audit:weekly` (standing warning 64).
