# HUD targets and readable labels — 26 September 2026

Scope: D09, D13 and D14 from the whole-app audit. Presentation only; save schema remains 51. No simulation clock, eligibility condition, transaction or purchase fulfilment changed.

## Changes

- Gem balance and Buy gems are sibling buttons with real 44-point minimum targets, under one compact visual pill. The plus no longer sits inside the breakdown button or relies on clipped hit slop. The approved utility circles, stat rings and Next week layout remain intact.
- Bank, Statistics, milestone records, account locks/openings, credit inquiries, vehicle insurance and contact favour stamps use one display-only life-week formatter. A fresh age-20 life reads Week 1, rather than Week 104. Pre-life records state how many weeks before this life; unknown timestamps are not invented. Stored absolute values and sorting remain unchanged.
- Advanced careers use canonical education and achievement names. Cumulative courses are joined with “and”; achievement gates explicitly require a claimed achievement. Unknown future keys receive a readable fallback.

## Validation

- 5 focused suites / 22 tests passed (exit 0): week stamps, catalogue coverage and real executive eligibility, restored HUD ownership, advanced career visibility, milestone display with unchanged absolute sorting stamps. Runs: 20.609 s + 19.311 s.
- Source and test-tree TypeScript: exit 0, no errors.
- Changed-file ESLint: exit 0, 0 errors / 28 existing warnings. No exemptions added.
- UI ratchet: exit 0; unchanged 148 gradients / 94 raw font sizes / 650 heavy weights.
- Browser captures use an isolated age-20 QA save at 375×667 and 768×1024, DPR 2, reduced motion. This fixture includes granted cash and app access; screenshots are not a normal starting economy.
- At 375px, Buy gems changed from 16×16 to 44×44, and the separate balance target is 44×44. At 768px, Buy gems changed from 19×19 to 44×44; balance is 44.2×44. Targets touch at the boundary and do not overlap.
- All eight final interaction cases pass with no browser page errors: Work, Statistics, gem store and gem balance at both widths. Top-edge taps (2px inside the target) open the correct destination. Initial screenshot automation errors (collapsed section, outdated store label, and an ambiguous two-card locator) were corrected; those failed runs are not acceptance passes.
- Bank statement displays Week 1 at both widths. Before/after screenshots and browser observations are in [the evidence folder](audit-labels-2026-09-26/).

- Previous revision `73e1d340`: full CI passed (827 suites / 10,049 tests / 308 snapshots, 862.888 s; 17 suites / 32 tests skipped), with preflight and quality passing. This is a baseline result, not an exact-head full run for these label changes.

## Remaining acceptance

Browser geometry does not prove native hit testing, VoiceOver, Larger Text or signed iPhone/iPad rendering. Those acceptance cases remain open in the register, alongside StoreKit, ads, cloud, lifecycle and release checks. No OTA or paid build is authorized by this work.

Next concrete task: V01 compact Home hierarchy — identify the starting scenario clearly, reduce repeated secondary identity content and bring the first useful goal into view while retaining first-job guidance.
