# Character creation revamp — procedural 2.5D vector avatars

## Why

Players call the current portraits AI slop, and the evidence is in the assets.
All 77 WebPs in `assets/images/Face/pool/` carry the same generator
fingerprints: a floating heart emoji and sparkle particles baked into the
background, an identical orange radial glow that fights the app's dark navy
palette, a "modern Pixar" render pastiche (see
`docs/avatar-portraits-prompts-modern-pixar.md`), and no range at all — same
3/4 framing, same closed-mouth smirk, same black t-shirt on every character.

The structural problem is worse than the art. `Customize.tsx` is not a
character creator, it is a gallery: a 60px horizontal strip where you tap one
of ~12 pre-baked PNGs. There is no ownership of the face, so the screen feels
cheap no matter how good the art gets.

## Direction

Replace the PNG pool with a face built from parameters and rendered as layered
SVG through `react-native-svg` (already a dependency at 15.12.1 — no new native
module, so no repeat of the Hard Rule #4 / lazy-import class of build risk).

Art direction is **2.5D**: flat authored geometry given real volume by gradient
shading with a consistent light from the upper left, explicit contact shadows
where layers meet, and a rim light on the opposite edge. No SVG filters —
`react-native-svg` support for them is uneven across iOS/Android/web, so
softness comes from gradient stops fading to transparent instead.

## Plan

- [x] 1. `lib/avatar/types.ts` — `AvatarConfig` (all-numeric feature indices)
- [x] 2. `lib/avatar/palette.ts` — skin / hair / eye ramps, each authored as a
      base + shadow + light triple so shading is data, not guesswork
- [x] 3. `lib/avatar/features.ts` — the geometry catalogs (face, hair, brows,
      eyes, nose, mouth, facial hair, accessories)
- [x] 4. `lib/avatar/random.ts` — seeded generation + `randomizeAvatar`
- [x] 5. `lib/avatar/aging.ts` — age → derived layer modifiers (greying,
      hairline recession, wrinkles). Player choices persist underneath.
- [x] 6. `lib/avatar/inherit.ts` — child face from two parent faces
- [x] 7. `lib/avatar/encode.ts` — compact string codec for the save
- [x] 8. `components/avatar/VectorAvatar.tsx` — the renderer
- [x] 9. Rebuild `app/(onboarding)/Customize.tsx` — large live preview,
      Randomize-first, real pickers
- [x] 10. Bridge the consumers behind `CharacterAvatar` + `resolveAvatar`, and
      switch every surface showing the PLAYER'S OWN face (`IdentityCard`,
      `PrestigeModal`, the Spark profile header). NPC surfaces still read the
      portrait pool — see "Not in this change" below
- [x] 11. Save: add `userProfile.avatar` as a CARVE-OUT field and bump
      `STATE_VERSION` 38 → 39. No `createTestGameState` entry: its default is
      `undefined`, matching every other carve-out (`ambitionId`, `rental`,
      `lastLoginRewardWeek`), none of which appear there either
- [x] 12. Tests: geometry validity, determinism, aging monotonicity,
      inheritance, codec round-trip, migration
- [x] 13. `npm run type-check`, `npm test`, `npm run preflight:quick`

## Save-format note (§7)

`userProfile.avatar` defaults to `undefined`, so it is a CARVE-OUT: version
bumped, NO backfill and no `repairGameState` mirror. Absence is load-bearing
rather than merely harmless — `resolveAvatar` derives a deterministic face from
the existing name seed, sex and legacy `avatarId`, so every save that predates
this loads with a face consistent with the character it already had. Writing a
config at migration time would freeze a face chosen by today's catalog order
into saves forever, and any later change to the catalogs would silently
re-roll every one of those characters.

## Status — complete

All 13 items done. Verification run on 2026-08-12:

- `npm test` — 534 suites, 6751 passed, 1 skipped, 0 failed
- `npm run type-check` — clean
- `npm run type-check:tests:ratchet` — holding at 0
- `npm run lint:errors` — clean
- `npm run check:routes` — 17 routes, no conflicts

`__tests__/save/storyModeRetirement.test.ts` needed two assertions updated: it
pinned `version).toBe(38)` as the head of the migration chain. Its intent — a
v38 save still loads cleanly and 38 stays a covered link — is unchanged and now
tracks `CURRENT_STATE_VERSION` instead of a literal, so the next bump does not
re-break it.

## Not in this change

The player's own face is now vector everywhere it appears (`IdentityCard`,
`PrestigeModal`, the Spark profile header). NPC faces — family tree, contacts,
dating cards, company screens — still render from the portrait pool via
`utils/characterImages.ts`. They resolve correctly through `CharacterAvatar`
whenever they are switched over; `resolveNpcAvatar` already gives every NPC a
stable seeded face. Doing that sweep in the same commit would have mixed a
17-file mechanical change into the creator rebuild, so it is left as a
follow-up. `assets/images/Face/` stays until then, and can be deleted with it
(~3.5 MB).


## Round 2 — the art was wrong, and got replaced

The hand-authored geometry shipped in the first pass looked amateur. The
pipeline was the problem, not the tuning: bezier path data typed by hand and
adjusted by squinting at contact sheets is not how character art gets made.

Replaced with illustrator-drawn modular art (avataaars via DiceBear), curated,
under the same 2.5D treatment re-expressed as a LIT PLATE behind the art rather
than hand-modelled volume inside it. `docs/avatar-art-direction-research.md`
has the evaluation of all 13 human styles and why this one won.

Kept unchanged: `types.ts`, `encode.ts`, `resolve.ts`, `inherit.ts`,
`pickers.ts`, the v39 migration and carve-out reasoning, and the rebuilt
`Customize.tsx`. Replaced: `features.ts` (deleted) → `style.ts`, and the
renderer.

Corrections made along the way, all found by rendering rather than review:

- **adventurer was the wrong first pick.** It has 45 hairstyles and no facial
  hair at all — unusable for a game where you play men from 18 to 80.
- **Grey hair on six-year-olds.** Random generation could reach the grey and
  white entries. `NATURAL_HAIR_COUNT` now stops before them; they stay
  available to the player, and ageing reaches white from any starting colour.
- **Skull-graphic tees on background NPCs.** `clothingGraphic` was unpinned, so
  the generator chose freely from a set including a skull and a "resist"
  slogan.
- **Half of every crowd looked miserable.** Expression was a flat roll across a
  catalog that includes sad, concerned and disbelief. Now weighted 82% toward
  the pleasant prefix, with the ordering pinned by a test.
- **`SvgXml` was missing from the jest mock**, so every screen carrying an
  avatar crashed with "Element type is invalid".
- **`transformIgnorePatterns` alone does nothing** for an ESM package when
  `transform` has no rule for the extension. `.js` needed `babel-jest`.

Verification (2026-08-12):

- `npm test` — 534 suites, 6762 passed, 1 skipped, 0 failed
- `npm run type-check`, `type-check:tests:ratchet`, `lint:errors`,
  `check:routes` — all clean

Bundle: the app imports `@dicebear/avataaars` (308 KB) directly rather than
`@dicebear/collection`, which is a barrel over all 30 styles (~6 MB on disk).
The barrel is now a devDependency used only by the evaluation scripts.

Known limitation, not hidden: **children look like small adults.** The style
has no age geometry. Every candidate shares this; fixing it means commissioning
a child art set.
