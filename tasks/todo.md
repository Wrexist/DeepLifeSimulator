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

## The object-capture half — also done

`let result = { success: false }` … `return result;`, the same timing defect in
its data-carrying form. All 12 converted to pure preview/commit resolvers:

- RealEstateActions — `installPropertyDecor`, `addPropertyRoom`,
  `upgradePropertyTier`, `buyPropertyWithMortgage`
- PulseActions — `acceptBrandDeal`, `deliverBrandDealPost`, `breachBrandDeal`
- CompanyActions — `buyCompanyUpgrade` (the original C-8)
- BankingActions — `openNewAccount`
- ContactsActions — `askNetworkFavor`
- VehicleActions — `purchaseVehicleWithAutoLoan`
- SparkActions — `promoteMatchToFriend` (outer guards, no resolver needed)

Six took only `setGameState` and no snapshot, so they could not answer their
caller except by reading across the updater boundary. Each now takes
`gameState`; 9 call sites and 8 test files updated.

`breachBrandDeal` carried a "⚠️ DO NOT TRUST THE RETURN VALUE" banner and a
pure `brandDealBreachPenalty` helper built to work around it. The banner is
replaced by the fix it asked for; the helper stays, because quoting the real
penalty on the confirm dialog is worth doing anyway.

`captureSuspects()` is now EMPTY. Its detector is proved on fixtures instead —
a detector that only ever returns an empty list is indistinguishable from a
broken one. Ratchet: 102 → 92.

## Round 3 — the form the detector could not see

Auditing the remaining 92 `suspects()` for unmirrored inner guards turned up
something bigger: my capture detector had been too narrow, so its "zero" was
wrong. It matched only `let x = false` / `= {}` initialisers and only two read
forms (`if (!x)`, `return x;`). **Nine more sites** were carrying the shape:

- `BankingActions::claimAdCashBonus` — `let granted = 0`, so a deferred dispatch
  told a player who had just WATCHED A REWARDED AD "Bonus unavailable right now"
  while the cash landed
- `MailActions` ×4 — `onResolved({ lost })` / `{ recovered }` / `{ outcome }`
  reported 0 or an empty string for money that had moved
- `MiningActions::claimStakingRewards` — "No rewards available yet" for a claim
  that credited
- `LuxuryActions::sellLuxuryItem` — refund figure flipped between the quote and
  the committed value depending on batching order
- `PulseActions::followNpc` — always reported the plain "Following."
- `VehicleActions::processVehicleWeekly` — no production caller (see below)

Plus three functions with NO outer guard at all, so their refusal was
unreportable by construction:

- `RealEstateActions::maintainProperty` — returned `void`; a player who could
  not afford maintenance tapped and got **complete silence**
- `SparkActions::reportProfile` — a second report said "reported and unmatched"
- `PulseActions::followNpc` — a second follow said "Following."

All fixed. `followNpc`'s follow-back roll also moved OUT of the updater, which
it needed anyway: React 19 StrictMode double-invokes updaters, so a
`Math.random()` inside could roll differently on the second pass.

The one survivor is `processVehicleWeekly`, which has no production caller —
the live path is `weekly/applyVehicles.ts`. Pinned BY NAME in the ratchet so
wiring it into the tick trips the test first, and the function carries the same
warning.

Detector widened and proved on fixtures for every read form, including the two
false-positive classes (a local declared inside the updater; a `let` reassigned
before the dispatch, which is what `swipeOnProfile` legitimately does).
Ratchet 92 → 93. Lint ceiling 862 → **860**, lowered with the work.

## Deliberately not done

- Rewriting the 22 boolean-capture sites as preview/commit resolvers too. Where
  every inner rejection already mirrors an outer guard, removing the capture
  gives IDENTICAL reporting for a fraction of the diff — and it is robust to an
  updater that rolls randomness, which a preview/commit resolver is not. The
  resolver form was used exactly where the result carries data the outer guards
  cannot produce.
- Chasing the remaining 92 `suspects()`. That is the ORIGINAL C-8 tail shape
  (reject inside, unconditional success after), and per
  `innerOnlyRejections.test.ts` most mirror an outer guard and are correct on
  the single tap that is almost all real play. A shape worth not adding more of,
  not 92 live bugs.
