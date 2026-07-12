# DeepLife — Complete Character Face Library (copy‑paste prompts)

The full set of prompts to generate every face the game needs, matching your
existing 5 faces in `assets/images/Face/` (Baby / Male / Female / Old_Male /
Old_Female). Generate these, drop them in `assets/images/Face/pool/`, and I wire
the seeded picker so each NPC gets a stable, unique face.

**~75 faces total.** You don't have to do them all at once — see [Priority](#priority).

---

## How to use (read once)

1. **Lock the style first.** Take `assets/images/Face/Male.png` into your generator
   as a **style reference / image‑to‑image**, generate the first face below, and
   confirm it's an exact style match. Then **lock that style‑ref/seed** and reuse it
   for every prompt — the shared style DNA is baked into each block, but the locked
   reference is what guarantees they look like one set.
2. Copy a **fenced block**, generate, pick the best of 4.
3. Save as **1024×1024 PNG** using the **filename above each prompt**.
4. Drop everything into `assets/images/Face/pool/` and ping me.

**Style DNA (baked into every prompt):**
> Rendered 3D Pixar / Fluent‑emoji style character head, soft matte finish, big
> round glossy eyes with white catch‑lights, soft rounded nose and cheeks, warm
> subsurface‑scattering skin, simple sculpted stylized hair, gentle key light from
> the upper‑left. Head and shoulders, centered, facing forward, warm friendly
> micro‑smile. Warm glowing radial gradient background (deep amber → gold) with a
> few small decorative sparkles and one small heart accent. Square, 1024×1024.

**Negative prompt (append if supported):**
```
text, watermark, photorealistic human photo, uncanny, harsh shadows, flat 2D
vector, line-art, full body, hands in frame, multiple people, busy background,
different art style, glossy plastic skin, tilted framing, low resolution
```

**Filename convention** — `<sex>_<band>_<nn>.png` · sex = `m`/`f` · band = `ya`
(18–29) · `ad` (30–39) · `mid` (40–55) · `sr` (55+) · `tn` (13–17) · `kid` (5–12).
Babies are `baby_<nn>.png`. Heroes are `hero_<role>.png`.

---

## Young adult women — `f_ya_01…10`

**`f_ya_01.png`** — fair skin, long auburn hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult woman with fair skin, long straight auburn hair, green eyes, and light freckles. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_02.png`** — light‑tan skin, dark wavy hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult woman with light-tan skin, dark wavy shoulder-length hair, brown eyes, and gold hoop earrings. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_03.png`** — olive skin, black ponytail
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm confident micro-smile. A young adult woman with olive skin, glossy black hair in a high ponytail, and dark brown eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_04.png`** — warm‑brown skin, curly afro
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult woman with warm-brown skin, a rounded natural curly afro, dark eyes, and a small nose stud. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_05.png`** — deep‑brown skin, box braids
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, bright friendly smile. A young adult woman with deep-brown skin, long box braids, bright dark eyes, and gold hoop earrings. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_06.png`** — fair skin, blonde pixie
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult woman with fair skin, a short blonde pixie cut, and blue eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_07.png`** — East Asian, sleek black bob
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young East Asian woman with light skin, a sleek straight black bob, and dark almond eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_08.png`** — South Asian, long dark hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young South Asian woman with medium-brown skin, long dark wavy hair, and warm brown eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_09.png`** — fair skin, red curls + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, cheerful micro-smile. A young adult woman with fair skin, curly red shoulder-length hair, freckles, and round glasses. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ya_10.png`** — olive skin, brown curls half‑up
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult woman with olive skin, curly brown hair worn half-up, and hazel eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Young adult men — `m_ya_01…10`

**`m_ya_01.png`** — fair skin, tousled brown hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult man with fair skin, tousled brown hair, light stubble, and blue eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_02.png`** — light‑tan skin, short fade
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult man with light-tan skin, black hair in a short fade, clean-shaven, and dark eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_03.png`** — olive skin, wavy hair + short beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm confident micro-smile. A young adult man with olive skin, dark wavy hair, a neat short beard, and brown eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_04.png`** — warm‑brown skin, textured coils
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly smile. A young adult man with warm-brown skin, short textured coils, and a friendly open smile. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_05.png`** — deep‑brown skin, buzz cut
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, calm friendly micro-smile. A young adult man with deep-brown skin, a clean buzz cut, and a strong jaw. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_06.png`** — fair skin, blonde + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, cheerful micro-smile. A young adult man with fair skin, short blonde hair, round glasses, and a clean-cut look. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_07.png`** — East Asian, straight black hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young East Asian man with light skin, straight black hair with a soft side part, and dark eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_08.png`** — South Asian, full beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young South Asian man with medium-brown skin, black hair, a well-groomed full beard, and brown eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_09.png`** — fair skin, red hair + scruff
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult man with fair skin, short red hair, freckles, and a light scruffy beard. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ya_10.png`** — olive skin, man bun + mustache
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young adult man with olive skin, dark hair in a man bun, a light mustache, and hazel eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Adult women (30–39) — `f_ad_01…06`

**`f_ad_01.png`** — fair skin, brown shoulder‑length hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A woman in her thirties with fair skin, shoulder-length brown hair, warm eyes, and the faintest smile lines. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ad_02.png`** — warm‑brown skin, curls pulled back
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm elegant micro-smile. A woman in her thirties with warm-brown skin, curly hair pulled back, and gold stud earrings. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ad_03.png`** — East Asian, layered black hair + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. An East Asian woman in her thirties with light skin, layered straight black hair, and thin glasses. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ad_04.png`** — deep‑brown skin, short natural curls
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, confident warm smile. A woman in her thirties with deep-brown skin, short natural curls, and gold earrings. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ad_05.png`** — olive skin, low bun
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A woman in her thirties with olive skin, dark hair in a low bun, and hazel eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_ad_06.png`** — fair skin, blonde lob
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A woman in her thirties with fair skin, a blonde shoulder-length lob, and blue eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Adult men (30–39) — `m_ad_01…06`

**`m_ad_01.png`** — fair skin, groomed beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A man in his thirties with fair skin, short brown hair, a well-groomed beard, and blue eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ad_02.png`** — warm‑brown skin, goatee
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly smile. A man in his thirties with warm-brown skin, short hair, and a neat goatee. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ad_03.png`** — East Asian, side part
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. An East Asian man in his thirties with light skin, black hair in a clean side part, and clean-shaven. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ad_04.png`** — deep‑brown skin, shaved head + short beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, calm confident smile. A man in his thirties with deep-brown skin, a clean-shaven head, and a short neat beard. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ad_05.png`** — olive skin, stubble
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A man in his thirties with olive skin, dark hair, and light stubble. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_ad_06.png`** — fair skin, blonde + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm professional micro-smile. A man in his thirties with fair skin, short blonde hair, and thin glasses, clean-shaven. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Middle‑aged women (40–55) — `f_mid_01…05`

**`f_mid_01.png`** — fair skin, brown hair with subtle grays
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged woman with fair skin, shoulder-length brown hair with a few subtle grays, and gentle laugh lines. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_mid_02.png`** — warm‑brown skin, gray‑streaked curls
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged woman with warm-brown skin, curly hair with gray streaks, and a gentle expression. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_mid_03.png`** — East Asian, black bob with grays + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged East Asian woman with light skin, a black bob with a few grays, and glasses. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_mid_04.png`** — deep‑brown skin, gray‑flecked curls
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, elegant warm smile. A middle-aged woman with deep-brown skin, short natural curls flecked with gray, and gold earrings. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_mid_05.png`** — olive skin, gray at temples
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged woman with olive skin, dark hair with gray at the temples, and hazel eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Middle‑aged men (40–55) — `m_mid_01…05`

**`m_mid_01.png`** — fair skin, salt‑and‑pepper + trimmed beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged man with fair skin, short salt-and-pepper hair, and a trimmed beard. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_mid_02.png`** — warm‑brown skin, graying hair + mustache
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged man with warm-brown skin, short graying hair, and a neat mustache. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_mid_03.png`** — East Asian, graying + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged East Asian man with light skin, black hair graying at the sides, glasses, and clean-shaven. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_mid_04.png`** — deep‑brown skin, bald + gray beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged man with deep-brown skin, a bald head, and a short gray beard, with kind eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_mid_05.png`** — olive skin, gray‑flecked hair + stubble
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm kind smile. A middle-aged man with olive skin, dark hair flecked with gray, and light stubble. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Senior women (55+) — `f_sr_01…04`
*(extra variety beyond the existing `Old_Female.png`)*

**`f_sr_01.png`** — fair skin, silver bob + round glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older woman with fair skin, a silver bob, round glasses, and soft warm wrinkles. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_sr_02.png`** — warm‑brown skin, gray natural curls
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older woman with warm-brown skin, gray natural curls, and a kind, gentle expression. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_sr_03.png`** — East Asian, short white hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older East Asian woman with light skin, short white hair, and soft wrinkles. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_sr_04.png`** — deep‑brown skin, silver bun
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm elegant smile. An older woman with deep-brown skin, silver hair in a neat bun, and pearl earrings. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Senior men (55+) — `m_sr_01…04`
*(extra variety beyond the existing `Old_Male.png`)*

**`m_sr_01.png`** — fair skin, bald + white side hair + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older man with fair skin, a bald crown with white hair at the sides, glasses, and a white mustache. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_sr_02.png`** — warm‑brown skin, white hair + white beard
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older man with warm-brown skin, short white hair, and a short white beard. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_sr_03.png`** — East Asian, thin gray hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older East Asian man with light skin, thin gray hair, and kind eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_sr_04.png`** — deep‑brown skin, gray close‑crop + stubble
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm gentle smile. An older man with deep-brown skin, gray close-cropped hair, and gray stubble. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Teen girls (13–17) — `f_tn_01…03`

**`f_tn_01.png`** — fair skin, long brown hair + braces
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, bright cheerful smile. A teenage girl with fair skin, long brown hair, freckles, and braces. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_tn_02.png`** — warm‑brown skin, hair puffs
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, bright cheerful smile. A teenage girl with warm-brown skin, curly hair in two puffs, and a big happy smile. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_tn_03.png`** — East Asian, hair clip + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, cheerful smile. A teenage East Asian girl with light skin, straight black hair with a colorful clip, and round glasses. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Teen boys (13–17) — `m_tn_01…03`

**`m_tn_01.png`** — fair skin, messy brown hair + braces
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, bright cheerful smile. A teenage boy with fair skin, messy brown hair, freckles, and braces. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_tn_02.png`** — warm‑brown skin, short curls
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, big happy smile. A teenage boy with warm-brown skin, short curly hair, and a big cheerful grin. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_tn_03.png`** — East Asian, bowl cut + glasses
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, cheerful smile. A teenage East Asian boy with light skin, black hair in a soft bowl cut, and glasses. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Children (5–12) — `f_kid_01…03`, `m_kid_01…03`

**`f_kid_01.png`** — fair skin, pigtails
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, joyful gap-tooth smile. A young girl (about 8) with fair skin, brown hair in pigtails, and freckles. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_kid_02.png`** — warm‑brown skin, curly puffs + dimples
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, joyful smile with dimples. A young girl (about 7) with warm-brown skin and curly hair in two puffs. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`f_kid_03.png`** — East Asian, black bob
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, bright happy smile. A young East Asian girl (about 9) with light skin and a straight black bob. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_kid_01.png`** — fair skin, blonde + freckles
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, joyful smile. A young boy (about 8) with fair skin, short blonde hair, and freckles. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_kid_02.png`** — warm‑brown skin, short curls
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, big happy grin. A young boy (about 7) with warm-brown skin and short curly hair. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`m_kid_03.png`** — deep‑brown skin, missing‑tooth smile
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, joyful missing-tooth smile. A young boy (about 9) with deep-brown skin and short hair. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Babies / toddlers (0–4) — `baby_01…03`
*(extra variety beyond the existing `Baby.png`)*

**`baby_01.png`** — warm‑brown skin, black hair tuft
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, gentle upper-left key light, head and shoulders, centered, facing forward, joyful gummy smile. A cute baby with warm-brown skin, chubby cheeks, and a small tuft of black hair. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`baby_02.png`** — fair skin, wispy blonde hair
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, gentle upper-left key light, head and shoulders, centered, facing forward, joyful gummy smile. A cute baby with fair skin, chubby cheeks, and wispy blonde hair, with big bright eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`baby_03.png`** — light‑tan skin, little tuft
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, gentle upper-left key light, head and shoulders, centered, facing forward, joyful gummy smile. A cute baby with light-tan skin, chubby cheeks, and a small dark tuft of hair. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Hero cast (named, recurring) — `hero_*.png`

**`hero_mom.png`** — the player's mother
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm loving smile. A kind middle-aged mother with medium skin, shoulder-length warm-brown hair with a few silver strands, soft laugh lines, and gentle hazel eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_dad.png`** — the player's father
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm reassuring smile. A friendly middle-aged father with medium skin, short salt-and-pepper hair, light stubble, kind brown eyes, and gentle crow's-feet. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_bestfriend_f.png`** — best friend (female)
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, bright playful grin. A warm young woman, best-friend energy, with tan skin, long dark wavy hair with a colorful clip, big lively brown eyes, and a small nose stud. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_bestfriend_m.png`** — best friend (male)
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, easy warm grin. A warm young man, best-friend energy, with warm-brown skin, short textured coils, and a friendly open smile. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_sibling_f.png`** — sister
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young woman with medium skin, shoulder-length wavy brown hair, and warm brown eyes, with a family resemblance and a friendly look. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_sibling_m.png`** — brother
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm friendly micro-smile. A young man with medium skin, short brown hair, and warm brown eyes, with a family resemblance and a friendly look. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_boss.png`** — the player's boss
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, composed confident half-smile. An authoritative middle-aged professional with light-tan skin, neat dark hair with a touch of gray, and a sharp, composed expression. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_mentor.png`** — a wise mentor
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm wise smile. A wise older mentor with warm-brown skin, gray hair and a short gray beard, glasses, and kind, knowing eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_rival.png`** — a sharp rival
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, sly confident smirk. A sharp, confident young adult with fair skin, slicked-back dark hair, and a subtle smirk. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

**`hero_grandparent.png`** — a warm grandparent
```
Rendered 3D Pixar / Fluent-emoji style character head, soft matte finish, big round glossy eyes with white catch-lights, warm subsurface skin, simple sculpted hair, gentle upper-left key light, head and shoulders, centered, facing forward, warm tender smile. A warm elderly grandparent with light skin, fluffy white hair, round glasses, deep soft wrinkles, and twinkling kind eyes. Warm glowing radial gradient background (deep amber to gold) with a few small sparkles and a small heart accent. Square, 1024x1024. No text.
```

---

## Priority

If you're not doing all ~75 at once, do them in this order — it maps to how often
faces actually show up in‑game:

1. **`f_ya_*` + `m_ya_*` (20)** — young adults dominate Spark, Contacts, the street. Biggest visible win.
2. **`f_ad_*` + `m_ad_*` (12)** — 30s adults, very common.
3. **Hero cast (10)** — Mom, Dad, best friends make the story feel personal.
4. **`f_mid_*` + `m_mid_*` (10)** + **`f_sr_*` + `m_sr_*` (8)** — parents, bosses, mentors.
5. **Teens, kids, babies (15)** — children growing up, school, family.

## When they're ready

Drop everything in `assets/images/Face/pool/`, push (or tell me the branch), and
ping me. I'll build `getPortrait(seed, age, sex)` + the `FACE_POOL` registry, wire
it through Spark (6 screens), Contacts/Family, Prestige and Hustle so each NPC
gets a stable, unique face, keep the original 5 as fallbacks, add tests, and send
a before/after render of Spark going from clones to a real crowd.
