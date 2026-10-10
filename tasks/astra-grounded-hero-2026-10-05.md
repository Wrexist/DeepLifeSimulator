# Group D revision — grounded work hero pilot

Owner clarified that the rejected part is "The toy-like artwork and scenes".
Keep the previously approved A-C assets and the onboarding preview layout.
Revise one Group D pilot before rebuilding the full set.

- [x] Model adult-scale work props: slim laptop, structured work bag and plain
  pay envelope; restrained navy/teal, satin metal, fabric/leather and paper.
- [x] Remove oversized coins, flag and display platform from this pilot.
- [x] Render the same transparent 1600x1200 format with required empty bands;
  inspect navy/light and the existing 390x844 phone placement.
- [x] Record checks and prepare the pilot for review; full Group D approval remains open.

This intentionally supersedes the glossy soft-plastic material direction for
Group D only, following the owner's correction. It does not change A-C.

## Evidence

- Pilot: `art/astra-v1/proposals/grounded-work/`. Editable linked `.blend`,
  embedded GLB, transparent master and navy/light + 390x844 phone previews.
- Python file checks exited 0: 1600x1200 RGBA, 227 empty top rows and 407
  empty bottom rows; 24,880 triangles total, every object below 40,000.
- Existing A-C and original D master hashes unchanged. No app runtime edits.
- Inspected both background composites and the phone preview. No visible edge
  halos; the scene fits within the existing art placement without clipping.
- First PowerShell render wrapper returned 1 because native warnings were
  surfaced as PowerShell errors; the log contains completed PNG/GLB/blend saves
  and `GROUNDED_PILOT_COMPLETE`. Independent file checks passed. A fresh Blender
  reopen exited 0: shared camera/world resolve, lens is 50 mm, all mesh scales
  are applied and no text objects exist. Log: `proposals/grounded-work/scene-verification.log`.
- This is a composited art review, not device or implemented onboarding evidence.

Next: owner reviews this one grounded pilot. Apply accepted direction to the
remaining two heroes, then return to the Group D review gate; loops remain pending.

## Approved direction: MacBook and collision correction

Owner approved the grounded style and requested a powered MacBook and removal of the bag/computer collision. Completed: silver aluminium body, larger trackpad, camera notch, original blue desktop and unlabelled dock. Wallpaper is embedded in the GLB with an emissive material. Moved the complete bag and envelope left.

Blender render exited 0; file checks exited 0. The disjoint bag/laptop X bounds guarantee geometry clearance (0.9533 scene units); projected bounds have a 79.9 px gap on the master, approximately 24 px in the phone preview. Checked navy/light and phone previews visually. Master remains 1600x1200 RGBA, with 230 empty top rows and 410 bottom rows; 27,580 total triangles. Previous masters remain unchanged.

Next: apply the approved grounded direction to the other two heroes, then present the complete revised Group D for its review gate.
