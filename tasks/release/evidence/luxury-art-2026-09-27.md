# Luxury catalogue artwork - 27 September 2026

[Before/after and full artwork gallery](luxury-art-2026-09-27/gallery.html)

## Result

All 12 luxury items now share original illustrated artwork with the accepted pet,
travel and vehicle family. Navy canvas, soft lighting and landscape framing retain
the approved UI. Browse, collection and detail banners use CatalogArt, including
its vector Gem fallback on unknown/failed art and decorative accessibility handling.
Canonical item IDs, prices, descriptions, purchase/sale actions, upkeep and schema
51 are unchanged. No new dependency or simulation logic.

The 768x384 WebP family totals **582,882 bytes**, compared with **3,596,259 bytes**
for the previous referenced photo files: **83.8% smaller**. Historical photos and
prompts remain archived; the live require map references only luxury-v2.

Art was generated with the built-in imagegen tool. [Exact prompts](../../../art/luxury-v2/prompts.json),
[originals and pipeline](../../../art/luxury-v2/README.md), [crop/dimension/hash manifest](../../../art/luxury-v2/manifest.json).
Rebuild: `node scripts/normalize-luxury-art.cjs`.

## Verification

- Focused Jest: **4 suites / 32 tests passed**, exit 0, 186.359 seconds. Catalogue coverage includes all luxury items; shared failed/unknown art fallback, purchase rules and sell valuation regressions pass.
- Source/test-tree TypeScript and changed-file ESLint: exit 0; zero lint errors/warnings.
- UI ratchet: exit 0, unchanged 142 gradients / 94 raw font sizes / 647 heavy weights. Git whitespace check: exit 0.
- All 12 runtime/source SHA-256 pairs verified against the manifest.
- Browser before/after: 375x667 and 768x1024, zero page errors. [Capture results](luxury-art-2026-09-27/after.json).
- Browser journeys: opened all 12 details, purchased the watch collection, found its owned artwork, requested a sale and chose Keep; ownership remained. Zero page errors. [Interaction results](luxury-art-2026-09-27/interactions.json).
- The first sale-cancellation script looked for Cancel rather than the existing Keep label. That run was not counted as a pass; the corrected script completed with exit 0.

## Remaining

V08's presentation implementation is complete. **36 audit items remain**, including
native acceptance. Next: **V09 Stocks hierarchy** (put useful securities ahead of
large sector context). [Full register](../../whole-app-audit-2026-09-26.md).

Screenshots use an isolated QA save in Expo web. Signed-device image sharpness,
decode memory, Larger Text/VoiceOver and iPhone/iPad acceptance remain open.
No merge, production OTA, paid build or store submission.
