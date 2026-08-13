# App Store 2026 — Immersive Screenshot Set

New-generation App Store images built from **real gameplay captures** (not mock
HTML): the game is driven end-to-end with Playwright, a rich late-game save is
built through the in-app Dev Tools, and every frame is a true 1290×2796 @3x
capture of the shipping UI.

> **Re-running this?** `capture-rich-state.mjs` drives the app by its on-screen
> LABELS, so it goes stale whenever the UI is reworded, and it goes stale
> SILENTLY — a missed label just means a shot is never written and the previous
> run's file stays on disk, so the set rebuilds from a mix of new and stale
> captures with nothing red anywhere. That is the Guideline 2.3.3 problem this
> whole directory exists to fix, reintroduced by the tool meant to fix it.
> Three staleness bugs were found and fixed in 2026-08:
>
> - it waited for `New Game` on the main menu — a label that only appears once a
>   save EXISTS. A fresh capture profile shows `Play` / `Custom life`, so every
>   run hung to its 120-second timeout before failing.
> - it waited for `Create Identity`, since renamed `Create Character`.
> - it matched the market's Computer row on `$5000`, the item's BASE price,
>   while the market applies inflation — by that point in a rich run the card
>   reads $5,300. The computer was never bought, so the desktop launcher never
>   opened, and the six desktop-app shots (including the Dark Web terminal used
>   by frame 06 and the Garage used by frame 09) silently kept their old files.
>
> The script now **throws** if the desktop launcher is missing rather than
> carrying on. If you add a capture, give it the same treatment: assert the
> screen you meant to reach, do not just photograph whatever is in front of you.

## Pipeline

1. `EXPO_PUBLIC_ENABLE_DEVTOOLS=true EXPO_PUBLIC_SAVE_HMAC_KEY=<any> EXPO_PUBLIC_REQUIRE_SIGNED_SAVES=false EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION=true EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES=true npx expo export --platform web --clear --output-dir <dir>`
2. `node scripts/serve-web-export.mjs <dir> 8090`
   (a 30-line static server with SPA fallback, so the pipeline needs no network
   install; `npx serve -l 8090 -s <dir>` does the same if you have it)
3. `node scripts/capture-rich-state.mjs` → `rich-captures/` (28 numbered shots, `00`–`27`)
   - onboarding (Food Courier → Business Empire ambition)
   - Dev Tools: god-mode on, 2×52-week skips, top career, company, education,
     spouse+kids, ~$11M net worth, gems, prestige, maxed stats + Darkweb setup → save
   - reload → menu → Continue (clean state, no dev modals) → capture every tab
     and phone app (Spark, Pulse, Stocks, Bank, Contacts, Education), then buy a
     Computer in-game and capture the desktop-launcher apps (Hustle/companies,
     Dark Web, Crypto, Real Estate, Garage, Luxury, Politics, Travel, …)
   - re-run with `VIEW_W=1024 VIEW_H=1366 DSF=2 OUT=<...>/rich-captures-ipad`
     for the native tablet layouts (2048×2732)
4. `node scripts/generate-appstore-2026-samples.mjs` → `style-samples/`
   (three 1320×2868 style candidates for image #1 — used once to pick a style)
5. `node scripts/generate-appstore-2026-set.mjs` → `iphone-6.9/` (1320×2868) and
   `iphone-6.5/` (1284×2778) — the final iPhone set (style C, "Life in Motion")
6. `node scripts/generate-appstore-2026-ipad.mjs` → `ipad-13/` (2064×2752), from
   `rich-captures-ipad/`

## The 3 style candidates (`style-samples/`)

| Sample | Style | Idea |
|--------|-------|------|
| `sample-A-cinematic` | **Aurora Stage** | Straight-on titanium phone on an ambient aurora backdrop, big headline, floating glass "live" chips ($11M · Married · +2.75% · Level 6) popping off the device |
| `sample-B-fullbleed` | **Inside the Game** | The real screenshot fills the entire canvas edge-to-edge, cinematic scrim + huge type — feels like standing inside the app |
| `sample-C-collage` | **Life in Motion** | Three overlapping angled phones (Home + Spark + Stocks), vivid gradient, emoji stickers and a net-worth badge — playful, content-rich |

## The 10-image narrative (as shipped)

Matches the `FRAMES` array in `generate-appstore-2026-set.mjs` /
`generate-appstore-2026-ipad.mjs`. Each frame is a three-phone collage: a main
(hero) screen plus two angled side screens.

| # | Headline | Main screen | Accent |
|---|----------|-------------|--------|
| 01 | Live any **life.** | Home / identity ($11M, married, Icon standing) | pink→cyan |
| 02 | Find your **person.** | Spark (dating swipe card) | pink |
| 03 | Build the **empire.** | Hustle / companies (empire dashboard) | indigo |
| 04 | Ride the **bull run.** | Crypto (market + BTC holdings) | emerald→gold |
| 05 | Go **viral.** | Pulse (social feed) | magenta |
| 06 | Enter the **dark web.** | Onion darknet terminal (heat / opsec) | green→violet |
| 07 | A phone full of **lives.** | Apps grid (Spark/Contacts/Pulse/Stocks/Bank/Education…) | cyan |
| 08 | Train your **mind.** | Education (degrees & skills) | teal |
| 09 | Live the **luxury.** | Garage dealership (+ Luxury collectibles) | gold→orange |
| 10 | Your story, your **rules.** | Home goals / ambition milestones (+ Family) | violet |

Order 01→10 is the upload order (01 is the primary hero). Output sizes:
**1320×2868** (iPhone 6.9", Apple's current primary), **1284×2778** (iPhone
6.5"), and **2064×2752** (13" iPad Pro). iPhone captures are 1290×2796
(430×932 @3x); iPad captures are 2048×2732 (1024×1366 @2x); both scale
losslessly inside the frames.
