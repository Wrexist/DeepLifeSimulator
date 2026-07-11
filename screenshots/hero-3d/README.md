# Hero 3D App Store screenshots — DeepLife Simulator

Premium, immersive hero screenshots with **genuine CSS 3D** (perspective /
rotateY / translateZ), rasterized to PNG via Playwright/Chromium. This is the
"more alive, more 3D" refresh of the old flat SVG-skew hero set, rendering the
**current** game UI (dark glass, the new vitals, the redesigned Liquid Glass
event card) and the **real** in-game character art.

## Sizes (Apple spec)

| Folder | Device | Resolution |
|--------|--------|------------|
| `iphone/` | iPhone 6.9" (16/15 Pro Max …) | **1320 × 2868** |
| `ipad/`   | iPad 13" (Pro M4 / 12.9")     | **2064 × 2752** |

`_contact-<device>.png` is a preview strip — **not** for upload.

## The five frames (same story on both devices)

| # | Headline | Screen |
|---|----------|--------|
| 01 | Live any **life.** (purple) | Home — identity, stats, net worth |
| 02 | Hustle & **rise.** (gold) | Work — current job + street jobs |
| 03 | Build the **empire.** (emerald) | Market — gear, assets, property |
| 04 | Go **viral.** (cyan) | Phone — apps, followers, trending |
| 05 | Every choice **counts.** (amber) | The Liquid Glass "Heads Up" event card |

Upload order 01 → 05 (01 is the hero). Each frame: a per-frame accent, an
accent-word headline, floating glass "live" chips that pop forward in 3D, and a
tilted device showing a faithful render of the real screen.

## Regenerating

```bash
node scripts/generate-hero-3d.mjs        # all frames + contact sheets
node scripts/generate-hero-3d.mjs 2      # just frame N (fast iteration)
```

Requirements: Playwright + Chromium (pre-installed; `chromium.executablePath()`
resolves it). No `sharp` needed. Data-driven via the `FRAMES` array and the
`screen*()` builders at the top of the script; the on-device avatar embeds
`assets/images/Face/*.png` so it never drifts from the real game art.
