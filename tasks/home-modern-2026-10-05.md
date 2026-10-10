# Home and shared finishes — 5 October 2026

- [x] Capture baseline Home at 375x667 and 768x1024.
- [x] Align Identity surfaces and borders with shared navy Card tokens.
- [x] Remove glass overlay and colored glow from shared primary buttons while
  preserving semantic gradients, secondary/disabled states and target geometry.
- [x] Verify Home guidance, Work buttons, source types and focused regressions;
  compare before/after bounds and screenshots. Native acceptance remains separate.

No new hero, HUD restructuring, gameplay or save changes.


## Changes and evidence

Identity strip now uses the shared Card radius and neutral border. Its details
list uses the existing inset navy token, and Goals uses the canonical divider.
GradientButton retains caller colors, secondary/disabled appearance, press-scale,
haptics and reduced-motion handling; removed its glass overlay and colored halo.
No dimensions, labels, action handlers or HUD styling changed.

Before/after Home browser measurements are exactly equal at 375x667 and 768x1024.
Phone Find a job: y474 / height44; first goal y557 / height45, above navigation at
y612. Tablet Find a job: y542.5 / height50. Work Apply remains y550 / height44 on
phone and y625.5 / height53 on tablet. All four page captures had zero page errors,
with reduced motion enabled. Find a job navigation opens Work with an enabled
first Apply. Saved in `tasks/release/evidence/home-modern-2026-10-05/`.

Focused tests: 2 suites / 12 tests, exit0. Changed-file ESLint and diff whitespace
check exit0. Source typecheck result recorded below after completion.

Signed iPhone/iPad, Larger Text and VoiceOver checks remain outstanding; browser
fixtures are not device acceptance. No merge, publication or build dispatched.
Next: Education, Contacts, Hustle and Health contextual artwork, using distinct
props in the approved grounded family and preserving app-specific meaning.

Final source TypeScript check completed with exit 0.
