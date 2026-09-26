# V06 — one illustrated character family

User chose cohesive illustrated characters on 26 September 2026.

- [x] Inventory portrait IDs, renderer, editor, NPC/family resolution and attached skill.
- [x] Replace the six photographic-style render branches with curated illustrated presets.
- [x] Share framing and matte finish across presets, custom faces and NPCs.
- [x] Preserve encoded features, catalog order, save schema and inherited faces.
- [x] Respect reduced motion; inspect compact/tablet creator and family artwork.
- [x] Run focused avatar/save tests, source types and lint; record screenshots and limits.

Art bible: illustrator-drawn filled shapes, warm natural skin, readable features,
matte navy background, no gloss or simulated lens lighting. Same camera and
framing for every identity. Existing modular Avataaars artwork remains credited;
this is curation and integration, not a claim of exclusively authored face art.

Asset manifest: six immutable `portrait-v1:*` IDs map to numeric feature presets
in `lib/avatar/portraitPresets.ts`. No network, new native dependency or raster
generation. Old WebP sources remain archived; active avatar surfaces use SVG.
The attached 3D studio has a useful prop pipeline but no compatible genetic face
system; do not install it for this task. Portrait presets affect presentation
only: existing stored custom DNA and family derivation stay untouched.
