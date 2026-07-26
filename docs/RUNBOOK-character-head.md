# Runbook — getting a real head into the character creator

Everything that can be built without the asset is built. This is the exact
sequence for the part that needs you, written so you can follow it without me.

**Time:** roughly half a day for Route A, one to two days for Route B (most of
which is the Blender sculpting in step 5).

**You need:** an Epic Games account (free), Blender (free), and this repo.

---

> **DECIDED:** Route **A**, MetaHuman, licence cleared (under $1M revenue).
> You can skip Step 0 and Step 1 — they are recorded below for reference — and
> **skip Step 5 entirely**, since Route A does no sculpting.
>
> Your path is: **Step 2 → 3 → 4 → 6 → 7.**

## Step 0 — Decide the route. Five minutes, and it changes step 5.

| | What the player gets | Work | Bundle |
| --- | --- | --- | --- |
| **A** | Picks one of ~10 preset faces. Hair/colour/style still adjustable. No face sculpting. | Export only | ~4–6 MB |
| **B** | Full sculpting — the jaw/nose/eye sliders in the design actually move the face. | Export **+ artist authors 24 shape keys in Blender** | ~1 MB |

**Route A is a strict subset of Route B.** Starting with A wastes nothing: the
same export is the base mesh for B later.

> **If you only remember one thing:** a MetaHuman's built-in blendshapes are
> *expressions* (smile, blink, jaw open). They do **not** sculpt face shape —
> that is baked in when you export. Route B exists because of this. If you skip
> step 5, the facial-structure sliders will have nothing to drive.

**My recommendation: ship A first, add B when an artist is available.**

---

## Step 1 — Confirm the licence position. Do this before anything else.

1. Check whether DeepLife Simulator's gross revenue is **under $1,000,000 USD**.
   Under that, MetaHuman is free under the standard Unreal Engine licence.
2. Read <https://www.metahuman.com/license> — or have whoever owns legal risk
   read it. **I am not able to give you a legal opinion, and you should not
   treat my summary as one.**
3. If either of those is a problem, stop and use **MakeHuman** instead
   (<https://www.makehumancommunity.org>). Its meshes are CC0 — no licence
   question at all — at lower fidelity. Every later step is identical.

---

## Step 2 — Create the head in MetaHuman Creator

1. Go to <https://metahuman.com> and sign in with your Epic account.
2. **Create MetaHuman** → pick a preset close to your target look.
3. Sculpt the face you want as the **base**. **Route A: do this ~10 times**, to
   get a spread of face shapes and skin tones. Name them `head_01`…`head_10`.
   Aim for genuine variety — different face widths, jaw shapes, ages and skin
   tones — because in Route A this set IS the customisation. Ten similar faces
   give the player nothing to choose between.
4. **Keep the hair simple or none.** MetaHuman hair is groom-based (millions of
   strands) and will not survive export to a phone. The app renders hair
   separately.
5. Set **Level of Detail to LOD3 or lower** before export if the option is
   offered. LOD0 is film-grade and far too heavy.

---

## Step 3 — Export to GLB

MetaHuman does not export GLB directly, so it goes via Blender.

1. In MetaHuman Creator, **Download** → choose the **Blender** or **Maya/FBX**
   option (post-2025 licensing offers these; older accounts may only offer
   Quixel Bridge → Unreal).
2. Open the download in **Blender**.
3. Delete everything except the **head mesh**. No body, no clothes, no
   eyelashes, no groom hair. Keep the eyes only if you want them as one mesh —
   otherwise delete them; the app draws eyes itself.
4. `File → Export → glTF 2.0 (.glb)` with:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects** (with the head selected)
   - Data → Mesh: **✅ Apply Modifiers**, **✅ Shape Keys** ← *this one is
     essential; without it you export a rigid head with no morphs at all*
   - Data → Material: **Export**, images **Automatic**
5. Save it as `assets/models/head_raw.glb` in this repo.

---

## Step 4 — Find out what the rig actually calls its morphs

```bash
npm run head:list
```

This prints every blendshape name in the file. **Do not skip this and do not
guess the names.** Every rig names them differently, and a guessed name binds
to nothing — producing a slider the player drags while nothing moves, with no
error anywhere. That is the single most likely way this goes wrong.

Send me that list, or keep it for step 6.

---

## Step 5 — (Route B only) Author the sculpting shape keys

This is the artist task, and it is what makes the design's sliders real.

In Blender, on the exported head, add **24 shape keys** named exactly:

```
faceWidth        faceLength       jawWidth         jawAngle
chinLength       chinProtrusion   cheekboneHeight  cheekFullness
browHeight       browProtrusion   eyeSize          eyeSpacing
eyeDepth         eyeTilt          noseLength       noseWidth
noseBridge       noseTip          mouthWidth       lipFullness
mouthHeight      earSize          foreheadSlope    neckThickness
```

For each: select the relevant vertices and sculpt the shape at **maximum**
intensity (the app blends 0→1 between neutral and this). Sculpt the *positive*
direction only — wider jaw, longer nose, bigger eyes.

**Optional:** if you also want the sliders to work *below* the midpoint, add an
opposing key named with a `Narrow`/`Short`/`Small` suffix, e.g. `jawWidthNarrow`.
The binder pairs those automatically. Without them the sliders still work, but
only from the midpoint upward — and the app is told so, so it can constrain the
control rather than leave half of it inert.

Re-export over `assets/models/head_raw.glb` when done.

---

## Step 6 — Build the optimised head

If step 4 showed names different from the list above, open
`assets/models/morph-keep.json` and replace its contents with the names you
actually want to keep. Then:

```bash
npm run head:build
```

You should see something like:

```
IN   6.60 MB  12000 verts  45 morph targets
OUT  0.52 MB  12000 verts  24 morph targets   (92.1% smaller, 24/24 sparse)
```

**Targets:** under **3 MB** and under **8,000 verts**. The script fails the
build if either is exceeded.

**If it aborts with "every morph target was removed"** — that is the safety net
working, not a bug. Your keep-list matched nothing. Go back to step 4, use the
real names. (This guard exists because deleting every morph makes the file
*smaller*, so without it the failure would look like a great result.)

**If it warns you are over budget** — decimate in Blender first:
`Modifier → Decimate → Collapse`, ratio ~0.4, then re-export. Do this *before*
sculpting shape keys, or you will have to redo them.

---

## Step 7 — Send me these three things

1. The output of `npm run head:list`
2. The final line of `npm run head:build` (the size report)
3. Which route you took, A or B

That is everything I need to wire the renderer — binding the genome to the
rig, loading the GLB, driving `morphTargetInfluences`, and turning the creator
flag on. Ordinary work, a couple of hours, all of it doable from here.

---

## What is already done, so you know what you are plugging into

| Piece | Where | Status |
| --- | --- | --- |
| Save format (`identity`, STATE_VERSION 26) | `contexts/game/` | Done, migrated, tested |
| Body / regimen / grooming simulation | `lib/identity/` | Done, tested |
| Presence → dating + hiring consequences | `lib/dating/`, `applyCareerApplications` | Done, tested |
| Creator UI to the approved design | `components/identity/FaceStudio.tsx` | Done |
| GLB optimiser | `scripts/optimize-head-glb.mjs` | Done, measured |
| Rig-name binding + dead-slider detection | `lib/identity/morphBinding.ts` | Done, tested |
| **The head asset** | `assets/models/head_raw.glb` | **← you are here** |
| GLB loader + morph driving | — | Waiting on the asset |

The creator is behind `FEATURE_FLAGS.faceCreator3D` (off). Nothing above ships
to players until you turn it on, so none of this is blocking a release.

---

## Common failure modes, and what they mean

| Symptom | Cause | Fix |
| --- | --- | --- |
| `head:list` prints nothing | Shape Keys were unticked on export | Re-export from Blender with **Data → Mesh → Shape Keys** on |
| `head:build` aborts, "every morph target removed" | keep-list does not match the rig | Use the names from `head:list` |
| Output still over 3 MB | Too many verts | Decimate in Blender to ~5–8k, then re-export |
| Names are `jawOpen`, `mouthSmile`, `eyeBlink` | You exported the ARKit **expression** set | Expected. Those animate, they do not sculpt — you need step 5 |
| File is tiny and the face will not move | Every morph was stripped | The abort guard should have caught this; check you ran `head:build`, not the raw script |
