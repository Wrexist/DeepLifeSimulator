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
4. `node scripts/generate-appstore-2026-set.mjs` → `iphone-6.9/` (1320×2868)
   and `iphone-6.5/` (1284×2778)
5. `node scripts/generate-appstore-2026-ipad.mjs` → `ipad-13/` (2064×2752), from
   `rich-captures-ipad/`

Steps 4 and 5 share `scripts/lib/storeFrameSystem.mjs` — change the design
there, never in one generator.

## The design system

`scripts/lib/storeFrameSystem.mjs` holds the palette, the type scale and the
frame list; both generators import it, so the iPhone and iPad sets cannot drift
apart. One rule runs through all of it: **the screenshot is the subject.**

- one device per frame, straight on, centred, fully contained
- one palette across all ten frames — the set reads as a series because it is
- one type size, weight, colour and position; the accent word is a single
  colour, never a gradient
- one proof-point pill per frame, same place, no rotation
- nothing decorative that is not doing work

The type block is anchored by its BOTTOM edge, so a headline that wraps grows
upward into the top margin and the device stays at exactly the same height in
every frame.

`docs/store-screenshot-design.md` records what the previous version did instead
— 40 emoji stickers, three-stop gradient type, a different palette per frame,
fake star dust, a halo ring, three skewed phones, a rotated gradient badge and a
gloss sweep over the UI — and why the result read as machine-made.
`generate-appstore-2026-samples.mjs` produced the style candidates for that
older direction and is superseded.

## The 10-image narrative (as shipped)

Matches the `FRAMES` array in `scripts/lib/storeFrameSystem.mjs`. One real screen each.

| # | Headline | Screen |
|---|----------|--------|
| 01 | Live any **life.** | Home / identity card |
| 02 | Find your **person.** | Spark (dating profile) |
| 03 | Build an **empire.** | Hustle / companies |
| 04 | Ride the **bull run.** | Crypto markets |
| 05 | Go **viral.** | Pulse (social feed) |
| 06 | Enter the **dark web.** | Onion darknet terminal |
| 07 | A phone full of **lives.** | Apps grid |
| 08 | Train your **mind.** | Education |
| 09 | Live the **luxury.** | Luxury & collectibles |
| 10 | Raise a **family.** | Contacts (parents, spouse, both children) |

Two frames deliberately do NOT use the obvious capture. Shown large and alone,
the Garage opens on an economy sedan behind a "Pay $500" licence prompt, and
the Family tab is an EMPTY STATE — "No partner yet" over a pink call to action,
a dev-tools artifact. Luxury and Contacts carry the same ideas with full
screens.

Order 01→10 is the upload order (01 is the primary hero). Output sizes:
**1320×2868** (iPhone 6.9", Apple's current primary), **1284×2778** (iPhone
6.5"), and **2064×2752** (13" iPad Pro). iPhone captures are 1290×2796
(430×932 @3x); iPad captures are 2048×2732 (1024×1366 @2x); both scale
losslessly inside the frames.
