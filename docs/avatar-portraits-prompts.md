# DeepLife — Character Portrait Prompts (the 3D / 2.5D look)

Copy‑paste prompts for generating **stylized 3D‑style character portraits** as
image assets (Midjourney, DALL·E, Ideogram, Flux, etc.) — the same workflow that
produced your app icons, scenarios, perks and challenge art.

## Why this, and not the generator

The current avatars come from a **seed generator** (DiceBear). That's great —
infinite, offline, free — but it is **fundamentally flat 2D vector art**. We can
dress it up with a 2.5D lit frame (shadow + radial light + gloss + rim, see
`screenshots/avatar-styles.png`) and it reads rounded and alive… but it will
never be *true* 3D/Pixar depth, because there's no rendered art underneath.

For the "immersive, alive, 3D" look you want, the honest path is **rendered
portraits** — and the best fit for you is an **AI‑generated portrait library**,
because you already have the workflow dialed in. This sheet is that library.

> We keep **both**: the DiceBear 2.5D avatar stays as the automatic fallback for
> any character that doesn't have a portrait yet, so we migrate one face at a
> time and nothing ever renders blank.

---

## How to use

1. Pick **one** generator and lock it for the whole set — mixing engines breaks
   the "one game" consistency instantly. (Midjourney `--style raw` or Flux tend
   to nail this stylized‑3D look; whichever you pick, lock a **style reference /
   seed** after your first good face and reuse it for every prompt below.)
2. Copy a **fenced prompt block** — the shared style DNA is already baked in, so
   each block is standalone. Generate, pick the best of 4.
3. Export **1024×1024 PNG, transparent background** (head‑and‑shoulders only).
   Transparent is important: the app drops each portrait into its circular frame
   and adds the depth ring / mood halo itself, so the portraits composite cleanly
   and all share the same lighting frame.
4. Save into `assets/images/Avatars/` using the **filename under each prompt**.
5. Ping me and I'll wire them (registry + seeded NPC assignment + player picker +
   automatic DiceBear fallback — details at the bottom). **You don't touch code.**

---

## Shared style DNA (baked into every prompt below)

> Stylized 3D character portrait, Pixar / Sims‑style, head and shoulders, facing
> the camera with the head turned very slightly, warm friendly micro‑smile,
> looking at the viewer. Soft subsurface‑scattering skin, big expressive eyes,
> clean rounded stylized features. Soft studio key light from the upper‑left with
> a gentle rim light, soft ambient occlusion for real depth. Centered, generous
> headroom, symmetrical framing. **Transparent background.** Cohesive character
> design, high quality, crisp, 1024×1024.

**Negative prompt (append if your tool supports it):**

```
text, words, letters, watermark, signature, photorealistic human photo, uncanny,
extra fingers, deformed face, harsh shadows, busy background, full body, hands in
frame, hat cropping the head, multiple people, tilted horizon, motion blur,
low resolution
```

**Consistency rules (the whole set must feel like one game):**

- **Same camera & crop** every time: head‑and‑shoulders, chin ≈ lower third,
  top of hair with a little headroom.
- **Same light**: soft key upper‑left + gentle rim. Don't let the engine flip it.
- **Same finish**: matte stylized‑3D, *not* glossy plastic and *not* realistic.
- Lock the **style reference / seed** after the first portrait you love.
- Keep expressions **warm and neutral‑positive** (slight smile) — the game adds
  mood on top; you don't want a locked‑in scowl or a manic grin.

---

## Tier 1 · Player presets (what the player picks from)

Generate a small spread so character creation feels like a choice. Aim for a
range of skin tones, hair, and age. Start with these 4 and add more anytime — the
picker just lists whatever exists.

### P1 · Player preset — warm, youthful
Filename: `player_01.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm friendly micro-smile. A young adult with
warm medium skin, tousled dark-brown hair, expressive brown eyes, casual crew-neck
tee. Soft subsurface skin, big expressive eyes, soft studio key light from the
upper-left with gentle rim light, ambient occlusion depth. Centered, generous
headroom, transparent background, matte stylized-3D finish, 1024x1024.
```

### P2 · Player preset — fair, bright
Filename: `player_02.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm friendly micro-smile. A young adult with
fair skin, shoulder-length wavy auburn hair, green eyes, light freckles, soft
knit top. Soft subsurface skin, big expressive eyes, soft studio key light from
the upper-left with gentle rim light, ambient occlusion depth. Centered, generous
headroom, transparent background, matte stylized-3D finish, 1024x1024.
```

### P3 · Player preset — deep skin, confident
Filename: `player_03.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm friendly micro-smile. A young adult with
rich deep-brown skin, short textured black coils, warm dark eyes, hoop earring,
collared shirt. Soft subsurface skin, big expressive eyes, soft studio key light
from the upper-left with gentle rim light, ambient occlusion depth. Centered,
generous headroom, transparent background, matte stylized-3D finish, 1024x1024.
```

### P4 · Player preset — light‑tan, sleek
Filename: `player_04.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm friendly micro-smile. A young adult with
light-tan skin, sleek black hair in a low bun, dark almond eyes, minimalist
turtleneck. Soft subsurface skin, big expressive eyes, soft studio key light from
the upper-left with gentle rim light, ambient occlusion depth. Centered, generous
headroom, transparent background, matte stylized-3D finish, 1024x1024.
```

---

## Tier 2 · Hero characters (specific, recurring cast)

These are named people the player sees repeatedly, so they get their own portrait
(never a random pool face). Keep their look distinct and memorable.

### Mom
Filename: `hero_mom.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm loving smile. A kind middle-aged woman,
medium skin, shoulder-length warm-brown hair with a few silver strands, soft
laugh lines, gentle hazel eyes, cozy cardigan. Soft subsurface skin, expressive
eyes, soft studio key light from the upper-left with gentle rim light, ambient
occlusion depth. Centered, generous headroom, transparent background, matte
stylized-3D finish, 1024x1024.
```

### Dad
Filename: `hero_dad.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm reassuring half-smile. A friendly
middle-aged man, medium skin, short salt-and-pepper hair, light stubble, kind
brown eyes, crow's-feet, simple henley shirt. Soft subsurface skin, expressive
eyes, soft studio key light from the upper-left with gentle rim light, ambient
occlusion depth. Centered, generous headroom, transparent background, matte
stylized-3D finish, 1024x1024.
```

### Maya — best friend
Filename: `hero_maya.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, bright playful grin. A young woman, warm tan
skin, long dark wavy hair with a colorful clip, big lively brown eyes, small nose
stud, denim jacket. Soft subsurface skin, expressive eyes, soft studio key light
from the upper-left with gentle rim light, ambient occlusion depth. Centered,
generous headroom, transparent background, matte stylized-3D finish, 1024x1024.
```

---

## Tier 3 · Spark daters (dating app faces)

A few attractive, varied, approachable portraits for the dating app. Generate as
many as you like — more variety = the app feels alive. Naming: `spark_01.png`,
`spark_02.png`, …

### Spark 01
Filename: `spark_01.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, charming confident smile. A stylish young adult,
olive skin, wavy dark hair, warm brown eyes, a light beard, open collar. Soft
subsurface skin, expressive eyes, soft studio key light from the upper-left with
gentle rim light, ambient occlusion depth. Centered, generous headroom,
transparent background, matte stylized-3D finish, 1024x1024.
```

### Spark 02
Filename: `spark_02.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, bright inviting smile. A young woman, deep-brown
skin, voluminous natural curls, striking dark eyes, gold hoop earrings, off-the-
shoulder top. Soft subsurface skin, expressive eyes, soft studio key light from
the upper-left with gentle rim light, ambient occlusion depth. Centered, generous
headroom, transparent background, matte stylized-3D finish, 1024x1024.
```

### Spark 03
Filename: `spark_03.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, relaxed easy smile. A young adult, fair skin,
tousled blond hair, blue eyes, light freckles, casual flannel. Soft subsurface
skin, expressive eyes, soft studio key light from the upper-left with gentle rim
light, ambient occlusion depth. Centered, generous headroom, transparent
background, matte stylized-3D finish, 1024x1024.
```

---

## Tier 4 · Pulse people (social‑feed faces)

Everyday, relatable faces for the social feed. Same style, wider age/vibe range.
Naming: `pulse_01.png`, `pulse_02.png`, …

### Pulse 01
Filename: `pulse_01.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, cheerful open smile. A cheerful young adult,
medium skin, curly ginger hair, round glasses, freckles, graphic tee. Soft
subsurface skin, expressive eyes, soft studio key light from the upper-left with
gentle rim light, ambient occlusion depth. Centered, generous headroom,
transparent background, matte stylized-3D finish, 1024x1024.
```

### Pulse 02
Filename: `pulse_02.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, calm friendly expression. A middle-aged man,
brown skin, close-cropped black hair with a neat beard, warm eyes, polo shirt.
Soft subsurface skin, expressive eyes, soft studio key light from the upper-left
with gentle rim light, ambient occlusion depth. Centered, generous headroom,
transparent background, matte stylized-3D finish, 1024x1024.
```

### Pulse 03
Filename: `pulse_03.png`

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, gentle smile. An older woman, fair skin with
soft wrinkles, silver bob, kind blue eyes, pearl earrings, elegant blouse. Soft
subsurface skin, expressive eyes, soft studio key light from the upper-left with
gentle rim light, ambient occlusion depth. Centered, generous headroom,
transparent background, matte stylized-3D finish, 1024x1024.
```

---

## Tier 5 · Generic NPC pool (batch template)

For every other in‑game person, the game assigns a portrait **by seed** from a
tagged pool (so the same NPC always looks the same). Batch‑generate variety from
**one template** by swapping the **five variables** in `[brackets]`:

```
Stylized 3D character portrait, Pixar / Sims-style, head and shoulders, facing
camera with head turned slightly, warm friendly micro-smile. A [AGE] [GENDER]
with [SKIN] skin, [HAIR], [EYES] eyes, wearing [OUTFIT]. Soft subsurface skin,
big expressive eyes, soft studio key light from the upper-left with gentle rim
light, ambient occlusion depth. Centered, generous headroom, transparent
background, matte stylized-3D finish, 1024x1024.
```

| Variable | Options to rotate through |
| --- | --- |
| `[AGE]` | young adult · adult · middle-aged · older |
| `[GENDER]` | man · woman · androgynous person |
| `[SKIN]` | fair · light-tan · olive · warm-brown · deep-brown |
| `[HAIR]` | short dark · long wavy · buzz cut · curly · braided · silver · dyed pastel |
| `[EYES]` | brown · hazel · green · blue · dark |
| `[OUTFIT]` | plain tee · hoodie · button-down · blouse · knit sweater |

**Filename convention (this is what lets the game auto‑assign correctly):**

```
npc_<gender>_<age>_<nn>.png
```

- `<gender>` = `m` · `f` · `x`  ·  `<age>` = `ya` (young adult) · `ad` (adult) · `mid` · `old`
- Examples: `npc_f_ya_01.png`, `npc_m_mid_03.png`, `npc_x_ad_02.png`

A first pass of **~24** (a couple per gender×age band) already makes the world
feel populated; expand whenever you want more variety.

---

## When the PNGs are ready

Drop them in `assets/images/Avatars/` with the filenames above and tell me. I'll:

- Add an `AVATAR_PORTRAITS` registry — heroes/players keyed by id, the NPC pool
  grouped by `<gender>_<age>` tag.
- Add `getPortrait(...)`: named characters (Mom/Dad/Maya/Spark/Pulse) resolve to
  their specific file; generic NPCs get a **deterministic seeded pick** from the
  matching demographic pool, so a given NPC always shows the same face.
- Wire the **player picker** in character creation to the `player_*` presets.
- Render every portrait inside the existing circular frame with the **2.5D depth
  ring / mood halo** already prototyped, so even the rendered portraits share one
  lighting language.
- **Fallback:** any character without a portrait keeps its current DiceBear 2.5D
  avatar — so you migrate incrementally and the grid is never half‑broken.

You don't need to touch any code — just generate, name, and drop.
