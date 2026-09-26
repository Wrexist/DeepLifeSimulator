# Life activity access - 26 September 2026

V03 presentation follow-through, baseline `ac6b05ea`. Baseline PR #229 coverage, preflight and quality passed. Save schema 51, activity order, prices, gains, requirements and the canonical activity handler are unchanged.

## Change

Vitals start compact when the player has no saved disclosure preference. The four stat icons and values remain visible; tapping opens the existing rings. Existing expanded/collapsed preferences still win. Life's header and activity cards use tighter shared spacing, redundant introductory copy is removed, and the gym artwork sits beside the gym section instead of above daily activities. Activity buttons have a 44-point minimum even on narrow screens. Only active diet cards reserve space for their Active badge.

Urgent treatment selection and ordering remain unchanged: disease/critical health still puts health issues and cures before vitals. No simulation or persistence implementation changed.

## Measured result

Isolated Tyler Nguyen fixture, age 20, $1,500, health/energy/happiness 100 and fitness 10. Browser DPR 2, reduced motion. Measurements use a fresh disclosure preference.

| Viewport | First activity action before | After | Improvement |
|---|---|---|---|
| 375 x 667 | y903-948, height 45 | y556-601, height 45 | 347px higher; fully visible above navigation. |
| 768 x 1024 | y1049.5-1102.5, height 53 | y627.5-680.5, height 53 | 422px higher; meditation also visible. |

[Before/after and interaction screenshots](life-compact-2026-09-26/gallery.html).

- PASS: Walk executes through the existing handler; energy becomes 95 and fitness 11, and feedback appears.
- PASS: Vitals expand/collapse; unaffordable Hospital Stay stays disabled with its $2,000 requirement; Family opens.
- PASS: Compact phone and tablet captures, plus narrow 320px preview; no browser page errors.
- PASS: 4 focused suites / 46 tests, 65.476 seconds, exit 0. Existing healthcare policy, health stress, relationship-health and disclosure persistence coverage.
- PASS: source TypeScript and changed-file lint, exit 0; no lint warnings. UI ratchet unchanged: 148 gradients / 94 raw font sizes / 650 heavy weights.

## Remaining acceptance

Native iPhone/iPad safe areas, Larger Text, VoiceOver and signed-device rendering remain unverified. Urgent treatment priority was checked in source, not exercised with an ill browser fixture. Browser evidence does not establish native release readiness. No merge, OTA or signed build performed; newest-commit PR checks are reported separately.

V03 implementation is complete. **41 audit items remain**, including native acceptance. Next: **V04 Profile hierarchy**, bringing long-term progress and achievements above repeated identity content.
