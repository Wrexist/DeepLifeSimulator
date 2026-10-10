# GPT-6 Astra master prompt: DeepLife premium 3D asset set (v1)

How to use: paste **everything between the two `=====` lines** into GPT-6 Astra as one message. Astra stops at each REVIEW GATE and waits for your "approved" (or your notes). When it's done, put the delivery folder at `art/astra-v1/` in this repo and tell Claude "Astra assets are in". The intake steps are at the bottom of this file.

Companion plan: `tasks/premium-experience-2026-10-05.md`.

=====

# Brief: premium 3D icon and hero set for "Deep Life Simulator"

## 1. Who you're working for

Deep Life Simulator is a life-simulation mobile game for iPhone and Android. A player starts with $0 and lives a whole life week by week: jobs, school, money, dating, marriage, children, houses, businesses, investing, and finally death and an heir who inherits.

The app UI is **dark navy** (canvas `#071321`, cards `#102235`) with bright accents. We are adding **celebration moments**: when something big happens, a sheet slides up with one glossy 3D object, one huge number, one short sentence and one button ("Keep going"). Your job is the 3D objects. The number and text are drawn by the app, never by you.

Reference feel: a glossy soft-plastic 3D fire icon on a milestone sheet, like Apple-style 3D emoji. Chunky, friendly, tactile, premium. Not realistic, not low-poly, not clay-matte.

## 2. Art direction (applies to every asset)

**Family name:** "DeepLife Glossy". Every asset must look like it came from the same set.

- **Forms:** chunky, rounded, slightly inflated. Generous bevels everywhere (no sharp edges). Simple silhouettes that read instantly at 48 px.
- **Material:** glossy soft plastic with clearcoat. Base roughness 0.30, clearcoat 1.0, clearcoat roughness 0.08. Subtle subsurface/inner glow on warm objects (flame core, gems, hearts). Metals (gold, coins) are polished but still soft and toy-like, roughness 0.22, metallic 1.0.
- **Colour:** saturated but warm, with gentle gradients across each surface (light top, deeper bottom). Use this palette and nothing far outside it:
  - Gold / reward: `#F5B731` to `#C5862A`
  - Flame: red `#F0442E` outer, orange `#FF8A1F` mid, yellow `#FFD45C` core
  - Gems / premium currency: indigo `#6366F1` to violet `#8B5CF6`, with light-blue highlights `#62B4FF`
  - Money / success: green `#10B981` to `#0E8A63`
  - Love / relationships: pink-red `#EC4899` to `#E63B5A`
  - Brand blue: `#168BFF` to `#0864C8`
  - Neutrals: cream `#FAF3DF`, warm white `#F2EEE6`, dark teal `#293D43`
- **Lighting (identical for every render; build ONE shared Blender scene and reuse it):**
  - Key: large soft area light, top-left-front, warm white (5200 K).
  - Rim: soft area light, back-right, cool blue `#62B4FF` at low strength. This is what makes objects pop on the navy UI.
  - Fill: weak, front-right, neutral.
  - World: neutral grey studio HDRI at low strength for reflections only. No visible environment.
- **Camera (identical for every icon):** perspective, 50 mm, the object seen from about 15° above eye level and turned 20° to the right (a gentle 3/4 view). The object is centered and fills **72-78% of the frame's height** (or width if wider). Leave the same safe margin on every icon.
- **Background:** fully transparent. **No ground plane, no floor, no cast ground shadow.** Self-shadowing and ambient occlusion on the object itself are wanted.
- **No text, letters or numbers anywhere** (the app localizes and draws all text). The single exception is an embossed `$` on the money bag.
- **No people, faces, hands or brand logos.** No copyrighted characters.
- **Must read on both** `#071321` (navy) and `#F8FAFC` (near-white). Check both before delivering.

## 3. Technical spec

- **Tool:** Blender (Cycles), one `.blend` per asset group, all linked to the shared lighting/camera scene.
- **Still renders:** PNG, RGBA, straight (un-premultiplied) alpha, sRGB.
  - Icons: **1024 × 1024**.
  - Hero scenes: **1600 × 1200**.
  - Badge frames: **1024 × 1024**.
- **Clean alpha:** soft anti-aliased edges, no dark or light halo on either test background, no stray semi-transparent pixels away from the object.
- **Geometry:** under 40,000 triangles per object, clean quads where practical, applied scale, origin at the visual center. Name every object and material sensibly.
- **Also export** a GLB 2.0 per asset (embedded materials, no external textures). Procedural materials are fine in Blender; for the GLB, bake to simple PBR values.
- **File names:** lowercase-kebab, exactly as given in the asset tables below.

## 4. Asset list

### Group A: milestone hero icons (12) - `icons/`

| File | Object | Shown when |
|---|---|---|
| `flame` | A plump cartoon flame: red outer tongue, orange middle, glowing yellow-orange inner core, two or three soft flicks at the top | Daily play streak |
| `gem-stack` | Three faceted gems: one large indigo-violet gem in front, two smaller behind and to the sides, light catching the facets | Buying gems, gem rewards |
| `trophy` | A short, chunky gold trophy cup with two rounded handles on a small two-step base | Chapter complete, achievements |
| `briefcase-up` | A rounded brown-leather briefcase (`#A86B3C`) with a gold clasp and a small round green badge with an up-arrow (shape only, not text) on its front-right corner | Promotion |
| `money-bag` | A plump green money sack tied at the neck with gold rope, embossed `$` on the front, two gold coins resting against it | Net-worth milestones |
| `house-key` | A small cozy house (cream walls, terracotta roof `#B97455`, round window glowing warm) with an oversized gold key leaning against it | First home |
| `rings` | Two interlocked gold rings, one with a small round diamond | Wedding |
| `rattle` | A pastel baby rattle: mint handle, round lilac-and-cream head with a soft star pattern | Child born |
| `crown` | A gold crown with three rounded points tipped by small red gems and a band of small blue gems | Prestige, heir inherits |
| `heart` | A glossy pink-red heart, slightly tilted, soft inner glow | Relationships, bond milestones |
| `grad-cap` | A navy graduation cap (`#293D43`) with a gold tassel | Graduation |
| `storefront` | A tiny shop front with a striped awning (brand blue and cream), a door and one glowing window | Business founded |

### Group B: tiers (6) - `tiers/`

These have the same object, camera and framing as Group A. Only the "power" changes, so the player sees growth.

| File | Change from the base |
|---|---|
| `flame-1` | Small, calm flame, 60% of the base flame's size, still centered (3-day streak) |
| `flame-2` | The base `flame` design (7-day streak) |
| `flame-3` | Taller blazing flame with an extra flick and a **blue-white hot core** (`#9BD7FF`), plus three tiny floating embers (30+ day streak) |
| `trophy-bronze` | `trophy` in bronze (`#C07A45`) |
| `trophy-silver` | `trophy` in silver (`#C9D2DC`) |
| `trophy-gold` | `trophy` as designed in Group A |

### Group C: level badge kit (5) - `badges/`

The app draws a number in the middle of the badge, so **the badge face must be an empty, flat-ish area** big enough for 3 digits. The face should be about 55% of the badge width, smooth, slightly convex, with no engraving.

| File | Object |
|---|---|
| `badge-bronze` | A chunky rounded pentagon badge, bronze, with a raised rim and an empty face |
| `badge-silver` | Same, silver |
| `badge-gold` | Same, gold |
| `badge-platinum` | Same, platinum with a subtle blue-to-orange iridescent sheen on the face (like the reference badge) |
| `laurel` | A separate gold laurel wreath, open at the top, sized and positioned to sit **behind** the badge when both are layered at the same canvas position (same camera, same center). Render it alone on transparent |

### Group D: onboarding heroes (3) - `heroes/`

These are 1600 × 1200 small dioramas in the same glossy family, one per intro screen. Keep each to one clear idea with 2-4 objects. No floor plane, but a soft, small, rounded platform under the objects is allowed (cream `#F2EEE6`, thick bevel). Leave **the top 15% and bottom 30% of the canvas empty** for the app's headline and button.

| File | Scene | The screen's message |
|---|---|---|
| `hero-start` | An empty open wallet with one single coin about to drop in | "Every life starts at $0" |
| `hero-grow` | A briefcase beside a rising staircase of three gold coin stacks (short, medium, tall), the tallest with a tiny flag on top | "Work, earn, level up" |
| `hero-legacy` | The `crown` resting on top of a small cozy house, with two tiny wrapped gift boxes beside it | "Leave it all to your heir" |

### Group E (phase 2, only after Groups A-D are approved): seamless loops - `loops/`

These are for 6 assets: `flame`, `gem-stack`, `trophy`, `crown`, `money-bag`, `heart`.

- 2.0 seconds, **48 frames at 24 fps**, PNG sequence, 512 × 512, same camera and lighting.
- **The last frame must lead seamlessly into the first** (animate a full cycle; frame 49 would equal frame 1).
- Motion is gentle and alive, not busy:
  - Flame: flicks sway and the core breathes in brightness.
  - Gems: slow 15° turntable back and forth, with sparkles travelling across the facets.
  - Trophy: soft shine sweep across the cup once per loop.
  - Crown: small bob plus a shine sweep across the gems.
  - Money bag: slight squash-and-stretch bounce, coins glint.
  - Heart: two soft beats (lub-dub) then rest.
- No camera movement. The object never leaves its 72-78% framing box.
- Files: `loops/<name>/frame_0001.png` … `frame_0048.png`.

## 5. Process and review gates

1. **STYLE FRAME.** Build the shared scene, then model and render only `flame`, `gem-stack` and `trophy`. Deliver each on transparent, plus a preview of all three side by side on `#071321` and on `#F8FAFC`, and at 48 px and 160 px sizes. **REVIEW GATE 1: stop and wait for approval.**
2. **GROUP A** (remaining 9 icons) + **contact sheet**. **REVIEW GATE 2.**
3. **GROUPS B and C.** Also deliver one composite preview showing the laurel behind `badge-platinum` with a placeholder "100" (preview only; the delivered badge PNGs stay text-free). **REVIEW GATE 3.**
4. **GROUP D.** Also deliver a preview of each hero inside a 390 × 844 phone frame on `#071321`, with a placeholder headline and button so the empty bands are checked. **REVIEW GATE 4.**
5. **GROUP E** loops, after approval. Also deliver one GIF preview per loop, for review only.

At every gate, list anything you changed from this brief and why.

## 6. Delivery

One folder `deeplife-astra-v1/`:

```
deeplife-astra-v1/
  icons/      flame.png ... storefront.png        (+ .glb with the same name)
  tiers/      flame-1.png ... trophy-gold.png      (+ .glb)
  badges/     badge-bronze.png ... laurel.png      (+ .glb)
  heroes/     hero-start.png, hero-grow.png, hero-legacy.png  (+ .glb)
  loops/      <name>/frame_0001.png ... frame_0048.png
  blend/      one .blend per group + shared-scene.blend
  previews/   contact sheets, navy/light checks, 48/160 px checks, phone frames, loop GIFs
  manifest.csv
```

`manifest.csv` columns: `group,file,width,height,triangles,main_hex_colors,notes`.

## 7. Quality checklist (check every item before each gate)

- [ ] Same camera, lighting and framing box on every icon. Laid side by side they look like one set.
- [ ] Transparent background, no ground plane or cast shadow, no halo on navy or on white.
- [ ] No text, letters or numbers (except the `$` on `money-bag`).
- [ ] Each icon's silhouette is recognisable at 48 px.
- [ ] Badge faces are empty and large enough for three digits.
- [ ] Hero top 15% and bottom 30% are empty.
- [ ] Loops are seamless (frame 48 → frame 1 has no jump).
- [ ] Sizes, names and folders exactly as specified.

=====

## Repo intake (for Claude, after delivery)

1. Copy the delivery to `art/astra-v1/`. Masters stay there; they are never bundled.
2. Convert to WebP:
   - icons, tiers and badges → **512 px** (`assets/images/milestones/<name>.webp`, ~30-60 KB each)
   - heroes → **1200 px wide** (`assets/images/onboarding/<name>.webp`)
   - Use `scripts/convert-assets-to-webp.js`.
3. Record name, hash, size and source in `art/astra-v1/manifest.json`, like `art/game-assets-v1/manifest.json`.
4. Check the shipped-image ratchet in preflight §11. It's 17.9 MB of a 45 MB ceiling now; this set should add roughly 1.5 MB.
5. Loops (Group E) stay as masters until the owner decides on animated WebP. That needs `expo-image` or Android Fresco animated-WebP, i.e. a native dependency and a new build. Until then the app animates the still in code (bob, glow, scale-in) and shows it still under reduced motion.
6. Wire-up order follows `tasks/premium-experience-2026-10-05.md` § Plan: CountUp → MilestoneSheet → purchase success → streak → chapter complete → popup frame → intro screens.

Licensing note: record in `art/astra-v1/README.md` that the assets were generated for this project with GPT-6 Astra, with the generation date and the account owner.
