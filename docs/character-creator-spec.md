# Premium Character Creator — spec, status and gap analysis

Source: the owner's design sheet ("DEEP LIFE SIMULATOR — PREMIUM CHARACTER
CREATOR"). Mood reference: MetaHuman Creator, Apple HIG, The Sims 4 (CAS).

This file is the source of truth for the creator's look. `FaceStudio.tsx` reads
its palette from here (§2) rather than the shared app theme, on purpose — the
screen is a deliberate visual island.

---

## The one thing that gates everything

**§4 of the spec requires real character assets:**

> High-res modular meshes (head, hair, body) · Blend shapes (morph targets) ·
> Separate hair meshes with physics · 2K–4K textures · PBR skin shading with
> SSS approximation

That is the asset-based route, and it is the ONLY route to the reference image.
No amount of code substitutes for it. This was offered at the start of the work
and declined on bundle size; the intervening attempt at code-only procedural
geometry did not reach the bar and is now flag-gated off
(`FEATURE_FLAGS.faceCreator3D`).

**Nothing else in this spec can be finished until a head mesh with blendshapes
exists.** Sequence the asset decision first.

### What acquiring the asset actually means

**Researched and decided — see `character-creator-asset-decision.md`.**

| Route | Bundle | Status |
| --- | --- | --- |
| **MetaHuman, mobile LOD** | ~1.5–3 MB | **Recommended.** Relicensed 2025: any engine, free under $1M revenue. The spec's own mood reference. |
| MakeHuman (CC0) | ~1.5–3 MB | Fallback. Zero licence risk, lower fidelity, blendshapes need authoring. |
| Ready Player Me | — | **Dead.** Netflix acquisition; public services shut down 31 Jan 2026. |
| Commissioned modular head | +3–8 MB | Not recommended — slowest and dearest, buys nothing MetaHuman now doesn't. |
| Layered 2D pre-rendered portraits | +4–8 MB | Only if 3D is abandoned. No rotation, no live morphs — those spec features must be CUT, not faked. |

Measured: a synthetic 12k-vert head with 45 morphs goes 6.60 MB -> 0.52 MB
through `scripts/optimize-head-glb.mjs`, with no decimation at all. See the
decision doc. The real bundle cost is the MORPH TARGETS, not the mesh: 45 morphs on a 10k-vert
head is ~5.4 MB of deltas alone. Sparse accessors, quantization, a ~5k-vert head
and a trimmed ~22-morph set bring it to the figures above. See the decision doc.

The spec's "Drag to rotate", idle blinking and live morph sliders all require
the 3D route. If the 2D route is chosen, those three features must be cut from
the spec rather than faked.

---

## Status against each section

| § | Spec | Status |
| --- | --- | --- |
| 1 | Design language | Partial — dark theme and flat-free cards done; glassmorphism and cinematic lighting pending the 3D asset |
| 2 | Colour palette | **Done** — exact values in `FaceStudio.tsx` |
| 3 | Typography (SF Pro Display Bold) | Partial — weights/sizes match; the app does not bundle SF Pro Display, it inherits the system face |
| 4 | Tech stack | Partial — Expo + Three.js + expo-gl in place. **No** Skia, Reanimated, R3F, MMKV. No character assets (the gate above) |
| 5 | Skills | n/a |
| 6 | Camera & lighting (FOV 28°, chest-up, DOF, idle animation) | FOV 28° matches. Chest-up framing, DOF and idle blink/breathe all need the asset |
| 7 | UI components | **Done** — section cards, gold Randomize, blue primary, progress indicator |
| 8 | Slider design | **Done** — thin glowing track, floating value readout, haptic on release. Spring animation pending Reanimated |
| 9 | Animations & interactions | Not started — needs `react-native-reanimated` for the 150–250 ms spring set |
| 10 | Creator flow (Gender/Body → Face → Hair → Body → Style) | Face step only. The other four steps do not exist |
| 11 | 40–60 face parameters | **24 implemented.** See gap below |
| 12–16 | Recreate steps, sound, perf, structure, notes | Not started |

---

## §11 parameter gap — 24 of ~45

`FACE_MORPH_KEYS` in `lib/identity/types.ts` currently covers 24 morphs. The
spec lists roughly 45. Missing:

- **Face shape**: face height, cheeks (separate from cheekbones), jaw height,
  chin width, chin forward, temple width
- **Eyes**: upper eyelid, lower eyelid, eye angle (distinct from tilt),
  eyebrow angle, eyebrow thickness
- **Nose**: bridge width, bridge height, tip size, tip rotation, nostril width,
  nose height, nose depth
- **Mouth**: upper lip, lower lip, mouth depth, smile, lip thickness
- **Ears**: ear rotation, ear height, ear width, ear angle

**Adding these is a save-format change.** Every new morph is a key in the stored
genome, so it needs a `STATE_VERSION` bump, a migration that backfills the new
keys at 0.5, a `repairGameState` guard, and `createTestGameState` coverage — the
same four-part contract every field in this codebase follows (see `CLAUDE.md`).
`clampMorphs` already backfills any missing key to neutral, so the migration is
mechanical, but the version bump is NOT optional.

Do this only once the head asset is chosen: the morph list should match the
blendshapes the mesh actually ships, or half of them will be dead sliders.

---

## Recommended order

1. **Decide the asset route** (table above). Everything else waits on this.
2. Acquire/licence the head + hair meshes; confirm the blendshape names.
3. Align `FACE_MORPH_KEYS` to those blendshapes; bump `STATE_VERSION` with the
   full four-part contract.
4. Swap `FaceStudio`'s portrait seam from the pool image to the live renderer.
5. Add `react-native-reanimated` and implement §9's spring set.
6. Build the remaining flow steps (§10).

Steps 1–2 are procurement, not engineering, and they are the long pole.
