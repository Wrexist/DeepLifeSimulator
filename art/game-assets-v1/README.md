# DeepLife modular 3D assets

18 actual mesh assets with transparent PNG renders and editable Three.js source.
No photographic plates, generated image textures, paid stock assets or character
portraits are included. This is the revised direction requested on 2026-09-08.

## Contents

| Group | Assets |
| --- | --- |
| Home environments | Neighborhood, starter room, settled home |
| Furniture and props | Sofa, single bed, desk, chair, plant, laptop, lamp, coffee table, house keys, work bag |
| Business environments | Factory, AI studio, restaurant, property agency, bank |

`models/` contains portable GLB 2.0 files. `renders/` contains 1200 × 900 PNGs
with real alpha transparency. `source/models.mjs` defines all mesh geometry,
materials and composition. `manifest.json` records model sizes, hashes, bounds,
triangle counts and transparent pixel coverage. `studio-preview.png` shows the
interactive viewer, not a gameplay screenshot.

The three Home renders are additionally encoded as transparent WebP files in
`../../assets/images/home/` and used by `components/home/HomeScene.tsx`.
Other props and business scenes are ready for subsequent screen integration.
Three.js is isolated to the asset toolchain. The mobile app still renders local
images with React Native and does not gain a WebGL/native module dependency.

## Rebuild and inspect

From this repository root:

```sh
npm ci --prefix art/game-assets-v1/source
cd art/game-assets-v1/source
npx playwright install chromium
npm run build
npm run preview
```

Open the local URL printed by preview. Select an asset, drag to rotate, toggle
light/dark background, or download its GLB. The browser viewer uses original
geometry for editing. The build exports each GLB, imports that exact binary with
GLTFLoader, and renders the imported model before writing its transparent PNG.
The build uses software WebGL in Chromium and never downloads remote textures.

Edit shapes and the palette in `source/models.mjs`, then rebuild. Furniture is
composed through shared factories, so a sofa adjustment updates the standalone
sofa and the room that contains it. Everything uses metres, Y-up and front +Z.
Nodes have names and standard PBR materials. Props have ground-level origins
except the hanging keyring. Scenes include floors and two cutaway walls.

## Validation and limits

All models pass the GLB v2 header/length check, GLTFLoader round-trip, geometry
count and rendered coverage checks. All renders contain both transparent and
opaque pixels. Models use zero image textures. The largest environment is under
20,000 triangles; standalone props are under 3,000 triangles. Geometry is static,
not rigged or collision-ready. Software rendering does not establish performance
on a native iPhone, nor validate a Unity/Unreal import.

Home uses broad housing categories. The rental/property name and tenure are
actual game state; models do not claim an exact floor plan or purchased furniture
inventory. Investment property does not change the Home scene. Moving out or
losing a tenancy restores the neighborhood model. Keep character identity in the
existing avatar system until a complete compatible 3D character pipeline exists.

## Ownership and dependencies

The geometry and compositions were authored for this project in this change.
No third-party asset license is attached. Three.js, Playwright and Sharp remain
separate tooling dependencies with their own licenses in the locked packages.
