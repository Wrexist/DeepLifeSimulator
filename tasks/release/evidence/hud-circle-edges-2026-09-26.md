# HUD circle edges - 26 September 2026

Request: smooth the rough/blocky edges of the Shop, Settings and seasonal buttons.

Implemented: direct SVG circles inset half a viewBox unit, removing redundant
native rounded clips. Transparent margins allow edge coverage. Same layout,
icons and hit targets; no inner circles. Gold retains its gradient and a subtle
native-driver opacity gleam instead of a clipped moving strip. Reduced motion
suppresses the gleam. No gameplay or persistence changes.

Verification:
- Source TypeScript: exit 0.
- Focused HUD tests: 2 suites / 16 tests passed, exit 0.
- Changed-file ESLint: 0 errors, 9 existing warnings.
- UI ratchet: 148 gradients / 94 raw font sizes / 650 heavy weights, pass.
- Chromium browser: 390x844 at 3x, 375x667 at 2x, 768x1024 at 2x;
  zero page errors, icons visible, Settings button operable. These are native
  browser-resolution captures, not resized/blurred screenshots.
- Prior branch head 4e2d8ef2: all required PR checks passed before this edit.

Screenshots: [phone](visual-ux-2026-09-26/smooth-circles-phone.png),
[compact](visual-ux-2026-09-26/smooth-circles-compact.png),
[tablet](visual-ux-2026-09-26/smooth-circles-tablet.png).

Remaining: signed-device iOS edge/motion/accessibility inspection. Browser
rendering is not native acceptance. No production OTA or build dispatched.
