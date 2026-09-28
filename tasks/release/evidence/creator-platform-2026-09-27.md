# Creator-platform artwork and usability - 27 September 2026

[Before/after gallery](creator-platform-2026-09-27/gallery.html)

## Result

Replaced the scenic v1 cover direction with five original creator/gaming images: studio microphone, lantern explorer, arena drone, modular building and rooftop robot. YouVideo uses canonical red accents; Streaming uses violet. The active 768x512 WebP family totals 317,318 bytes. Original PNGs, exact prompts and file hashes are archived in [media-v2](../../../art/media-v2/manifest.json). No new dependency, save migration or domain formula.

YouVideo now places the title, horizontally scrollable topics and upload action inside a compact composer. Drafts are labelled DRAFT and have neither invented view counts nor a play affordance. Blank titles remain disabled. Energy cost and weekly cap remain visible.

Streaming places the broadcast action before the category directory. Category labels sit below the artwork, and the dashboard identifies the player as a creator rather than implying an earned partnership. History/detail dates use the canonical life-relative week helper. Existing upload and live-session actions are preserved.

## Verification

- Focused Jest: 5 suites / 40 tests passed, exit 0 (263.088 seconds). Includes composer validation, stream continuity while tabbing away, media mapping, stream metadata and life-relative dates.
- Source and test-tree TypeScript checks: exit 0.
- Changed-file ESLint: exit 0, no warnings. UI ratchet: exit 0, 142 gradients / 94 raw font sizes / 647 heavy weights; gradient ceiling tightened from 144 to 142. Git diff whitespace check: exit 0.
- Browser upload/detail and all five streaming categories, start/stop/history: passed, zero captured errors. [Interaction results](creator-platform-2026-09-27/interactions.json).
- Browser layouts: 320x667, 375x667 and 768x1024; upload and Go Live are visible without scrolling. [Measured bounds](creator-platform-2026-09-27/layout-checks.json).

| Width | Upload y / height | Go Live y / height |
| --- | --- | --- |
| 320 | 431 / 44 | 364 / 45 |
| 375 | 481 / 44 | 420 / 52 |
| 768 | 566 / 53 | 489 / 62 |

The initial 320px run caught a scaled upload target below 44 points. Explicit minimums now cover upload, title, topic chips and stream actions; the repeated run passed. A gradient artifact on the Streaming dashboard was replaced with the canonical solid action fill.

## Limits and next work

These are Expo browser captures using an isolated QA save, not signed iOS evidence. Native keyboard, VoiceOver/Larger Text, phone/iPad rendering, memory and backgrounding acceptance remain open. No merge or production deployment is authorized by this polish task.

This revises V07 quality rather than closing another item: **37 audit items remain**. Next is V08 pet/travel/vehicle asset consistency in [the full register](../../whole-app-audit-2026-09-26.md).
