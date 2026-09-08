# Deep Life Simulator — Immersive App Store edition

Rebuilt 8 September 2026 following feedback on the flat blue edition, then refocused on player aspiration and progression rather than menu-by-menu feature coverage.

The campaign now sells the fantasy of the game first: start with little, build a career, create wealth, form relationships, take risks, own property, unlock lifestyle rewards, build a family and carry progress into future lives. Cinematic 3D-style artwork frames real gameplay captures, with no generated interface text or invented game statistics.

## Package contents

| Folder | Dimensions | Main images | Alternatives |
| --- | --- | --- | --- |
| `iphone-6.9`, `alternatives/iphone-6.9` | 1320 × 2868 | 10 | 6 |
| `iphone-6.5`, `alternatives/iphone-6.5` | 1284 × 2778 | 10 | 6 |
| `ipad-13`, `alternatives/ipad-13` | 2064 × 2752 | 10 | 5 |

47 RGB PNG exports. Choose up to ten screenshots for each device set. Alternatives replace a main image rather than extending an App Store set beyond ten. The iPad prestige alternative is omitted because its source capture does not expose that section.

## Recommended sequence

The first five frames are intentionally outcome-led rather than feature-led. They should communicate what the player can become before the set starts explaining individual systems.

| Image | Player promise | Gameplay proof |
| --- | --- | --- |
| 01 | Start with little and build the life you want | Early-life Home state |
| 02 | Turn ambition into an empire | Company ownership and revenue |
| 03 | Build a life worth sharing | Dating and relationship systems |
| 04 | Every choice changes your future | Event choices and visible effects |
| 05 | Become more than you started as | Education and career progression |
| 06 | Make your money work for you | Stock investing |
| 07 | Take risks and live with the outcome | Dark web, heat and risk |
| 08 | Turn income into ownership | Real-estate portfolio |
| 09 | Earn the lifestyle you imagined | Vehicle ownership |
| 10 | Build more than a bank balance | Family and relationships |
| 11 | Keep health and happiness in balance | Vitals and activities |
| 12 | Build a life that takes you places | Travel |
| 13 | Build an audience and become somebody | Creator/streaming life |
| 14 | Chase opportunity while respecting risk | Crypto |
| 15 | Turn success into something rare | Luxury collections |
| 16 | Carry your legacy into the next life | Prestige and permanent bonuses |

The series is designed to answer three questions in order: **What can I become? What can I do? Why will I keep playing?** It does not attempt to document every submenu.

## Source and release check

Gameplay comes from `screenshots/appstore-2026/rich-captures` and `rich-captures-ipad` in Wrexist/DeepLifeSimulator, repository snapshot `1824b9c4148340d8a66d253ed90ceb58dc883f1b`. The source PNGs and their accompanying text are reused unchanged from `rich-captures` and `rich-captures-ipad`.

These are existing web captures at phone and tablet form factors, not newly captured native iOS screens. Before upload, confirm that the depicted UI and features match the iOS build being submitted. This change updates store artwork and tooling only. It does not publish to App Store Connect or modify the playable app.

The scenery is promotional illustration outside the gameplay panels. It does not depict a playable 3D environment. The 16 art plates were created with built-in image generation and are raster PNG assets, not editable meshes or Blender scenes. Exact prompts and reference provenance are included in `source/art-prompts.json`. Original game artwork informed the city and yellow-car scenes.

## Edit and rebuild

`source/build.mjs` owns typography, native capture crops, framing, shadows, sizing and export. `source/storyboard.json` owns headlines and feature metadata. `source/art/01.png` through `16.png` contain the distinct artwork plates. Fonts and their SIL Open Font License are included.

Requirements: Node.js, Sharp, and an SVG rendering stack with Fontconfig/Pango support. Install the isolated screenshot dependency with `npm install --prefix screenshots/appstore-2026/source` from the repository root. This does not add a dependency to the game. The renderer can also use the supplied runtime module location through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`.

```bash
node screenshots/appstore-2026/source/build.mjs
node screenshots/appstore-2026/source/previews.mjs
```

For a selective revision, use `node screenshots/appstore-2026/source/build.mjs --ids=01,03,09`. For the initial three-image phone preview, use `--draft`.

## Research basis

The visual revision retains the earlier review of the live product page, repository screenshots and game systems. It changes the art direction in response to feedback.

Apple recommends introducing core features early and allows up to ten screenshots per set. The initial images should work independently in search results. Export dimensions follow Apple's accepted screenshot sizes, and every screenshot must accurately represent the app in use.

The new visual direction is a design proposal, with no measured conversion result yet. Product Page Optimization should be used to compare it against the current store set rather than assuming the new campaign wins by taste alone.

The existing `scripts/generate-appstore-2026-set.mjs` and `scripts/generate-appstore-2026-ipad.mjs` entry points also rebuild this edition. The earlier `scripts/lib/storeFrameSystem.mjs` is retained for historical tooling and is not the current campaign compositor. The new capture assertions are in `source/storyboard.json`.

![First three screenshots](DeepLife-Immersive-First-Three.png)

[Main overview](DeepLife-Immersive-Overview.png) · [Alternative themes](DeepLife-Immersive-Alternatives.png) · [iPad overview](DeepLife-Immersive-iPad.png)
