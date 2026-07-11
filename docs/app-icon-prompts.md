# DeepLife — In‑Game App Icon Prompts

Copy‑paste prompts for generating the in‑game phone/computer app icons as image
assets (Midjourney, DALL·E, Ideogram, Flux, etc.).

Right now each app icon is a **Lucide vector glyph on a gradient tile** (drawn at
runtime in `app/(tabs)/mobile.tsx` / `computer.tsx`). That's clean and
consistent, but flat. Swapping to **custom‑rendered icons** is what gives the
grid that "real App Store" feel — so this sheet exists to make that easy.

---

## How to use

1. Pick one generator and **stick with it for the whole set** (mixing engines
   breaks visual consistency).
2. For each icon below, copy the **fenced prompt block** — it already includes
   the shared style DNA, so it's fully standalone. Paste, generate, pick the
   best of 4.
3. Save each as `assets/images/AppIcons/<filename>` (see the filename under each
   prompt). Keep them **1024×1024 PNG**.
4. Ping me and I'll wire the swap (render the PNG edge‑to‑edge with a rounded
   mask, keep the current glyph as an automatic fallback for any icon you
   haven't generated yet — so we can migrate one at a time, nothing breaks).

> **Recommendation:** generate **full‑bleed** icons (gradient baked in, per the
> hex below) rather than transparent glyphs. Baked icons let each app carry its
> own lighting/depth and read as a designed set. The app will mask the corners,
> so you don't need to round them yourself — fill the whole square.

---

## Shared style DNA (baked into every prompt below)

> Premium iOS‑style app icon. A single symbol, perfectly centered, on a smooth
> diagonal gradient background running top‑left → bottom‑right. Soft glossy
> light from the upper‑left, gentle inner depth, a clean minimalist **white**
> symbol with a subtle soft shadow. Modern flat‑with‑depth design language,
> crisp edges, generous safe padding around the symbol, balanced composition,
> full‑bleed square (corners will be masked by the app), studio lighting,
> 1024×1024, ultra clean, high detail.

**Negative prompt (append if your tool supports it):**

```
text, words, letters, numbers, watermark, signature, photorealistic photo,
busy or cluttered background, multiple separate objects, hard border or frame,
pre-rounded corners with visible transparent gaps, drop shadow outside the tile,
low contrast, noisy texture
```

**Consistency tips:** keep the same symbol scale (~55–60% of the tile), the same
upper‑left light source, and the same padding across all 17. If your tool
supports a **style reference / seed**, lock it after the first icon you like and
reuse it for the rest.

---

## Phone apps (8)

### 1 · Spark — dating / "find your match"
Filename: `spark.png` · Gradient: `#F43F5E → #FB923C` (rose → orange)

```
Premium iOS-style app icon. A single glowing white flame/spark symbol perfectly
centered on a smooth diagonal gradient from #F43F5E (top-left) to #FB923C
(bottom-right). Soft glossy light from the upper-left, gentle inner depth, a
clean minimalist white flame glyph with a subtle soft shadow. Modern
flat-with-depth design, crisp edges, generous safe padding, balanced full-bleed
square, studio lighting, 1024x1024, ultra clean, high detail. No text.
```

### 2 · Contacts — relationships
Filename: `contacts.png` · Gradient: `#00D2D3 → #54A0FF` (teal → blue)

```
Premium iOS-style app icon. A single clean white person/contact-card silhouette
perfectly centered on a smooth diagonal gradient from #00D2D3 (top-left) to
#54A0FF (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white glyph with a subtle soft shadow. Modern flat-with-depth
design, crisp edges, generous safe padding, balanced full-bleed square, studio
lighting, 1024x1024, ultra clean, high detail. No text.
```

### 3 · Pulse — social vibe / "feel the room"
Filename: `pulse.png` · Gradient: `#EC4899 → #6366F1` (magenta → indigo)

```
Premium iOS-style app icon. A single white heartbeat/pulse waveform line
perfectly centered on a smooth diagonal gradient from #EC4899 (top-left) to
#6366F1 (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white waveform glyph with a subtle soft shadow. Modern
flat-with-depth design, crisp edges, generous safe padding, balanced full-bleed
square, studio lighting, 1024x1024, ultra clean, high detail. No text.
```

### 4 · Stocks — trade & invest
Filename: `stocks.png` · Gradient: `#00B894 → #00CEC9` (green → aqua)

```
Premium iOS-style app icon. A single white upward trending line-chart with a
small arrow, perfectly centered on a smooth diagonal gradient from #00B894
(top-left) to #00CEC9 (bottom-right). Soft glossy light from the upper-left,
gentle inner depth, minimalist white glyph with a subtle soft shadow. Modern
flat-with-depth design, crisp edges, generous safe padding, balanced full-bleed
square, studio lighting, 1024x1024, ultra clean, high detail. No text.
```

### 5 · Bank — finances
Filename: `bank.png` · Gradient: `#FD79A8 → #FDCB6E` (pink → gold)

```
Premium iOS-style app icon. A single white classic bank building with columns
(or a credit card), perfectly centered on a smooth diagonal gradient from
#FD79A8 (top-left) to #FDCB6E (bottom-right). Soft glossy light from the
upper-left, gentle inner depth, minimalist white glyph with a subtle soft
shadow. Modern flat-with-depth design, crisp edges, generous safe padding,
balanced full-bleed square, studio lighting, 1024x1024, ultra clean, high
detail. No text.
```

### 6 · School — education / learn skills
Filename: `education.png` · Gradient: `#14B8A6 → #06B6D4` (teal → cyan)

```
Premium iOS-style app icon. A single white graduation cap (mortarboard),
perfectly centered on a smooth diagonal gradient from #14B8A6 (top-left) to
#06B6D4 (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white glyph with a subtle soft shadow. Modern flat-with-depth
design, crisp edges, generous safe padding, balanced full-bleed square, studio
lighting, 1024x1024, ultra clean, high detail. No text.
```

### 7 · Hustle — build a startup / company
Filename: `hustle.png` · Gradient: `#6366F1 → #06B6D4` (indigo → cyan)

```
Premium iOS-style app icon. A single white rocket launching upward (startup
energy), perfectly centered on a smooth diagonal gradient from #6366F1
(top-left) to #06B6D4 (bottom-right). Soft glossy light from the upper-left,
gentle inner depth, minimalist white glyph with a subtle soft shadow. Modern
flat-with-depth design, crisp edges, generous safe padding, balanced full-bleed
square, studio lighting, 1024x1024, ultra clean, high detail. No text.
```

### 8 · Pets — adopt & care
Filename: `pets.png` · Gradient: `#F59E0B → #CA8A04` (amber → gold)

```
Premium iOS-style app icon. A single white paw print, perfectly centered on a
smooth diagonal gradient from #F59E0B (top-left) to #CA8A04 (bottom-right). Soft
glossy light from the upper-left, gentle inner depth, minimalist white glyph
with a subtle soft shadow. Modern flat-with-depth design, crisp edges, generous
safe padding, balanced full-bleed square, studio lighting, 1024x1024, ultra
clean, high detail. No text.
```

---

## Computer / desktop apps (9)

### 9 · Crypto — mining
Filename: `crypto.png` · Gradient: `#FFD700 → #FFA500` (gold → orange)

```
Premium iOS-style app icon. A single white Bitcoin-style coin symbol with a
subtle pickaxe motif, perfectly centered on a smooth diagonal gradient from
#FFD700 (top-left) to #FFA500 (bottom-right). Soft glossy light from the
upper-left, gentle inner depth, minimalist white glyph with a subtle soft
shadow. Modern flat-with-depth design, crisp edges, generous safe padding,
balanced full-bleed square, studio lighting, 1024x1024, ultra clean, high
detail. No text.
```

### 10 · Real Estate — properties
Filename: `realestate.png` · Gradient: `#22C55E → #00CEC9` (green → aqua)

```
Premium iOS-style app icon. A single white house with a small roof highlight,
perfectly centered on a smooth diagonal gradient from #22C55E (top-left) to
#00CEC9 (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white glyph with a subtle soft shadow. Modern flat-with-depth
design, crisp edges, generous safe padding, balanced full-bleed square, studio
lighting, 1024x1024, ultra clean, high detail. No text.
```

### 11 · Dark Web — deep web access
Filename: `darkweb.png` · Gradient: `#334155 → #4A5568` (slate → gray)

```
Premium iOS-style app icon. A single white globe overlaid with a small padlock,
perfectly centered on a smooth diagonal gradient from #334155 (top-left) to
#4A5568 (bottom-right), slightly moody. Soft glossy light from the upper-left, a
faint neon-green rim highlight on the symbol, minimalist white glyph with a
subtle soft shadow. Modern flat-with-depth design, crisp edges, generous safe
padding, balanced full-bleed square, studio lighting, 1024x1024, ultra clean,
high detail. No text.
```

### 12 · YouVideo — create videos
Filename: `youvideo.png` · Gradient: `#8B5CF6 → #A855F7` (violet → purple)

```
Premium iOS-style app icon. A single white rounded play-button triangle inside a
soft rounded rectangle, perfectly centered on a smooth diagonal gradient from
#8B5CF6 (top-left) to #A855F7 (bottom-right). Soft glossy light from the
upper-left, gentle inner depth, minimalist white glyph with a subtle soft
shadow. Modern flat-with-depth design, crisp edges, generous safe padding,
balanced full-bleed square, studio lighting, 1024x1024, ultra clean, high
detail. No text.
```

### 13 · Streaming — go live
Filename: `streaming.png` · Gradient: `#DC2626 → #EF4444` (red → coral)

```
Premium iOS-style app icon. A single white broadcast/live symbol (a camera or a
dot with radiating signal arcs), perfectly centered on a smooth diagonal
gradient from #DC2626 (top-left) to #EF4444 (bottom-right). Soft glossy light
from the upper-left, gentle inner depth, minimalist white glyph with a subtle
soft shadow. Modern flat-with-depth design, crisp edges, generous safe padding,
balanced full-bleed square, studio lighting, 1024x1024, ultra clean, high
detail. No text.
```

### 14 · Travel — book trips
Filename: `travel.png` · Gradient: `#0EA5E9 → #0284C7` (sky → blue)

```
Premium iOS-style app icon. A single white paper airplane tilted upward,
perfectly centered on a smooth diagonal gradient from #0EA5E9 (top-left) to
#0284C7 (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white glyph with a subtle soft shadow. Modern flat-with-depth
design, crisp edges, generous safe padding, balanced full-bleed square, studio
lighting, 1024x1024, ultra clean, high detail. No text.
```

### 15 · Political Office — run & govern
Filename: `politics.png` · Gradient: `#EF4444 → #B91C1C` (red → deep red)

```
Premium iOS-style app icon. A single white speaker's podium with a small
star/emblem above it, perfectly centered on a smooth diagonal gradient from
#EF4444 (top-left) to #B91C1C (bottom-right). Soft glossy light from the
upper-left, gentle inner depth, minimalist white glyph with a subtle soft
shadow. Modern flat-with-depth design, crisp edges, generous safe padding,
balanced full-bleed square, studio lighting, 1024x1024, ultra clean, high
detail. No text.
```

### 16 · Statistics — lifetime stats
Filename: `statistics.png` · Gradient: `#10B981 → #059669` (emerald → green)

```
Premium iOS-style app icon. A single white bar-chart of three rising bars,
perfectly centered on a smooth diagonal gradient from #10B981 (top-left) to
#059669 (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white glyph with a subtle soft shadow. Modern flat-with-depth
design, crisp edges, generous safe padding, balanced full-bleed square, studio
lighting, 1024x1024, ultra clean, high detail. No text.
```

### 17 · Garage — vehicles
Filename: `garage.png` · Gradient: `#6366F1 → #8B5CF6` (indigo → violet)

```
Premium iOS-style app icon. A single white sporty car (three-quarter front
view), perfectly centered on a smooth diagonal gradient from #6366F1 (top-left)
to #8B5CF6 (bottom-right). Soft glossy light from the upper-left, gentle inner
depth, minimalist white glyph with a subtle soft shadow. Modern flat-with-depth
design, crisp edges, generous safe padding, balanced full-bleed square, studio
lighting, 1024x1024, ultra clean, high detail. No text.
```

---

## When the PNGs are ready

Drop them in `assets/images/AppIcons/` with the filenames above and tell me. I'll:

- Add an `APP_ICON_ASSETS` map (`{ spark: require('...'), ... }`) keyed by the
  existing app ids used in `mobile.tsx` / `computer.tsx`.
- Render the PNG edge‑to‑edge inside the existing rounded icon container.
- **Fallback:** any id without a PNG keeps its current Lucide glyph, so you can
  ship the set incrementally — no half‑migrated grid, nothing breaks.

You don't need to touch any code — just generate, name, and drop.
