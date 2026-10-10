# Contextual app art — 6 October 2026

- [x] Reuse approved study and laptop artwork in Education/Hustle.
- [x] Model paired ceramic cups for Contacts and bottle/dumbbell/towel for Health.
- [x] Inspect navy/light composites and integrate through existing SceneCard.
- [x] Check actual phone/tablet pages and source types/lint; record limitations.

Preserve card layout, app actions, unlocks, navigation and reduced-motion owner.


## Delivered

Education uses the approved notebook/pen, Hustle the approved lit silver laptop.
Contacts uses two open ceramic cups on cork coasters; Health uses a steel bottle,
rubber dumbbell and folded towel. Same linked camera and studio, restrained
materials, transparent background, no text/logos. Existing destination files
remain available for unrelated consumers. Only these five SceneCard call sites
(two Hustle states) changed; all card sizing and behavior remain with SceneCard.

New sources/PNG/GLB: `art/astra-v1/context-modern/`. Rebuild with
`source/build-context-modern.py` and `source/export-context-modern.py`.
New runtime WebPs total 26,824 bytes at 512x384. Manifest includes SHA256 hashes.
Contacts: 8,680 triangles, largest mesh 1,280; Health: 6,712, largest mesh 764.
Blender exit0; RGBA size/bounds and GLB header/embedded-resource checks exit0.

## Verification

Source TypeScript, changed-file ESLint and diff whitespace checks exited0.
No new behavior tests added for image-reference-only changes.
Browser capture exited0: Education, Contacts, Hustle empty-business state and
Health at 375x667 and 768x1024 (eight cases), zero page errors, reduced motion
active. Cards are 343x98 on phone and 730x117 on tablet. Visually inspected
phone cards and tablet samples; art stays clear of the text with no clipping.
The active-business Hustle branch shares the same replacement asset but was not
separately exercised. Evidence: `tasks/release/evidence/context-modern-2026-10-06/`.

No economy, save, unlock, transaction or navigation changes. Native iPhone/iPad,
Larger Text and VoiceOver remain acceptance gates; these captures are browser
fixtures. No publication or build dispatched.

Next: finish the remaining grounded onboarding heroes and align entry-flow
illustration treatment; preserve approved creator controls and portraits.
