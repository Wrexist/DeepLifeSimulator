> **SUPERSEDED.** This is the proposal that chose parameters over PNGs. The portrait pool it describes, and
> the assets under `assets/images/Face/`, were deleted when faces moved to
> the parameterised system in `lib/avatar/`. Kept for the record of what
> was tried and why. Start at `docs/avatar-art-direction-research.md`.

# Avatar / Character Creation Redesign — Research & Proposal

The current Create Identity screen offers a horizontal strip of AI-generated
3D-cartoon portraits (orange glow background) that "age with you". This doc
summarizes competitor research and player sentiment, and proposes a direction.

## What competitors do

| Game | Character representation |
| --- | --- |
| **BitLife** (genre leader) | Emoji-style face that changes by **age bracket** (baby → child → teen → adult → older adult → elder). Redesigned in v1.30+ with light customization (hair, eyes, accessories); plastic surgery can change it in-game. |
| **InstLife** | No avatar at all — pure text. Praised for speed and readability. |
| **Alter Ego** | Text only; identity expressed through stats and choices. |
| **The Sims Mobile** | Full 3D creator. Known complaint: every Sim looks young — the system can't represent age well. |
| **BitLife clones** | Usually one stylized cartoon portrait; several market "deep customization" as a differentiator. |

## What players want (Reddit / research)

- Avatar customization measurably **increases identification, playtime, and
  emotional investment**; "the avatar looks like me" matters most → skin tone
  and hair coverage are table stakes.
- BitLife players complained the old emojis were **too uniform** (3 hair
  colors, 2 eye colors); the customization update was a direct response. Even
  in a text game, players want *some* ownership of the face.
- Players notice when a system **can't represent age** (Sims Mobile) — a life
  sim where a 70-year-old looks 25 breaks immersion.
- Anti-pattern: photoreal/AI-real portraits in a text-driven game read as
  **uncanny** and slow down the "new life" loop. Fast start (randomize + tweak)
  beats a long creator.

## Recommended direction (ranked)

### 1. Layered SVG avatar builder (recommended)

Use a DiceBear-family style via `@dicebear/core` + `react-native-svg`
(officially supported in Expo/RN). Pick ONE dark-theme-friendly stylized set —
Notion-style doodle ([Mayandev/notion-avatar](https://github.com/Mayandev/notion-avatar), MIT),
Open Peeps (CC0), or Big Heads — and expose 4–6 pickers: skin tone, hair
style/color, face shape, accessory, plus a big **Randomize** button.

- **Aging becomes a feature, not an asset problem:** because the avatar is
  parameters, age thresholds just swap layers — grey/white hair, balding,
  glasses, beard, wrinkles — while the player's customizations persist
  underneath. This is a strictly better "ages with you" than swapping
  pre-rendered portraits.
- Deterministic (seed = character id), offline, tiny bundle (SVG — replaces the
  shipped PNG face pool), free licenses.
- Effort: ~1–2 weeks including age-layer logic and migrating `utils/facePool`.

### 2. Curated portrait packs with age variants

Commission/generate ~12–20 base characters × 5 age stages as consistent
stylized PNGs on the app's dark palette. Same architecture as today, better
assets. Low code effort, but no real customization (players' #1 ask), and
asset weight grows fast (base × age × sex).

### 3. Minimal identity (InstLife direction)

Drop portraits; monogram/emoji badge that shifts per age bracket + strong
typography. Days of work, zero uncanny valley, but loses the aging-avatar
emotional hook and a marketing differentiator.

## Bottom line

Direction **1** gives players customization, a genuinely better "ages with
you", and removes the uncanny AI portraits — while keeping the creation screen
fast (randomize-first, few pickers, BitLife-style restraint). Direction 2 is
the fallback if art quality with zero code change is the priority.

Sources: BitLife wiki (Characters, Emoji), LevelSkip InstLife review, Sims
Mobile reviews (Handsome Phantom, GamingTrend), PMC avatar-identification
study, DiceBear docs, notion-avatar repo.
