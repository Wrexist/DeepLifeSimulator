# Store screenshots — what read as AI, and the system that replaced it

The 2026 set was rebuilt from real gameplay captures and was still rejected as
looking machine-made. This records what specifically produced that impression,
because the captures underneath were never the problem — the composition around
them was.

## The tells, itemised

Each of these is a real property of the old generator, not a vague impression.

| # | Tell | What it was |
|---|---|---|
| 1 | **Emoji stickers** | Four per frame at 118px, each individually rotated (−12°, +10°, +8°, −8°) with a drop shadow. 💍 🚀 🏝️ 💎 🌹 👑 🤝 📊 💰 🔥 📣 ⭐ 💬 🕶️ 💻 🔒 ₿ 📱 🎓 📚 🧠 🏆 ⌚ 🚤 🎯 🧭 ✨ … **40 across the set.** This is the loudest signal by a distance. No premium app or game set on either store scatters emoji over its screenshots. |
| 2 | **Rainbow gradient text** | The accent word ran a *three*-colour gradient (`linear-gradient(90deg, #f472b6, #a78bfa, #22d3ee)`). Multi-stop gradient type is the single most recognisable template-generator flourish. |
| 3 | **A different palette on every frame** | Each frame declared its own three background glow colours and its own three accent colours — pink/cyan/violet, then indigo/emerald, then gold, then magenta. Ten frames, ten palettes. The set had no identity; it read as ten images generated in isolation, which is exactly what it was. |
| 4 | **Fake star dust** | Eight hardcoded white dots at fixed percentages pretending to be a starfield. |
| 5 | **A halo ring** | A 1080px empty circle outline floating behind the device, decorating nothing. |
| 6 | **Three phones in 3D perspective** | A main device plus two side devices at `rotateY(±24deg) rotateZ(∓9deg)`, positioned at `left:-160px` and `right:-160px` so both were cropped by the canvas. Their content was too small and too skewed to read — pure texture. Worse, they *hid the product*: the thing being sold was reduced to about a third of the frame. |
| 7 | **A rotated gradient sticker** | The stat badge sat at −4° with a two-colour gradient fill and a heavy shadow. |
| 8 | **A gloss sweep over every screen** | A diagonal white wash across the real UI. It obscured the actual interface to add a "shine" that no real device produces. |
| 9 | **A repeated kicker** | `DEEP LIFE SIMULATOR` in 34px letter-spaced caps on all ten frames, directly above where the store already prints the app's name. |
| 10 | **Over-tight display type** | 158px at `letter-spacing:-5px`, weight 900. Crushed enough that letters collide, which is what happens when a size is chosen to fill a box rather than to be read. |

The common thread: **every one of them is decoration applied ON TOP of the
product rather than a decision about how to present it.** That is what makes
work look automated — not any single effect, but the absence of a system, and
the sheer number of unrelated flourishes competing in one frame.

## The system that replaced it

One rule behind all of it: **the screenshot is the subject; everything else is
there to frame it.**

- **One device per frame**, straight on, centred, fully contained with real
  margins. It is the largest element in the composition. The UI is legible,
  which is the entire point of a store screenshot.
- **One palette across all ten frames.** A single dark navy ground taken from
  the app's own `#0B1220`, one blue accent from its primary, one soft bloom in
  a fixed position. The set reads as a series because it is one.
- **Type as a system, not per-frame art.** One size, one weight, one position,
  one colour. The accent word is a *single* accent colour — no gradient. Sizes
  are set so the longest headline in the set still fits on two lines without
  crushing the tracking.
- **One proof point per frame**, in a consistent pill, in a consistent place,
  with no rotation and no gradient. It is a caption, not a sticker.
- **Nothing decorative that is not doing work.** No emoji, no dust, no rings,
  no gloss. The only non-content elements are a soft bloom that separates the
  device from the ground, and the shadow that sits it there.

Both the iPhone and iPad generators import the same layout module
(`scripts/lib/storeFrameSystem.mjs`) so the two sets cannot drift apart, which
is how the old pair had ended up with different emoji positions for the same
frame.

---

# The 2026-08 revision — what the restrained set still got wrong

The system above fixed the *decoration* problem and was right to. Reviewed as a
shipped set rather than as a reaction to the previous one, it had three
weaknesses of its own. They are worth writing down because none of them is a
matter of taste — each is checkable.

## 1. Half the frames claimed something the picture contradicted

The proof pills were written as marketing copy and matched to captures
afterwards, which is the order that produces this:

| Frame | The pill said | The screenshot said |
|---|---|---|
| 08 Train your mind | **PhD unlocked** | the Education **Catalog** — courses *not* taken, each with a price and an Enroll button |
| 09 Live the luxury | **Rare collection** | `Collection (0)` · `0 / 6 collectibles` · `$0 / $150M in trophies` |
| 07 A phone full of lives | **Every app unlocked** | a grid of six apps |
| 03 Build an empire | *Found companies. Hire. Scale.* | `1 company · 0 employees` |
| 05 Go viral | **Trending now** | a feed whose top post had 13 likes |

Apple's Guideline 2.3.3 is the outside version of the same rule, and a 2.3.3
rejection costs a full review cycle and returns every attached IAP marked
"Rejected" alongside it.

The rule now is one line: **every claim on a frame is legible inside that
frame.** Each entry in `FRAMES` carries an `evidence` note saying where to look
and an `assert` list of literal strings that must appear in the capture — and
`capture-rich-state.mjs` writes each screen's text beside its PNG so
`__tests__/tooling/storeFrameClaims.test.ts` can check it in CI rather than
leaving it to whoever reviews the set next.

Two of those frames were fixed by photographing a **different screen** rather
than by softening the words: Education's **Earned** tab (a transcript reading
`7 credentials earned`, every credential stamped *Graduated · On record*) and
Luxury's **Collection** tab, which the capture now fills by buying two pieces
through the app's own Buy button. Two more were fixed by putting the real
number on the pill — six apps, not "every app".

A third class was subtler and only showed up when the claims were tested: some
were true of *one capture*. "$61,911" of Bitcoin and "15 advancing · 10
declining" are re-rolled every run, so they were facts with a shelf life. They
are gone; `2.000 BTC` and `25 listed` are structural and stay true.

## 2. The state under the captures was dev-tools placeholder

`Grant Top Career` in `DevToolsModal` built a synthetic ladder named
`Dev Career` whose six levels were literally called `Level 1` … `Level 6`, so
the home identity card — the hero frame, the most-viewed image on the page —
read **"Job: Level 6"**. It also paid $13,000/wk, about four times the top of
any real ladder in `lib/careers/careerData.ts`.

Fixed at the source rather than papered over downstream: the grant now seeds a
real career out of `INITIAL_CAREERS`, so the same button gives QA and the store
page "Engineering Manager · $3,000/wk · Lv 6/6" — the shipping economy.

## 3. Craft details that read as "template", quietly

- **The headline was not set in the typeface the CSS asked for.** The stack was
  `-apple-system, 'SF Pro Display', …`; there is no Apple font and no Inter on
  a CI box or in a container (`fc-list` returns DejaVu, FreeSans and Liberation
  Sans), so it fell through to **Liberation Sans**, an Arial clone — and to
  whatever else happened to be installed on the next machine. Inter Tight is
  now embedded as base64 in the frame HTML, so the render is deterministic.
- **The 6.5" set was squashed.** One 1320×2868 canvas was laid out and scaled
  with `transform:scale(sx, sy)` where `sx = 0.9727` and `sy = 0.9686` — every
  6.5" frame shipped 0.4% anamorphic. Each canvas now derives its own numbers
  and renders natively.
- **A third of each frame was empty ground.** The device was sized as a share
  of the canvas WIDTH and left ~475px of unused sky. It is now derived from the
  height it is given and fills it, fully contained, with the tab bar intact.

## What "one palette" does and does not mean

The original set failed partly because every frame declared its own three
background glows *and* its own three accent colours: ten frames sharing
nothing. The fix was one blue for everything, which was correct as a correction
and too far as a destination — ten frames of one hue is a series with nothing
to say about what is on each screen.

Each frame now carries **one** accent, and every one of them is a value lifted
from `lib/config/theme.ts`: money is the app's money green, dating is its
reputation pink, the darknet terminal is its terminal green. The ground, the
type, the layout, the device treatment and the bloom geometry are identical
across all ten; the hue appears in exactly three places (the accent word, the
pill, and the light the screen spills on the ground). A reader scrolling the
carousel sees one series whose colour tracks the content — which is the
opposite of ten unrelated images, even though both "vary colour per frame".


---

# Three screens per frame — the multi-device layout, done deliberately

The single-device set that this section revises was correct about the product
being the subject and wrong about how much of the product one frame can carry.
A life sim's pitch is *breadth* — careers, dating, markets, crime, family — and
a lone screenshot argues the opposite: that there is one screen.

So each frame is a hero plus two flanking screens again, which is what the
2026-07 set did. The composition is not a return to it. Tell #6 in the table
above lists four separate faults, and each is answered here:

| The 2026-07 flanks | These flanks |
|---|---|
| Main device ~⅓ of the frame, flanks nearly as large — nothing led | Hero is ~70% of the canvas width and fully legible; flanks are 70% of its width and ~15–18% further back |
| `left:-160px` / `right:-160px` — about **40%** of each flank off-canvas | 15–18% off the edge: a sliver, not an amputation |
| `rotateY(±24deg) rotateZ(∓9deg)` — a tilt with no optical basis | One shared `perspective-origin`; rotation in **Y only**, so both flanks turn to face the same viewer. A camera, not a sticker |
| Too small and too skewed to read — texture standing in for content | Dimmed and set back, never **blurred**. You can still read what each one is |

**No blur** is the load-bearing choice. Blurring a background screenshot is the
quick way to say "this is context", and it converts a real screen into
decoration — which is precisely what made the originals read as filler. A
reader who looks at a flank should be able to tell that it is Contacts, or the
Bank, or the darknet terminal.

The flanks carry **no claim**. The proof pill always describes the hero, and
`storeFrameClaims.test.ts` only ever checks the hero's capture. What the flanks
carry is the argument the headline is making: frame 07 says "a phone full of
lives" and flanks the app grid with two of the apps it opens.

## The two shelves need different flank models

Not different numbers — a different arrangement, because the canvas *shape*
differs.

- **Phone.** A 2.17-tall canvas holding a 2.17-tall device leaves no width for
  a flank of the same height, so the flanks are much shorter and are **raised**
  above the hero's top edge. The empty ground that leaves falls in the bottom
  corners, where the vignette and the hero's contact shadow already sit.
- **Tablet.** A 1.33 canvas is proportionally far wider, and the same treatment
  left two large empty rectangles low and outboard. There the flanks are near
  hero height and stand on the **same baseline**, so the three read as one band.

## One bug worth writing down

`transform-style: preserve-3d` makes `z-index` **inert**. Children are painted
by their position in 3D space, so a flank carrying a `rotateY` and no
`translateZ` sorted *in front of* the un-transformed hero and clipped its left
column — the identity card rendered as "Age 2" and "ried", and the luxury
header as "llectibles". `z-index: 3` on the hero was doing nothing at all.

The fix is to make the depth real: flanks get `translateZ(-0.15…0.17 × W)` and
the hero sits at `translateZ(0)`. It pays for itself twice, because a device
further from the camera also projects smaller — the size falloff is now the
perspective doing it rather than another number to keep in sync.

---

# The set is a story now — and the background is one panorama

Two rounds of this design fixed real faults and still produced something the
product owner called flat next to the version that is live. Both diagnoses were
right, and neither was about the faults being fixed. The set was a **catalogue**
— ten domains listed in no particular order, each frame arguing on its own — and
it was **underlit**, so a game about ambition looked like a utility.

## The story

The research is unambiguous on structure: a screenshot set is a narrative arc,
and iOS renders the **first three frames in search results** before anyone opens
the product page, so those three have to carry hook → mechanic → stakes alone.

A life sim's product is the ARC: the distance between where you start and where
you end up. So the ten frames run

> Start with nothing. → Take any job. → Fall for someone. → Earn the degree. →
> Play the markets. → Work the dark web. → Build the empire. → Buy the
> impossible. → Raise a family. → Leave a legacy.

Read top to bottom, the headlines are a life.

**Frames 01 and 10 are the same screen.** Same character — Isaac Carter, the
Food Courier scenario — photographed at week one and again 104 weeks later:

| | Frame 01 | Frame 10 |
|---|---|---|
| Age | 20 | 22 |
| Cash | **$1,500** | **$11M** |
| Job | Unemployed | Engineering Manager |
| Relationship | Single | Married |
| Reputation | 0 · Unknown | 100 · Icon |

That comparison is the whole product in one pair of images, and it is why
`capture-rich-state.mjs` now photographs the life on its way past week one. Up
to this point every capture came from one rich late-game save, which can only
ever show the destination — there was no picture of the start, so the strongest
hook the game has could not be used.

The game wrote frame 01's copy better than marketing could: the opening screen
carries its own coaching card reading *"You need work — No job means no money
coming in"*, the Job field reads **Unemployed**, and the Work tab's job list
bottoms out at *"Beg for Money, $28–52"*. None of it needed dressing up.

## The panorama

The other technique the research kept returning to: **one wide image sliced into
card-sized pieces**, so the background flows unbroken from one screenshot into
the next. The pull is the Zeigarnik effect — a pattern cut off at an edge is an
unfinished pattern, and the reader swipes to close it.

Here each of the ten frames contributes a wash of its own accent hue centred on
its own card, over a virtual canvas `10·W + 9·gutter` wide, and every frame
renders a window into it. So each frame carries its neighbours' colour bleeding
in from both edges. The set reads as one place.

It also, finally, resolves the tension this document has been circling since the
first version. "Ten palettes" was the loudest tell in the 2026-07 set; "one blue
for everything" was the overcorrection. A continuous field that a frame samples
from is neither: the hues differ **because they are positions along one thing**.

**The gutter is the part people get wrong.** The App Store draws a gap between
screenshots. Slice a panorama into ten equal pieces and ignore that gap and the
halves do not meet — the result reads as ten misaligned images, which is worse
than not attempting it. `GUTTER` is that allowance.

## The light, and the chip

- The washes are large and strong, not a polite bloom: the ground is a lit
  place, and the devices stand in coloured light that reaches the bottom edge.
- **Film grain** over everything at low opacity. It does two jobs: it kills the
  banding that big soft gradients show on an OLED phone, and it gives the ground
  a surface. Without it the washes read as flat vector fill, which is a large
  part of what "template" actually looks like.
- The proof moved from a pill centred under the sub-line to a **chip on the hero
  device**, overhanging its edge. The pill put the number as far from the pixels
  that prove it as the frame allows; the chip is a label on the thing it
  describes, and it is the one element that reads as pointing INTO the product.
  It is also the closest thing here to what the live set was doing with its
  coloured badges — that instinct was right.

## What was NOT brought back

The live set's emoji stickers. Forty of them across ten frames is tell #1 in the
table at the top of this document, and the product owner rejected the look. The
energy they were providing is now coming from the light, the panorama and the
chip instead. If that call should be revisited, it is a product decision and not
a design one — say so and it is a small change.

---

# Matching the live set's density — the audit, item by item

The story and the panorama landed and the result was still called flat beside
the version that is live. Comparing the two side by side, the live set is
denser, brighter and more physical, and **most of what produces that has
nothing to do with the emoji**. Separating the two lists is the whole job:

## What the live set does that is RIGHT, and is now here

| Live set | Why it works | Here |
|---|---|---|
| Flanks nearly as large as the hero and **bright enough to read** | Three legible screens is the breadth argument; two dark smudges is not | Flanks at 86% of hero width, dimmed to 0.30–0.48 rather than 0.56–0.74 |
| Flanks pressed **close**, overlapping heavily | Fills the frame; a gap between devices reads as three separate pictures | `sideDx` pulled in, `sideZ` reduced so they crowd the hero |
| A **bold coloured badge** on the device | Puts the number on the thing it describes, and it is the one element that points INTO the product | The proof chip: uppercase, tracked, solid accent on near-black, over the hero's left edge |
| Deep saturated ambient colour, edge to edge | A game about ambition should not look like a utility | Panorama washes at 0.72 alpha reaching 90% of frame height |
| Very little empty ground | Every dark rectangle is an unpaid pixel | Devices raised, footer trimmed, flanks filling the flanks |

## What makes it read as machine-made, and is NOT here

- **~40 emoji stickers** across ten frames. Tell #1 in the table at the top of
  this document, and an explicit product-owner rejection. No premium set on
  either store scatters emoji over its screenshots.
- **A repeated `DEEP LIFE SIMULATOR` kicker** above every headline. The store
  prints the app's name directly above the screenshot already; spending the
  frame's most valuable line repeating it is the clearest sign the layout was
  filled rather than designed.
- **Gradient text on the accent word.** Multi-stop gradient type is the single
  most recognisable template-generator flourish. One flat accent colour.
- **Headlines broken so the accent word lands alone on line two**, at a
  different apparent size from line one. That is a text box wrapping, not a
  typographer setting a line.

## One layout bug this round, worth recording

The flanks were first raised ABOVE the hero's top edge. Two consequences, both
visible immediately once the frame is looked at rather than measured: the hero
stopped being the tallest thing in the composition, so the hierarchy inverted;
and two flanks at the same raised height drew **one hard horizontal line
straight across the frame above the hero's head**. It read as a shelf. The
flanks now sit BELOW the hero's top edge — the hero is the silhouette, and the
flanks recede behind it.

---

# Which screens hold the slots — decided by demand data, not taste

The question "which screens should the set feature" has an empirical answer in
this repo, and it was sitting in `marketing/apple-ads/` the whole time.

## The evidence

**The keyword account's own investment, by theme** (its bid research, not a
guess): LifeSim-Core 18 keywords · Money-Wealth 13 · Investing-Stocks 12 ·
Crime-Underground 10 · Business-Tycoon 10 · RealEstate 8 · Choices-Story 8 ·
Career-Job 8. Two themes have **no ad group at all: education and dating.**

**The first live campaign run** (`08-first-results-2026-08.md`): Category-Exact
tap-through hit 18.8% against a 7.7% category floor — 2.4× — while the product
page converted at 40% against a 66% benchmark. Demand is not the problem; the
page is. These frames are the fix that run was asking for.

**The CPP briefs** (`04-custom-product-pages.md`) already specified the two
shots the flagship page needed most: "Start at 18. Own nothing." and "Every
week is a decision. — the week loop with an event choice open."

## What changed because of it

| Slot | Was | Now | Why |
|---|---|---|---|
| 03 | Education › Earned transcript | **The weekly event modal, open** | Education has no ad group; Choices-Story does ("choices game" flagged large-volume), and CPP-LifeSim slot 2 asks for exactly this shot |
| 04 | Fall for someone (was 03) | unchanged, one later | Dating also has no ad group — it stays for page appeal, but it does not deserve a search-result slot over the core loop |

The bitter irony the swap fixed: the capture pipeline's first act was
`clearDecisions()` — deleting all twelve queued weekly decisions from every
capture so they would not pollute the screenshots. The game's core loop, the
thing the genre is named for, was the one thing the store page could never
show. The capture now photographs one decision OPEN before the inbox is
cleared. The event's text varies per run, so the frame's claim rests on the
modal's unconditional chrome (the "Choice Effects" panel) and its chip
deliberately carries no number — a digit here would quote an event the next
capture re-rolls.

## What did NOT change, and what is parked

- **Dark web (06), stocks (05), empire (07), luxury (08)** all stay — they map
  1:1 onto Crime-Underground, Investing-Stocks, Business-Tycoon and the
  wealth-fantasy terms ("dark web game" and "money laundering game" are in the
  account as exact matches to named in-game systems).
- **Real estate is the known gap**: an 8-keyword group and no frame. Its
  capture is an empty portfolio ($0 · 0 properties), and this set does not
  caption empty states. The unlock is a capture step that buys a property
  through the app's own UI, the way the luxury frame buys its trophies — parked
  as the next capture-pipeline task, not a design task.
- **Education's Earned transcript** stays on disk for `CPP-Career`'s "Study,
  qualify, get promoted" slot — the right audience for it arrives through
  career searches, not the default page.

---

# 2026-08-19 — art-led: the round that changed what the frames are pictures OF

Five rounds of work went into the frame *around* the screenshot: a panorama
sliced with gutter compensation, three shelves rendered natively, an embedded
typeface, a CI test that fails the build when a caption claims something its
capture does not show. Every one of those was right and every one of them
stays. None of them touched the thing that was actually wrong, which the owner
named in one sentence: *"If I looked at App Store and saw this game I would not
download it."*

## The diagnosis

Laid out as a contact sheet at the ~141px a carousel actually gives each frame,
the set failed on five counts, in the order they cost money.

1. **The subject of every frame was a phone.** Ten product shots of a user
   interface. The thing being sold — a life you gamble with and can lose —
   appeared in none of them.
2. **One composition, ten times.** Identical centre hero, identical flank pair
   at identical angles, identical headline slot. Across ten frames the only
   variable was accent hue, which teaches the eye it has already seen frames
   2–10 after looking at frame 1.
3. **No face and nothing at stake.** One human face in the whole set, at ~6% of
   its canvas, and not a single frame showing a consequence.
4. **The app's own UI is poor raw material at this size.** Navy on navy, 11pt
   labels, four-decimal figures — correct for a game you read closely, wrong for
   an image that gets half a second. Below ~200px the hero screen is grey
   texture, and no re-capture fixes that.
5. **The best art in the app had never reached the store page.** Forty-plus
   cinematic renders ship in the binary. Every player sees them; nobody deciding
   whether to become a player ever had.

The evidence for acting on it was already in the repo. `marketing/apple-ads/08-first-results-2026-08.md`:
category-exact TTR **18.82%** against a 7.72% category floor (2.4×), product
page conversion **40%** against a 66.2% benchmark (0.6×), CPA $2.18 against a
$12.28 median. Demand is not the problem and price is not the problem.

## What changed

- **The game's own art behind every frame**, read from `assets/images/` — the
  same plates the app renders, so a frame cannot advertise art the product does
  not contain. `ART` in the design module holds the map, the crop and the
  relight.
- **Three compositions instead of one** — `solo`, `trio`, `edge` — assigned by
  what each frame has to accomplish rather than applied uniformly.
- **Three panoramas instead of one.** A single continuous field cannot span ten
  different photographs, so the hue sweep and horizon run per ACT and cut at the
  act breaks.
- **The device chrome went.** No metallic bezel, no notch — a dark rim and a
  hairline. That chrome was ~12% of the canvas spent on a picture of a phone.
- **Real estate got its frame**, which took a capture change rather than a
  design one (below).
- **The payoff moved to slot 3 and dating to slot 8**, on the keyword evidence.

## Two things this round refused to do

**Shrink the screenshot.** The failure mode of an art-led set is a frame that is
an advert with a phone in the corner, and Guideline 2.3.3 rejections cost a
review cycle and take every attached IAP down with them. `MIN_SCREEN_SHARE`
(0.55) is a floor the `edge` geometry is DERIVED from rather than checked
against afterwards, and the claims test asserts it on all three shelves.

**Judge legibility by eye.** A drawn gradient has a luminance you can reason
about from the CSS; a photograph does not. `scripts/check-store-contrast.mjs`
renders every frame twice — once normally, once with the type block hidden —
samples the p95 luminance of the backdrop the type actually sits on, and fails
below 4.5:1. That measurement is what caught the sub-line: at 70% opacity it was
tuned against a gradient and the golden-hour plates ate it whole.

## The plate that was tried and rejected

Frame 02 was first given `Main_Menu/Mainmenu_1.webp` — the app icon's own
image, a lone figure at a cliff edge under a light shaft, and on paper the
perfect picture for "every week, one choice". At full size it is genuinely
atmospheric. At carousel scale it is a black rectangle, and lifting it to
`brightness(1.95) contrast(1.30)` did not save it: **a plate whose subject is
small and unlit has nothing to lift.** It was replaced with a mountain cabin lit
from inside, which survives the shrink because its light source is in the frame.

That is the rule the whole art direction rests on, and it was learned twice —
once in the three-frame side-by-side that started this round, once here.

## Real estate: a capture gap that had been read as a content decision

`RealEstate` carried 8 category-exact keywords and no frame for the entire life
of this set. The reason was never editorial: the app opens on an empty portfolio
reading `Portfolio equity $0`, `0 properties`, "You don't own any property yet",
and this set does not caption empty states — so every previous round wrote the
gap down as parked and moved on.

`buyPropertyAndShowPortfolio` closes it the same way `buyLuxuryAndShowCollection`
closed the luxury one: buy through the app's own listing CTA and photograph the
result. Two details are load-bearing.

- **Cash, not a mortgage.** The modal defaults to the `standard` down-payment
  tier, whose confirm button reads "Sign Mortgage" — so pressing the affirmative
  without switching the tier first is not a no-op, it signs a 30-year loan and
  leaves the portfolio showing equity far below the headline value plus a weekly
  debt line.
- **Scroll to the top before shooting.** The first run of this landed mid-card:
  switching to the Portfolio tab does not reset scroll, so the capture opened on
  "Vacant 0" with the summary's own headline rows above the fold, and the frame
  had no total to caption. The claims test caught it, which is the entire reason
  that test exists.

## Same day — one art language, not two

The first art-led pass drew six of its ten plates from `assets/images/Real Estate/`
and four from `assets/images/luxury/`. Laid side by side those are two different
visual languages: the Real Estate renders are neon-outlined night buildings with
magenta and cyan tubes tracing every roofline, the luxury renders are photoreal
— real light, dusk skies, wet tarmac, golden hour. A carousel that switches
language every other frame reads as borrowed rather than art-directed, and the
owner caught it immediately.

**Grading was tried first and does not work.** Desaturating the neon does not
make it photoreal; it makes it a dim laser outline on a black box, and it costs
exactly the light the thumbnails need. Five grades were measured, down to
near-monochrome: every one traded the mismatch for a darker, muddier plate.

So the whole set now comes from `luxury/`, the only coherent photoreal library
the binary ships. That has one hard consequence worth writing down, because it
shapes the first two frames:

**The luxury library is entirely wealth imagery.** There is no plate in it for
"Start with nothing" and none for an ordinary evening, because it is a catalogue
of things you buy. Two moves get around that without leaving the language:

- **Frame 01 is the vineyard plate cropped away from the chateau and hue-turned
  cold**, so it reads as an ordinary valley at first light. **Frame 07 is the
  same plate whole and warm.** The same land, empty at the start and owned
  later — the only source used twice in the set, and the reuse is the point.
- **Frames 02 and 05 are chosen for mood rather than subject**: a jet on wet
  tarmac under low cloud, and the black marble the museum diamond stands on with
  the diamond cropped out. Neither says "wealth" at a glance; both carry their
  own light.

**Cropping into a plate for texture costs its light.** Frames 02, 06, 09 and 10
were first built from tight crops — open sea off the yacht plate, a corner of
the gallery, a slice of the stadium box — and all four washed out to pale grey
or muddy black. The rule that came out of it: use whole plates wherever a whole
plate will do, and crop only when the crop is the subject (frames 01 and 05).

### What is still missing, and what would fix it

Four frames would be better with purpose-made plates that do not exist: a cold
dawn street for 01, a rain-streaked window for 02, a monitor-lit desk for 05,
and a warm family room for 09. Generating them was attempted and is blocked in
this environment for two independent reasons — the image models that produce
photoreal environments require a paid plan on the connected account, and the
generated file could not be fetched anyway because the CDN host is denied by the
session's egress policy. The prompts are recorded in the handover so they can be
generated elsewhere and dropped into `assets/images/`; wiring a new plate in is
one entry in `ART` plus a crop and a relight.

## Same day — the collectibles frame had no collectibles in it

The owner's next note was the sharpest one yet: *"I don't see any assets of the
collectibles."* He was right, and it was the clearest failure left in the set.
Frame 03 is the frame about owning beautiful objects, and what it showed was a
list of text cards over a yacht that has nothing to do with what the player
owns — while every item in `lib/luxury/catalog.ts` ships with a render, and the
catalog ids are literally the filenames in `assets/images/luxury/`.

`PROPS` composites them in, and the mechanism is free: those renders are shot as
a **subject on black**, so `mix-blend-mode: lighten` knocks the background out
against whatever is behind them. No cutout, no mask, no alpha channel — the
diamond and the watch case drop onto a golden-hour sea as if they were
photographed there. `screen` was measured first and washes them out; `normal`
shows the box they were rendered in.

Three things that took a wrong turn first and are worth keeping written down:

- **A stacking context isolates a blend group.** The first render showed grey
  boxes: `mix-blend-mode` composites against its backdrop only within the
  nearest stacking context, and every `z-index` between the plate and the prop
  was creating one. Everything from `.art` up to `.props` now stacks by document
  order for that reason alone, and the rotation lives on the blended `img`
  rather than on a wrapper — a `transform` on an ancestor isolates it again.
- **The blend flatters a lit object and destroys a drawn one.** The three owned
  properties were tried as props on frame 07 and became glowing wireframes
  hanging in the vines, because those renders draw the building in neon outline
  rather than lighting a subject. `blend` is per-prop and never a default.
- **A prop is a claim.** Frame 03's chip reads `2 OF 6 TROPHIES ACQUIRED` and
  its capture reads `Collection (2)`, so the two objects in the frame are the
  two the capture bought — Rare Watch Collection ($250K) and Museum-Grade
  Diamond ($600K), whose resale sums to the `$510K` the same screen prints. A
  third would be inventing a purchase. The claims test now checks every prop is
  registered, on disk, inside the canvas and large enough to read as an object
  rather than debris.

Props sit BEHIND the device on purpose: a blended object overlapping the phone
would let the screenshot show through it, which is the opposite of the depth it
is there to create.

### What else was rejected in the same pass

`assets/images/iap/` holds 28 glossy 3D-style icons — gem piles, treasure
chests, a golden phoenix, a trophy — all on black, so all of them would
composite. None are used. They are stylized illustrations, and scattering them
across photoreal plates is precisely the "40 emoji stickers" tell the 2026-07
set was rebuilt to remove. The rule that came out of it: **props are photoreal
objects the player owns, never icons.**

The same pass also raised the whole set's colour energy — the accent wash, the
screen spill and the device glow had all been dialled back while the scrims were
being tuned for contrast, and the result was ten technically-correct frames that
read as murk at carousel size. The three darkest plates were lifted with them,
and frame 04's crop was moved off the dark half of the penthouse interior and
onto the window wall, which is where that frame's light actually is.

## Same day — the garage, and the third gated shop

The vehicle frame is the third instance of one pattern and the last one this set
needs. Luxury opened on a shop with nothing bought; Real Estate opened on an
empty portfolio; Vehicles opened on a dealership **behind a gate** — a driver's
licence at $500, with every Buy button in the list reading "License needed". So
the only picture the pipeline could ever take of the garage was of a locked shop,
and that is why there had never been a vehicle frame.

`buyVehicleAndShowGarage` buys the licence and an Exotic Supercar. Cash, not
finance, for the same reason the property step buys with cash: the modal defaults
to the `standard` down-payment tier and its confirm reads "Sign Auto Loan", so
pressing the affirmative without switching the tier first signs a loan and leaves
the garage showing a debt line instead of a car somebody owns.

Three things worth keeping:

- **The vehicle renders ship with a real alpha channel.** They are the only
  props in the repo that need no blend at all — `normal` keeps their own edges
  and their own shadow, which is why the car reads as solid where the
  collectibles read as lit glass.
- **`flip` exists because frames 07 and 08 are both `edge`.** Two adjacent
  frames in the same composition read as one image rendered twice, which is the
  failure the mode system was added to prevent. The flipped frame puts the
  device left and the type and props right, and the chip hangs off the other
  edge of the device.
- **It cost the family frame.** Apple caps a shelf at ten. Frame 09 was the
  weakest image in the set — a contacts list over the murkiest plate — and the
  THIRD frame serving LifeSim-Core, which frames 01 and 10 already carry. Frame
  10's identity card still reads Married, so the family has not left the set; it
  has stopped spending a slot saying so.

### The claims test earned its keep again, twice

Adding purchases to the run moved the numbers, which is exactly what it is for.

`home-final` fell from $11M to $8M once the capture started buying three
properties, a supercar and two trophies. Frame 10 does **not** read that capture
— it reads `home`, shot at the top of the desktop walk and before any of the
spending — so its `$11M` is still true, and the test proved it by rejecting the
"$8M" I had just corrected it to. Both numbers are true states of the same save
at different moments; the frame quotes the one it is actually a picture of.

The same pass found a mislabel that had been sitting there since the chip was
written: frame 10's label read "net worth", and the HUD chip is the **wallet**.
The net-worth line lives below the fold and is not in the picture. It now reads
`to your name` — the same words as frame 01's chip on the same screen, so the
bookend is one label and one number that moved.
