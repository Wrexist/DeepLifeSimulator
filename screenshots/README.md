# App Store Screenshots — DeepLife Simulator

Immersive, ready-to-upload marketing screenshots for the App Store, designed for
the life-sim genre and built from the app's real theme tokens + real in-game art
(character portraits, supercars, mansions, scenario icons).

## Folders & sizes (verified against Apple's spec)

| Folder | Device class | Resolution | Notes |
|--------|--------------|------------|-------|
| `iphone-6.9/` | iPhone 6.9" (16/15 Pro Max …) | **1320 × 2868** | Apple's current required iPhone base size. Auto-scales to all smaller iPhones. |
| `ipad-13/` | iPad 13" (Pro M4 / 12.9") | **2064 × 2752** | Required for iPad apps (this app has `supportsTablet: true`). Auto-scales to 12.9" (2048×2732) and smaller iPads. |

Both sets: portrait PNG, 6 screenshots each, plus a `_contact-sheet.png` preview
(the contact sheet is **not** for upload).

> 1290 × 2796 (6.7") is also an accepted iPhone size; 1320 × 2868 is the current
> primary and is what's generated here so there's zero ambiguity at upload.

## The six screens (same story on both devices)

| # | Headline | Showcases |
|---|----------|-----------|
| 01 | Live a Life. Any Life. | Identity, stats, goals, achievements (core loop) |
| 02 | Your Story Starts Here. | Starting scenarios / replayability |
| 03 | Build an Empire. | Net worth, crypto, stocks, luxury assets, passive income |
| 04 | Find Love. Or Lose It. | Dating & relationships |
| 05 | Leave a Dynasty. | Multi-generation family tree & inheritance |
| 06 | Go Viral. Get Famous. | Social media, followers, fame |

Upload order: 01 → 06 (01 is the primary/hero shot). The iPhone set uses tall
single-column app screens; the iPad set uses native wide two-column tablet layouts.

## Regenerating

```bash
node scripts/generate-app-store-screenshots.mjs
```

Requirements: `sharp` (SVG→PNG) and the **Inter** font available to fontconfig.
Everything is data-driven at the top of the script (`THEMES`, `COPY`) and in the
per-screen builders (`screen1…6` for iPhone, `ipadScreen1…6` for iPad). Re-run to
re-export all 12 PNGs + both contact sheets.

> For a Google Play set, add a 1080×1920 (or 1080×2400) target to `main()`.
