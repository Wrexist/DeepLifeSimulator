# DeepLife — Character Face Prompts (expand your existing 3D set)

You already have the look. `assets/images/Face/` ships **5 rendered 3D/Pixar
faces** — `Baby`, `Male`, `Female`, `Old_Male`, `Old_Female` — wired via
`utils/characterImages.ts` (`getCharacterImage(age, sex)`) and used across Spark,
Contacts, Family, Prestige and Hustle. They match your app-icon art and are
exactly the immersive 3D style you asked for.

**The only problem is variety:** there are just 5, keyed by age-band + sex, so
every young woman in Spark is the *same* face, every young man is the *same*
face, every parent is one of two seniors, every child is the same baby.

This sheet is for **generating ~25–30 more faces in that identical style** so the
world stops looking like clones — same workflow that made your icons/perks/
scenarios. Once you drop them in, I wire a **seeded picker** so each person gets a
stable, unique face from the pool (details at the bottom).

---

## Match the existing style exactly (the whole point)

New faces must be indistinguishable in style from the current 5. Study
`assets/images/Face/Male.png` / `Female.png` / `Old_Male.png` and match:

> Rendered **3D Pixar / Fluent-emoji style character head**, soft matte finish,
> **big round glossy eyes with white catch-lights**, soft rounded nose and
> cheeks, warm **subsurface-scattering skin**, simple sculpted stylized hair,
> gentle key light from the upper-left. **Head and shoulders, centered, facing
> forward**, warm friendly micro-smile. Background: a **warm glowing radial
> gradient (deep amber → gold)** with a few small decorative 4-point sparkles and
> one small heart accent (as in the existing set). Square, **1024×1024**.

**Best practice — lock it:** generate your **first new face from a reference of
`Male.png`** (image-to-image / style reference / "in the style of this"), confirm
it's a perfect match, then lock that style reference/seed and reuse it for every
face below. Change **only the person**, never the lighting/background/framing.

**Negative prompt:**

```
text, watermark, photorealistic human photo, uncanny, harsh shadows, flat 2D
vector, line-art, full body, hands in frame, multiple people, busy background,
different art style, glossy plastic skin, tilted framing, low resolution
```

> Note: the existing set bakes in the warm-glow background + sparkle/heart motif.
> Keep it consistent — either **all** new faces have it (recommended, matches
> today) or we regenerate the whole set without it later. Don't mix.

---

## What to generate — kill the clone problem

The world is mostly **working-age adults**, so that's where variety matters most.
Vary **skin tone, ethnicity, hair, and face shape** — the axes the current set
completely lacks. Batch from one template, changing only `[bracket]` values:

```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big
round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted
hair, gentle upper-left key light, head and shoulders, centered, facing forward,
warm friendly micro-smile. A [AGE] [GENDER] with [SKIN] skin, [HAIR], and
[FEATURE]. Warm glowing radial gradient background (deep amber to gold) with a
few small sparkles and a small heart accent. Square, 1024x1024.
```

| Variable | Rotate through |
| --- | --- |
| `[AGE]` | young adult · adult · middle-aged |
| `[GENDER]` | man · woman |
| `[SKIN]` | fair · light-tan · olive · warm-brown · deep-brown |
| `[HAIR]` | short dark · buzz cut · long wavy · curly afro · braided · blonde · red · black bun · bald |
| `[FEATURE]` | freckles · glasses · a beard · earrings · a nose stud · clean-cut |

**Target a first batch of ~24** — roughly a dozen women and a dozen men spread
across skin tones and hair. That alone transforms Spark, Contacts and the street.

**Filenames** (this is what lets the game auto-assign — extends your current set):

```
assets/images/Face/pool/<sex>_<ageband>_<nn>.png
```

- `<sex>` = `m` · `f`   ·   `<ageband>` = `ya` (young adult) · `ad` (adult) · `mid` (middle-aged)
- Examples: `f_ya_01.png`, `f_ya_02.png`, `m_ad_03.png`, `m_mid_02.png`
- Keep `Baby.png` / `Old_Male.png` / `Old_Female.png` as-is for kids/seniors (add
  `old_m_02.png` etc. later if you want senior variety too).

---

## Optional — bespoke faces for the recurring cast

The player sees Mom, Dad and a best friend repeatedly, so a specific face each
makes them feel real (vs. a pool pick). Same style, distinct look. Name them
`hero_mom.png`, `hero_dad.png`, `hero_bestfriend.png`. Generate from the same
locked style reference.

---

## When the PNGs are ready

Drop them in `assets/images/Face/pool/` and tell me. I'll:

- Build a `FACE_POOL` registry grouped by `<sex>_<ageband>`, plus the current 5 as
  the guaranteed defaults.
- Replace `getDatingProfileImage(gender)` and generalize `getCharacterImage()` into
  **`getPortrait(seed, age, sex)`** — a deterministic seeded pick from the matching
  bucket, so **Sarah always looks like Sarah but different from Emma**, and every
  NPC keeps its face across sessions.
- Wire it through Spark (6 screens), Contacts/Family, Prestige and Hustle.
  `CompanyDetailScreen` already does exactly this with a 4-face pool — we
  generalize that one pattern everywhere.
- **Fallback:** any empty bucket falls back to the current 5, so nothing ever
  breaks and you can add faces a few at a time.

You don't touch code — just generate in this style, name, and drop.
