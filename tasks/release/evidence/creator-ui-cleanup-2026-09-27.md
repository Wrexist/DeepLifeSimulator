# Creator UI cleanup - 27 September 2026

[Before/after screenshots](creator-ui-cleanup-2026-09-27/gallery.html)

## Changes

YouVideo now shows all six topics in a two-column grid with 44-point minimum targets and full labels at 320px. A smaller preview keeps upload visible in the first viewport. Estimated reach is a disclosure with a visible view-range summary; expanded details retain estimated views, subscribers, gear tier and the upgrade destination. Removed the duplicate weekly-limit/energy card; both facts remain beside the recording action.

Streaming category cards keep the same border width during selection, use a checkmark beyond color, wrap category names, and keep the final tile the same width as its siblings. Helper copy is shorter and uses larger upright text. Existing art, canonical upload/live actions, weekly limits and schema 51 are unchanged.

## Verification

- Focused composer and stream-continuity regressions: 2 suites / 7 tests pass (191.375 seconds).
- Changed-file ESLint: exit 0, zero warnings. Git whitespace check: exit 0.
- Source TypeScript check: exit 0. UI ratchet: exit 0, unchanged 142 gradients / 94 raw font sizes / 647 heavy weights.
- Browser upload/detail, all five stream categories, start/stop/history: passed, zero captured errors.
- Browser layout/disclosure checks at 320x667, 375x667 and 768x1024: all topic controls fit horizontally and meet 44 points; blank title disables upload; filling enables it; reach details open and close. Upload and Go Live remain visible without scrolling.

| Width | Upload y / height | Go Live y / height |
| --- | --- | --- |
| 320 | 492 / 44 | 354 / 45 |
| 375 | 537 / 44 | 408 / 52 |
| 768 | 616 / 53 | 492 / 62 |

The first iteration truncated Lore Deep Dive at 320px. The final two-column layout corrects it. Showing every topic moves upload lower than the previous horizontal carousel, but it remains fully visible at all checked widths.

## Remaining

Browser captures use an isolated QA save. Signed iPhone/iPad, native keyboard, Larger Text/VoiceOver and performance acceptance remain unverified. No merge or OTA publishing.

37 items remain in [the full audit](../../whole-app-audit-2026-09-26.md); this is further V07 refinement. Next: V08 pet/travel/vehicle asset consistency.
