# A06 banking journeys follow-through - 27 September 2026

[Actual screenshot gallery](banking-journeys-2026-09-27/gallery.html)

## Changes

- Account opening, loan quotes and recurring bills now parse the complete money entry. `1,000.50` is 1000.50, not 1; malformed/empty amounts cannot submit. Domain actions remain authoritative.
- Loan/card repayment Max is capped to both available cash and outstanding principal/balance in Bank and Bank Pro.
- Loan preview and default-checking bill funding display live cash instead of the potentially stale checking mirror.
- Recurring expenses explain that existing rent/loans already run automatically. Four-week cadence, first due date, paused status and the amount/cadence confirmation are explicit. Missing checking accounts block creation.
- Forms have labelled inputs and selection states, reduced-motion presentation, keyboard avoidance and 44-point choice controls. Account product headings wrap rather than collide with APR.
- No schema, interest rates, billing schedule or weekly simulation changes. STATE_VERSION remains 51.

## Verification

- Focused tests: 7 suites / 86 distinct tests passed, exit 0, 11.527s. Files: bankingForms.render, loanQuoteDelta.render, banking operations, accountLifecycle, creditCardChargeLoop, weeklyTick and amountInputModal. After the final loan target/role adjustment, both render suites passed again: 4 tests, exit 0, 8.712s.
- Source and test-project TypeScript passed, exit 0. Final source check also passed.
- Changed-file ESLint: exit 0, no errors; two existing Bank/Bank Pro income memo dependency warnings remain.
- UI ratchet passed: 141 gradients / 94 raw sizes / 645 heavy weights, unchanged. Diff whitespace check passed.
- Browser: isolated synthetic saves, 375x667 and 768x1024, DPR 2, reduced motion, local Expo web. Both widths passed account open/close, malformed bill rejection, bill pause/resume/save-reopen/delete, card apply/charge/Pay Max, loan origination with grouped input and full prepayment. Zero page errors. See results.json and screenshots in the gallery directory.
- CD/missed-payment recovery browser journey passed at both widths, exit 0: locked at week 155, mature after the real HUD transition to week 156, bill/loan arrears recorded with no cash; withdraw $3,000, advance to week 157, verify bill paid/missed count cleared and loan principal reduced. Zero page errors; see maturity-results.json.
- Initial browser inspection exposed product-title/APR collision; wrapping fixed it before final capture. Initial maturity harness runs encountered a stale welcome-back timestamp, daily rewards, a real life decision and the community invite. Fixtures were updated to represent a recent session with invite reminders already exhausted; the real event's no-cash choice was used. No force-clicks or simulation replacements.
- The full suite was not rerun for these presentation/input-validation changes. The preceding full run and its failed timing/stale assertion cases, subsequent targeted passes and final-commit CI gate remain recorded in [prior evidence](banking-lifecycle-2026-09-27.md).

## Remaining acceptance

Signed iPhone/iPad keyboard, VoiceOver/Larger Text, modal/safe-area behavior, old-save permutations and background/kill/relaunch still need device evidence. Browser reload is not native interrupted-storage acceptance. Prolonged delinquency/default permutations and broader loan/product combinations remain open.

Observed shared-overlay follow-up: the persistent decision badge overlaps the upper part of an auto-pay card in the compact recovery capture. The funding/payment assertions pass, but this screenshot is not a claim of overlap-free layout; retain it for the interruption/safe-area audit.

26 acceptance/operational items remain. Next independent task: A07 Stocks and crypto.

Git refreshed: origin/main 9e729ac2; draft PR 229 remote head da850215 has passing coverage/quality/preflight, with the previous update run cancelled. Those remote checks do not validate this local patch. No push, merge, OTA or paid build.
