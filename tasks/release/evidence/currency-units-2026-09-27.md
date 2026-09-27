# Currency formatting and units - 27 September 2026

[Screenshots](currency-units-2026-09-27/gallery.html)

## Changes

Health activity prices, affordability explanations, diet cards and active-plan summaries now use the canonical money formatter. Basic Diet reads `$17.5K/wk` instead of `$17500 / wk`. Work reward ranges format both endpoints and state `per job`. Statistics uses the same formatter for records, aggregates, chart ranges and signed deltas; weekly earnings retain `/wk`. Highest salary was incorrectly described as annual despite the canonical writer storing weekly pay: its unit is now weekly. Vehicle pilot-license cost also uses the canonical formatter.

No prices, reward formulas, weekly transitions, save fields or transaction handlers changed. Detailed bank amounts, market quotes and per-viewer rates retain their required precision. The presentation guide records the rule and these exceptions.

## Verification

- 4 focused suites / 41 tests passed, exit 0, 54.902s: money formatting, diet display units, weekly career salary and political lifetime statistics.
- Previous-head CI had 837 passing suites and one failed tax reachability assertion expecting the old Bank link copy. Updated that assertion to the approved `Income & tax` label and accessible tax action while retaining the unconditional reachability checks. All 24 tax tests pass, exit 0, 28.855s. No test floors or cases removed.
- Source TypeScript passed, exit 0. Changed-file lint passed with 12 existing warnings in Work/Vehicle and no errors; final Statistics/test lint passed without warnings.
- UI ratchet passed unchanged: 142 gradients / 94 raw font sizes / 647 heavy weights. Diff whitespace check passed.
- Browser captures at 375x667 and 768x1024, DPR 2, reduced motion, isolated QA saves: matching locked diet prices and requirements, zero page errors. Active-plan selection verifies the weekly summary; Work displays formatted per-job rewards.
- Before capture could not connect while Metro was starting; gallery contains actual after captures, not a fabricated before view. An initial interaction locator used the wrong capitalization; corrected to the actual translated label before acceptance.

## Remaining gates

Exact signed iPhone/iPad acceptance, Larger Text, VoiceOver and full latest-head CI remain required. Browser evidence is not native evidence. V12 implementation complete; 32 audit items remain. Next: V13 Education copy (free enrollment and consistent durations). No merge or OTA publishing authorized.
