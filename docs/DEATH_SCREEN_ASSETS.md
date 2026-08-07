# Death screen — asset generation prompts

Everything on the death screen renders **today** without any of these files.
The hero is drawn from views (`components/death/DeathHero.tsx`) precisely so the
layout could ship before the art existed — Metro resolves `require()` at build
time, so a component reaching for a missing file does not degrade gracefully, it
fails to bundle.

So these are upgrades, not blockers. Generate what you want, drop it in, wire it.

> **Status:** asset 1 has not been generated. It was attempted through the
> connected image tool and refused — the workspace is on a free plan with 1.68
> credits, which does not cover a generation. The drawn hero was tightened in
> the meantime (inset stone face, crack, tapering three-layer wisp, moss tufts,
> the white flower), but it is a stand-in for the prompt below, not a
> substitute for it. Top up the workspace or run the prompt in any image tool.

---

## How to wire one once it is generated

Put the file in `assets/images/Death/`, then pass it to the hero in
`components/DeathPopup.tsx`:

```tsx
// before
<DeathHero height={heroHeight} mood={quality.mood} />

// after
<DeathHero
  height={heroHeight}
  mood={quality.mood}
  source={require('@/assets/images/Death/gravestone.webp')}
/>
```

That is the whole change. `DeathHero` swaps its drawing for the image and keeps
the same band height, so nothing below it moves.

**Do not** add the `require` before the file exists — the app will not bundle.

---

## Shared style direction

Every prompt below inherits these. Repeat them verbatim in each generation; do
not assume the model carries style across prompts.

> Mobile game UI art, 3D soft-render / stylised claymation look, rounded
> friendly forms, matte surfaces with soft rim light. Deep near-black navy
> background (#080B12). Violet and indigo key light (#7C4DFF, #A78BFA) from the
> right. Gentle bloom, no harsh shadows. Melancholy but warm — sombre, never
> gory, never horror. Centred composition, generous empty margin, no text, no
> letters, no numbers, no watermark, no logo, no border, no frame.

**Format for all:** PNG with a real alpha channel, then convert to `.webp` at
quality 90 for the repo.

---

## 1. Hero — gravestone (the one that matters)

The illustration at the top of the screen. This is the only asset the design
truly depends on; everything else is polish.

**Size:** 1024 × 640 (approx 8:5), transparent background.
**File:** `assets/images/Death/gravestone.webp`

> [shared style direction]
>
> A single rounded-top stone gravestone standing on a small mound of dark earth
> and moss, seen straight on. A simple cartoon skull carved into the face of the
> stone, sunken slightly, no jaw detail, friendly rather than frightening. A
> thin ribbon of violet spirit-flame rises from the ground on the right side of
> the stone, translucent and softly glowing, curling like smoke. Small clumps of
> moss and two or three tiny grey pebbles at the base. One small white
> five-petal flower growing at the right of the mound, catching the violet
> light. A dozen tiny drifting light motes in the air around the stone, out of
> focus. The stone is cool grey-blue (#3B4453) with a faint crack. Everything
> below the mound fades to full transparency.

**Watch for:** models like to add an epitaph. There must be **no text on the
stone** — the game renders "You Died" over this area, and carved lettering
underneath reads as a rendering bug. If a generation has text, either regenerate
or clone-stamp it out.

### 1b. Optional — a warmer variant for a long life

`deathReason === 'age'` shows the title "A Long Life", and the gravestone above
is tuned for a sad ending. If you want a second hero for that case, generate:

> [shared style direction, but replace the violet key light with warm amber
> #F59E0B and gold #FDD663]
>
> Same rounded-top gravestone on a mound, but at golden hour. Warm amber rim
> light. The mound is thick with grass and small wildflowers, well tended. The
> rising wisp is warm gold instead of violet, soft and slow. Peaceful, the end
> of a long good day rather than a loss.

**File:** `assets/images/Death/gravestone-longlife.webp`. Wiring it means
branching on `deathReason` where `source` is passed — three lines.

---

## 2. Life Quality faces (optional)

The arc currently uses `lucide-react-native` line icons (`Angry`, `Frown`,
`Meh`, `Smile`, `Laugh`), picked by `lifeQuality().mood`. They are consistent
with the rest of the app's iconography and honestly look fine. Replace them only
if you want the gauge to feel more characterful than the rest of the UI.

**Size:** 256 × 256 each, transparent.
**Files:** `assets/images/Death/mood-{bleak,poor,fair,good,great}.webp`

Generate as **one sheet** so the five faces match each other — five separate
generations will drift in proportion and shading:

> [shared style direction]
>
> A horizontal row of five simple 3D rounded cloud-shaped faces on a transparent
> background, evenly spaced, identical in size, shape, material and lighting —
> only the expression changes. Left to right: 1) deeply miserable, eyes squeezed
> shut, downturned mouth; 2) sad, drooping eyes, small frown; 3) neutral, flat
> line mouth, blank eyes; 4) content, gentle smile, soft eyes; 5) delighted,
> wide happy smile, eyes closed and curved upward. Matte pale grey-lavender
> bodies (#C7C9D6), simple dark navy features, no outlines, no blush, no limbs.

Then slice the sheet into five squares.

---

## 3. Action row icons (optional)

The three footer rows use `lucide` glyphs — a filled `Heart` for Revive, a `Gem`
for the store, a `RotateCcw` for Rewind. Custom art here is the lowest-value
change on this list: these need to read at 20px, and a detailed 3D render at
20px is mud. **Recommend skipping.**

If you do want them, generate as one sheet at 256 × 256 per cell:

> [shared style direction]
>
> Three simple 3D game icons in a row on a transparent background, identical
> size and lighting, no background plates, no text: 1) a glossy pink heart
> (#F472B6) with a soft highlight; 2) a faceted violet gemstone (#A78BFA) seen
> face-on; 3) a golden-amber circular arrow curving counter-clockwise (#F59E0B)
> with a small clock face at its centre. Chunky forms, thick strokes, readable
> at very small sizes.

---

## 4. What NOT to generate

- **A portrait for the identity card.** It already uses the character's real
  avatar via `getCharacterImage(age, sex, name)`, from the existing face pool.
  A generated stand-in would replace the player's own character with a stranger,
  which is the exact wrongness the "Player" name bug had.
- **A background.** The screen is deliberately near-black so the hero's glow is
  the only light source. A textured backdrop fights the bloom and makes the
  title harder to read.
- **Anything with text on it.** All copy is live — the title changes with the
  cause of death, the name and age come from the save. Baked-in text would be
  wrong for most deaths and untranslatable for all of them.

---

## Budget note

Each of these is one still image. If you are generating on a per-image credit
model, asset 1 is the only one worth paying for twice to get right; 2 and 3 are
genuinely optional, and 3 is arguably a downgrade at the size it renders.
