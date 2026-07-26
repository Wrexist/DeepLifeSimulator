# Runbook — getting a real head into the character creator

Everything that can be built without the asset is built. This is the exact
sequence for the part that needs you, written so you can follow it without me.

**Time:** roughly half a day for Route A, one to two days for Route B (most of
which is the Blender sculpting in step 5).

**You need:** an Epic Games account (free), Blender (free), and this repo.

---

> **DECIDED:** Route **A**, and the head source is **MakeHuman**, not MetaHuman.
>
> MetaHuman was the original choice and the licence was cleared (under $1M
> revenue), but metahuman.com has no mesh export — reaching geometry requires
> Unreal (~100 GB), Maya (~$300/yr) or Houdini (~$270/yr). See Step 3a. Since
> Route A needs no blendshapes, MakeHuman gets the same job done for free, in an
> afternoon, with CC0 output and no licence question at all.
>
> Skip Step 0 and Step 1 — recorded below for reference — and **skip Step 5**,
> since Route A does no sculpting.
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

## Step 2 — Create the heads in MakeHuman

Install from <https://www.makehumancommunity.org> (~200 MB, Windows/Mac/Linux).
No account, no engine. Output is CC0 — you own what you make, commercially.

For each of the ten heads:

1. **Modelling → Main.** This tab alone gets you most of the variety, fast:
   - **Gender** — do not only use the extremes; 0.3 and 0.7 read as distinct
     faces rather than as "male" and "female".
   - **Age** — spread these. 25 / 35 / 45 / 60 produce genuinely different
     bone structure, not just wrinkles.
   - **African / Asian / Caucasian** — three sliders that blend. Mixed
     settings look far better than any single one at 100%.
   - **Muscle / Weight** — changes jaw and cheek fullness.
2. **Modelling → Face.** Optional, and only if you want to push a head further.
   There are ~100 sliders here grouped by feature (head shape, jaw, nose, mouth,
   eyes, chin, cheeks). This is where a head stops looking like a preset.
3. **Materials → Skin.** **Do not skip this.** The default material is untextured
   and renders as grey clay. Pick a skin per head. If the built-in set is thin,
   the community asset downloader (Settings → Community, or the website's asset
   library) has many more, also CC0.
4. **Geometries → Eyes → Low-poly.** *Keep the eyes* — unlike the procedural
   head, they arrive already seated correctly in the socket, which removes an
   entire class of alignment bugs.
5. **Geometries → Hair → None.** The app renders hair separately as its own
   customisation, so baked-in hair would fight it.
6. **Geometries → Clothes / Eyebrows / Eyelashes / Teeth / Tongue → None.**
   Everything below the neck is discarded in Step 3 anyway; leaving it out here
   is less to delete later.
7. **Pose/Animate → Skeleton → None.** A static head needs no rig, and a
   skeleton only adds size and export complications.

Save each as `head_01` … `head_10`.

> **Make them genuinely varied.** In Route A this set IS the customisation — the
> player picks one and the shape is fixed. Ten similar faces give them nothing to
> choose between. Vary age, ethnicity mix, face width, jaw shape and skin tone
> deliberately, and check them side by side before exporting.

---

## Step 3 — Export to GLB

> **Route A needs no blendshapes.** The face shape is baked in at export and the
> creator UI hides any slider the rig cannot drive, so a plain static head mesh
> is enough. The `Shape Keys` tick below still matters for Route B later, and
> costs nothing now.

### 3a — Head source (for the record)

MakeHuman is decided. This table is why, and what to fall back to if its fidelity
turns out not to be enough:

| | Cost | Size | Notes |
| --- | --- | --- | --- |
| **MakeHuman** ← chosen | Free, CC0 | ~200 MB | Exports directly. No engine, no account, no licence question. Lower fidelity than MetaHuman, but on a phone at portrait size the gap is much smaller than Epic's marketing renders suggest. |
| Unreal Engine | Free | ~50–100 GB | The only free route to a MetaHuman mesh. Creator now lives inside UE; assemble, then `Asset → Export → FBX` on the head skeletal mesh. |
| Maya + MetaHuman for Maya | Indie ~$300/yr (under $100k rev), full ~$2k/yr | ~5 GB | The route Epic supports best. FBX directly. |
| Houdini + MetaHuman for Houdini | Indie ~$270/yr | ~3 GB | Apprentice (free) is non-commercial and restricts export — cannot ship. |

Everything from 3b on is identical whichever you use.

### 3b — Export from MakeHuman

`Files → Export`, then:

- Format: **glTF** if your build lists it — that skips Blender entirely, go
  straight to Step 4. Otherwise **Filmbox (fbx)**.
- **Feet on ground:** on. **Scale:** metres.

If you got glTF, save it straight to `assets/models/head_raw.glb` and skip to
Step 4. Otherwise continue.

### 3c — Convert to GLB in Blender

1. Open the FBX in **Blender** (`File → Import → FBX`).
2. **Cut the body off at the neck.** MakeHuman exports a whole figure; you want
   the head only. In Edit Mode (`Tab`), hover the neck and press `L` with the
   cursor over the head to select the connected island, or box-select everything
   below the collarbone and `X → Vertices`. Keep the **eyes**.
   Roughly: everything above the collarbone stays, everything below goes.
3. `File → Export → glTF 2.0 (.glb)` with:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects** (with the head selected)
   - Data → Mesh: **✅ Apply Modifiers**, **✅ Shape Keys** ← *leave this on even
     on Route A; it costs nothing and it is what Route B needs later*
   - Data → Material: **Export**, images **Automatic**
4. Save it as `assets/models/head_raw.glb` in this repo.

---

## Step 4 — Find out what the rig actually calls its morphs

```bash
npm run head:list
```

This prints every blendshape name in the file. **Do not skip this and do not
guess the names.** Every rig names them differently, and a guessed name binds
to nothing — producing a slider the player drags while nothing moves, with no
error anywhere. That is the single most likely way this goes wrong.

**On Route A an empty list is a valid result**, not a failure — a preset head has
its shape baked in, and the creator UI hides every slider the rig cannot drive.
`head:build` handles a morph-free head without aborting. Route B is where an
empty list means something went wrong.

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
| `head:list` prints nothing | Route A: expected — a preset head has no morphs. Route B: Shape Keys were unticked on export | Route A: carry on. Route B: re-export with **Data → Mesh → Shape Keys** on |
| metahuman.com has no "export mesh" button | Correct — it only lists DCC plugins and mocap tools | See Step 3a. This is why the route is MakeHuman |
| Head renders as grey clay | No skin material was assigned in MakeHuman | **Materials → Skin**, pick one per head, re-export |
| Head is enormous or microscopic in the app | Export scale was not metres | Re-export with **Scale: metres**, or `S` in Blender before exporting |
| `head:build` aborts, "every morph target removed" | keep-list does not match the rig | Use the names from `head:list` |
| Output still over 3 MB | Too many verts | Decimate in Blender to ~5–8k, then re-export |
| Names are `jawOpen`, `mouthSmile`, `eyeBlink` | You exported the ARKit **expression** set | Expected. Those animate, they do not sculpt — you need step 5 |
| File is tiny and the face will not move | Every morph was stripped | The abort guard should have caught this; check you ran `head:build`, not the raw script |
