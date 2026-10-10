# Modern theme consistency review — 5 October 2026

## Scope and evidence

Owner approved the grounded work pilot including the lit silver MacBook and
separated bag, then requested the next pages/assets to align across the game.
This is a source and existing-art review, not a fresh running-app/device audit.
Main refreshed: fc7e17a46f785ba012f8b358bd2e3d36e5b91c4d; no open PRs returned.
No app runtime or economy changes in this review.

- [x] Inspect canonical presentation rules, mounted scene references and actual art.
- [x] Identify first implementation slice and sequenced rollout.
- [x] Record approved direction separately from proposed wider changes.

## Findings

The shared navy UI already provides a foundation. The largest observed art mismatch
is between the approved grounded props, the existing miniature room scenes, and
the illustrated onboarding scenario cards. Inspected the September 28 Work capture,
destination-university render and Corporate Intern scenario image directly.

`components/ui/SceneCard.tsx` owns the scene registry. Work uses its 72x56 thumbnail
through `components/work/JobCard.tsx`; `lib/config/workArtwork.ts` selects artwork.
Education mounts university, Contacts mounts lounge, Hustle mounts studio, and
Health mounts gym. Updating scene files therefore has multiple consumers; check
each consumer before replacement. Registered assets alone do not prove mounting.

Scenarios and Perks use their own illustration collections and cover crops.
Apps chooses a phone or computer launcher based on owned devices. Preserve that
behavior, recognizable app identities, unlock explanations and back destinations.

## Recommended rollout

| Order | Page/surface | Concrete work |
| --- | --- | --- |
| 1 | Work: Career | Pilot three grounded thumbnails: food-service tray/apron for cafe careers, lit laptop/work bag for office/studio careers, notebook/study tools for education. Keep salary, requirements and Apply hierarchy. Check 72x56 readability before converting all work props. |
| 2 | Home and shared chrome | Check common card surfaces, headings, selected controls and semantic colors against the approved baseline. Preserve compact HUD, next-week action and first-job guidance. Avoid adding a large decorative hero that pushes decisions down. |
| 3 | Education, Contacts, Hustle, Health | Replace university/lounge/studio/gym miniature sets with restrained contextual props. Use the same camera, materials, lighting and scale as Work. Verify every shared-scene consumer. |
| 4 | Entry flow | Finish grounded start/legacy hero revisions, then align MainMenu, SaveSlots, Scenarios and Perks illustration treatment. Keep the approved creator controls and useful character portraits. The hero previews are not implemented onboarding screens. |
| 5 | Profile and celebrations | Carry approved metallic badges into consistent achievement/celebration framing. Review glossy reward icons in context before proposing material changes; earlier A-C approvals remain valid. Share spacing, type and reduced-motion behavior. |
| 6 | Apps and catalogues | Audit both launchers, store/property/vehicle art and fictional app headers. Normalize framing, material treatment and control behavior while preserving app/category meaning. These catalogue families require further visual inspection before selecting replacements. |

## Coherent identity

Use the existing navy surfaces, warm off-white type, restrained teal/blue accents,
satin metals, fabric/leather and paper. Everyday props should feel plausible and
specific to their action. Maintain a consistent studio view and optical scale;
do not repeat the laptop for unrelated jobs. Existing LifeLine artwork offers a
DeepLife-specific home/work/journey motif for occasional transitions, not every card.

Keep semantic colors stable: cash green, investments violet, property pink and
existing health/happiness/energy colors. Navigation remains simple line icons.
Metallic achievement rewards can coexist with grounded everyday objects if their
framing and lighting agree. A single theme need not erase fictional app identities.

## Next implementation slice and acceptance

Produce a before/after Work Career review with the three proposed thumbnail
families in the actual JobCard layout. Do not substitute the large onboarding
composition directly into a tiny thumbnail. Reuse existing rendering and UI owners.
Validate transparent edges on navy/light and no model collisions, then inspect
compact phone and tablet, Larger Text, first Apply visibility and reduced motion.
Native acceptance remains separate from screenshots. No deployment/build authorized.

The remaining Group D heroes and Group E loops are still outstanding; this review
does not mark the complete asset delivery approved or ready for intake.
