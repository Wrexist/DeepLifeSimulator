# A07 Stocks and crypto lifecycle - 27 September 2026

[Actual screenshot gallery](trading-lifecycle-2026-09-27/gallery.html)

## Changes and scope

- Stock/crypto order and recurring-buy forms parse complete grouped/fractional values with the shared strict parser. `1,000.50` no longer silently becomes 1; malformed inputs cannot submit.
- Pending-order validation accounts for cash and units committed to existing open orders. Stock 2% commission and crypto's existing 1% pending-buy buffer are reflected in affordability. Immediate market trades retain their existing rules; canonical actions remain authoritative.
- Crypto trade previews use the current coin from state rather than a snapshot captured when the sheet opened.
- Labelled fields, selected radio states, disabled confirmation semantics, 44-point selections, keyboard tap handling and reduced-motion modal presentation added. Stock content can shrink/scroll within the sheet.
- Recurring buys explain skipped unaffordable purchases and retry on the next scheduled date; four-week cadence and live checking cash are explicit. Removed funding accounts block submission; exact amount/cadence stay above Schedule.
- Crypto's misleading 24h change label now says Weekly change. Approved stock illustrative charts and recorded quote data remain intact.
- No settlement, tax, dividend, mining, rate, weekly transition or save-schema changes. STATE_VERSION stays 51.

## Verification

- Focused Jest: 20 suites / 230 tests passed, exit 0, 11.961s. Includes new trading form regressions; lib/stocks and lib/crypto; orderBookParity, dividendDoublePay, deadPlayerTradingGuards, stakeCryptoRace, miningRepair, miningAutoRepair, miningAltCoinYield and miningPowerNonCash.
- Final recurring-form polish rerun: 3 tests passed, exit 0, 7.487s (already counted in the 230 distinct tests).
- Source TypeScript and test-project TypeScript passed, exit 0; final source recheck passed.
- Changed-file lint: 0 errors, 24 existing warnings in StocksApp/BitcoinMiningApp (memo dependencies and existing lazy require). Final form/test-only lint passed without warnings. UI ratchet unchanged and passed: 141 gradients / 94 raw sizes / 645 heavy weights. Diff whitespace check passed.
- Browser trading, both 375x667 and 768x1024, DPR 2, reduced motion: stock grouped buy, fractional sell, limit placement/cancellation; crypto grouped buy, fractional sell, limit placement/cancellation; recurring buy validation and creation; save/reopen; real HUD Next Week executes the scheduled $100.50 buy and records updated market data. All passed, exit 0, zero page errors. See results.json.
- Browser mining, both widths: buy Basic Miner, buy Hash Rate Boost, verify stored rig and upgrade; switch the already-loaded browser offline; real HUD Next Week earns BTC; restore connection and reload; rig and earned BTC persist exactly. Both passed, exit 0, zero page errors. See mining-results.json. This is not an offline cold boot or native background test.
- Screenshot review prompted the shorter Recurring buy heading and persistent amount/cadence footer before final captures. Close control measured 44x44 at 375px. Phone screenshots and tablet output captured for review.
- Initial trading harness expected lastWeekPrices on the first tick of a seed without savedMarketPrices. The canonical previous snapshot is legitimately absent on that first tick; the harness now asserts the newly saved market snapshot/current holding quote. One recapture was interrupted by the deliberate Metro restart for final styles; both widths subsequently completed cleanly. No gameplay rules or assertions about successful settlement were bypassed.
- No full-suite rerun for this presentation/input-validation patch. Previous full-run caveats remain in banking-lifecycle-2026-09-27.md; clean final-commit CI is still required for release.

## Remaining acceptance

A07 remains open for signed iPhone/iPad VoiceOver/Larger Text, native keyboard and modal priority, old-save permutations, offline cold boot/background/kill/relaunch, extended loss/tax/dividend boundary journeys, staking maturity and larger mining-fleet/device performance. Unit coverage does not close those device/permutation cases.

26 acceptance/operational audit items remain. Next independent task: A08 Education lifecycle.

Git refreshed: origin/main 9e729ac2; draft PR 229 remote head da850215. Coverage/quality/preflight passed on that remote head; update is the previously cancelled run. Those checks do not cover local follow-through commits. No push, merge, OTA, paid build or release.
