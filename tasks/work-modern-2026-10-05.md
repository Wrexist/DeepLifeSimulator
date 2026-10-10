# Work modern art - 5 October 2026

Owner authorized the first slice of the modern-theme rollout.

- [x] Render original grounded food-service, office and study thumbnails using
  the approved studio and restrained materials.
- [x] Export optimized WebP and map only the intended career families through
  existing SceneCard / JobCard owners; preserve other scene consumers.
- [x] Inspect full-size and 72x56 artwork plus actual compact/tablet JobCards.
- [x] Run focused existing tests and types; record results and remaining gates.

No salary, eligibility, job application, save or purchase logic changes.

## Delivered

Three original Blender/Cycles models, linked to the approved shared studio, PNG/GLB/editable sources in `art/astra-v1/work-modern/`. Reproduction scripts: `build-work-modern.py` and `export-work-modern.py` in `art/astra-v1/source/`.
Runtime files: three 512x384 transparent WebP files, 47,366 bytes combined, with SHA256 manifest. Geometry totals: food 5,456, office 20,400, study 3,628 triangles; maximum individual mesh 764 triangles. Blender production and export checks exited 0.

SceneCard registers dedicated work-only assets. Food, office/accounting and teaching careers map to them. Teaching Assistant now maps to study before the generic assistant rule; Accounting Clerk now matches office. Existing street actions, other app scenes and locked-card art suppression are preserved.

## Verification

- Existing focused tests: 2 suites / 3 tests passed, exit 0. After finding the entry-title mapping gap, added a regression case; final artwork suite 3 tests passed, exit 0 (4 distinct tests across runs).
- Source TypeScript and changed-source ESLint exited 0. Final mapping change is confined to regex strings; focused regression rerun passed.
- Actual app captures: 375x667 and 768x1024, reduced motion enabled, no page errors. First Apply at y550, height44 on phone; y625.5, height53 on tablet. Compact first action stays visible.
- Inspected original-size and 72x54 navy/light asset samples; the actual SceneCard container remains 72x56.
- Initial capture assertion measured the inner Apply text instead of the button. Corrected the locator to the accessible button; rerun passed. This was a capture-script error, not a reduced target size.
- The base fixture shows Accounting Clerk and Teaching Assistant locked, correctly hiding decorative art. A separate local fixture with completed education and owned tools is used to inspect unlocked art; no real player save is edited.
- Unlocked fixture rerun exited 0 at both sizes with zero page errors. Visually
  confirmed the laptop on Accounting Clerk and notebook/pen on Teaching Assistant.
  The first fixture attempt had no education records to mark complete; explicitly
  supplied its required credentials and reran before claiming unlocked-art coverage.

Browser evidence is under `tasks/release/evidence/work-modern-2026-10-05/`. These are local fixture screenshots, not signed-device evidence. Native Larger Text/VoiceOver and iPhone/iPad checks remain pending. No production publication or paid build.

Next: review the Work slice, then align Home/shared presentation and the remaining contextual art families using the rollout plan. Group D remaining heroes and Group E loops remain outstanding.
