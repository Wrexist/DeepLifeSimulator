# Deep Life Simulator: Small start. Big life.

Revised after the original campaign was rejected for not matching the game.
All ten compositions now use navy game surfaces, bright semantic accents,
the actual app icon, prominent gameplay controls, and shorter action-led copy.
No scenic illustrations appear in the exports. The first image follows an example
character from a modest start through a first action to an aspirational career.
The iPad layout uses wider cards and independently cropped tablet captures.
Revised 9 September 2026.

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
| 01 | Small start. Big life. | Current first-job guidance paired with an established career. Different example lives illustrate progression, not a promised timeline. |
| 02 | Build it. Be the boss. | Launch a company and develop revenue, market share and brand. |
| 03 | Swipe. Spark. Fall in love. | Discover profiles and choose who to pursue in Spark. |
| 04 | Dream job? Work for it. | Earn qualifications and progress to senior jobs. |
| 05 | First paycheck. Next property. | Combine a first property with the stock market. |
| 06 | Dream car. Your keys. | Own and manage a supercar as a visible progression reward. |
| 07 | Take the cash? Chase the fame? | Pick between actual event options with their actual effects. |
| 08 | Go live. Get noticed. | Start streaming, upgrade equipment and grow an audience. The example channel is explicitly at its starting state. |
| 09 | Next stop? Your choice. | Get a passport and choose destinations including Paris, Tokyo and Bali. |
| 10 | Find your people. Build your life. | Build relationships, raise children and maintain connections. |

The first three communicate agency, ambition and connection. Later images broaden
the reasons to play without repeating a financial menu ten times. Ten is the
chosen coverage for this campaign, not a claim of measured conversion superiority.
[Apple's product-page guidance](https://developer.apple.com/app-store/product-page/)
recommends introducing the experience in the first images. Compare this set with
the previous campaign using Product Page Optimization before attributing an uplift.

## Sources and limits

- Reviewed repository base: `024f19e76cd1bc56693316e98b1fd5be089d1e4e`.
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
- The rejected scenic art remains archived under `source/art/` but is not
  consumed by the renderer. The only image outside gameplay captures is the
  existing app icon. Decorative line icons and layout are code-native SVG.
- Colors follow `lib/config/theme.ts`: navy backgrounds, slate cards, blue
  action accents, green progress, pink relationships, and purple investments.
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
