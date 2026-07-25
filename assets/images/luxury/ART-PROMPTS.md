# Luxury & Collectibles — AI Artwork Prompts

Art for the Luxury & Collectibles app. Each catalog item gets one bundled image
shown as the card / detail **artwork banner**. Until an image exists the app
falls back to a per-tier gradient placeholder (a tinted dark panel with the
item's emoji), so the game always looks finished — importing art just upgrades it.

> **Copy-paste ready:** the **`prompts/`** folder next to this file has one
> `.txt` per item with the full prompt (style clause already inlined) — open,
> copy the whole file, paste into your image tool. Each `.txt` is named after
> the catalog id, which is also the exact filename to save the result as.

## Pipeline

1. Generate each image with **any** AI image tool (Midjourney, DALL·E, Ideogram,
   Firefly, SDXL, …). Paste the item's prompt from `prompts/<id>.txt` (or the
   list below).
2. Export a **JPEG** (quality ~88), landscape **2:1**, **1600×800**. See
   *Framing* below — the app crops these, and 2:1 is the ratio that survives
   both crops best.

   **JPEG, not PNG.** These are photographs. As PNG the first twelve weighed
   **25.1 MB**; the same images at JPEG q88 are **3.7 MB**, a difference nobody
   can see at banner size and 21 MB straight off the app download. Only reach
   for PNG if a piece genuinely needs transparency.
3. Name the file **exactly** as specified (the catalog `id` + `.jpg`, all
   lowercase, e.g. `rare_watch_collection.jpg`). The filename is the wiring key —
   a typo means the app can't find it. Do not ship camera/export UUID names
   (`0521D982-8AED-….png`); they have to be renamed before anything resolves.
4. Drop the file into **`assets/images/luxury/`** (this folder).
5. Open **`components/computer/luxury/luxuryArt.ts`** and add (or uncomment) the
   matching `require(...)` line in `LUXURY_ART`. All twelve current items are
   already wired. A require for a file that does not exist is a BUILD failure,
   not a runtime fallback — so comment a line out rather than deleting its file.

## The set — 12 items

Tick these off as you go. Prices are what the player pays, and they set the tone:
the $250k watch tray should look attainable-expensive, the $500M stadium should
look like something a person cannot really own.

| ✓ | File | Item | Tier | Price |
|---|---|---|---|---|
| ✅ | `rare_watch_collection.jpg` | Rare Watch Collection | entry | $250K |
| ✅ | `museum_diamond.jpg` | Museum-Grade Diamond | entry | $600K |
| ✅ | `fine_art_collection.jpg` | Fine Art Collection | premium | $1.2M |
| ✅ | `supercar.jpg` | Hypercar | premium | $2.5M |
| ✅ | `racehorse.jpg` | Thoroughbred Racehorse | premium | $6M |
| ✅ | `vineyard_estate.jpg` | Vineyard Estate | elite | $15M |
| ✅ | `luxury_yacht.jpg` | Luxury Yacht | elite | $32M |
| ✅ | `private_jet.jpg` | Private Jet | elite | $65M |
| ✅ | `private_island.jpg` | Private Island | ultra | $120M |
| ✅ | `trophy_penthouse.jpg` | Trophy Penthouse | ultra | $180M |
| ✅ | `mega_yacht.jpg` | Mega-Yacht | ultra | $300M |
| ✅ | `sports_team_stake.jpg` | Pro Sports Team Stake | ultra | $500M |

**All twelve are done and live.** Partial sets are still fine if the catalog
grows — the app falls back per item, so a new item with no art keeps its
gradient placeholder rather than breaking the build.

## Framing — read this before generating

The app never letterboxes. Both surfaces render the image with `resizeMode="cover"`,
so whatever doesn't match the box's aspect ratio is **cropped away**, centred.
There are two boxes, measured from the live layout (`LuxuryApp.tsx`: card banner
`scale(132)` tall, detail hero `scale(190)` tall, both full card width inside
`responsiveSpacing.md` padding — the ratios are device-independent because width
and height scale by the same factor):

| Surface | Aspect | What a 2:1 source loses |
|---|---|---|
| Card banner (browse list) | **2.6 : 1** | top + bottom — **23% of height** |
| Detail sheet hero | **1.8 : 1** | left + right — **10% of width** |

So with a 2:1 source, the only region guaranteed visible everywhere is the
**central 77% of height × 90% of width**. Keep the subject inside that. Treat the
outer band as bleed: atmosphere, floor, sky, bokeh — never the watch face, never
the hull, never the horse's head.

> **Why not 3:2?** The previous spec said 3:2 / 1200×800. In a 2.6:1 card banner
> that keeps only **58% of the image height** — 42% of everything you generate is
> thrown away before anyone sees it, and centred subjects get their tops and
> bottoms sliced. 2:1 is the compromise that keeps the most of both crops.

## Shared style clause

Prepend (or append) this to every prompt so the set reads as one cohesive,
premium collection:

> **premium dark editorial product photography, deep navy-black background
> #0B1220, soft rim lighting, subtle blue accent glow, no text, no watermark,
> subject centred within the middle 75% of the frame, generous bleed around the
> edges, ultra detailed, landscape 2:1, 1600x800**

---

## Prompts

### `rare_watch_collection.jpg` — Rare Watch Collection · ENTRY
**Prompt:** A curated tray of grail-tier luxury wristwatches — a platinum perpetual
calendar, a vintage steel chronograph, and an openworked tourbillon — arranged on
black velvet, macro detail on dials and hands, {shared style clause}.
**Alt:** A velvet tray of grail-tier collector wristwatches under soft light.

### `museum_diamond.jpg` — Museum-Grade Diamond · ENTRY
**Prompt:** A single flawless brilliant-cut diamond on a museum pedestal under a
focused spotlight, fiery internal reflections and caustics, faint blue rim glow,
{shared style clause}.
**Alt:** A flawless brilliant-cut diamond glittering on a display pedestal.

### `fine_art_collection.jpg` — Fine Art Collection · PREMIUM
**Prompt:** A private gallery wall of blue-chip abstract canvases in gilded frames
with a marble sculpture on a plinth, gallery track-lighting, hushed and expensive,
{shared style clause}.
**Alt:** A private gallery wall of framed blue-chip paintings and a sculpture.

### `supercar.jpg` — Hypercar · PREMIUM
**Prompt:** A limited-run carbon-fibre hypercar in a dark studio, low three-quarter
hero angle, wet reflective floor, dramatic rim light tracing the bodywork,
{shared style clause}.
**Alt:** A carbon-fibre hypercar shot low in a dark reflective studio.

### `racehorse.jpg` — Thoroughbred Racehorse · PREMIUM
**Prompt:** A champion thoroughbred racehorse in profile, glossy muscular coat,
braided mane, standing in a dim stable with a shaft of light, breath visible,
{shared style clause}.
**Alt:** A champion thoroughbred racehorse in profile in a dim stable.

### `vineyard_estate.jpg` — Vineyard Estate · ELITE
**Prompt:** A boutique winery estate at golden dusk — a stone chateau above ordered
rows of vines rolling into hills, warm windows, long shadows, cinematic,
{shared style clause}.
**Alt:** A stone chateau above rolling vineyard rows at golden dusk.

### `luxury_yacht.jpg` — Luxury Yacht · ELITE
**Prompt:** A sleek 50-metre superyacht at anchor in a turquoise Mediterranean bay
at blue hour, warm deck lighting, tender at the swim platform, glassy water,
{shared style clause}.
**Alt:** A 50-metre superyacht anchored in a turquoise bay at blue hour.

### `private_jet.jpg` — Private Jet · ELITE
**Prompt:** An ultra-long-range private jet on a night tarmac with the airstair
down and a soft cabin glow spilling out, ground lighting and faint reflections,
{shared style clause}.
**Alt:** An ultra-long-range private jet on a night tarmac, airstair down.

### `private_island.jpg` — Private Island · ULTRA
**Prompt:** A private tropical island from a low aerial view — white-sand beaches,
a modern compound among palms, a dock with a yacht, turquoise lagoon, dusk,
{shared style clause}.
**Alt:** An aerial view of a private tropical island with a compound and dock.

### `trophy_penthouse.jpg` — Trophy Penthouse · ULTRA
**Prompt:** A full-floor skyline penthouse interior at night, floor-to-ceiling
glass over a glittering city, minimalist luxe furnishing, warm pooled lighting,
{shared style clause}.
**Alt:** A full-floor penthouse interior over a glittering city skyline at night.

### `mega_yacht.jpg` — Mega-Yacht · ULTRA
**Prompt:** A 120-metre mega-yacht at sea at dusk — multiple decks lit warm, a
helipad and pool visible, sweeping cinematic scale against a moody sky,
{shared style clause}.
**Alt:** A 120-metre multi-deck mega-yacht lit warm at sea at dusk.

### `sports_team_stake.jpg` — Pro Sports Team Stake · ULTRA
**Prompt:** A packed major-league stadium at night from an owner's-box vantage,
floodlit pitch below, sea of crowd lights, sense of ownership and prestige,
{shared style clause}.
**Alt:** A floodlit major-league stadium at night from an owner's-box vantage.

---

_The app reads these automatically once wired: with a matching PNG present and its
line uncommented in `luxuryArt.ts`, the card shows the photo; otherwise it renders
the tier gradient placeholder with the emoji. No code change beyond uncommenting._
