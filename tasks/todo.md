# Active plan — three product decisions unblocked (2026-08-01) — ALL THREE SHIPPED

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

- [x] A small shop spending points on the heir's starting position
- [x] Surface the balance so the player knows they have it
- [x] STATE_VERSION bump only if a new stored field is required — check the
      §7 carve-out rules before writing any migration
- [x] Regression suite; prove red; full gate — 26 new assertions, 420 suites green

## C-4 — Progressive disclosure (owner decision, 2026-08-01)

Pace unlocks by the five life chapters; show locked features with their
requirement rather than hiding them; a new player starts on Home / Life /
Work / Health.

- [x] `lib/progress/featureUnlocks.ts` — the table + a DERIVED tier (never
      stored, monotonic, three signals with the max winning)
- [x] Computer and phone app grids gate per app: dim, padlock, explain on tap
- [x] Chapter completion moved into the week tick (`applyChapterProgress.ts`)
      so the unlock spine no longer depends on the player opening a card
- [x] `LifeChapterCard` made read-only, claim handler deleted
- [x] Corrected `tab:apps` / `tab:mobile` / `tab:computer` from tiers 1/1/2 to
      tier 0 — the layout's `ownsAnyDevice` gate is the right one, and a
      chapter tier would have locked a player out of a phone they had bought
- [x] Life → Stats gated at tier 1 via new optional lock support on the shared
      `SegmentedControl`; Health and Market never gated
- [x] Regression suites; proved red (4 + 3 assertions); full gate

Remaining, deliberately not done: nothing further. The four bottom-bar entries
are Home / Work / Life / Apps, and Apps is correctly gated on device
ownership, so the owner's "week 1 shows Home/Life/Work/Health" is satisfied —
Health is Life's default segment.

## Standing constraints

- Every behavioural fix proved RED against the pre-fix tree before green.
- Every suite carries a control asserting what must NOT change.
- Gate before each commit: `tsc` on both configs (test ratchet 182),
  `eslint --quiet`, full Jest, `npm run audit:weekly` (standing warning 64).
