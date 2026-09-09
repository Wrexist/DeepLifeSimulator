# Deep Life Simulator: Your life. Your way.

A new ten-image App Store campaign focused on the experience of building a life.
Warm ivory headlines, individual cinematic illustrations, readable gameplay
panels and a consistent navy finish. Created 9 September 2026.

![First three](first-three.png)

[All ten iPhone images](overview-iphone.png) · [All ten iPad images](overview-ipad.png)

## Upload folders

| Device set | Folder | Pixels | Images |
| --- | --- | --- | --- |
| iPhone 6.9″ | [iphone-6.9](iphone-6.9/) | 1320 × 2868 | 10 |
| iPhone 6.5″ | [iphone-6.5](iphone-6.5/) | 1284 × 2778 | 10 |
| iPad 13″ | [ipad-13](ipad-13/) | 2064 × 2752 | 10 |

Upload the ten PNGs from each folder in filename order. Overview sheets and source
art are review aids, not store uploads. All exports are RGB PNGs without alpha.
These sizes follow [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## The sequence

| # | Headline | Player experience and gameplay proof |
| --- | --- | --- |
| 01 | Your life. Your way. | Current first-job guidance paired with an established career. Different example lives illustrate progression, not a promised timeline. |
| 02 | Be your own boss. | Launch a company and develop revenue, market share and brand. |
| 03 | Find your kind of love. | Discover profiles and choose who to pursue in Spark. |
| 04 | Start small. Aim higher. | Earn qualifications and progress to senior jobs. |
| 05 | Make more. Own more. | Combine a first property with the stock market. |
| 06 | You earned this life. | Own and manage a supercar as a visible progression reward. |
| 07 | One choice. A new chapter. | Pick between actual event options with their actual effects. |
| 08 | Your channel. Your big break. | Start streaming, upgrade equipment and grow an audience. The example channel is explicitly at its starting state. |
| 09 | Go beyond the everyday. | Get a passport and choose destinations including Paris, Tokyo and Bali. |
| 10 | More to life than money. | Build relationships, raise children and maintain connections. |

The first three communicate agency, ambition and connection. Later images broaden
the reasons to play without repeating a financial menu ten times. Ten is the
chosen coverage for this campaign, not a claim of measured conversion superiority.
[Apple's product-page guidance](https://developer.apple.com/app-store/product-page/)
recommends introducing the experience in the first images. Compare this set with
the previous campaign using Product Page Optimization before attributing an uplift.

## Sources and limits

- Reviewed repository base: `1e8c0fdfccbe59a37b0634b77d0be79a526cd108`.
- Frame 01 uses the newer Home captures in `docs/reviews/compact-hud/`, replacing
  the prior campaign's obsolete opening UI.
- Other gameplay panels reuse the repository's real seeded web captures in
  `screenshots/appstore-2026/rich-captures/` and `rich-captures-ipad/`.
  They are cropped and scaled, never retyped, painted over or AI-generated.
- The tablet Home source was captured in a resized browser. Other tablet panels
  use their dedicated tablet captures. These are **not newly captured native iOS
  screenshots**. Confirm visible UI parity with the submitted iOS build before
  uploading. Export validation alone cannot establish native parity.
- Source images show example game states, not guaranteed outcomes or real money.
- Scenery is promotional illustration, not a playable 3D world. The new first
  illustration was made with built-in image generation. Its brief is in
  `source/art/prompt.txt`. Other plates reuse the established campaign artwork
  and prompts in `../appstore-2026/source/art-prompts.json`.
- `source/manifest.json` records exact inputs, crop rectangles, output hashes and
  per-frame storyboard hashes. The earlier campaign remains available for comparison.
- No gameplay code, balance, monetization or App Store Connect data is changed.

## Rebuild and verify

Use the existing isolated Sharp dependency and bundled licensed fonts:

```bash
npm ci --prefix screenshots/appstore-2026/source
node screenshots/player-stories-2026-09/source/build.mjs
node screenshots/player-stories-2026-09/source/verify.mjs
node screenshots/player-stories-2026-09/source/previews.mjs
```

Node.js plus Fontconfig/Pango support are required. The renderer also supports
`CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Selective revisions support
`--ids=01,03` and `--devices=iphone-6.9,ipad-13`; validation requires a complete,
up-to-date 30-image set. Marketing copy and normalized phone/tablet crop coordinates
are editable in `source/storyboard.json`.

The existing `scripts/generate-appstore-2026-{set,ipad}.mjs` commands now point to
this campaign. Run the previous campaign's `source/build.mjs` directly to reproduce
its older designs.
