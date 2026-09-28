# Fictional media identity — 26 September 2026

V07 follow-through from `3e0194fc`, draft PR #229. Presentation-only changes;
schema 51, saved titles/category IDs and content actions are unchanged.

## Change and provenance

YouVideo and Streaming now share five original illustrations: After Hours
(chat studio), Lantern Isles (RPG), Relay Arena (competition), Pocket Borough
(creative building) and Rooftop Rush (speedrun). The family uses matte coastal
architecture, navy/teal shadows and warm amber/coral highlights. Images contain
no generated typography; category and user-written titles remain native UI.

Generated using the built-in GPT Image tool, with each preceding image used as
a style reference. Exact prompts: `art/media-v1/prompts.json`. Original PNGs:
`art/media-v1/originals/`. Runtime files: `assets/images/media/`. The manifest
records dimensions, bytes, source/output SHA-256 and review decisions. Rebuild
the WebP encoding with `node scripts/normalize-media-art.cjs` using the existing
art-tool installation; no new dependency was introduced.

The five 768×512 WebPs total **321,904 bytes (314.4 KiB)** versus **628,948 bytes**
for the old five covers: **48.8% smaller**. This compares image file bytes, not
a measured native binary/download size. Historical external-game files remain
in the repository, but no app/component/lib source imports that family now.
Existing destination art is retained.

A shared mapping covers composers, featured videos, category tiles, live
streams, history and detail views. Old named titles resolve to matching original
art without rewriting saved text. Unknown uploads use a deterministic fallback.
The legacy `fps` category ID still means Just Chatting; actual FPS topic text
maps to competitive art. Whole-word matching avoids treating “party” as art.

## Verification

- PASS: 3 focused suites / 34 tests, 84.457 seconds, exit 0: legacy/fallback
  mapping, stream metadata, and broadcasts surviving tab-away/remount.
- PASS: source and test-tree TypeScript, exit 0.
- PASS: changed-file lint, exit 0, no warnings after removing an existing unused import.
- PASS: UI ratchet remains 144 gradients / 94 raw font sizes / 647 heavy weights.
- PASS: actual Expo browser previews at 375×667 and 768×1024, no page errors.
- PASS: upload a video using the canonical action, dismiss its success dialog,
  open its detail; choose all five streaming categories; start/stop a stream,
  dismiss its summary and view its history. Isolated test browser storage only.
- Reviewed the generated originals and compact runtime crops. No external-game
  logos or borrowed character silhouettes were requested or observed.

[Artwork and before/after screenshot gallery](media-identity-2026-09-26/gallery.html).

## Remaining acceptance

Native iPhone/iPad image decoding, device memory/performance and signed-build
visual acceptance remain unverified. These browser screenshots do not establish
release readiness. No domain formulas, purchases, ads or save migration changed.
No merge, production OTA, paid build or store submission performed.

**37 audit items remain. Next: V08 asset consistency** — prioritize the repeatedly
visible pet, travel and vehicle families, with a retention/replacement manifest.
