# Stock curves - 27 September 2026

[Before/after gallery](stock-curves-2026-09-27/gallery.html)

User-requested V09 follow-up: stock lines now have distinct seeded rises/dips from the opening screen. Twelve points, rounded caps/joins and an endpoint dot fit the compact row. The same symbol shape is used in details. Opening lines are blue; actual positive/negative weekly changes use green/red. Numeric quotes and change pills remain actual game data.

Curves are explicitly labelled illustrative, including row accessibility text: the engine stores only two closes, so these are not historical price samples. Seeded presentation randomness does not use the game RNG or modify money, quotes, trading, saves or schema 51. Portfolio aggregate sparklines retain their original two-point representation.

## Verification

- 2 suites / 18 tests passed, exit 0, 51.715s. All 25 symbols have distinct stable shapes with both rising and falling segments; known weekly endpoint direction and invalid-input fallback verified.
- Source types: exit 0.
- Changed-file lint: exit 0, no errors, 11 existing StocksApp warnings.
- UI ratchet: exit 0; 142 gradients / 94 raw fonts / 647 heavy weights, unchanged.
- Browser captures: 375x667 and 768x1024, reduced motion. Both list and detail screenshots captured. Returning from details retains identical polyline coordinates; no page errors. First compact stock y=393px, still visible.
- Initial capture failed because preview was stopped; restarted Metro and completed captures. Native VoiceOver/Larger Text/device acceptance remains outstanding.

Review branch only; no OTA or merge authorized. Audit remains 35 items; next is V10 financial hierarchy and duplicate totals.
