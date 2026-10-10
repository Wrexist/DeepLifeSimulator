# Grounded entry flow — 6 October 2026

- [x] Produce grounded Start and Legacy heroes; preserve approved Grow.
- [x] Validate transparent hero bands, geometry and navy/light/phone previews.
- [x] Integrate approved prop artwork into matching scenario cards with contain framing.
- [x] Capture entry flow at phone/tablet sizes and run relevant checks.
- [x] Present revised Group D at the owner's explicit review gate before intake.

Remaining scenario/perk/mindset families need distinct art; do not reuse unrelated
props solely to make the catalogue look uniform. Main menu/SaveSlots backgrounds
and creator portraits stay intact during this slice.


## Delivered and review boundary

Start: empty dark leather wallet with restrained stitching and visible empty
slots. Legacy: teal cloth album, unprinted document folder and brass house keys.
Grow remains the approved MacBook/bag proposal. All share the linked studio.
No people, faces, painted numbers or floating coin stacks. New geometry totals:
Start 3,680 triangles (max mesh640); Legacy 7,056 (max mesh1,152).

Master sources/PNG/GLB and phone/navy-light reviews:
`art/astra-v1/proposals/grounded-entry/`. Blender production exit0; PNG RGBA,
1600x1200, empty-band and embedded GLB checks exit0. Start has 222 empty top /
402 bottom rows; Legacy 225 / 405. Phone composition stays inside safe artwork
bounds. Start copy now reads Your life. Your beginning. because the real scenario
catalogue has different starting balances. Hero phone images are compositions,
not implemented intro screens. New heroes await the original Group D review gate.

Entry integration: Corporate Intern, Aspiring Entrepreneur, Tech Prodigy reuse
approved laptop art; Fitness Enthusiast reuses gym props. Mapping is local to
Scenarios, not shared gameplay catalogue data. Transparent props use contain with
space reserved below for title/difficulty. Other paintings retain cover/scrim.
No perk effects, starts, eligibility, challenges, portraits or controls changed.

## Checks

- Source TypeScript and changed-source lint exit0; whitespace check exit0.
- Scenario-flow suite: six tests pass, exit0.
- Eight scenario visual cases at 375x667 and 768x1024; selection continues to
  Identity at both sizes, zero browser page errors, capture exit0.
- Initial browser run failed because the local server was stopped; restarted it
  and reran successfully. Failed run is not counted as a pass.
- Inspected hero navy/light and phone compositions plus scenario phone/tablet
  captures. No object/title crop in the updated scenario framing.
- Initial visual inspection caught React Native Web intrinsic-image overflow
  despite successful navigation checks. Added a bounded wrapper containing a
  100%-size contain image; all eight captures and selection flows reran with exit0.
  Inspected corrected phone/tablet images and reran lint with exit0.
- Main refreshed; no open PRs. No publication/build. Native Larger Text/VoiceOver
  and signed iPhone/iPad acceptance remain outstanding.

Evidence: `tasks/release/evidence/entry-modern-2026-10-06/`.

Remaining: owner reviews Start/Legacy at Gate4; other scenario families and
perk/mindset illustrations need distinct grounded art. Menu/SaveSlots backgrounds
remain the owner's existing authored set. No claim that the entire entry flow is
finished. After hero approval, consolidate final Group D sources and continue the
remaining entry artwork before animation/intake handoff.
