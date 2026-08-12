# Plan — Make lobbyist specialty real (option A)

## The finding

Three facts, each re-verified:

1. `calculateTotalLobbyistInfluence` (`lib/politics/lobbyists.ts:153`) is the only
   reader of `Lobbyist.specialty` in the repo, and it has **zero call sites**.
2. `PoliticalApp.tsx` advertises the specialty three times (`:887`, `:936`,
   `:1373`), so the player picks a lobbyist on a distinction the game does not
   implement.
3. `PolicyType` is declared **twice** and they diverge — 5 members in
   `lobbyists.ts`, 11 in `policies.ts`. That divergence is *why* the targeting
   was never wired: 7 of the 11 policy types have no possible specialist.

## Design

`policyInfluence` is NOT repurposed. It has three other consumers — the
`Influence` StatCard (`PoliticalApp.tsx:486`), an achievement at `>= 50`
(`achievementsData.ts:1311`), and an event effect (`lib/events/engine.ts:53`) —
and its discount was itself a recent fix for a dead stat. Taking the discount
away from it would re-open that exact hole.

So the targeted discount **stacks on top** rather than replacing:

```
base     = min(0.25, policyInfluence / 100)          // unchanged, every existing source
targeted = min(0.15, matchedLobbyistInfluence / 100) // NEW: only lobbyists who match
discount = min(0.35, base + targeted)
```

- No existing save loses a single point of discount — `base` is byte-identical.
- A matching specialist is now worth more on its policy type than off it, which
  is precisely what the three UI strings already claim.
- Generalists (`'all'`) match everything, consistent with their price and copy.

**No `STATE_VERSION` bump.** Specialty is catalogue data keyed by lobbyist id;
`calculateTotalLobbyistInfluence` already derives from ids, so nothing new is
persisted and existing saves work untouched.

## Steps

- [x] 1. `lib/politics/policies.ts` — no change; it owns the canonical `PolicyType`.
- [x] 2. `lib/politics/lobbyists.ts` — delete the duplicate 5-member `PolicyType`,
      re-export the canonical 11-member one from `policies.ts`. Root cause.
- [x] 3. `Lobbyist.specialty: PolicyType` → `specialties: readonly LobbyistSpecialty[]`
      (`LobbyistSpecialty = PolicyType | 'all'`). The catalogue descriptions already
      name multi-type coverage ("Great for social and economic policies") that the
      singular field could not express.
- [x] 4. Retag the catalogue from its **own existing names and descriptions** — no
      invented coverage. Add specialists for the types left genuinely uncovered.
- [x] 5. `calculateTotalLobbyistInfluence` — read the array; keep the `'all'` wildcard.
- [x] 6. `PoliticalActions.enactPolicy` — stack `targeted` onto `base`. Must be
      recomputed from `prev` inside the updater as well as the snapshot pre-check
      (CLAUDE.md §4.4) — the existing `influenceCost` closure already does this and
      must keep doing it.
- [x] 7. `PoliticalApp.tsx` — the three sites print the specialty list, and the
      policy card shows the discount actually applied.
- [x] 8. Tests: targeting changes the price; a non-matching specialist does not
      discount; every `PolicyType` has at least one catalogue specialist (the guard
      that stops the two lists diverging again); no existing player loses discount.

## Verification

```
npm run type-check && npm run type-check:tests
npx jest __tests__/politics lib/politics __tests__/economy/gateThenGrantAtomicity.test.ts \
         __tests__/stress/legacyPulsePoliticsFlow.stress.test.ts \
         __tests__/stress/fallbackOperatorSweep.stress.test.ts \
         __tests__/actions/runForOfficeRace.test.ts
npx jest __tests__/render   # PoliticalApp is a rendered screen
```

## Done — 2026-08-12

All eight steps landed. Verification actually run:

- `npm run type-check` — clean
- `npm run type-check:tests` — clean (baseline stays 0)
- `npm run lint:errors` — clean
- `npx jest lib/politics __tests__/economy/gateThenGrantAtomicity.test.ts
  __tests__/actions/runForOfficeRace.test.ts __tests__/progression/inertBonusesWired.test.ts
  __tests__/refactor` — 541 passed, 1 skipped
- `npx jest __tests__/render __tests__/stress/legacyPulsePoliticsFlow.stress.test.ts
  __tests__/stress/fallbackOperatorSweep.stress.test.ts` — 390 passed
- `npm test -- --ci` — **536 suites / 6,768 tests passed**, 1 skipped

New coverage: `lib/politics/__tests__/lobbyistSpecialty.test.ts` (18) and
`__tests__/economy/policyDiscountTargeting.test.ts` (11).

Left deliberately untouched: `VoteCard` still prints the sticker price, because
it renders bills that are ALREADY enacted — a discount quote on a historical
purchase would be noise.
