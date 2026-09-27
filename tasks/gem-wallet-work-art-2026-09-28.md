# Gem wallet and contextual work art

- [x] Center the HUD gem glyph/value and retain separate 44-point balance/top-up targets.
- [x] Reuse the canonical store in a compact wallet with Top up / Spend gems tabs, live balance, real localized IAP prices and existing upgrade ownership/affordability.
- [x] Author original action-specific 3D props with the existing local Three.js pipeline; replace generic Work banners with compact relevant artwork.
- [x] Run focused store, transaction and presentation regressions, types and lint; inspect compact/tablet renders. Native StoreKit remains a signed-device acceptance gate.

No save schema, product IDs, pricing, currency grants or simulation formulas change.

## Implementation and evidence

Starting revision: f7ad45d9, review branch codex/visual-ux-rebuild-2026-09-26; main refreshed at 9e729ac2. User's IMG_3310/3311/3312 are the before references.

HUD: removes the constrained percentage-width text wrapper and excessive line box from gem numbers, retaining tabular figures and two separate 44-point targets. Both controls open a focused wallet through the single global GemStoreContext owner. The obsolete read-only GemsBreakdownModal is removed.

Wallet: solid navy sheet, live balance, Top up and Spend gems tabs, optional daily reward and existing upgrade cards. Native IAP connection, SKU availability, localized prices, busy locks, confirmation, grants and save ownership remain with the existing store/service. Missing products show Price unavailable; no fallback dollar prices or price-ratio claims in the offline wallet. The full store's other categories remain accessible through its normal entry point. Close/restore controls are at least 44 points; footer respects the bottom safe area.

Art: ten project-owned Three.js models with the existing palette, orthographic camera, soft shadows and transparent backgrounds. Lost-items, delivery, cleaning, gardening, pet care, study, network, retail, recycling and vehicle props. GLB round-trip import, header/length, triangle budget and alpha/nonempty checks passed (build --work, exit 0). Models: 1,092-3,964 triangles each. Runtime WebP family: 127,610 bytes total, 720x540 each. No real-time 3D renderer or new dependency in the game. Editable sources, GLBs, PNG masters and hashes are in art/game-assets-v1. Street actions map by stable IDs; unmatched actions get no misleading fallback image. Career-specific matching replaces the generic office fallback where identifiable.

Verification:
- Focused presentation/catalogue/spending run: 5 suites / 27 tests passed (32.268 s).
- Restore/carry-over run: 3 suites / 24 tests passed (12.117 s; includes the same 3 wallet tests).
- Durable fulfillment, no-double-grant, catalogue retry, HUD and wallet: 5 suites / 17 tests passed (25.986 s; includes the same 3 wallet tests).
- Final wallet run: 4 tests passed (26.910 s), including a simulated localized SEK catalogue and missing-SKU gating. Across the focused runs: 63 distinct tests passed. UI ratchet initially caught one new bold declaration; wallet balance now uses shared tier1Value. Rerun passed at 141 gradients / 94 raw font sizes / 645 heavy weights, with no ceiling changes.
- Source typecheck and changed-file ESLint --quiet completed with exit 0. No gameplay or purchase reducer edits.
- Browser wallet journeys at 320x740, 375x740 and 768x1024 passed: balance/plus entry, Top up / Spend gems, close/reopen, offline availability; 44-point HUD targets, zero page errors. Work art checked at 375 and 768 widths, zero page errors. A capture interrupted by the development-server restart was rerun successfully; it is not counted as a pass.

Screenshots: [top-up wallet](release/evidence/gem-wallet-2026-09-28/top-up-375.png), [spend gems](release/evidence/gem-wallet-2026-09-28/spend-375.png), [HUD](release/evidence/gem-wallet-2026-09-28/hud-work-375.png), [lost-items card](release/evidence/gem-wallet-2026-09-28/lost-items-375.png), [3D art family](release/evidence/gem-wallet-2026-09-28/work-art.png). Browser fixtures are test saves; screenshots do not claim successful real-money purchases.

Remaining acceptance: exact signed iPhone/iPad build, Larger Text/VoiceOver, safe-area and modal priority, native localized StoreKit pack purchase/cancel/retry and persisted balance after relaunch. These edits are not included in the already-started 2.15.0 binary. No new build, merge or production OTA is dispatched by this task.
