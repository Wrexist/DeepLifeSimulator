# Health and low-cash recovery ? 27 September 2026

[Phone/tablet screenshots](health-recovery-2026-09-27/gallery.html) ? [Browser results](health-recovery-2026-09-27/results.json)

## Confirmed problems corrected

- Critical health previously led with paid doctor/hospital/experimental cards even at $0. Existing usable free Walk and Meditation now lead, above the longer warnings. Cards use existing policy-adjusted prices and commitment energy gates, and appear only once. Unusable actions are not promoted.
- Hospital copy promised all cures except cancer; the action actually excludes every critical illness and non-curable conditions. Treatment descriptions and per-condition guidance now distinguish routine cures, critical cures and chronic management. Rest is described as energy recovery, not a health cure.
- Low-energy guidance identifies the existing Energy-ring Rest action, its +14 energy/-5 happiness tradeoff and once-per-week limit. If already used, it says so.
- An active diet previously showed ordinary benefit copy even with insufficient cash. The card now explains the conditional skipped payment/benefits and that the subscription remains active. The button says Stop plan and remains usable at $0.
- Browser inspection caught the Active badge overlapping the weekly price. The badge now participates in normal card layout instead of absolute positioning.

No changes to schema 51, activity prices, cure probabilities, stat formulas, diet charging, gym ownership, cooldowns or save logic. Fixes are presentation and existing-action wiring.

## Validation

- Initial focused run: 6 suites / 55 tests passed, exit 0, 40.709s. Health hierarchy, real activity affordability/recovery and diet cancellation, gym atomicity guards, quick-action weekly gates, healthcare discounts and diet units.
- Real canonical early-game survival plus chronic-care regression run: 2 suites / 43 tests passed, exit 0, 61.186s. Includes recovery from critical tips, low-cash starts and 20-week survival; no copied weekly formula.
- Final hierarchy rerun after moving recovery/badge: 2 suites / 20 tests passed, exit 0, 20.659s. Overlaps the initial run.
- Final Health recovery suite: 5 tests passed, exit 0, 19.788s, including non-treatable permanent-condition guidance. Total: 99 distinct focused tests across these overlapping runs.
- Source and test-project TypeScript passed, exit 0. Changed-file lint passed with no warnings or errors. UI ratchet unchanged at 142 gradients / 94 raw sizes / 645 heavy weights; diff check passed.
- Browser 375x667 and 768x1024, DPR 2, reduced motion, isolated synthetic development saves: free recovery visible, Walk updates health 10 -> 13 and energy 20 -> 15 with cash still $0, active unaffordable diet can be stopped. Zero page errors. Screenshots reviewed; the first free action is visible on the compact phone after the layout refinement.

## Remaining acceptance

A04 stays open for signed iPhone/iPad, VoiceOver/Larger Text, all disease/commitment/policy combinations, full gym purchase/use/reload and interrupted treatment/diet persistence. Browser evidence and unit tests do not establish native acceptance. Existing static gym/cooldown suites are safeguards, not a full native lifecycle test. No full suite rerun for this presentation-only patch; prior PR CI is not claimed as validation of local changes.

26 acceptance/operational items remain. Next independent task: A05 Market/inventory and equipment. Local branch work only; no merge, OTA, paid build or release. PR229's previous head checks were refreshed: coverage/quality/preflight passed; EAS Update had been intentionally cancelled. This patch is not pushed.
