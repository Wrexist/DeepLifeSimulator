# App Store Screenshots — DeepLife Simulator

Immersive, ready-to-upload marketing screenshots for the App Store (and Google Play).

## Files

| File | Headline | Showcases |
|------|----------|-----------|
| `01-live-your-life.png` | Live a Life. Any Life. | Identity, stats, goals, achievements (core life-sim loop) |
| `02-choose-your-origin.png` | Your Story Starts Here. | 13 starting scenarios / replayability |
| `03-build-an-empire.png` | Build an Empire. | Net worth, crypto, stocks, luxury assets, passive income |
| `04-find-love.png` | Find Love. Or Lose It. | Dating & relationships |
| `05-leave-a-dynasty.png` | Leave a Dynasty. | Multi-generation family tree & inheritance |
| `06-go-viral.png` | Go Viral. Get Famous. | Social media, followers, fame |
| `_contact-sheet.png` | — | Preview grid of all six (not for upload) |

## Specs

- **Resolution:** 1290 × 2796 px (portrait) — Apple's **6.9"/6.7"** iPhone size class
  (iPhone 16/15 Pro Max etc.). This size is accepted across the modern iPhone classes;
  App Store Connect will down-scale it for smaller devices.
- **Format:** PNG, sRGB, no alpha. Each well under the 30 MB limit.
- **Design:** dark/premium theme using the app's real design tokens, real in-game art
  (character portraits, supercars, mansions, scenario icons) embedded into faithful
  recreations of the actual app screens, with bold gradient headlines + floating accents.

## Upload order (recommended)

1 → 2 → 3 → 4 → 5 → 6. The first screenshot is the primary/hero shot.

## Regenerating

```bash
node scripts/generate-app-store-screenshots.mjs
```

Requirements: `sharp` (SVG→PNG) and the **Inter** font available to fontconfig.
Edit copy, colors, layout, and which art is featured directly in
`scripts/generate-app-store-screenshots.mjs` (everything is data-driven at the top:
`THEMES`, `COPY`, and the per-screen builders). Re-run to re-export all six + the
contact sheet.

> Tip: For an Android/Google Play set you can add a 1080×1920 (or 1080×2400) export
> target in the script's `main()` render loop.
