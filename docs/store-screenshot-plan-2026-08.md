# App Store screenshot plan — August 2026

The current set is accurate, well-built and boring. This records why, what the
evidence says, and what to replace it with. Companion to
[`store-screenshot-design.md`](store-screenshot-design.md), which documents the
system that renders the frames; this document is about what goes *in* them.

---

## 1. The problem in one number

`marketing/apple-ads/08-first-results-2026-08.md`, seven days of Search Ads:

| Signal | Us | Benchmark | Read |
|---|---|---|---|
| Category-exact TTR | **18.82%** | 7.72% (Games, the lowest category on the store) | 2.4× — demand is real |
| Product page CR | **40%** | 66.2% | 0.6× — **the leak** |
| CPA | $2.18 | $12.28 US Games median CPI | 5.6× cheaper than median |

People searching the genre tap at more than twice the category rate, land on the
page, and leave. Lifting CR to benchmark drops CPA $2.18 → $1.32: **+65%
installs at identical spend.** The account is paused behind a gate reading
"page conversion ≥ 55%". The page is mostly ten images.

**A search result shows three screenshots.** Frames 4–10 are only seen by
someone who already scrolled, i.e. someone already half sold. Frames 1–3 do the
work or nothing does.

---

## 2. Why the current set is boring

Five rounds went into the frame *around* the screenshot — panorama slicing with
gutter compensation, three shelves rendered natively, an embedded typeface,
`__tests__/tooling/storeFrameClaims.test.ts` failing the build when a caption
claims something its capture does not show. All of that is right and all of it
stays. None of it addressed what is inside the frame.

1. **The subject of every frame is a phone.** Ten product shots of a device. The
   thing being sold — a life you gamble with and can lose — never appears.
2. **The same composition ten times.** Identical centre hero, identical flank
   pair at identical angles, identical headline slot. Across ten frames the only
   variable is accent hue, which teaches the eye it has already seen frames 2–10.
3. **No face, nothing at stake.** One human face in the set (frame 4, ~6% of the
   canvas) and no frame showing a consequence. Character-led creative
   consistently outperforms abstract creative.
4. **The app's UI is poor raw material at this size.** Navy-on-navy, 11pt labels,
   four-decimal figures — correct for a game you read closely, wrong for an image
   that gets ~141px and half a second. Below ~200px the hero screen is grey
   texture. Not fixable by re-capturing.
5. **The best art in the app has never reached the store page.** 40+ cinematic
   renders ship in the binary (`assets/images/luxury/`, `Real Estate/`,
   `Vehicles/`, `Main_Menu/`). Every player sees them; nobody deciding whether to
   become a player ever has. Largest unused asset in the repo.

---

## 3. Demand — which screens deserve a slot

Group sizes from `marketing/apple-ads/keywords/category-exact.csv`:

| Intent group | Keywords | Current frame | Verdict |
|---|---:|---|---|
| LifeSim-Core | 18 | 1, 9, 10 | covered |
| Money-Wealth | 13 | 8 | buried past the fold |
| Investing-Stocks | 12 | 5 | covered |
| Crime-Underground | 10 | 6 | covered |
| Business-Tycoon | 10 | 7 | covered |
| RealEstate | 8 | — | **gap** |
| Choices-Story | 8 | 3 | covered |
| Career-Job | 8 | 2 | covered |
| Dating | 0 | 4 | premium slot, no search demand |
| Education | 0 | — | correctly cut |

43 of 87 category keywords are about money, and the frame that shows money as a
*result* sits at slot 8 where a search result never reaches. Real estate has 8
keywords and no frame purely because its capture lands on an empty portfolio
(`$0 · 0 properties`) — a capture-pipeline gap mistaken for a content decision.

---

## 4. The direction — art-led scenes

A throwaway renderer tested one variable: replace the flat gradient behind the
devices with the game's own art, full-bleed. Identical captures, identical
headlines, identical layout. The golden-hour mega-yacht and the neon-lit condo
transform their frames; the main-menu art barely improves on the original.

That is a visual judgement on three frames, **not a measured conversion test.**
What it does establish is a constraint: **the scene has to carry light.** Every
art plate gets a directional relight and a contrast floor, or it does not ship.

---

## 5. The proposed set — three acts, ten frames

| # | Headline | Scene | Hero screen | Answers |
|---:|---|---|---|---|
| | **Act I — the hook (the only three a search shows)** | | | |
| 1 | You start with $1,500. | Cold dawn city, relit | Week 1 home · age 20 · unemployed | LifeSim-Core |
| 2 | Every week, one choice. | Held breath — tight, low light | Decision modal, open, both outcomes legible | Choices-Story |
| 3 | Buy the impossible. | Mega-yacht, golden hour | Collection · $510K · 2 of 6 trophies | Money-Wealth |
| | **Act II — the systems** | | | |
| 4 | Play the markets. | Trading floor glass, blue hour | Stocks · 25 tickers · six sectors | Investing-Stocks |
| 5 | Work the dark web. | Monitor glow in the dark | Terminal · live job | Crime-Underground |
| 6 | Found the company. | Neon office tower at night | Empire snapshot · $8,000/wk | Business-Tycoon |
| 7 | Own the block. | Modern mansion, lit interior | Property portfolio *(needs capture work)* | RealEstate |
| | **Act III — the life** | | | |
| 8 | Fall for someone. | Warm city night, shallow focus | Spark · match · rapport | retention, not search |
| 9 | Raise a family. | Warm interior, lamplight | Contacts · named children | LifeSim-Core |
| 10 | Then do it all again. | Cliff edge at dusk, relit | Legacy · $11M net worth · age 82 | LifeSim-Core |

Three deliberate changes: **the payoff moves from slot 8 to slot 3** (13 keywords
search for it; slot 8 is invisible), **dating moves from 4 to 8** (keeps its
frame, loses a premium slot it has no demand for), **real estate gets slot 7**
(requires teaching `capture-rich-state.mjs` to buy a property, the same pattern
`buyLuxuryAndShowCollection` already uses).

**Three panoramas, not one.** One continuous background across ten different
photographs is impossible. Instead one panorama *per act* — 3 / 4 / 3 — so the
carousel still pulls sideways and the two seams land on the act breaks.

---

## 6. Constraints the rebuild holds

- **Guideline 2.3.3 stays satisfied.** Every frame keeps one real, unretouched
  capture at ≥55% of frame height with its numbers legible. The art is the room
  the screen sits in, never a replacement for it. `storeFrameClaims.test.ts`
  keeps running against both shelves' visible-text sidecars.
- **The scene carries light.** Directional relight + measured contrast floor;
  headline over art holds ≥7:1.
- **One hue per act, not per frame.** The adjacent-hue assertion in the test
  becomes an adjacent-act assertion.
- **No decorative one-sided borders** — Hard Rule #7 applies to the store
  creative too, so the page and the product look like the same object.
- **No device chrome.** A rounded panel with a hairline, no bezel or notch;
  returns ~12% of the canvas to the picture.
- **Everything mechanical stays** — native render per canvas (no anamorphic
  squash), PNG-24 without alpha, `pruneOrphans`, one shared frame table read by
  both generators and the test.

---

## 7. Open decisions

| | Question | Recommendation |
|---|---|---|
| A | Art-led scenes, or tighten the gradient system? | Art-led. More execution on the gradient set will not fix that its subject is a phone. |
| B | Does the luxury payoff move to slot 3? | Yes — nothing-to-yacht inside the three frames a search shows is the whole pitch in one glance. |
| C | Is dating demoted 4 → 8? | Demote, keep. A face in Act I instead is a different Act I; decide before the build. |
| D | Extend the capture script to buy a property? | Yes — ~1h, and 8 keywords with no frame is the clearest gap in the set. |
| E | Marketing rights to the generated art? | **Blocking if no.** `assets/images/luxury/ART-PROMPTS.md` indicates the renders were generated for the project; in-app and store-marketing use are usually covered the same way, but the store page is where it is worth confirming. Fallback is the vector scenario art and the avatar renderer. |

---

## 8. Cost and risk

- **~1 day.** Capture extension ~1h · art relight/plates ~2h · design-system
  rewrite in `scripts/lib/storeFrameSystem.mjs` ~3h · 30 renders ~20 min ·
  claims-test update ~1h.
- **The outcome is not mine to claim.** Restart `DLS-US-Category-Exact` at
  $12/day once the set is live and read page CR after ~200 taps.
- **Screenshots are the biggest lever, not the only one.** The results doc also
  names the app preview video, the subtitle/keyword field, and a rating count
  above 1.
- **Risk: the art oversells.** A yacht behind a spreadsheet can read as a
  different game. Mitigated by the ≥55% legible-capture floor — the real screen
  stays the loudest object in the frame.
