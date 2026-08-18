# Avatar art direction — research and decision

Follow-up to `avatar-redesign-proposal.md`. That doc chose the right
architecture (parameters, not PNGs) and the wrong art pipeline.

## What the portrait pool actually did

Worth recording accurately, because `utils/facePool.ts` is deleted in this
change and its behaviour is the reason any of this happened.

The pool grouped 77 rendered portraits into buckets by sex and age band, and
assigned each person a bucket slot from a hash of a stable seed. Its own header
described the result as a feature: *"as a person AGES, the band changes, so the
face follows their age"*.

But a slot index is not an identity. Crossing from one band to the next did not
age a character's face — it swapped them for **a different rendered person** who
happened to occupy the same index in the next bucket. A player watching their
character turn 30 saw a stranger. That is the failure the parameterised system
exists to fix, and it is structural: no amount of extra portraits could have
fixed it, because the pool had no way to express "the same face, older".

Earlier revisions of this work cited facePool.ts as *documenting* that
complaint. It does not — it documents the mechanism approvingly. The complaint
came from players.

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
| **avataaars** | Free personal + commercial · Pablo Stanley | 20 (34 tops · 5 facial hair · 9 clothing) | ✅ | ✅ | **CHOSEN.** The only finalist with facial hair AND clothing |
| adventurer | CC BY 4.0 · Lisa Wischofsky | 14 (45 hair · 26 eyes · 30 mouths · 15 brows) | ✅ | ✅ | Prettiest art, but **no facial hair and no clothing at all** |
| **lorelei** | **CC0** · Lisa Wischofsky | 26 — the most (48 hair · 24 eyes · 27 mouths) | ✅ | ✅ | Elegant line art, zero licence burden. Does NOT take the lit frame |
| micah | CC BY 4.0 · Micah Lanier | 25, but only 8 hair | ❌ (`baseColor`) | ✅ | Stylish, too shallow for a creator |
| bigEars | CC BY 4.0 · The Visual Team | 12 (40 hair · 32 eyes · 38 mouths) | ✅ | ✅ | Deep, but childlike against a premium dark UI |
| openPeeps | CC0 · Pablo Stanley | 11 | ✅ | ❌ | **Disqualified** — hair is baked into the head, so it cannot grey |
| notionists | CC0 · Zoish | 15 (64 hair) | ❌ | ❌ | **Disqualified** — no skin colour at all |
| bigSmile | CC BY 4.0 | 8 | ✅ | ✅ | Every face grins. Wrong for a game with death in it |
| personas, miniavs, croodles, dylan, pixelArt | CC BY 4.0 / CC0 | 6–20 | mixed | mixed | Weaker fits |

Three eliminations are worth stating plainly, because they are specific to a
**birth-to-death** life sim rather than general taste:

- A style with no `hairColor` **cannot grey** — that removes openPeeps.
- A style with no `skinColor` **cannot represent the player** — notionists,
  and micah, which exposes only `baseColor`.
- A style with no facial hair **cannot show a man over 18** — that is what
  removed adventurer, which was the initial recommendation until its schema
  was checked properly. It has 45 hairstyles and no beards.

All three were confirmed by rendering and by reading the schemas, not assumed.

### Why avataaars, in the end

It is the only candidate strong on every axis a life sim actually needs:

- **Facial hair** — five sets, colour-linked to the hair so a grey-haired man
  does not keep a black beard.
- **Clothing** — nine outfits plus colour. This is upside the others cannot
  offer at all: the outfit can eventually be driven by wealth and career.
- **The cleanest ageing ladder** of anything rendered. One man at 10 → 80 stays
  the same person, greys, then thins.
- **No attribution required**, unlike every CC BY style.

Its real weakness is ubiquity — it is the most-used avatar style on the
internet. That is answered by **curation**: the shipped option sets are
deliberate subsets, the palettes are ours, and the 2.5D plate is ours. What a
player sees is not what an unconfigured avataaars install looks like.

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
mobile-game look") was shelved. `scripts/generate-avatar-recommendation.mjs`
renders the same treatment over the recommended art — run it to see the
comparison; the preview PNG is regenerable output and is no longer committed.

One constraint, verified twice: **the lit frame only works on FILLED styles.**
Line-art styles (lorelei, notionists, openPeeps) have transparent faces, so a
coloured plate shows straight through. They must ship flat.

## Ageing

Ageing is driven entirely through real style options — no drawn-on wrinkles:

| Age | Lever |
|---|---|
| Hair colour | greys toward white from ~34, smoothstepped so there is no kink |
| Beard colour | follows the hair exactly — a grey man with a black beard is a very visible wrongness |
| `hairProbability` | drops from 55 on **masculine faces only**; thinning a feminine hairline reads as an art bug |
| `glassesProbability` | 0% under 40 → 65% over 70, and only when the player chose none |

Known limitation, stated rather than hidden: **children look like small
adults.** The style has no age geometry, so a six-year-old differs from a
thirty-year-old only in the levers above. Every candidate shares this; the
alternative is a separate child art set, which is a commission.

The rendered ladder (6 → 85 on one seed) holds up: the person stays the same
person and visibly ages — the exact property the old portrait pool could not
express at all (see the top of this document).

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

## Resolved during implementation

- **Bundle size.** Settled rather than assumed: the app imports
  `@dicebear/avataaars` (308 KB) directly instead of `@dicebear/collection`,
  which is a barrel re-exporting all 30 styles (~6 MB on disk). Relying on
  Metro to shake 29 unused styles out of a release build was not a bet worth
  taking. The barrel is now a devDependency, used only by the evaluation
  scripts.
- **Attribution.** Not needed — avataaars requires none.
- **Plate colour.** Muted slate (`#465875` → `#1A2334`), not the prototype's
  blue, which was louder than the app's glass cards want.
- **Jest.** `@dicebear` is ESM-only. Two changes were required, and the second
  is the non-obvious one: adding it to `transformIgnorePatterns` does nothing
  on its own, because `transform` only had a `.ts/.tsx` rule — the ignore list
  decides WHAT is offered to a transform, not whether one exists for the
  extension. A `babel-jest` rule for `.js` was needed too.
- **`lib/` stays pure.** The art package is imported only by
  `components/avatar/VectorAvatar.tsx`; `lib/avatar/style.ts` holds catalogs
  and option-building with no dependency on it, so all of it is testable
  without the ESM runtime.

## The migration is complete

Every face in the app now comes from this system — the player, family, the
family tree, contacts, the dating app, company hires, the death and prestige
screens. `utils/facePool.ts`, `utils/characterImages.ts` and the 3.5 MB of
rendered portraits under `assets/images/Face/` are deleted.

That completeness is a UX requirement, not tidiness: a half-migrated app shows
two different illustration styles depending on which screen you are on, which
reads as broken. `__tests__/avatar/avatarCoverage.test.ts` fails the build if
any of the old modules, helpers or assets come back, or if a screen stops
routing through the avatar components.

## Still open

- **Curation is a standing job.** The shipped subsets drop `vomit`,
  `screamOpen`, `grimace`, `eating`, `tongue`, `xDizzy`, `cry` and `eyepatch`,
  and pin `clothingGraphic` (unpinned, background NPCs turned up in skull
  tees). A test asserts the exclusions. Anything added later needs the same eye.
- **Children look like small adults.** The style has no age geometry, so a
  six-year-old differs from a thirty-year-old only by the levers above. Fixing
  it properly means commissioning a child art set.
