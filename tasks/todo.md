# Active plan — act on the 2026-08-04 critical review

Source: `tasks/critical-review-2026-08-04.md`. Every item below names the chosen
solution and why it beats the alternatives. Items judged NOT worth fixing are
listed at the bottom with the reasoning, so the decision is on the record.

---

## 1. A-1 — the stock walk has no drift, so every market collapses

**Chosen: log-normal step with an explicit drift target.**

`price *= (1 + z·σ)` is zero-mean *arithmetically*, which is −σ²/2 *geometrically*.
Adding a compensating `+σ²/2` would only make it flat. A market that is flat in
expectation is still not worth investing in — the whole point of the asset class
is a risk premium. So: switch to `price *= exp(μ + σ·z)` where `μ` is the
intended weekly LOG drift, set from one readable annual figure.

Rejected: bumping σ down (hides the bug, doesn't fix the sign); clamping the
price floor higher (treats the symptom).

- [x] `MARKET_ANNUAL_DRIFT` constant, converted to a weekly log drift
- [x] `simulateWeek` uses `exp()`, so the price can never go negative and the
      drift means what it says
- [x] Regression test that runs 520 and 3 120 weeks and asserts the MEDIAN
      buy-and-hold multiple lands in a sane band — the assertion the old suite
      never had

## 2. A-2 — `resetStockPrices` has no production caller

**Chosen: call it where its own docstring says it should be called.**

- [x] Reset on new game and on prestige
- [x] Test that a fresh life does not inherit the previous life's prices

## 3. A-3 — the inflation system never runs

**Chosen: wire it in AND index career pay by the same index.**

Deleting it would silently drop effects three policy cards advertise. But wiring
it in alone makes A-5 worse: prices climb while nominal wages are frozen, so a
60-year life ends with a 6× cost of living on a 1985 paycheck. Indexing pay by
the same `priceIndex` makes baseline inflation neutral in real terms (correct)
and leaves the *policy-driven* deviation as the thing the player actually feels.

- [x] `applyWeeklyInflation` runs in the weekly tick
- [x] `applyCareerSalaryAndPenalty` scales pay by `priceIndex`
- [x] Test: the index moves over a played year, and real wages hold

## 4. A-7 — the daily-login gate is still farmable forward

**Chosen: require game-week progress between claims.**

A device clock cannot be trusted and there is no monotonic wall-clock on RN
without a native module, so no amount of day-key cleverness closes this. Gate on
something the player can only advance by playing: `weeksLived`. A legitimate
player who opens the app and plays one week is unaffected; a clock-scrubber gets
exactly one claim per week actually played.

- [x] `lastLoginRewardWeek` (undefined default → carve-out, no backfill)
- [x] Gate checks it, both at the render-time guard and inside the updater
- [x] Test: same game week → no second claim, however the clock moves

## 5. A-4 — unpaid bills are silently forgiven; no fail state on money

**Chosen: an arrears bucket, not negative cash.**

Letting `stats.money` go negative would break the `Math.max(0, …)` and
overdraft-reject invariants at ~40 call sites. Instead the shortfall becomes a
debt that is paid off the top of next week's income and that damages credit
while it stands.

- [x] `overdueBalance` (concrete default `0` → real migration + repair mirror)
- [x] Tick books the shortfall instead of clamping it away
- [x] Arrears are settled first next week, and hit the credit score
- [x] Surfaced in the weekly finance summary so it is visible, not silent

## 6. A-5 — the bottom half of the career ladder is off by ~10×

**Chosen: one rule, applied to the data — no ladder starts below a living wage.**

Advanced careers are annual÷52; base careers are not, so a line cook reads
$2 080/yr next to a $95 000 studio and street jobs that pay ~$700/wk. Scale each
under-scaled ladder by a single factor so its FIRST rung meets a floor, which
preserves each ladder's internal shape (and the monotonicity the existing test
pins).

- [x] `MIN_ENTRY_WEEKLY_SALARY`, ladders rescaled proportionally
- [x] Test: no career starts below the floor; ladders stay monotonic; the
      already-correct professional tier is untouched

## 7. A-6 — 4-week months vs a 52-week year

**Chosen: derive both from one function so they cannot disagree.**

- [x] `resolveCalendar` in `utils/weekCounters.ts` owns month + week-of-month
- [x] The tick uses it; the HUD's 1..4 dot strip keeps working
- [x] Test: the week label resets exactly on the month boundary, for 200 weeks

## 8. A-8 / A-9 — jail and fines

- [x] `jailWeeks` adds instead of overwriting (getting caught can't shorten a sentence)
- [x] The "caught" message reports the amount actually deducted
- [x] Police fines scale with net worth, so crime keeps a cost when rich

## 9. C-1 — twelve `apply*` calls run outside their own try/catch

**Chosen: guard each one with a documented fallback, not one big try.**

A throw in any of them currently loses the whole week (the outer catch returns
`prevState`, so "Next Week" silently no-ops).

- [x] Each guarded, each with an explicit neutral fallback
- [x] Test that drives a throwing subsystem and asserts the week still advances

## 10. B-3 — coverage is measured on the safest half of the codebase

**Chosen: widen the scope, re-baseline the floors in the same commit.**

- [x] `app/`, `services/`, `src/` added to `collectCoverageFrom`
- [x] Floors re-measured against the wider scope

## 11. B-4 — 1 234 lint warnings, none enforced

**Chosen: a warning ratchet, same shape as the coverage one.**

Promoting the rules to `error` needs 1 234 fixes first, which is a different
project. A ratchet locks in today's number and fails on any increase, so the
backlog can only shrink.

- [x] `scripts/check-lint.js` + `scripts/lib/lintRatchet.js`
- [x] Wired into `preflight`

## 12. D-1 — asset payload

**Correction to my own review first.** I reported the 67 MB of unreferenced
assets as a shipping problem. It is not. Metro bundles only what a static
`require()` reaches — verified by diffing a real `expo export` against the tree:
none of the unreferenced files appear in the bundle. That 67 MB is repo weight
and clone time, not download size.

The real number is the **234.0 MB that DOES ship**, against Google Play's 200 MB
base-AAB limit. The app cannot currently be released as a single Android
artifact, and nothing in the ten-section preflight looked at it.

**Chosen: measure what ships, gate it, delete the dead weight separately.**

- [x] Delete the 40 unreferenced images (repo hygiene — stated as such, not as a
      download win)
- [x] `scripts/lib/assetBudget.js` — sums assets reachable from a static
      `require()`. Validated against a real export: 234.0 MB predicted vs 234 MB
      bundled
- [x] Preflight §11 — FAILS an Android build over the Play limit, warns + ratchets
      elsewhere. A gate set to the number we wish were true would fail on day one
      and block every build, which is the corrosive shape `coverageRatchet.js`
      already documents
- [x] WebP conversion documented with the measured saving (230 of the 234 MB is
      PNG; q85 on photographic art is 5-15x). Left to the owner: it needs an
      encoder that is not a dependency here, and re-encoding 238 pieces of
      commissioned art is a visual-quality call

---

## Deliberately NOT fixed

- **B-1/B-2 (source-text tests, no render tests).** Replacing 72 test files and
  adding a render harness is a project, not a fix, and doing it halfway leaves
  two conventions in the tree. Recorded in the review.
- **D-2 (no i18n).** ~245 components of hardcoded copy. A product decision.
- **C-2 (394 uncalled exports).** Deleting them is safe but noisy, and some are
  half-built features the owner may still want. Needs a keep/kill pass per module.
- **A-1's cousin in crypto.** Already has explicit drift terms and measures
  near-neutral; nothing to fix.
