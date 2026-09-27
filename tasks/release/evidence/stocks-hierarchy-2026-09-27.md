# Stocks hierarchy - 27 September 2026

[Before/after gallery](stocks-hierarchy-2026-09-27/gallery.html)

## Change

Sector rotation uses the shared, remembered disclosure and defaults closed. Its summary shows the sector count or current filter. All six sector cards, momentum, duration and filter actions remain available. Sorting and clear-filter controls have a 44-point minimum. Portfolio landing, quotes, watchlist, order submission and schema 51 are unchanged.

## Measured browser evidence

| Viewport | First stock before | After | Improvement |
|---|---:|---:|---:|
| 375 x 667 | 639px | 369px | 270px higher |
| 768 x 1024 | 769px | 447px | 322px higher |

Before/after captures use DPR 2, isolated QA state and reduced motion. Interaction run also covers 320px: first stock y=322, height=51. At all three widths: expand/collapse, Finance filter, clear filter, price sort, add watch, open detail, open trade, enter amount and cancel work without page errors. Returning from details preserves the collapsed section. No real player save was touched.

The first interaction script incorrectly expected React Native Web to expose aria-expanded on this shared control; it returned null. The corrected run checks rendered sector visibility and completes with exit 0. This does not constitute native VoiceOver acceptance.

## Checks

- Focused Jest: 3 suites, 27 tests passed, exit 0 (29.041s): stock row presentation, watchlist actions and stock operations.
- Source TypeScript: exit 0.
- ESLint: exit 0, zero errors; 11 existing hook/static-import warnings in StocksApp.
- UI ratchet: exit 0, unchanged 142 gradients / 94 raw font sizes / 647 heavy weights.
- Browser capture and corrected interaction scripts: exit 0, zero page errors.

## Remaining acceptance

Signed iPhone/iPad, VoiceOver/Larger Text, lifecycle and offline acceptance remain open. CI must be checked against the new review head. No merge or OTA publishing authorized. V09 implementation is complete; 35 audit items remain. Next: V10 financial hierarchy and duplicate totals.
