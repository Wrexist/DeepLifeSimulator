# A08 Education lifecycle - 27 September 2026

[Actual screenshot gallery](education-lifecycle-2026-09-27/gallery.html)

Study shows both energy and happiness costs. Paused courses say Resume to study. Courses at zero remaining weeks disable further study and say Next week: graduate. Withdrawal asks for confirmation and explains lost progress, non-refundable tuition and continuing student-loan debt, with pausing offered as an alternative. Canonical education actions, weekly progression and save schema remain unchanged.

## Verification

- Education/slider batch: 14 suites / 138 tests passed, exit 0, 8.549s (includes 5 shared slider tests). Enrollment safety/quotes, action guards, cost rendering, education helpers, life-salted exams, semester progression, paused finalization and fractional education speed covered.
- Source/test types passed; final source recheck passed. Changed-file lint has six existing Education hook dependency warnings and no errors. UI ratchet and diff check passed.
- Both 375x667 and 768x1024: free enrollment, study limit, pause/resume, cancel/confirm withdrawal, student-loan enrollment, save/reopen and withdrawal preserving debt/cash passed, exit 0, zero page errors.
- Separate near-graduation fixture: study to zero disables extra study, real HUD Next Week finalizes graduation, reload preserves the earned credential. Both widths passed, exit 0, zero page errors. This uses the canonical weekly transition, not a copied formula.
- Actual final screenshots reviewed. A temporary edit encoding issue was caught visually and repaired from the UTF-8 HEAD source before final verification. Initial recapture attempts hit server-startup timeouts; all final runs completed successfully.

## Remaining acceptance

A08 remains open for signed-device VoiceOver/Larger Text, modal priority, old-save/background/relaunch permutations, full prerequisite/catalogue paths and extended exam/failure journeys. No full-suite release claim. No deployment.

26 acceptance/operational audit items remain. Next independent task: A09 Businesses.
