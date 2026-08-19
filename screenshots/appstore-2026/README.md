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
3. `node scripts/capture-rich-state.mjs` → `rich-captures/` (35 numbered shots, `00`–`34`,
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
6. `npm run check:store-contrast` — measures the headline against the plate it
   is printed on, on both shelves, and fails under 4.5:1. Run it after any
   change to `ART`, to a crop, or to the scrim

Steps 4 and 5 share `scripts/lib/storeFrameSystem.mjs` — change the design
there, never in one generator.

## The design system

`scripts/lib/storeFrameSystem.mjs` holds the palette, the type scale, the art
library and the frame list; both generators import it, so the iPhone and iPad
sets cannot drift apart. Two rules run through all of it: **the frame is a
picture of a life, not of a phone** — and, because that is exactly the direction
a set drifts into being an advert, **the screenshot is still the subject.**

- **the game's own art behind every frame.** This is the 2026-08 change and the
  one that matters: every earlier version photographed a PHONE against a drawn
  gradient — ten product shots of a user interface, when the thing being sold
  is a life you gamble with and can lose. The binary already ships forty-plus
  cinematic renders (`assets/images/luxury/`, `Real Estate/`, `Vehicles/`,
  `Main_Menu/`) that every player sees inside the game and nobody deciding
  whether to become a player ever had. `ART` in the design module maps each
  frame to one of them, read from `assets/images/` directly so a frame can
  never advertise art the product does not contain
- **the scene has to carry its own light.** Every plate declares a relight
  (`bright`/`contrast`/`sat`, sometimes `hue`/`zoom`/`shade`) and a crop
  (`focus`), because these are wide renders being cut to a 1:2.17 canvas. Two
  plates were tried and rejected on that rule alone. The app icon's own
  main-menu art — a lone figure under a light shaft, on paper the perfect
  picture for frame 02 — is atmospheric at full size and flat black at the
  ~141px a carousel gives a frame; a plate whose subject is small and unlit has
  nothing to lift. And **cropping into a plate for texture costs its light**:
  frames 02, 06, 09 and 10 were first built from tight crops of open sea, a
  gallery corner and a stadium box, and all four washed out. Whole plates,
  wherever a whole plate will do
- **the luxury library is entirely WEALTH imagery**, which is the constraint
  that shapes the first two frames. "Start with nothing" cannot sit in front of
  a yacht. Frame 01 is the vineyard plate cropped away from the chateau and
  hue-turned cold, so it reads as an ordinary valley at first light; frame 07 is
  the same plate whole and warm. The same land, empty at the start and owned
  later — the only place in the set where one source is used twice, and it earns
  it. Frames 02 and 05 are the other side of the same constraint: a jet on wet
  tarmac and near-black marble, chosen for mood because nothing here can show
  an ordinary night
- **three compositions, not one.** `mode: 'solo'` for the frames whose argument
  is small text that has to survive a thumbnail (01, 02, 05, 08); `mode: 'trio'`
  — hero plus two flanks set back in 3D — where breadth is the point (04, 06,
  09); `mode: 'edge'` where the scene should out-argue the screen, with the
  device stepped off centre and turned (03, 07, 10). Ten frames sharing one
  composition is most of why the previous set read as a template rather than a
  series, and the claims test asserts all three modes are actually in use
- **the real capture never drops below `MIN_SCREEN_SHARE` (55%) of canvas
  height.** Guideline 2.3.3 asks that a screenshot represent the app in use, and
  the failure mode of an art-led set is shrinking the capture until the frame is
  an advert with a phone in the corner. `edgeH` is derived from that floor
  rather than chosen, and the test checks it on all three shelves
- **headline legibility is measured, not eyeballed.** `npm run check:store-contrast`
  renders each frame twice — once normally, once with the type hidden — and
  samples the p95 luminance of the backdrop the type actually sits on. Fails
  under 4.5:1, flags under the 7:1 target. A photograph has no luminance you can
  reason about from the CSS, which is how a headline ships unreadable over a
  golden-hour sky
- **the game's own objects, composited into the frame.** The luxury frame was
  the clearest failure of the first art-led pass: it is the frame about
  COLLECTIBLES and it showed none of them — a list of text cards over a yacht
  that had nothing to do with what the player owns. Every collectible in
  `lib/luxury/catalog.ts` ships with a render, and the catalog ids ARE the
  filenames in `assets/images/luxury/`. `PROPS` in the design module composites
  them in.
- **the compositing is free, and it constrains what qualifies.** These renders
  are shot as a subject on black, so `mix-blend-mode: lighten` knocks the black
  out against whatever is behind them — no cutout, no mask, no alpha. `screen`
  was tried and washes them out; `normal` shows the box. The catch is that the
  blend flatters a LIT object and destroys a DRAWN one: the three owned
  properties were tried as props and became glowing wireframes hanging in the
  vines, because their renders draw the building in neon outline. So `blend` is
  declared per prop and is never a default
- **a prop is a claim.** Frame 03's chip reads `2 OF 6 TROPHIES ACQUIRED` and
  its capture reads `Collection (2)`, so the two objects in the frame are the
  two the capture actually bought — the Rare Watch Collection ($250K) and the
  Museum-Grade Diamond ($600K), whose resale sums to the `$510K` the same screen
  prints. A third would be inventing a purchase, and the claims test checks
  every prop is registered and on disk
- props sit BEHIND the device, not in front. A blended object overlapping the
  phone would let the screenshot show through it, which is the opposite of the
  depth it is there to create
- flanks are dimmed, never blurred: a screenshot you cannot read is decoration,
  which is what made the 2026-07 flanks filler. They carry no claim; the chip
  always describes the hero
- **no device chrome.** A dark rim and a hairline, no metallic bezel and no
  notch. The chrome the old set drew was ~12% of the canvas spent on a picture
  of a phone — the thing this redesign is trying to stop being about — and with
  a real scene behind it the screen separates on contrast alone
- **one accent per frame**, and every one is a value from `lib/config/theme.ts`
  — the app's own colour for that domain. It appears in the accent word, the
  chip, the light the screen spills, and as a soft-light tone over the plate, so
  the accent is also the light in the room. No two adjacent frames share one
- the accent word is a single flat colour, never a gradient
- one proof chip per frame, same place, no rotation, and the number on it is one
  you can find in the screenshot below it
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

## The story — three acts, ten frames

Matches the `FRAMES` array in `scripts/lib/storeFrameSystem.mjs`. This is a
STORY, not a feature tour. The set it replaces listed ten domains in roughly the
order they were built, each frame arguing on its own; a life sim's product is
the ARC — the distance between where you start and where you end up — and the
whole of that arc now lands inside the **first three frames**, because three
screenshots is all a search result shows.

| # | Headline | Scene | Mode | Hero screen | Proof chip | Accent |
|---|----------|-------|------|-------------|------------|--------|
| | **Act I · the hook** — the only three a search result shows | | | | | |
| 01 | Start with **nothing.** | Cold valley at first light | solo | Home, week one (pre-grant) | `$1,500` to your name | infoLight |
| 02 | Every week, one **choice.** | Jet on wet tarmac, dusk | solo | Weekly event modal, OPEN | `Your call` · consequences included | danger |
| 03 | Buy the **impossible.** | Mega-yacht, golden hour + **both owned trophies** | edge | Luxury › **Collection** | `2 of 6` trophies acquired | gold |
| | **Act II · the systems** — why it is not a slot machine | | | | | |
| 04 | Play the **markets.** | City at night from a high floor | trio | Stocks · Bank + Crypto | `25 listed` tickers | gems |
| 05 | Work the **dark web.** | Near-black marble | solo | Onion darknet terminal | `Opsec Lv4` heat cold | successLight |
| 06 | Found the **company.** | Private box over a floodlit stadium | trio | Hustle / companies · Politics + Apps | `$8,000` a week in revenue | happiness |
| 07 | Own the **block.** | The valley again, warm and owned | edge | Real Estate › **Portfolio** | see the table row below | purple |
| 08 | Drive what you **earned.** | Showroom floor | edge (flipped) | Vehicles › **Garage** | `211 mph` exotic supercar · owned | money |
| | **Act III · the life** — why anyone starts a second one | | | | | |
| 09 | Fall for **someone.** | Private island at sunset | solo | Spark (dating profile) | `30 swipes` left · 1 super | reputation |
| 10 | Then do it **again.** | Harbour at dusk | edge | Home, 104 weeks later | `$11M` net worth · age 22 | gold |

**Frames 01 and 10 are the same screen.** Same character, photographed at week
one and again 104 weeks later: age 20 → 22, $1,500 → $11M, Unemployed →
Engineering Manager, Single → Married, Reputation `0 · Unknown` → `100 · Icon`.
Nothing else a store listing can do says "this is how far you get" as plainly as
the same screen twice, and it is why `capture-rich-state.mjs` photographs the
life on its way past week one instead of only at the end.

Three ordering decisions are worth arguing with rather than inheriting:

- **The payoff moved from slot 8 to slot 3.** Money-Wealth is 13 of the 87
  category-exact keywords, the largest money-shaped intent group in the account,
  and slot 8 is past the fold of a page most people never scroll.
- **Dating moved from slot 4 to slot 8.** It has ZERO keywords in
  `category-exact.csv`, so it earns a frame on retention grounds and not one of
  the three slots a scanner actually reaches. It is also the only human face in
  the set, which is why Act III is where a character appears at all.
- **Real estate gained slot 7**, which took a capture change rather than a
  design one — see below.

Order 01→10 is the upload order. Output sizes: **1320×2868** (iPhone 6.9",
Apple's current primary), **1284×2778** (iPhone 6.5"), **2064×2752** (13" iPad
Pro) — each rendered natively at its own canvas, never scaled from another.
iPhone captures are 1290×2796 (430×932 @3x); iPad captures are 2048×2732
(1024×1366 @2x); both scale losslessly inside the frames.

## Three panoramas, not one

The set this replaces sliced ONE continuous field across all ten cards. That
works when every card's background is a gradient the generator draws; it cannot
work when each card is a different photograph. So the continuity device — the
hue sweep and the horizon line — runs **per act**, and the two seams fall
exactly on the act breaks. A carousel still pulls you sideways within an act,
and the structure becomes visible rather than decorative.

The gutter is the part people get wrong: the App Store draws a gap between
screenshots, so slicing a field into equal pieces leaves the halves not meeting,
and the result looks like misaligned images — worse than not attempting it.
`GUTTER` in the design module is that allowance, and the virtual canvas for an
act of `n` frames is `n·W + (n-1)·gutter` wide.

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
- **Vehicles now has a frame too, and it was the most gated of the three.**
  The Vehicles app opens on a dealership behind a driver's licence — every Buy
  button reads "License needed" — so every previous capture of it was a picture
  of a locked shop. `buyVehicleAndShowGarage` buys the licence and an Exotic
  Supercar with cash, and the frame composites the game's own render of that car
  in front of the showroom plate. It cost the family frame: Apple caps a shelf
  at ten, and that was the weakest image in the set as well as the third frame
  serving LifeSim-Core, which frames 01 and 10 already carry between them.
- **Real estate now has its frame.** It had a group (8 keywords) and no frame
  for the whole life of this set, for one reason: the app opens on an EMPTY
  portfolio (`Portfolio equity $0`, `0 properties`, "You don't own any property
  yet"), and this set does not caption empty states. That was a capture gap
  being read as a content decision. `buyPropertyAndShowPortfolio` in
  `capture-rich-state.mjs` now buys through the app's own listing CTA — with
  cash rather than a mortgage, so the equity printed is simply what the
  properties are worth — and photographs the Portfolio tab.

## Eight frames do NOT use the obvious capture

Each one is a claim an earlier set could not back up.

- **03** is Luxury's **Collection** tab, and the capture *buys two pieces*
  through the app's own Buy button to fill it. Browse read `Collection (0)` and
  `0 / 6 collectibles` under the caption "Rare collection".
- **07** is Real Estate's **Portfolio** tab after the capture buys property.
  The tab the app opens on is an empty state, which is why this intent group
  had no frame at all until 2026-08.
- **08** is Vehicles' **Garage** tab after the capture buys a licence and a car.
  The tab the app opens on is a dealership with everything locked behind the
  licence gate.
- Contacts (used while a family frame existed) is not the Family tab. Shown large and alone the Family tab
  is an EMPTY STATE — a pink "Open the dating app" button under the words "No
  partner yet". Contacts carries the same idea and is full: parents, a spouse
  and both children.
- **01** and **10** are the same screen at opposite ends of a life, and **01**
  is shot BEFORE the dev-tools grants land, on the way past week one. Every
  other capture is the one rich late-game save, which can only ever show the
  destination — there was no picture of the start at all.
- **02** is the weekly event modal photographed OPEN, before the capture's
  clean-up pass empties the inbox. The event's text varies per run, so its
  claim rests on the modal's unconditional chrome — the "Choice Effects" panel.
- Education's Earned tab is no longer on the main page but the capture stays:
  the Catalog is a list of courses *not* taken, every row carrying a price and
  an Enroll button, so the old caption "PhD unlocked" described something the
  picture did not have.
- The Garage, considered for the luxury slot, opens on an economy sedan behind
  a "Get your driver’s licence — Pay $500" prompt.

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
