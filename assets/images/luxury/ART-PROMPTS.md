# Luxury & Collectibles — AI Artwork Prompts

Art for the Luxury & Collectibles app. Each catalog item gets one bundled image
shown as the card / detail **artwork banner**. Until an image exists the app
falls back to a per-tier gradient placeholder (a tinted dark panel with the
item's emoji), so the game always looks finished — importing art just upgrades it.

## Pipeline

1. Generate each image with **any** AI image tool (Midjourney, DALL·E, Ideogram,
   Firefly, SDXL, …). Paste the item's prompt below.
2. Export a **PNG**, landscape **3:2** or **16:10**, about **1200px wide**
   (≈1200×800). The card crops to a wide banner and the detail sheet shows it
   taller, so keep the subject **centred** with a little breathing room.
3. Name the file **exactly** as specified (the catalog `id` + `.png`, all
   lowercase, e.g. `rare_watch_collection.png`). The filename is the wiring key —
   a typo means the app can't find it.
4. Drop the PNG into **`assets/images/luxury/`** (this folder).
5. Open **`components/computer/luxury/luxuryArt.ts`** and **uncomment** the
   matching `require(...)` line in `LUXURY_ART`. The app then uses the image
   automatically; anything still commented out keeps the gradient placeholder.
   (The require lines ship commented so a missing file never breaks the build.)

## Shared style clause

Prepend (or append) this to every prompt so the set reads as one cohesive,
premium collection:

> **premium dark editorial product photography, deep navy-black background
> #0B1220, soft rim lighting, subtle blue accent glow, no text, no watermark,
> centered composition, ultra detailed**

---

## Prompts

### `rare_watch_collection.png` — Rare Watch Collection · ENTRY
**Prompt:** A curated tray of grail-tier luxury wristwatches — a platinum perpetual
calendar, a vintage steel chronograph, and an openworked tourbillon — arranged on
black velvet, macro detail on dials and hands, {shared style clause}.
**Alt:** A velvet tray of grail-tier collector wristwatches under soft light.

### `museum_diamond.png` — Museum-Grade Diamond · ENTRY
**Prompt:** A single flawless brilliant-cut diamond on a museum pedestal under a
focused spotlight, fiery internal reflections and caustics, faint blue rim glow,
{shared style clause}.
**Alt:** A flawless brilliant-cut diamond glittering on a display pedestal.

### `fine_art_collection.png` — Fine Art Collection · PREMIUM
**Prompt:** A private gallery wall of blue-chip abstract canvases in gilded frames
with a marble sculpture on a plinth, gallery track-lighting, hushed and expensive,
{shared style clause}.
**Alt:** A private gallery wall of framed blue-chip paintings and a sculpture.

### `supercar.png` — Hypercar · PREMIUM
**Prompt:** A limited-run carbon-fibre hypercar in a dark studio, low three-quarter
hero angle, wet reflective floor, dramatic rim light tracing the bodywork,
{shared style clause}.
**Alt:** A carbon-fibre hypercar shot low in a dark reflective studio.

### `racehorse.png` — Thoroughbred Racehorse · PREMIUM
**Prompt:** A champion thoroughbred racehorse in profile, glossy muscular coat,
braided mane, standing in a dim stable with a shaft of light, breath visible,
{shared style clause}.
**Alt:** A champion thoroughbred racehorse in profile in a dim stable.

### `vineyard_estate.png` — Vineyard Estate · ELITE
**Prompt:** A boutique winery estate at golden dusk — a stone chateau above ordered
rows of vines rolling into hills, warm windows, long shadows, cinematic,
{shared style clause}.
**Alt:** A stone chateau above rolling vineyard rows at golden dusk.

### `luxury_yacht.png` — Luxury Yacht · ELITE
**Prompt:** A sleek 50-metre superyacht at anchor in a turquoise Mediterranean bay
at blue hour, warm deck lighting, tender at the swim platform, glassy water,
{shared style clause}.
**Alt:** A 50-metre superyacht anchored in a turquoise bay at blue hour.

### `private_jet.png` — Private Jet · ELITE
**Prompt:** An ultra-long-range private jet on a night tarmac with the airstair
down and a soft cabin glow spilling out, ground lighting and faint reflections,
{shared style clause}.
**Alt:** An ultra-long-range private jet on a night tarmac, airstair down.

### `private_island.png` — Private Island · ULTRA
**Prompt:** A private tropical island from a low aerial view — white-sand beaches,
a modern compound among palms, a dock with a yacht, turquoise lagoon, dusk,
{shared style clause}.
**Alt:** An aerial view of a private tropical island with a compound and dock.

### `trophy_penthouse.png` — Trophy Penthouse · ULTRA
**Prompt:** A full-floor skyline penthouse interior at night, floor-to-ceiling
glass over a glittering city, minimalist luxe furnishing, warm pooled lighting,
{shared style clause}.
**Alt:** A full-floor penthouse interior over a glittering city skyline at night.

### `mega_yacht.png` — Mega-Yacht · ULTRA
**Prompt:** A 120-metre mega-yacht at sea at dusk — multiple decks lit warm, a
helipad and pool visible, sweeping cinematic scale against a moody sky,
{shared style clause}.
**Alt:** A 120-metre multi-deck mega-yacht lit warm at sea at dusk.

### `sports_team_stake.png` — Pro Sports Team Stake · ULTRA
**Prompt:** A packed major-league stadium at night from an owner's-box vantage,
floodlit pitch below, sea of crowd lights, sense of ownership and prestige,
{shared style clause}.
**Alt:** A floodlit major-league stadium at night from an owner's-box vantage.

---

_The app reads these automatically once wired: with a matching PNG present and its
line uncommented in `luxuryArt.ts`, the card shows the photo; otherwise it renders
the tier gradient placeholder with the emoji. No code change beyond uncommenting._
