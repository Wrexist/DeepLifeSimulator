# Money-entry sliders - 27 September 2026

[Actual screenshot gallery](amount-sliders-2026-09-27/gallery.html)

## Changes

Shared navy AmountSlider replaces player money keyboards in Stocks, crypto orders/recurring buys, banking amounts/account opening/loans/bills, laundering, property rent, employee salaries/bonuses and campaign spend. Existing account-to-account transfer slider remains. Names, durations, guest counts and internal developer tools retain their appropriate inputs.

Drag, 10%/25%/50%/Max, increment/decrement and expandable ranges are available. Exact Max preserves fractional holdings and small balances. Available cash/holdings cap bounded fields; stock commission and crypto pending-buy buffers remain represented. Canonical transaction validation is unchanged. Web arrow keys/Home/End and native adjustable accessibility actions are supported. No native dependency, save schema or simulation changes (STATE_VERSION 51).

Account opening now scrolls product selection and deposit together, with selected account/deposit and confirmation retained below the scroll area.

## Verification

- 4 form suites / 26 tests passed, exit 0, 13.602s. Education/slider batch: 14 suites / 138 tests passed, exit 0, 8.549s. Combined 164 distinct tests. Includes exact Max and drag/accessibility boundary tests.
- Overlapping final reruns: 5 suites / 31 tests passed (22.037s); slider/amount modal 24 tests passed (24.469s); final banking/slider layout check 8 tests passed (63.439s). All exit 0.
- Source and test-project TypeScript passed; final source recheck passed, exit 0.
- Changed-file lint: exit 0, no errors; seven existing hook warnings in EducationApp/HireEmployeeModal. Shared slider has no lint warnings.
- UI ratchet passed unchanged: 141 gradients / 94 raw sizes / 645 heavy weights. Diff whitespace check passed.
- Final browser checks at 375x667 and 768x1024, DPR 2, reduced motion: actual stock drag, buy, sell Max, bank opening deposit and account creation passed, exit 0, zero page errors. See results.json and actual captures.
- Initial browser inspection caught stale web ARIA values; explicit web value attributes and keyboard handlers fixed it. Final screenshots also prompted the scrolling account-opening layout. A recapture started before Metro was ready and timed out; all final journeys passed after readiness.

## Remaining acceptance

Physical iPhone/iPad drag, VoiceOver, Larger Text and every secondary form permutation remain unverified. Browser evidence is not native acceptance. Full-suite/final-commit CI remains a release gate; no full-suite rerun for this presentation migration. Prior banking full-run caveats remain applicable. No push, merge, OTA, paid build or release.

Git refreshed: origin/main 9e729ac2; draft PR 229 remote head da850215. Remote checks do not cover these local changes.
