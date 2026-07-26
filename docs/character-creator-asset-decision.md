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
