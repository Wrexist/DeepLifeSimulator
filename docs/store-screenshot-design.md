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
