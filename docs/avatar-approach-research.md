# DeepLife — How to make the characters 2.5D / 3D (research brief)

Research into the real options for giving DeepLife's people (player, Spark, Pulse,
Family, all NPCs) an immersive 2.5D/3D look — buy an existing library, generate
one, build a modular creator, or render live 3D. Written July 2026.

> **UPDATE — the answer was already in the repo.** `assets/images/Face/` ships 5
> rendered 3D/Pixar faces (Baby / Male / Female / Old_Male / Old_Female), already
> wired via `getCharacterImage(age, sex)`. That *is* the immersive look, and it
> matches the app-icon art — so we don't need to buy a pack, use DiceBear, or
> chase the (now-dead) Ready Player Me. The real gap is **variety** (only 5 faces,
> so everyone of the same age+sex is identical). The recommended path collapses to
> **"expand the existing set"**: generate ~25–30 more faces in that exact style
> (see `avatar-portraits-prompts.md`) and seed the picker. The options below are
> kept for context, but this supersedes them.

## Headline: the "just use Ready Player Me" era is over

Ready Player Me was the default free 3D-avatar SDK for indies. **Netflix acquired
it (Dec 19 2025) and shut the public platform down on Jan 31 2026** — the avatar
creator, PlayerZero, and all public APIs are offline, with no public successor.
So the easy "drop in a live 3D avatar SDK" answer is gone for indies now (and it
was already network-blocked in our build environment). Every project on it is
scrambling to migrate. Net: we didn't build on sand — good — and live-3D is now
the *hard* path, not the easy one.

## The constraint that decides everything

DeepLife is a **2D React Native / Expo app**. It shows people as **portrait
images inside circular frames**, across *many* NPCs (a Spark stack, a Pulse feed,
family) plus a customizable player. So the practical question isn't "which 3D
engine" — it's **"where do the portrait images come from, and how alive can they
look."** That yields four real approaches:

---

## A · Buy a ready-made portrait library ("is there already one?" → yes)

There are big, finished libraries of character portraits you can license and drop
in today:

- **Infinity PBR — Character Portrait Mega Pack** (itch.io): each pack is
  **1,600+ hi-res portraits**, AI-made, multiple styles; the full **bundle is
  13,000+ portraits for ~$45–50**. This is the closest thing to "a library that
  already exists."
- **Mighty Facepack**, **Human Character Portrait Pack**, **Anime Portrait Mega
  Pack**, awtdev **Pre-Rendered ARPG Character Pack** — smaller/style-specific.
- Unity Asset Store has equivalents.

**Pros:** on screen this week, ~$45, zero generation, huge variety instantly.
**Cons:** fixed faces (every DeepLife player sees the same stock people), the
pack's art style may not match our slate/Pixar vibe, weak fit for *player*
customization, and you must respect the license. Best used as the **NPC filler
pool**, not the hero cast or the player.

---

## B · Generate our own consistent portrait library with AI (best style fit)

Same workflow that made your app icons / perks / scenarios — but use a purpose-
built **"consistent character"** tool so every face shares one identity/style
without training a model:

- **Ideogram — Character**: locks the same face from a single reference, no LoRA
  training; make a whole set of consistent headshots.
- **OpenArt — AI Character**: save a character, reuse it across new prompts;
  supports a 3D-render style.
- **Media.io / Consistent Character AI**: similar, free tiers exist.

Workflow the community converged on: **keep lighting + background + framing +
style identical for every character, change only the person** — the shared base
creates automatic consistency. You can even generate an **expression sheet**
(neutral / happy / sad / surprised) per hero so the avatar reflects game mood.

**Pros:** exactly the true-3D/Pixar look you keep asking for, your own brand,
bespoke heroes + a seeded NPC pool, expression variants. **Cons:** you generate
the art (but you already do this well). → This is what `docs/avatar-portraits-
prompts.md` is for; swap Midjourney-seed-lock for a consistent-character tool for
tighter cohesion.

---

## C · Modular 2.5D layered avatar (best for deep customization)

How The Sims / BitLife-style creators get infinite variety from finite art: a
**base head + swappable layers** — skin tone, hair, eyebrows, eyes, nose/mouth,
facial hair, outfit — composited at runtime. Pick-and-mix → every character is
unique, the player creator is deep, and **genetics fall out for free** (a kid =
mom's layers + dad's layers).

**Pros:** infinite unique people from one authored part-set, a real character
creator, genetics for family. **Cons:** the most art + engineering; the parts
must be drawn as a cohesive 2.5D-lit set (an artist, or AI-generating parts on a
fixed base head). This is a bigger build than A or B.

---

## D · Live 3D in the app (most literally "3D", but overkill here)

Render real 3D models (GLB/glTF) in RN via **three.js / expo-gl / BabylonJS**.
Model sources now that RPM is dead: **VRoid Studio** (free, stylized/anime, VRM),
**Avatar SDK / MetaPerson** (RPM's official migration target), **Tripo / 3D AI
Studio** (AI → rigged 3D), **MakeHuman** (free/OSS).

**Pros:** true rotatable 3D, real customization. **Cons:** heavy — great for **one
hero avatar** on a profile screen, impractical to render *dozens* of NPC faces in
a scrolling feed (GPU/perf), plus a much bigger integration. Reserve for a single
showpiece, if ever.

---

## Recommendation for DeepLife

A **hybrid**, shipped in layers so the game looks better immediately and keeps
improving — nothing blocks:

1. **Now (free, instant):** ship the **2.5D-lit DiceBear** avatar as the universal
   fallback — already prototyped in `screenshots/avatar-styles.png`. Every face
   gets depth today, infinite, offline.
2. **The real look (B):** generate an **AI consistent-character portrait library**
   for the true-3D feel — heroes bespoke, NPC pool seeded. Prompt sheet is ready.
   These auto-replace the DiceBear fallback as you add them.
3. **Fast alternative to step 2:** if you want 3D-looking faces *this week* with
   zero generation, license **Infinity PBR's Mega Pack (~$45)** and I wire it as
   the NPC pool immediately — then swap in your own AI portraits over time.
4. **Later, optional (C):** if you want a deep character creator + genetics, add
   the modular 2.5D layer system.
5. **Skip D** unless you specifically want one rotatable hero avatar.

Every step shares one runtime: a portrait registry with **seeded NPC assignment
and a DiceBear fallback**, so faces migrate incrementally and nothing ever renders
blank.

## Sources

- [Ready Player Me shutdown / Netflix acquisition — Genies](https://genies.com/blog/ready-player-me-discontinued-alternatives)
- [RPM migration guide — Avatar SDK](https://avatarsdk.com/blog/2026/07/07/ready-player-me-migration-guide/)
- [Best AI 3D character & avatar generators 2026 — 3DAI Studio](https://www.3daistudio.com/blog/best-ai-3d-character-and-avatar-generators-2026)
- [Ideogram Character (consistent faces, no training)](https://ideogram.ai/features/character/)
- [OpenART AI Character](https://openart.ai/features/ai-character)
- [Infinity PBR Character Portrait Mega Pack bundle (itch.io)](https://itch.io/s/33638/13000-character-portrait-mega-pack-bundle)
- [itch.io — portrait asset packs](https://itch.io/game-assets/tag-portraits)
- [SimAvatar: layered avatars (NVIDIA, CVPR 2025)](https://nvlabs.github.io/SimAvatar/)
- [Designing avatar customization systems](https://www.designthegame.com/learning/tutorial/designing-identity-mechanics-avatar-customization-systems)
