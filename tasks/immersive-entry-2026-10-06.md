# Interactive entry redesign — 6 October 2026

Owner rejected the wallet/album slides as boring and requested more immersive UX.
Those static Group D compositions are rejected, not approved for intake.

- [x] Build a runnable three-chapter interaction preview: choose a direction,
  reveal the weekly loop, explore the next generation.
- [x] Use approved navy surfaces, existing city/portrait art and grounded props;
  replace empty space and generic Keep going copy with purposeful actions.
- [x] Verify choice feedback, Back/Skip, keyboard focus, reduced motion, compact
  portrait/tablet/landscape and enlarged text.
- [x] Present preview and screenshots at the existing review gate. This is an
  isolated UX prototype; it does not alter real saves or simulate economy math.

UI/UX skill matched narrative chapters, progress, reduced motion and keyboard
navigation. Its glassmorphism/color/font recommendations are not applied because
the repository's approved presentation system takes precedence.

## Delivery and verification

- [Offline interactive preview](../art/astra-v1/proposals/immersive-entry/preview.html), 275,255 bytes, embedded art and no external requests.
- [Three-screen review](../art/astra-v1/proposals/immersive-entry/review.png).
- Source: index.html, style.css and preview.js in the same folder.
- Playwright check exited 0: 390x844, 375x667, 320x568, 768x1024,
  844x390 and 375x667 with 150% root text. Choice feedback, story progression,
  Back, Skip and replay passed. No page errors; opening controls all at least
  44px; no opening horizontal overflow. Screenshots captured for all chapters.
- Portable-preview keyboard check exited 0: selection, advance, demo, Back,
  retained choice, chapter focus, loaded images and animation disabled under
  reduced motion. JS syntax check exited 0.
- Enlarged-text inspection found and fixed absolute-position overlaps in the
  portrait and weekly-story sections. Both now use normal grid layout.
- Raw results/screens: `tasks/release/evidence/immersive-entry-2026-10-06/`.
- No runtime/save/economy changes in this proposal. No new release tests needed
  for this standalone artifact; native VoiceOver/Larger Text and signed-device
  acceptance remain pending after integration.

Next: owner design review, then adapt approved interactions to the existing
React Native entry flow, localization and accessibility owners. Group D remains
unapproved; do not advance asset loops or intake on the strength of this preview.
