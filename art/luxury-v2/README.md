# Luxury illustrated catalogue v2

All 12 canonical items use original 2.5D illustrations aligned with the approved
navy art family. Three four-panel sheets were generated with the built-in
imagegen tool. Exact prompts: prompts.json. Original sheets: originals/.

Rebuild with `node scripts/normalize-luxury-art.cjs`. It crops each reviewed
quadrant, normalizes to 768x384 WebP, and records dimensions, source hashes,
output hashes and byte sizes in manifest.json. Runtime mapping lives in
lib/content/luxuryArtAssets.ts; CatalogArt supplies a Gem fallback on failure.
Luxury catalogue IDs, prices, descriptions and rules are unchanged.

Historical photos remain archived in assets/images/luxury but are no longer
referenced by the luxury art map. Existing media-v2, illustrated characters,
pet/travel/vehicle art and original destination rooms remain approved.

Native decode memory and final iPhone/iPad sharpness remain acceptance gates.
