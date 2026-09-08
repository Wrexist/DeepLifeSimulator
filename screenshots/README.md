# App Store screenshots

The current campaign is the [immersive September 2026 edition](appstore-2026/README.md).

| Device | Current main set | Dimensions |
| --- | --- | --- |
| iPhone 6.9 | `appstore-2026/iphone-6.9/` | 1320 × 2868 |
| iPhone 6.5 | `appstore-2026/iphone-6.5/` | 1284 × 2778 |
| iPad 13 | `appstore-2026/ipad-13/` | 2064 × 2752 |

Use the ten main images in filename order. Optional images in `appstore-2026/alternatives/` replace a main slot. The 47 exports combine real game captures with 16 distinct cinematic artwork plates. The art, fonts, prompts and compositor are under `appstore-2026/source/`.

Before uploading, verify that these existing web captures match the iOS build being submitted. Export validation does not establish native-build parity.

## Rebuild from the repository root

```bash
npm install --prefix screenshots/appstore-2026/source
node scripts/generate-appstore-2026-set.mjs
node scripts/generate-appstore-2026-ipad.mjs
node screenshots/appstore-2026/source/previews.mjs
```

Keep `rich-captures/` and `rich-captures-ipad/`, including their text sidecars. They are shared source inputs and are reused without duplication. Re-capture only when gameplay has changed, using `scripts/capture-rich-state.mjs` and the phone/tablet viewport settings documented in its source. Its label-driven actions require review after UI copy changes.

Nothing in this directory is bundled into the playable app.
