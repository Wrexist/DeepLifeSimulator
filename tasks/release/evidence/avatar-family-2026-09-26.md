# Illustrated character family — 26 September 2026

V06 follow-through from `d8cdf41c`, draft PR #229. User explicitly selected the
cohesive illustrated direction. Schema 51, encoded avatar catalogs, inheritance,
weekly progression and purchases are unchanged.

## Changes

- The six saved portrait IDs now render curated feature presets through the
  same SVG renderer as custom avatars and NPCs. Presets now receive existing age
  effects. Their descriptions reflect the available illustrated outfits.
- Removed full-frame lighting overlays, metallic disc, gloss and outer contact
  shadow. Shared matte navy surface and framing work at hero and list sizes.
- Creator thumbnails use the actual character renderer. Copy explains that
  custom features remain the source of family resemblance; portrait presets
  do not overwrite existing stored DNA.
- Hero blink/breath animation pauses for Reduced Motion and app backgrounding.
  List avatars start neither motion timers nor app-state subscriptions.
- Spark's NPC card places the face and details in separate rows. Removed the
  stepped black scrim that covered the face; retained swipe drivers and actions.
- Uploaded photo failure retains the selected illustrated identity; replacing
  the URI still retries the image.

Art provenance and the stable preset manifest are recorded in
`art/illustrated-characters-v1/manifest.json`. Existing Avataaars artwork by Pablo
Stanley is curated, not represented as exclusive original artwork. The attached
3D studio was inspected but not installed: its prop pipeline does not provide a
compatible modular face system. No generated replacement raster assets, runtime
network, native library or save migration was introduced. Retired WebP source
art and its provenance remain archived.

## Verification

- PASS: 9 focused suites, 172 tests, 116.879 seconds, exit 0. Includes portrait
  save repair, legacy migration, catalog/aging/child proportions, inheritance,
  renderer routing, photo fallback and motion cleanup.
- PASS: source and test-tree TypeScript, exit 0.
- PASS: changed-file lint, exit 0, no warnings.
- PASS: UI ratchet, 144 gradients / 94 raw font sizes / 647 heavy weights. Lowered
  the gradient ceiling from 145 to 144; no gate relaxed.
- PASS: browser creator and Profile at 375×667 and 768×1024, Contacts and Spark
  at 375×667. Zero page errors in recorded journeys.
- PASS: portrait arrows and identity fields persist into Perks; Custom selection
  retains encoded features and clears the portrait ID; name/sex/sexuality remain
  intact. Tint controls measure 44×44; aging preview expands and collapses.
- Initial fallback test exposed a new provider dependency; removed that dependency
  from the renderer and reran successfully. The renderer remains independently usable.

[Before/after and NPC screenshot gallery](avatar-family-2026-09-26/gallery.html).
Fresh onboarding randomizes identity between captures; screenshots compare art
treatments rather than claiming an identical saved person before and after.

## Remaining acceptance

Native SVG rendering, iPhone/iPad safe areas, Larger Text, VoiceOver, app
background/resume and reduced-motion behavior on a signed build remain open.
Browser evidence and mocked lifecycle tests do not establish device acceptance.
No merge, production OTA, paid build or submission is authorized by this pass.

**38 audit items remain.** Next: **V07 media identity** — fictional artwork for
YouVideo/Streaming instead of external-game thumbnails, with recorded provenance.
