# App Store Screenshots — DeepLife Simulator

Immersive, ready-to-upload marketing screenshots for the App Store, designed for
the life-sim genre and built from the app's real theme tokens + real in-game art
(character portraits, supercars, mansions, scenario icons).

## Folders & sizes (verified against Apple's spec)

| Folder | Device class | Resolution | Notes |
|--------|--------------|------------|-------|
| `iphone-6.9/` | iPhone 6.9" (16/15 Pro Max …) | **1320 × 2868** | Apple's current required iPhone base size. Auto-scales to all smaller iPhones. |
| `iphone-hero/` | iPhone 6.5" (hero set) | **1284 × 2778** | Premium "hero" presentation — a 3D-tilted titanium phone, ambient accent glow, and floating glass "live" chips. 5 frames. |
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

## The hero set (`iphone-hero/`)

Five premium, immersive frames built for maximum scroll-stopping appeal — the
modern App-Store "hero" style: a titanium iPhone tilted in 3D, one ambient
accent color per frame, a bold accent-word caption, and floating glass "live"
chips that pop forward off the device for depth. The on-device art is the app's
own real screens (reused from the base generator), so it never drifts from the UI.

| # | Caption | Accent | Showcases |
|---|---------|--------|-----------|
| 01 | Live any **life.** | purple | Identity, stats, goals, achievements |
| 02 | Build the **empire.** | emerald | Net worth, crypto, stocks, passive income |
| 03 | Find your **person.** | pink | Dating & relationships |
| 04 | Go **viral.** | cyan | Social feed, followers, fame |
| 05 | Leave a **dynasty.** | gold | Multi-generation family tree & inheritance |

## Regenerating

```bash
node scripts/generate-app-store-screenshots.mjs   # iphone-6.9/ + ipad-13/ (12 PNGs)
node scripts/generate-hero-screenshots.mjs        # iphone-hero/ (5 hero PNGs)
```

Requirements: `sharp` (SVG→PNG) and the **Inter** font available to fontconfig.
The base sets are data-driven at the top of the script (`THEMES`, `COPY`) and in
the per-screen builders (`screen1…6` for iPhone, `ipadScreen1…6` for iPad). The
hero set is data-driven via the `FRAMES` array at the top of
`generate-hero-screenshots.mjs` (caption, accent, tilt direction, and the
floating-chip stats per frame) and reuses the base screens via `buildDeviceLayer()`.

> For a Google Play set, add a 1080×1920 (or 1080×2400) target to `main()`.
