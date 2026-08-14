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
