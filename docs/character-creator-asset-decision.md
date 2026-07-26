# Step 1 — the character asset decision

Research for `character-creator-spec.md` §4. Verified July 2026; licence terms
move, so re-check anything commercial before signing.

---

## Finding 1: Ready Player Me is gone

**Ready Player Me was acquired by Netflix and shut its public services down on
31 January 2026.** It was the obvious default for this job — free GLB avatars
with ARKit blendshapes, built for exactly this use — and it is no longer an
option. Anyone picking this up from memory will reach for it first; don't.

## Finding 2: MetaHuman is now usable outside Unreal

This is the significant change. Historically MetaHumans were locked to Unreal
Engine, which ruled them out for a React Native app. Epic relicensed at Unreal
Fest 2025:

- Usable in **any engine or DCC**, including Blender, Maya, Unity, Godot
- Covered by the standard Unreal Engine licence: **free under $1M USD revenue**
- MetaHuman-derived content may be sold on FAB and third-party marketplaces

The spec's own mood reference is therefore now legally available to us.

## Finding 3: MakeHuman is CC0

MakeHuman's bundled base meshes and textures are released **CC0** — commercial
use, no attribution, no permission. Exported models are CC0 too. Zero licence
risk and zero cost, at lower fidelity than MetaHuman, and its shape targets are
its own rather than the ARKit set, so blendshapes need authoring.

---

## The constraint nobody has costed yet: morph targets are the bundle

The mesh is not the problem. **The blendshapes are.**

A glTF morph target stores a position delta per vertex. Naively:

```
45 morphs x 10,000 verts x 3 floats x 4 bytes  =  5.4 MB
```

— and that is *before* the base mesh, textures, or normals deltas. The spec asks
for 40-60 parameters, so on a full-resolution head the morph data alone would
blow the entire asset budget several times over.

Three levers, in order of effect:

1. **Fewer morphs.** 20-25 well-chosen blendshapes cover most of the perceived
   range. The spec's list has real redundancy — "eye angle" and "eye tilt",
   "cheekbones" and "cheeks" — that costs full price in bundle terms.
2. **Fewer vertices.** A 4-6k head at mobile viewing size is indistinguishable
   from 15k. This roughly halves or quarters the number above.
3. **Sparse accessors + quantization.** glTF sparse morph targets store only
   the vertices a morph actually moves — a jaw morph touches maybe 15% of the
   head. Combined with `KHR_mesh_quantization` this is typically a 5-10x saving.

Realistic target: **a 5k-vertex head with ~22 sparse, quantized morphs, plus 1K
textures, in roughly 1.5-3 MB.** That is affordable. The naive export is not.

### Verified, not estimated

`scripts/optimize-head-glb.mjs` implements this and was measured on a synthetic
12k-vertex head carrying 45 named morph targets — deliberately built to look
like a real desktop rig:

```
IN   6.60 MB  12000 verts  45 morph targets
OUT  0.52 MB  12000 verts  24 morph targets   (92.1% smaller, 24/24 sparse)
```

That is **without any geometry decimation** — the vertex count is unchanged.
Trimming to the 24 morphs the app drives, then sparse-encoding and quantizing,
did all of it. Decimating to ~5k in Blender first would take it lower again.

The budget question is therefore settled: this is affordable.

---

## DECIDED (owner, this session)

- **Route: A** — preset heads. Player picks one of ~10; no face sculpting.
- **Licence: cleared.** Owner confirms DeepLife Simulator is under $1M USD
  revenue, so MetaHuman is free under the standard Unreal Engine licence.
- **Source: MetaHuman.**

Route A is a strict subset of Route B, so moving to sculpting later reuses the
same exports as base meshes. Nothing here is a one-way door.

### What Route A changes in the app

The facial-structure sliders have nothing to drive — a preset's shape is baked
in at export. `FaceStudio` therefore takes the `RigBinding` and HIDES every
group whose morphs are unbound, rather than shipping dead controls. The face
genome is still stored and still feeds `computePresence`, so the character's
looks continue to affect dating and hiring exactly as they do now.

---

## Original recommendation (kept for context)

**Take the MetaHuman route, on a mobile LOD, with a trimmed morph set.**

- It is the spec's own reference, so it hits the visual target by construction.
- The licence is now free and permissive at this revenue scale.
- The remaining work is a well-defined asset pipeline, not a procurement
  negotiation: export → decimate to ~5k → trim to ~22 blendshapes → sparse +
  quantize → GLB.

**Fallback: MakeHuman.** Take it if any licence ambiguity is unacceptable, or if
the MetaHuman export pipeline proves too heavy. CC0 removes every legal
question at the cost of fidelity and some blendshape authoring.

**Do not commission a bespoke head.** It is the slowest and most expensive
route and buys nothing the two above do not, now that MetaHuman is open.

---

## What is needed to proceed to step 2

These are decisions and actions I cannot take:

1. **Confirm the revenue position.** MetaHuman is free under $1M USD. If
   DeepLife is above that, standard Unreal terms apply and someone should read
   them properly.
2. **Read the MetaHuman EULA** (metahuman.com/license) with whoever owns legal
   risk. My summary is from reporting, not from counsel.
3. **Produce the GLB.** MetaHuman Creator export and the decimation pass need a
   desktop DCC (Blender is sufficient and free). That cannot happen in this
   environment.
4. **Decide the morph list** — but only after the export, so the names match
   the blendshapes the mesh actually ships. Aligning `FACE_MORPH_KEYS` to a
   guessed list produces dead sliders.

Once a GLB exists, step 3 onward in `character-creator-spec.md` is ordinary
engineering and can be done here.

---

## Finding 4 (verified after the decision): MetaHuman's blendshapes are EXPRESSIONS, not sculpting

This is the one that changes the plan's shape, and it is worth understanding
before anyone spends a day on an export.

A MetaHuman ships **130+ morph targets driven by its Control Rig via Pose
Assets, designed primarily for facial expression** — ARKit's 52 (jawOpen,
mouthSmile, eyeBlink…) plus rig extras. Those animate a face. They do **not**
sculpt one.

The character's *shape* — the thing MetaHuman Creator lets you dial — lives in
the **DNA file and rig logic**, and is **baked into the mesh at export**. So:

> A MetaHuman export gives you **one specific face's geometry**, plus the
> blendshapes to make it emote. It does **not** give you a face the player can
> re-sculpt with a "jaw width" slider.

That is a direct mismatch with spec §11 (40-60 adjustable face parameters).

### Practical consequence for the pipeline

`scripts/optimize-head-glb.mjs`'s default keep-list uses OUR morph names
(`jawWidth`, `noseBridge`…). A MetaHuman export contains none of them, so the
script's **abort guard will fire immediately** — correctly. That is the tool
telling the truth, not a bug. Run `--list` first to see the real names.

### Three ways forward

| | Approach | Bundle | Player experience |
| --- | --- | --- | --- |
| **A** | **Preset heads.** Export 8-12 MetaHumans across face shapes and skin tones. Player picks one, then adjusts hair/colour/style only. | ~0.5 MB each after the pipeline → **4-6 MB for 10** | Choose a face. No free sculpting. Closest to BitLife, and the fastest to ship. |
| **B** | **One base + authored sculpt shapes.** Export one male and one female head, then have an artist author the ~24 sculpting shape keys (jaw width, nose bridge…) in Blender on top. | ~1 MB for both | True sculpting. Delivers spec §11 as written. Costs one-time artist work. |
| **C** | Runtime DNA/rig evaluation | n/a | **Not viable.** The MetaHuman rig needs Unreal; there is no three.js equivalent. |

**Recommendation: B**, with A as the interim.

B is the only route that makes the spec's sliders real, and the authoring is
bounded — 24 shape keys on one head, done once, by someone comfortable in
Blender. A ships sooner and is genuinely fine if "pick a face you like" is
acceptable; it is also a strict subset of B, so starting with A wastes nothing.

Either way the head budget holds: the measured pipeline puts a 12k-vert head
with 24 morphs at 0.52 MB.

---

# Research round 2 — 2026-07-26

Triggered by two things: MakeHuman's Windows build turned out to ship no
readable source data (67 `.npz` caches, zero `.target` files), and the owner
asked for the best possible creator rather than the fastest one. Both warranted
re-checking the field instead of proceeding.

## Finding 5 — the MakeHuman licence does not clearly permit what we planned

This is the important one, and it is **unresolved by MakeHuman's own
maintainers**, not merely unclear to us.

- The program **and its data** — "3D models and 3D morphings" — are **AGPL3**.
- CC0 is a *special and limited exception* for characters "bundled in an export
  made using the file export functionality inside an OFFICIAL and UNMODIFIED
  version of MakeHuman".
- That exception explicitly does **not** apply when linking MakeHuman as a
  library, running it in server mode, or making code interventions.
- `makehuman-assets` states CC0 as of September 2020, but also that the
  transition is "a work in progress".
- Issue #199 ("License Clarification") asks precisely our question — reading the
  targets programmatically and bundling them into another application — and
  **no maintainer answer resolves it.**

The distinction that matters:

| What we do | Position |
| --- | --- |
| Design a head in the GUI, export it, ship the mesh | Covered by the CC0 exception. This was the original plan and it is fine. |
| Read the `.target` database and bake it into the app as morph targets | **The unresolved case.** Not an "export"; it redistributes the asset database itself. |

AGPL on a closed-source mobile game is not a minor risk — it is a
source-disclosure obligation. **This is a legal question and nothing here is a
legal opinion.** Whoever owns legal risk decides.

## Finding 6 — ICT-FaceKit is a better base AND unambiguously licensed

USC Institute for Creative Technologies' morphable face model. Checked the
LICENSE file directly rather than trusting a summary: it is **MIT**, copyright
USC ICT 2020, granting rights "to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell" without restriction. No export-path condition, no
copyleft, no revenue threshold.

What ships in `FaceXModel/`:

| Piece | Form |
| --- | --- |
| Base topology | `generic_neutral_mesh.obj` |
| Identity shape modes | `identity000.obj` … `identity069.obj` |
| Expression blendshapes | ~30+, ARKit-named (`eyeBlink_L`, `browDown_R`, `cheekPuff_L`) |
| Landmarks, rigid/morphable vertex sets | included |

Three reasons it beats MakeHuman for a *premium* result:

1. **It is scan-derived.** The shape modes are principal components of Light
   Stage scans of real people, so the space it spans is the space real faces
   occupy. MakeHuman's targets are artist-authored approximations. This is the
   single biggest lever on whether output reads as "a person" or "a game
   character".
2. **Plain OBJ.** Every mode is a full mesh at identical topology, so a morph
   target is `identityNNN − neutral` — subtraction, no format
   reverse-engineering. Contrast the `.npz` cache route, where a wrong guess is
   indistinguishable from a right one until the face deforms strangely.
3. **Fixed topology is guaranteed**, which is the hard requirement for morph
   targets and the reason AI-generated meshes cannot drive sliders at all.

Caveat, stated plainly: the README claims 100 identity modes for the Light
version while `FaceXModel/` contains 70 OBJs. Verify the real count before
budgeting bundle size.

## Finding 7 — PCA modes are not semantic sliders

`identity017` is a statistical direction, not "jaw width". This is a genuine gap
against spec §11 and must not be glossed over.

It is solvable, and the solution is better than plain sliders:

- **Identity space** — randomize, blend two faces, push toward older/younger.
  Every sample lands on the scan manifold, so every result is a *plausible real
  human*. Sliders cannot guarantee that; they let a player build an impossible
  skull.
- **Derived semantic morphs** — ICT ships landmark definitions, so a semantic
  axis can be solved for offline: find the coefficient vector maximising
  jaw-landmark separation while minimising movement elsewhere, then bake the
  result as a single named morph target. Buildable and verifiable here, without
  the owner installing anything.

Best-in-class creators expose both. That is the recommendation.

## Rendering — the "premium and polished" half

Already in place: PMREM studio environment, ACES filmic tone mapping, exposure
tuned to 1.45 (1.1 crushed deep skin tones to black), inertial drag, contact
shadow.

What actually moves perceived quality next, in order:

1. **Eyes.** Cornea layer with a specular highlight is the largest perceptual
   win per byte in any face render. Currently the weakest part.
2. **Subsurface scattering.** `MeshPhysicalMaterial` costs more per pixel than
   other materials but has effects off by default, so cost is opt-in;
   `MeshTranslucentMaterial` is a drop-in alternative. Mobile guidance is 8–16
   samples against 64–128 offline. **Must be measured on device, not assumed.**
3. **Texture set** — albedo, normal, roughness, cavity. Cheap, topology-safe,
   and where AI generation genuinely helps (see Finding 8).
4. Bloom, vignette, FXAA — small, and only after the above.

## Finding 8 — where AI does and does not fit

- **Geometry: no.** Image-to-3D emits a fresh mesh with its own vertex layout
  every time. Morph targets require identical topology across all shapes, so
  generated heads yield presets, never sliders. Generated textures also bake in
  lighting, which fights the studio environment.
- **Skin textures: yes.** Albedo maps are images painted on the one fixed base
  mesh, so topology does not apply. Large visible variety, near-zero risk.
- **Photo → slider values: yes, later.** Fitting the identity coefficients from
  a photo works *because* it outputs parameters rather than a mesh. A follow-on
  to the editor, not a replacement.

## Recommendation

**Switch the base to ICT-FaceKit.** MIT removes the licence question entirely,
the scan-derived basis is what makes output read as premium, and OBJ input
removes the `.npz` reverse-engineering risk. Expose identity space *and* derived
semantic sliders.

Keep MakeHuman only as a GUI-export preset source if a fallback is wanted —
that use is squarely inside its CC0 exception.
