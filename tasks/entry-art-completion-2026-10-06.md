# Entry art and save presentation — 6 October 2026

- [x] Produce grounded contextual props with shared Blender studio, transparent
  PNG, editable source and embedded GLB; verify meshes and exports.
- [x] Map life paths, perks and mindsets to relevant artwork without changing
  catalogue effects, prices, eligibility or identity controls.
- [x] Align SaveSlots solid surfaces and selected framing; preserve recovery,
  delete confirmation, loading and save owners.
- [x] Check rendered art, compact/tablet navigation and focused tests/types/lint.

Local game-dev CLI is absent; continue established direct Blender workflow.
New geometry is original, with no provider spend or external source assets.

## Results

11 original props: camera, collection tray, dice, headphones, keys, medical
notebook/stethoscope, planner, plant, safe, travel case and wallet. Shared studio
lighting and camera come from the approved grounded-work Blender source.

[Navy/light art review](../art/astra-v1/entry-modern/review.png).
Each asset includes 1024x768 transparent PNG, editable linked Blender scene and
embedded GLB; runtime WebPs are 640x480 and total **177,656 bytes**. Mesh maximum
is 12,800 triangles, below 40,000; largest whole prop is 17,028 triangles.
Alpha bounds have safe margins; GLB headers, lengths and embedded buffers were
checked by `art/astra-v1/source/export-entry-runtime.py` (exit 0). Manifest records
runtime hashes and provenance. Visually inspected on navy and near-white.

Blender emitted all 11 exports, geometry report and completion marker then quit;
the PowerShell redirected-stderr wrapper reported exit 1. This is not reported
as a clean process pass. Independent output validation and runtime import pass.

All **15 life paths, 23 challenges, 20 perks and 11 mindsets** now resolve through
the contextual artwork mapping. Related subjects share props; these images do
not imply inventory grants. Original catalogue images remain available as
fallbacks and no catalogue rules, costs, bonuses or requirements changed.
Scenarios/Perks use the existing quiet navy shell, with legible locked-card text
and retained locks/eligibility enforcement.

SaveSlots uses solid navy materials and stable border geometry. Browser testing
exposed a pre-existing render/load loop: `logger.scope()` created a fresh logger
each render, changing `loadSlots` and retriggering its effects. Moving that logger
to module scope stabilizes those dependencies. Slot selection is accessible.
Recovery/delete/occupied-save semantics were not edited.

## Verification

- Six catalogue/flow/safety suites: **110 tests passed**, exit 0 (6.725s).
- Two slot metadata/read suites: **42 tests passed**, exit 0 (4.516s).
- Source and test TypeScript, changed-file ESLint: exit 0.
- Live Expo web at 375x667 and 768x1024: Medical Student to identity/perks,
  locked-perk disclosure, Frugal selection and empty-slot selection pass with no
  page errors. Separate repeated slot 2/3 selection and selected accessibility
  label check passed, exit 0, after stabilizing the logger.
- Screens/results: `release/evidence/entry-art-completion-2026-10-06/`.
- Earlier automation waited for a locked perk before opening the shelf; corrected
  to follow the visible disclosure. Slot-tap timeouts exposed the loop above.

No release, merge, push or build. Main refreshed; no open PRs. Signed-device
VoiceOver/Larger Text, safe areas and occupied-save recovery/delete still require
native acceptance. Next: Profile/celebration framing, then Apps/catalogues.
