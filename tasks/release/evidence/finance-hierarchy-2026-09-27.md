# Finance hierarchy - 27 September 2026

[Before/after gallery](finance-hierarchy-2026-09-27/gallery.html)

## Changes

Phone Bank and Bank Pro share a compact net-worth card and a 44-point assets/debts action. The canonical breakdown includes all existing asset categories; Bank Pro's partial duplicate composition and repeated statement totals are removed. Bank Pro opens on Overview with accounts before income and credit. Phone Bank removes the secondary totals card and keeps urgent payment notices ahead of the overview. Its income/tax route is explicitly named. Existing recorded wealth history expands on demand when two or more samples exist.

All account, transfer, goal, loan, card, budget, tax and ad handlers are preserved. No simulation, save schema or banking action changes.

## Layout measurements

Accounts heading y-position, CSS pixels:

| App / viewport | Before | After | Higher by |
|---|---:|---:|---:|
| Bank / 375x667 | 400 | 194 | 206 |
| Bank Pro / 375x667 | 1238 | 244 | 994 |
| Bank / 768x1024 | 475 | 230 | 245 |
| Bank Pro / 768x1024 | 1469 | 290 | 1179 |

DPR 2 screenshots use isolated QA saves with reduced motion. Phone-only and computer-owned fixtures exercise the actual launcher variants; their balances intentionally differ. Phone savings deposit/withdraw actions now fit in the compact first view. All four captures completed with zero page errors.

## Verification

- Banking regressions: 4 suites / 40 tests passed, exit 0, 67.88s (canonical net-worth itemisation, account mirrors, savings contribution wiring and displayed APR).
- Source and test-project types: exit 0. The new test fixture now explicitly requires its optional lifetime-statistics slice.
- Changed-source lint: exit 0, zero errors; two existing income-memo warnings.
- UI ratchet: exit 0, unchanged 142 gradients / 94 raw fonts / 647 heavy weights.
- Recorded-history regression: 1 suite / 1 test passed, exit 0, 74.478s. An initial test mock omitted other selector-module exports and crashed the provider harness; preserving those exports fixes the test setup.

Initial capture attempts were interrupted by a stopped preview server and incorrect launcher assumptions. Restarted preview and used the appropriate phone/computer QA saves. The first interaction attempt looked for a modal deposit button inside phone Bank's slider-based detail screen; the corrected journey returns to the account card's deposit action and selects the actual amount-labelled confirmation button. No real player data was used.

- Browser interactions: exit 0 at 320/375/768px for both apps. Open/close canonical breakdown, open savings detail, deposit $100 and verify the updated account, navigate to account goals (Pro) or income/tax (phone). Zero page errors; assets/debts actions measure 44px high at all widths.
- New render-test lint: exit 0, no warnings.

## Remaining gates

Native iPhone/iPad, VoiceOver/Larger Text, keyboard, lifecycle, offline and exact-build purchase/ads acceptance remain open. Browser evidence is not signed native evidence. No publishing or merge authorized. V10 presentation implementation is complete; 34 audit items remain, next V11 segmented-control overflow and long labels.
