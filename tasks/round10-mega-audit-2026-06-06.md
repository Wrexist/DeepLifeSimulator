# Round 10 Mega-Audit — 2026-06-06

Eight parallel deep-dive audits (navigation, Hermes/startup, performance, state
integrity, game logic/exploits, error handling, type safety, UX/a11y). Below are
the findings that were **fixed** this round. Verified: `npm test` → 2344 passed /
145 suites / 308 snapshots; route-conflict+anchor guard green; no new structural
type errors in touched files.

## CRITICAL

- **Stock & crypto limit/stop orders printed money.** `placeStockLimitOrder` /
  `placeStockStopOrder` / crypto `placeLimitOrder` / `placeStopOrder` validated
  nothing, so a SELL for shares/coins you didn't own filled into pure cash
  (phantom-sell printer), and a BUY beyond your cash filled into free shares
  (the weekly tick's `Math.max(0, money + cashDelta)` floor masked the debt).
  Fixed with placement-time solvency/holdings guards (`canPlaceStockOrder` /
  `canPlaceCryptoOrder`, reserving cash/shares against other open orders) **and**
  an authoritative fill-time sell clamp in both `weeklyTick`s (credit cash only
  for units actually held).
- **IdentityCard home-tab crash.** `currentCareer.levels[currentCareer.level].salary`
  was unguarded; a stale/migrated save with an out-of-bounds `level` crashed the
  default home screen on launch. Now `?.[…]?.salary ?? 0`, mirroring the guard
  already on the job-name line.
- **Karma never fed political scandal risk.** `(prevState.karma as any)?.totalKarma`
  read a field that doesn't exist on `KarmaState` (it's `.score`) → always `0`, so
  a corrupt politician's negative karma never raised scandal exposure. The `as any`
  hid the typo. Fixed to `prevState.karma?.score ?? 0` (+ matching test input).

## HIGH

- **work.tsx career-level crashes + rule-2 violations.** Four unguarded
  `career.levels[…]` accesses (card render, sort comparator, alert) and several
  gratuitous `as any` casts on `CareerRequirements` (which types `fitness`/`items`
  directly) and on advanced careers (typed the map param `AdvancedCareer`, derived
  the display name from `levels[0].name`). All level lookups now guarded.
- **Loan principal double-credited.** `acceptLoan` credited both the deposit
  account balance and `stats.money`; the weekly mirror only syncs `checking-default`
  from `stats.money`, so depositing into any other account double-counted the
  principal. Now credits cash only (the authoritative field).
- **R&D competition entry fees were a pure money sink.** `enterCompetition` charged
  the fee but `processCompetitionResults` had zero callers, so prizes were never
  awarded. Refactored the resolver to a single atomic, idempotent `setGameState`
  updater (prize via `applyMoneyDelta`, marks entries `completed`) and wired it to
  the weekly tick via a `weeksLived`-keyed effect in `CompanyActionsContext`.

## MEDIUM

- **NaN clamp gaps.** Weekly-tick stat caps used `typeof === 'number'`
  (`typeof NaN === 'number'` is true; `Math.max(0, Math.min(100, NaN))` stays NaN);
  switched energy/health/happiness/fitness to an `isFinite` clamp and added a final
  `isFinite` guard on money/reputation. `validateStats`/`clampStatByKey` used bare
  `Math.max(0, v)` for money/gems (also NaN-passthrough); added `sanitizeAmount`.

## PERF (one-line dep-array narrowing on hot, always-mounted screens)

- `work.tsx` `streetJobInterconnections` memo: `[gameState]` → unlock-gating
  primitives (was re-walking the whole interconnection graph every decay tick).
- `FirstWeekGuide.useContextualTip`: dropped `careers`/`stats` object deps, derived
  a `promotionReady` primitive.
- `computer.tsx` `appsList`: `[t, gameState.careers]` → `[t, canRunPolitical]`.

## LOW

- Converted 4 type-only value-imports into the `contexts/game/types` hub to
  `import type` (`familyTree`, `systemInterconnections`, `discoverySystem`,
  `enhancedStatistics`) — removes latent runtime require-cycle landmines.
- `BaseModal` close button: added `accessibilityRole`/`accessibilityLabel`/`hint`
  (fixes the unlabeled-close-button gap across every modal built on it).

## TOOLING

- Extended `scripts/check-route-conflicts.cjs` to also fail when any route group
  has neither an `index` route nor `unstable_settings.initialRouteName` — the
  second launch-crash cause (undefined group anchor) now can't silently ship.
