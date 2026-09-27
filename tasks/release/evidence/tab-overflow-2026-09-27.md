# Tab overflow and long labels - 27 September 2026

[Before/after gallery](tab-overflow-2026-09-27/gallery.html)

## Change

Shared SegmentedControl now provides 44-point previous/more controls only when content exceeds available width. End controls disable correctly. Arrow scrolling preserves selection; selecting a tab or resizing reveals the active tab. Scroll movement respects reduced motion. Fixed groups allow labels to wrap and all tab variants have a 44-point minimum height. Travel opts into natural-width scrolling so Destinations no longer competes with its icon in an undersized equal-width slot. Tablet controls drop the arrows when all labels fit.

The navigation keys, callbacks, unlock behavior and domain state are unchanged. The presentation guide records when to use fixed versus scrolling groups.

## Verification

- Shared-control regressions: 2 suites / 8 tests passed, exit 0, 180.464s. Bounded arrows, no selection change from scrolling, arrows removed when content fits, and all existing lock/unlock behavior pass.
- Source and test-project TypeScript: exit 0.
- Changed-file lint: exit 0, zero warnings/errors. UI ratchet: exit 0, unchanged 142 gradients / 94 raw font sizes / 647 heavy weights.
- Before/after captures: Bank Pro and Travel at 375x667 and 768x1024, isolated QA saves, reduced motion, DPR 2; exit 0 and zero page errors.
- Browser interaction checks: both apps at 320 and 375px; scroll to end, select Tax/Passport, enlarge to 768px (arrows disappear), shrink again (selected label remains within the arrow boundaries), scroll back without switching selection, then select first tab. All four journeys pass with zero page errors and arrow heights at least 44px.
- Browser initially queried aria-selected, which this preview did not expose. Corrected browser checks verify the visible selected styling; React render tests verify accessibilityState. Native VoiceOver acceptance is still required.

## Remaining acceptance

Native iPhone/iPad, Larger Text, VoiceOver, RTL and touch scrolling still need device evidence. Browser resize/reduced-motion checks do not replace these gates. No merge or OTA publishing authorized. V11 implementation complete; 33 audit items remain. Next: V12 currency formatting and explicit units/cadence.
