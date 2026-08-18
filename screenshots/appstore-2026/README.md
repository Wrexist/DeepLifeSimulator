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
3. `node scripts/capture-rich-state.mjs` → `rich-captures/` (30 numbered shots, `00`–`29`,
   each with its on-screen text written beside it as `NN-name.txt`)
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

- one device per frame, straight on, centred, fully contained — sized from the
  height it is given, so it fills the frame with the tab bar intact
- one ground, one type scale, one layout, one device treatment, one bloom
  position across all ten
- **one accent per frame**, and every one is a value from `lib/config/theme.ts`
  — the app's own colour for that domain. It appears in exactly three places:
  the accent word, the pill, and the light the screen spills on the ground.
  This is not the "ten palettes" tell from the 2026-07 set: there, each frame
  declared its own three glows *and* its own three accents, so ten frames
  shared nothing
- the accent word is a single flat colour, never a gradient
- one proof-point pill per frame, same place, no rotation, and the number on it
  is one you can find in the screenshot below it
- nothing decorative that is not doing work

The type block is anchored by its BOTTOM edge, so a headline that wraps grows
upward into the top margin and the device stays at exactly the same height in
every frame.

Type is **Inter Tight, embedded as base64** in the frame HTML. A
`-apple-system, 'SF Pro Display', …` stack has nothing to resolve to on a CI
box or in a container and fell through to Liberation Sans, so the shipped
headline was set in an Arial clone — and in whatever else happened to be
installed on the next machine. `scripts/lib/fonts/README.md` has the licence.

Each canvas derives its own numbers from `layoutFor(W, H, kind)` and renders
natively. The version this replaces laid out one 1320×2868 canvas and scaled it
to 6.5" with `transform:scale(0.9727, 0.9686)`, so that whole set shipped 0.4%
anamorphically squashed.

`docs/store-screenshot-design.md` records what the previous version did instead
— 40 emoji stickers, three-stop gradient type, a different palette per frame,
fake star dust, a halo ring, three skewed phones, a rotated gradient badge and a
gloss sweep over the UI — and why the result read as machine-made.
`generate-appstore-2026-samples.mjs` produced the style candidates for that
older direction and is superseded.

## The 10-image narrative (as shipped)

Matches the `FRAMES` array in `scripts/lib/storeFrameSystem.mjs`. One real
screen each; the accent hue is the app's own colour for that domain, from
`lib/config/theme.ts`.

| # | Headline | Screen | Proof pill | Accent |
|---|----------|--------|------------|--------|
| 01 | Live any **life.** | Home / identity card | `$11M` net worth · age 22 | infoLight |
| 02 | Find your **person.** | Spark (dating profile) | `30 swipes` left · 1 super | reputation |
| 03 | Build an **empire.** | Hustle / companies | `$8,000` a week in revenue | money |
| 04 | Ride the **bull run.** | Crypto markets | `2.000 BTC` held · bull regime | happiness |
| 05 | Work the **market.** | Stocks | `25 listed` tickers · sector rotation | infoLight |
| 06 | Enter the **dark web.** | Onion darknet terminal | `Opsec Lv4` heat cold | successLight |
| 07 | A phone full of **lives.** | Apps grid | `6 apps` on the phone | gems |
| 08 | Train your **mind.** | Education › **Earned** | `7 credentials` earned | fitness |
| 09 | Live the **luxury.** | Luxury › **Collection** | `2 of 6` trophies acquired | purple |
| 10 | Raise a **family.** | Contacts | `5 people` in your circle | reputation |

Order 01→10 is the upload order (01 is the primary hero; the first two are the
only ones most store visitors ever see). Output sizes: **1320×2868** (iPhone
6.9", Apple's current primary), **1284×2778** (iPhone 6.5"), and **2064×2752**
(13" iPad Pro) — each rendered natively at its own canvas, never scaled from
another. iPhone captures are 1290×2796 (430×932 @3x); iPad captures are
2048×2732 (1024×1366 @2x); both scale losslessly inside the frames.

## Four frames do NOT use the obvious capture

Each one is a claim an earlier set could not back up.

- **08** is Education's **Earned** tab, not the Catalog. The Catalog is a list
  of courses *not* taken, every row carrying a price and an Enroll button — so
  the old caption "PhD unlocked" described something the picture did not have.
  Earned is a transcript: `7 credentials earned`, each stamped *Graduated · On
  record*.
- **09** is Luxury's **Collection** tab, and the capture *buys two pieces*
  through the app's own Buy button to fill it. Browse read `Collection (0)` and
  `0 / 6 collectibles` under the caption "Rare collection".
- **10** is Contacts, not the Family tab. Shown large and alone the Family tab
  is an EMPTY STATE — a pink "Open the dating app" button under the words "No
  partner yet". Contacts carries the same idea and is full: parents, a spouse
  and both children.
- **09**'s alternative, the Garage, opens on an economy sedan behind a "Get
  your driver’s licence — Pay $500" prompt.

## The claims are tested, not trusted

`shot()` writes each capture’s on-screen text to `NN-name.txt` beside the PNG,
and every entry in `FRAMES` declares an `assert` list of literal strings that
must appear in it. `__tests__/tooling/storeFrameClaims.test.ts` checks the pair.

A re-capture that lands in a different game state, or a UI reword, therefore
fails in CI — not on the product page. That matters because Guideline 2.3.3
rejections cost a full review cycle and return every attached IAP marked
"Rejected" alongside the build.

Two rules follow from this for anyone editing the frame copy:

1. **Put the number that is in the picture on the pill.** Not a rounder one,
   not a better one.
2. **Do not use a number the game re-rolls.** `$61,911` of Bitcoin and
   `15 advancing · 10 declining` were both true of exactly one capture.
   `2.000 BTC` is granted flat and `25 listed` is the size of the ticker table,
   so both stay true.
