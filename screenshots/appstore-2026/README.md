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
3. `node scripts/capture-rich-state.mjs` → `rich-captures/` (33 numbered shots, `00`–`32`,
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

- **three devices per frame**: a hero straight on, centred and fully contained
  — sized from the height it is given, so it fills the frame with the tab bar
  intact — plus two flanking screens set back in 3D and dimmed. The flanks are
  never blurred: a screenshot you cannot read is decoration, which is what made
  the 2026-07 flanks filler. They carry no claim; the pill always describes the
  hero
- the flanks differ per shelf because the canvas SHAPE does: raised above the
  hero on the tall phone canvas, standing on the hero's baseline on the wide
  tablet one
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

## The story — ten frames, one life

Matches the `FRAMES` array in `scripts/lib/storeFrameSystem.mjs`. This is a
STORY, not a feature tour, and that is the change that matters most: the set it
replaces listed ten domains in no particular order, each frame arguing on its
own. A life sim's product is the ARC — the distance between where you start and
where you end up.

| # | Headline | Hero screen | Flanks | Proof chip | Accent |
|---|----------|-------------|--------|------------|--------|
| 01 | Start with **nothing.** | Home, week one (pre-grant) | Work · Bank | `$1,500` to your name | infoLight |
| 02 | Take any **job.** | Work / street jobs | Home · Market | `3 ways` to earn this week | happiness |
| 03 | Every week, a **decision.** | Weekly event modal, OPEN | Life · Market | `Your call` · consequences included | danger |
| 04 | Fall for **someone.** | Spark (dating profile) | Contacts · Pulse | `30 swipes` left · 1 super | reputation |
| 05 | Play the **markets.** | Stocks | Bank · Crypto | `25 listed` tickers | purple |
| 06 | Work the **dark web.** | Onion darknet terminal | Crypto · Desktop | `Opsec Lv4` heat cold | successLight |
| 07 | Build the **empire.** | Hustle / companies | Politics · Apps | `$8,000` a week in revenue | money |
| 08 | Buy the **impossible.** | Luxury › **Collection** | Garage · Travel | `2 of 6` trophies acquired | gems |
| 09 | Raise a **family.** | Contacts | Spark · Life | `5 people` in your circle | reputation |
| 10 | Leave a **legacy.** | Home, 104 weeks later | Stocks · Luxury | `$11M` net worth · age 22 | gold |

**Frames 01 and 10 are the same screen.** Same character — Isaac Carter, the
Food Courier scenario — photographed at week one and again 104 weeks later:
age 20 → 22, $1,500 → $11M, Unemployed → Engineering Manager, Single → Married,
Reputation `0 · Unknown` → `100 · Icon`. Nothing else a store listing can do
says "this is how far you get" as plainly as the same screen twice, and it is
the reason `capture-rich-state.mjs` now photographs the life on its way past
week one instead of only at the end.

Frames **01–03 have to work alone**: iOS renders the first three in search
results before anyone opens the product page, so they carry hook → mechanic →
stakes without the other seven.

Order 01→10 is the upload order. Output sizes: **1320×2868** (iPhone 6.9",
Apple's current primary), **1284×2778** (iPhone 6.5"), **2064×2752** (13" iPad
Pro) — each rendered natively at its own canvas, never scaled from another.
iPhone captures are 1290×2796 (430×932 @3x); iPad captures are 2048×2732
(1024×1366 @2x); both scale losslessly inside the frames.

## The background is one panorama, sliced into ten

The ten cards are windows onto a single field `10·W + 9·gutter` wide. Each
frame contributes a wash of its own accent hue centred on its own card, so
every frame carries its neighbours' colour bleeding in from both edges and the
carousel reads as one continuous place rather than ten separate images.

The gutter is the part people get wrong: the App Store draws a gap between
screenshots, so slicing a panorama into ten EQUAL pieces leaves the halves not
meeting, and the result looks like ten misaligned images — worse than not
attempting it. `GUTTER` in the design module is that allowance.

## Which screens hold the ten slots — a demand decision

The Apple Ads account (`marketing/apple-ads/`) ranks the search themes people
actually arrive through, by its own keyword investment: LifeSim-Core (18
keywords), Money-Wealth (13), Investing-Stocks (12), Crime-Underground (10),
Business-Tycoon (10), RealEstate (8), Choices-Story (8), Career-Job (8). Its
first live run also showed the product page converting at 0.6× benchmark — the
page, not demand, is the leak these frames exist to fix.

Two consequences are baked into the set:

- **Education has NO ad group anywhere**, so the Earned-transcript frame gave
  its slot to the open weekly decision — which the Choices-Story group ("choices
  game" is flagged large-volume) and `CPP-LifeSim` slot 2 both ask for.
  The Earned capture stays on disk for `CPP-Career`.
- **Real estate has a group (8 keywords) and no frame.** Its capture is an
  empty portfolio ($0 · 0 properties · "You don't own any property yet"), and
  this set does not caption empty states. Featuring it waits on a capture step
  that buys a property through the app's own UI, the way the luxury frame buys
  its two trophies.

## Six frames do NOT use the obvious capture

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
- **01** and **02** are shot BEFORE the dev-tools grants land, on the way past
  week one. Every other capture is the one rich late-game save, which can only
  ever show the destination — there was no picture of the start at all.
- **03** is the weekly event modal photographed OPEN, before the capture's
  clean-up pass empties the inbox. The event's text varies per run, so its
  claim rests on the modal's unconditional chrome — the "Choice Effects" panel.
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
