# Career lifecycle - 27 September 2026

[Screenshot gallery](career-lifecycle-2026-09-27/gallery.html)

## Confirmed defects fixed

- Delayed hiring now opens a career-history entry on the hire week. The first paycheck still arrives on the following tick; the hire week does not fabricate wages or a worked week. Previously only immediate hires opened a record, so delayed hires could work without accumulating history earnings.
- Delayed rehires reset startedWeeksLived to the new hire week, matching immediate hires. Previously an old employment date leaked into tenure/cooldown/progression calculations.
- Delayed hiring notices name the retained career level and use the canonical boosted weekly salary. Previously every notice used rung zero and raw base salary.
- Firing closes the last open employment record without adding earnings or paid weeks. Previously reapplying could leave two open records and credit new earnings to the old spell.

The approved Work layout, canonical payroll formula, hiring odds and promotion gates are unchanged. Save schema remains 51. Existing historical omissions are not backfilled with invented earnings.

## Verification

Four new regressions drive the real provider/weekly transition and actual career-event resolver. They cover the forced two-week response branch, no wages on the hire tick, first pay exactly once, immediate hire, promotion, quit/reapply, retirement workforce exclusion, termination and retained-role/boosted-pay notices. The stale rehire date and unclosed termination record were observed failing before their fixes. The other career/retirement suites cover requirements, promotion gates, salary units, capstones and pension behavior.

- Focused run: 15 suites / 595 tests / 308 snapshots passed, exit 0, 31.77s.
- Source and test-project TypeScript passed, exit 0.
- Browser: 375x667 and 768x1024, DPR 2, reduced motion, isolated QA saves. Apply -> advance week -> current job -> cancel quit -> confirm quit -> reapply. Zero page errors. Initial harness hit duplicate Cancel controls during a modal fade; it now targets the confirmation control and allows transitions to settle. Browser evidence does not establish native modal behavior.
- Lint: zero errors; 33 existing GameActionsContext warnings. Two new duplicate-import warnings were removed from the test file.
- UI ratchet and diff check passed; ratchet unchanged at 142 gradients / 94 raw sizes / 645 heavy weights. Full regression run is in progress.

## Remaining acceptance

A02 remains open for signed native phone/tablet, VoiceOver/Larger Text, native modal handoff, old-save relaunch, advanced-career entitlement/requirement combinations and promotion/retirement browser/device journeys. The test suite exercises promotion/retirement behavior but cannot establish native UI acceptance. Current rules use immediate or delayed offers after an eligible application; requirement rejection is separate from an unsuccessful instant-offer roll, which queues a delayed response.

26 acceptance/operational items remain. Next independent task: A03 Weekly-loop interaction (rapid taps, pending decisions, recap and save failure). No merge, OTA or signed native acceptance.
