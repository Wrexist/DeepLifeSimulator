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
- UI ratchet and diff check passed; ratchet unchanged at 142 gradients / 94 raw sizes / 645 heavy weights. [CI full suite](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/36330167614) passed on code commit `7c752f8b`: 845 suites / 10,134 tests / 308 snapshots, 857.979s; coverage floors passed. The 17 manual/conditional suites and 32 tests already skipped by the repository configuration remain unchanged. Quality and preflight passed.

## Timing validation and runner limits

The local full run was stopped after CI completed: 579 suites had passed and the tick benchmark failed at 1,616ms against the unchanged 1,000ms projected 52-week limit. It is an interrupted run, not a full pass. An earlier single-worker attempt was also interrupted. Separate working-checkout benchmark runs failed at 3,092ms and 2,159ms. No threshold, exclusion or coverage floor was changed.

The pre-change commit `4c31a32f` passed in a separate clean checkout at 890ms. CI ran the career-fix commit's benchmark successfully at 249ms. The same clean checkout switched to `7c752f8b` also passed at 917ms (exit 0, 134.555s). [Timing results](career-lifecycle-2026-09-27/timing-results.json). The threshold failure was not reproduced in that clean checkout or CI; the failed working-checkout runs remain recorded, with their precise environmental cause unproven. The isolated checkout is `C:/Users/IsacC/Downloads/DeepLifeSimulator-career-baseline` and shares the unchanged installed dependencies through a junction. These are Node/test-renderer measurements, not Hermes/device timings.

## Remaining acceptance

A02 remains open for signed native phone/tablet, VoiceOver/Larger Text, native modal handoff, old-save relaunch, advanced-career entitlement/requirement combinations and promotion/retirement browser/device journeys. The test suite exercises promotion/retirement behavior but cannot establish native UI acceptance. Current rules use immediate or delayed offers after an eligible application; requirement rejection is separate from an unsuccessful instant-offer roll, which queues a delayed response.

26 acceptance/operational items remain. Next independent task: A03 Weekly-loop interaction (rapid taps, pending decisions, recap and save failure). No merge, OTA or signed native acceptance.
