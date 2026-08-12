# Avatar art direction — research and decision

Follow-up to `avatar-redesign-proposal.md`. That doc chose the right
architecture (parameters, not PNGs) and the wrong art pipeline.

## What went wrong the first time

The first implementation hand-authored the facial geometry: bezier path data
typed directly into `lib/avatar/features.ts` and iterated by rendering
contact sheets and adjusting coordinates by eye.

That is not a process that produces character art. It produced stiff,
uncanny, amateur faces — semi-realistic proportions rendered with flat-vector
execution, which is the worst of both. More iterations on the same geometry
would not have fixed it; the problem was the pipeline, not the tuning.

**The architecture was fine. The art was not.** Everything downstream of
"what does a face look like" — the config, the codec, the ageing model, the
inheritance, the save migration, the rebuilt screen — is sound and tested.
What has to change is where the geometry comes from.

## What the industry actually does

Nobody types face geometry. Every quality avatar system is illustrator-drawn
art assembled from modular parts:

- **Bitmoji, Memoji, Ready Player Me** — in-house illustration teams, large
  modular part libraries, years of iteration.
- **Indie and mobile** — either commission a modular part set, or use an
  existing illustrated one.

Commissioning, for reference (2026 rates): **$300–$2,000** per 2D character
design, mid-tier freelancers **$40–80/hr**, with commercial-use licensing
adding roughly **20–30%**. The cost-saving approach everyone recommends is
exactly the modular one — a base plus interchangeable parts, batch-commissioned.
For a full life-sim part set (hair, eyes, brows, mouths, noses, facial hair,
accessories, across age stages) that is a **five-figure commission and weeks
of turnaround.**

## The shortcut that is not a compromise

DiceBear is a library of **illustrator-drawn** modular avatar sets — the
library code is MIT (Florian Körner) and each art set carries its own licence
from its original designer. It is already a dependency of this repo
(`@dicebear/core` + `@dicebear/collection` 9.2.2, 30 styles), left over from
the earlier research.

This is not "template slop" versus bespoke art — the realistic alternatives
here are *illustrator-drawn open-source art* or *my hand-typed geometry*, and
the first is better by an enormous margin.

### Styles evaluated

Rendered locally at real game sizes on the app's dark palette —
`scripts/evaluate-avatar-styles.mjs` and `scripts/evaluate-avatar-finalists.mjs`.

| Style | Licence | Option groups | skinColor | hairColor | Verdict |
|---|---|---|---|---|---|
| **adventurer** | CC BY 4.0 · Lisa Wischofsky | 14 (45 hair · 26 eyes · 30 mouths · 15 brows) | ✅ | ✅ | **Best overall.** Warm, modern, reads at 44px, ages convincingly |
| **lorelei** | **CC0** · Lisa Wischofsky | 26 — the most (48 hair · 24 eyes · 27 mouths) | ✅ | ✅ | Elegant line art, zero licence burden. Does NOT take the lit frame |
| **avataaars** | Free personal + commercial · Pablo Stanley | 20 (34 tops · clothing) | ✅ | ✅ | Safest and most proven — and the most ubiquitous avatar style on the internet |
| micah | CC BY 4.0 · Micah Lanier | 25, but only 8 hair | ❌ (`baseColor`) | ✅ | Stylish, too shallow for a creator |
| bigEars | CC BY 4.0 · The Visual Team | 12 (40 hair · 32 eyes · 38 mouths) | ✅ | ✅ | Deep, but childlike against a premium dark UI |
| openPeeps | CC0 · Pablo Stanley | 11 | ✅ | ❌ | **Disqualified** — hair is baked into the head, so it cannot grey |
| notionists | CC0 · Zoish | 15 (64 hair) | ❌ | ❌ | **Disqualified** — no skin colour at all |
| bigSmile | CC BY 4.0 | 8 | ✅ | ✅ | Every face grins. Wrong for a game with death in it |
| personas, miniavs, croodles, dylan, pixelArt | CC BY 4.0 / CC0 | 6–20 | mixed | mixed | Weaker fits |

Two disqualifications are worth stating plainly, because they are specific to
a **birth-to-death** life sim rather than general taste: a style with no
`hairColor` cannot grey, and a style with no `skinColor` cannot represent the
player. Both were confirmed by rendering, not assumed.

### Licence practicalities

- **CC0** (lorelei, notionists, openPeeps, pixelArt) — public domain, nothing owed.
- **CC BY 4.0** (adventurer, micah, bigEars, bigSmile, personas, miniavs) —
  a visible credit line. A "Credits" row in Settings satisfies it. Not a
  blocker for a paid App Store game; it is one line of text.
- **avataaars / bottts** — "free for personal and commercial use", no credit required.

## The 2.5D, kept

2.5D stays — but as a **lit frame around the art**, not as hand-modelled
volume inside it: a contact shadow so the face sits *on* the surface, a radial
key light from the upper left, a gloss sweep, and a hairline rim.

This is not a new idea in this repo — `scripts/generate-avatar-styles.mjs`
prototyped exactly this treatment and its conclusion ("a legit premium
mobile-game look") was shelved. `screenshots/avatar-recommendation.png` is the
same treatment over the recommended art.

One constraint, verified twice: **the lit frame only works on FILLED styles.**
Line-art styles (lorelei, notionists, openPeeps) have transparent faces, so a
coloured plate shows straight through. They must ship flat.

## Ageing

Ageing is driven entirely through real style options — no drawn-on wrinkles:

| Age | Lever |
|---|---|
| Hair colour | dark → mid → salt-and-pepper → grey → white |
| `hairProbability` | drops past ~72, so hair thins rather than being repainted |
| `glassesProbability` | 10% young → 70% old |

The rendered ladder (8 → 85 on one seed) holds up: the person stays the same
person and visibly ages, which is the exact property the old portrait pool
failed and that `utils/facePool.ts` documents at length.

## What this changes in the code

Kept — all tested, all still correct:

- `lib/avatar/types.ts`, `encode.ts`, `aging.ts`, `inherit.ts`, `resolve.ts`,
  `pickers.ts` — config, codec, ageing model, inheritance, save resolution
- `app/(onboarding)/Customize.tsx` — the rebuilt creator screen
- v39 migration and the carve-out reasoning
- the ~50 tests in `__tests__/avatar/` and `__tests__/save/avatarMigration.test.ts`

Replaced:

- `lib/avatar/features.ts` — hand-authored geometry → option-name catalogs
  from the chosen style's schema
- `components/avatar/VectorAvatar.tsx` — the hand-rolled renderer →
  `createAvatar(...).toString()` into `<SvgXml>` from `react-native-svg`,
  wrapped in the lit frame

`AvatarConfig`'s numeric indices map cleanly onto the style's option arrays,
so the save format, the codec and the inheritance maths are unaffected.

## Open items

- **Bundle size.** `@dicebear/collection` ships all 30 styles. Importing one
  named export should let Metro drop the rest, but that needs measuring rather
  than assuming.
- **Attribution.** If a CC BY style is chosen, a credit line goes in Settings
  in the same change.
- **Plate colour.** The prototype's blue plate is louder than the app's palette
  wants; a slate plate with a soft key reads better against the glass cards.
