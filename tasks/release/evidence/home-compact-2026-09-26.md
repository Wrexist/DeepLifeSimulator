# Compact Home — 26 September 2026

V01 presentation follow-through on draft PR #229. Baseline: `510c09e2`; its coverage, preflight and quality checks all passed before this change. Save schema remains 51. No game rules, goal priority, rewards, save writes or HUD components changed.

## Result

Home uses a compact identity variant: 48-point portrait, less padding, no repeated brand header, and the life week in the Details summary. Profile retains the fuller record. Starting scenario is explicitly labelled inside Details so “Food Courier” is not mistaken for the current job. Net worth, forecast and all detail actions remain available.

The goal card uses 12-point padding and tighter spacing. First-job guidance still explains comparing pay and requirements, with a 44-point CTA. Its existing find-work → pending → hired → paid behavior is unchanged.

## Measured browser evidence

Isolated age-20 Tyler Nguyen save, $1,500, unemployed, Food Courier starting scenario; reduced motion and DPR 2. Coordinates are CSS pixels, not native-device measurements.

| Viewport | Find a job before → after | First goal before → after | Result |
|---|---|---|---|
| 375×667 | y544 → y468; height 44 | y631–676 → y551–596 | Goal moves up 80px and fits above the bottom bar; CTA moves up 76px. |
| 768×1024 | y625.5 → y535.5; height 50 | y727.5 → y632.5 | Goal moves up 95px; no horizontal overflow observed. |

[Screenshot gallery](home-compact-2026-09-26/gallery.html) includes before/after, expanded scenario details, goal disclosure, application and employed states.

- PASS: tap goal opens its details; Find a job opens Work; applying and returning to Home shows Application under review; newly hired Delivery Driver fixture shows the correct Next week guidance. Four interaction cases, zero page errors.
- PASS: 320×568 preview keeps the CTA reachable by scrolling, 44px high, and has no document horizontal overflow.
- PASS: long-name DOM layout stress at 375px preserves the CTA and avoids horizontal overflow. This is explicitly a text-layout probe, not a saved-profile or native Dynamic Type test.
- PASS: existing focused regressions — 3 suites / 17 tests, 31.142 s, exit 0. Covers coaching transitions and dismissal, composed goals, identity mounting and real cash-flow state inputs.
- PASS: source TypeScript, exit 0. Changed-file ESLint, exit 0: 0 errors / 4 existing warnings. UI ratchet unchanged at 148 gradients / 94 raw font sizes / 650 heavy weights. No new dependencies or test-floor exceptions.

## Not reached / next

Signed iPhone/iPad, safe-area differences, VoiceOver and Larger Text remain native acceptance gates. On shorter screens or larger fonts the content may require scrolling; no fixed-height clipping was added. This browser check is not native acceptance or release approval.

Next: V02 Work density — shorten decorative/header space and bring the first relevant Apply action higher, while preserving salary and lock explanations. Remaining register: 43 V/A/O items after this implementation fix.
