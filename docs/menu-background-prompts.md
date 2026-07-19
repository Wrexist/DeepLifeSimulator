# Main-Menu Background — AI Image Prompts

Prompts for generating the main-menu background artwork. The menu's title,
cards, and buttons are rendered by the app ON TOP of this image, so the image
itself must follow the hard rules below or the screen becomes unreadable.

## Hard rules (apply to every prompt)

1. **NO text of any kind.** No title, letters, numbers, logos, watermarks,
   signatures. The app draws "DEEP LIFE SIMULATOR" itself. (This is why the
   existing `assets/images/Main_Menu*.png` posters can't be used as live
   backgrounds — their baked-in title would be cropped on tall screens and
   would double up with the on-screen title.)
2. **Portrait, tall.** Generate at 9:16 or taller — Midjourney `--ar 9:16`,
   DALL·E 1024×1792, SDXL 896×1600+. The app crops edges to fill a ~9:19.5
   iPhone screen, so keep everything important in the CENTER column and never
   place key elements near the left/right edges.
3. **Dark, deep-navy palette.** The scene must live in the same world as the
   app background `#020617`: near-black navy (`#020617`, `#0B1220`,
   `#0F172A`) with electric-blue accents (`#3B82F6`, `#60A5FA`). No bright
   whites, no large light areas, no warm daylight.
4. **Composition zones** (top → bottom):
   - **Top ~35%: quiet.** Sky/atmosphere only — the title sits here.
   - **Middle 35–70%: calm, low-detail.** The action cards sit here; busy
     detail in this band fights the UI.
   - **Bottom ~30%: the interesting part.** Landscape/silhouette/subject
     lives low in the frame.
5. **Vignette.** Edges and corners fade toward near-black so the app's UI
   pops. The app also applies its own dark overlay (scrim), so a generation
   that looks slightly too bright is fine — one that is busy is not.

Add to every prompt (Midjourney): `--ar 9:16 --style raw --no text, letters,
typography, logo, watermark, signature, frame, border`
For DALL·E / others, append: *"absolutely no text, letters, logos or
watermarks anywhere in the image."*

---

## Prompt 1 — Brand continuity: the cliff silhouette (recommended first)

> Minimalist flat-vector night scene: a lone human silhouette seen from
> behind, standing small on a dark cliff edge in the LOWER THIRD of the
> frame, gazing into a vast deep-navy abyss. Soft volumetric god-rays of
> cold electric-blue light (#3B82F6) descend from the upper corner through
> darkness. A few tiny faint stars. Palette: near-black navy #020617 to
> #0F172A with cyan-blue glow accents. Large, empty, smooth dark sky in the
> upper two thirds. Clean flat 2D illustration, subtle grain, strong
> vignette fading to black at all edges. No text.

*(This recreates the existing DeepLife key-art identity — silhouette, rays,
navy — but text-free and composed for the phone screen.)*

## Prompt 2 — The winding life-path

> Minimalist dark landscape at night viewed from above and behind: a single
> narrow winding path of soft glowing blue light (#60A5FA) starts at the
> bottom edge and meanders far into a black-navy horizon, over low rolling
> silhouetted hills. The path is the only light source, thin and elegant.
> Deep navy #020617 sky with sparse tiny stars in the upper third, kept very
> dark and empty. Flat vector illustration style, subtle film grain, heavy
> vignette. No text.

## Prompt 3 — City of a thousand lives

> A dark city skyline at night seen from a high rooftop, compressed into the
> BOTTOM QUARTER of the frame: hundreds of tiny warm and cool window lights
> like distant bokeh dots, heavily darkened, under an enormous empty
> deep-navy #020617 night sky filling the upper three quarters. A faint cold
> blue haze (#3B82F6) rises from the city into the dark. Minimal flat
> illustration, atmospheric, moody, strong vignette to black at the edges.
> No text.

## Prompt 4 — Time nebula

> Abstract cosmic scene: a very dark deep-navy #020617 space field with one
> soft, slow swirl of blue nebula (#3B82F6 fading to #60A5FA) low in the
> frame, shaped vaguely like sand falling through an invisible hourglass.
> Sparse pin-point stars. The upper half is almost pure dark navy with only
> a whisper of glow. Smooth gradients, no hard shapes, minimal and elegant,
> subtle grain, edges vignetted to black. No text.

## Prompt 5 — Aurora over the ridge

> A thin, single ribbon of blue-cyan aurora (#60A5FA) hanging LOW over a
> pitch-black silhouetted mountain ridge in the bottom fifth of the frame.
> Above it, a vast, near-empty deep-navy #020617 night sky with a few faint
> stars — calm and enormous. Minimal flat vector style, soft glow only where
> the aurora meets the ridge, strong dark vignette. No text.

## Prompt 6 — The window at night

> Interior mood shot: looking at a dark rain-speckled window at night from
> inside an unlit room; through the glass, extremely blurred cold-blue city
> bokeh lights (#3B82F6) in the LOWER HALF only. Everything is very dark
> deep-navy #020617; the raindrops catch tiny glints of blue. The upper part
> of the window fades into pure darkness. Cinematic, minimal, melancholic,
> heavy vignette. No text.

## Prompt 7 — Generations on the ridge

> Three tiny human silhouettes — a child, an adult, and an elder with a cane
> — walking in a line along a thin dark ridge in the BOTTOM SIXTH of the
> frame, backlit by a faint cold-blue moon glow (#60A5FA) low on the
> horizon. Above them an immense, almost-empty deep navy #020617 night sky
> with sparse stars. Flat minimal vector illustration, poetic, strong
> vignette to black. No text.

## Prompt 8 — The thread of life

> Abstract minimal artwork: one single continuous thin luminous blue thread
> (#3B82F6) enters at the bottom edge and weaves gentle knots and loops as
> it rises through pure deep-navy #020617 darkness, thinning and fading
> before it reaches the upper third, which stays almost black. The thread's
> glow is the only light. Elegant, calm, subtle grain, vignetted edges. No
> text.

---

## Delivery / wiring

- Generate 2–3 candidates (they crop differently on-device; variety helps).
- Filename: anything clear, e.g. `menu-bg-1.png`.
- Either send the image(s) in chat or commit them to
  `assets/images/Main_Menu/` — then say the word and the wiring lands the
  same day: `ImageBackground` behind the menu with a dark scrim
  (`rgba(2,6,23,0.45)` at the top deepening to `rgba(2,6,23,0.8)` behind the
  cards) so every button and label keeps full contrast. The flat `#020617`
  background remains the automatic fallback whenever no image is present.
