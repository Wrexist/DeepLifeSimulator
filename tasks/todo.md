# Active plan — the read-out-of-updater class, fixed across the board

## Why

A player report on 2026-08-15 ($40.25M told they needed $10,000) traced to
`manageFamilyBusiness` reading a `didManage` flag it had set INSIDE a
`setGameState` updater. React runs only the FIRST functional update of a batch
eagerly; a second is deferred, so the flag was still `false` at the read and a
successful action reported failure.

That one is fixed. Sweeping `contexts/game/actions/` for the same shape — a
`let x = false` assigned `true` inside an updater and read through `if (!x)` —
finds **27 more**. Every one can report a canned failure for an action that
worked, and every one suppresses the caller's `saveGame()`.

## The fix, and why it is NOT a resolver rewrite

`__tests__/actions/innerOnlyRejections.test.ts` already prescribes the answer
for this class, and it is the one the repo used for `upgradeEnergySystem` /
`buildRDLab`:

> Both are fixed with an OUTER guard, not an outcome capture. A capture is only
> readable for the first update in a React batch. An outer guard has no timing
> dependency at all.

Removing the capture and reporting from the outer guards gives **identical**
reporting to a full pure-resolver rewrite (on a stale double-tap the preview
passes either way), at a fraction of the diff and the risk. It is also robust
to randomness inside the updater, which a preview/commit resolver is not.

So, per function:

1. Enumerate the inner `return prev` guards.
2. For each, confirm an OUTER guard already mirrors it. Where none exists, that
   is a live "reported success for a no-op" bug — add the outer guard.
3. Delete the `let x = false` capture and its `if (!x)` tail.
4. Keep every inner guard: they are the same-batch race protection for STATE.

## Tasks

- [x] Fix the reported bug (`manageFamilyBusiness`) + regression test
- [x] Sweep `contexts/game/actions/` for the same shape — 27 sites found
- [x] PetActions (8 — `petSleep` too; the first sweep missed it because it
      dispatches through the `updatePet` helper rather than `setGameState(` directly): buyPet, feedPet, buyFood, buyToy, playWithPet, payForVet,
      enterCompetition
      - `payForVet`'s "nothing left to do" check was **inner-only** → now
        `vetVisitWouldHelp`, one predicate used inside and out
- [x] ContactsActions (4): recordInteraction, lendMoney, redeemFavor, repayFavor
- [x] TravelActions (3): travelTo, returnFromTrip, doTravelActivity
- [x] PoliticalActions (3): lobby, campaign, hireLobbyist
- [x] PulseActions (3): composePost, endLiveStream, watchAdForFollowerBoost
- [x] RDActions (1 real — `advanceResearch` / `processCompetitionResults` scope their flags INSIDE the updater and were false positives): startResearch, advanceResearch, processCompetitionResults
- [x] SparkActions (3): exposeCatfish, fallForCatfish, resolveJealousy
- [x] MiningActions (1): repairRig
- [x] GameActionsContext (1): `claimProgressAchievement` — the flag gated analytics
      AND the global gold-claim AsyncStorage write
- [x] Regression tests for every outer guard added
- [x] Re-baseline the C-9 ratchet, which certified the guarded-capture shape as
      "fixed" — the premise this bug disproves. It now counts BOTH shapes;
      honest total 102, and the `not.toContain` control is inverted
- [x] Full suite (7,062), type-check, both ratchets, lint, routes

## Found on the way — bugs worse than the wrong message

Six of these flags did not just misreport; they GATED the payout, so a deferred
dispatch applied the cost and skipped the reward:

- `returnFromTrip` — trip cleared, every stat/event-money/passport milestone
  skipped. Now one updater.
- `doTravelActivity` — charged and marked done for the trip, no stat effects.
- `composePost` — post + followers recorded, energy/health/happiness costs and
  the ad revenue never applied.
- `endLiveStream` — session ended and followers banked, tips never paid.
- `exposeCatfish` / `fallForCatfish` / `resolveJealousy` — record written,
  reputation (and the scam debit) skipped.
- `claimProgressAchievement` — gems granted, but `achievement_unlocked` never
  tracked and the cross-install gold-claim record never persisted.

Enabled by a new `applyStatsDelta` in `StatsActions` — the stats counterpart of
`applyMoneyDelta`, so a stat change can fold into an existing updater. There was
no pure stats helper, which is WHY these were separate dispatches.

## Still open — the object-capture half of the same class

`captureSuspects()` in the ratchet lists 12 functions using
`let result = { success: false }` … `return result;`. Identical timing defect.
Several (`installPropertyDecor`, `addPropertyRoom`, `upgradePropertyTier`) take
only `setGameState` and no state snapshot, so they cannot report to their caller
at all without a signature change.

## Deliberately not done

- Rewriting all 27 as preview/commit pure resolvers. Same reporting behaviour,
  much larger diff, and it breaks on any updater that rolls randomness.
