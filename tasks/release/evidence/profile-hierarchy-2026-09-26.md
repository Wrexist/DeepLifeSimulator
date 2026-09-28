# Profile hierarchy - 26 September 2026

V04 presentation follow-through. Baseline `51fc6462`, draft PR #229. Save schema 51 and progression calculations are unchanged.

## Change

Profile now leads with a compact portrait/customization link, the live achievement count and life-relative stats. It no longer repeats Home's net-worth forecast, starting-scenario details and full identity record. The portrait uses the existing resolver, including legacy gender fallback, and retains equipped frame/theme colors.

Life Stats starts compact on Profile unless a saved preference says otherwise. Age and weeks in this life remain visible; expanding restores all four stat cards. Prestige keeps its existing contextual destination, claimable contract badge and Legacy Pass row. The optional achievement catalogue expands on demand, keeping tools and support reachable without scrolling through the entire catalogue. The embedded Life/Stats surface retains expanded defaults.

## Measured result

Isolated Tyler Nguyen fixture: first generation, age 20, $1,500, zero weeks in this life and no claimed achievements. Browser DPR 2, reduced motion, fresh disclosure preferences.

| Viewport | Achievement heading before | After | Improvement |
|---|---|---|---|
| 375 x 667 | y896 | y375 | 521px higher. Full progress card at y358-452, above navigation. |
| 768 x 1024 | y992.5 | y444.5 | 548px higher. |

[Before/after screenshot gallery](profile-hierarchy-2026-09-26/gallery.html).

- PASS: live headline shows 0/159; Life Stats shows age 20 and 0 weeks and expands to the original four cards.
- PASS: portrait opens and cancels without applying; Legacy Pass, Settings and Help open and close.
- PASS: catalogue disclosure, unmatched-search empty state and Completed Only empty state. Zero browser page errors.
- PASS: 375px, 768px and narrow 320px browser layouts.
- PASS: 3 focused suites / 22 tests, 166.837 seconds, exit 0. Existing regressions cover live claimed achievements, empty inheritance, deprecated-store rejection and life-relative counting.
- PASS: source TypeScript and changed-file lint, exit 0; no lint warnings. UI ratchet unchanged: 148 gradients / 94 raw font sizes / 650 heavy weights.

## Remaining acceptance and next task

Native iPhone/iPad safe areas, Larger Text, VoiceOver and signed-device rendering remain open. An all-completed profile, a later-generation dynasty and equipped cosmetics were not visually exercised in the browser; their existing state sources and routes remain unchanged. These screenshots do not establish release readiness. Newest-commit PR checks are separate from the focused local checks; no merge, OTA or signed build performed.

V04 implementation is complete. **40 audit items remain**, including native acceptance. Next: **V05 character creator density and hierarchy**.
