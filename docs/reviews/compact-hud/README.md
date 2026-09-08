# Compact shared HUD — 2026-09-08

The shared status bar now uses three rows: generation/currencies/More, vitals, and date/Next week. Shop, Settings and seasonal controls remain available through More. Stat taps and long presses keep their existing behavior; quick actions expand in normal flow instead of clipping under the header.

Measured browser header height: 151 CSS px at 320, 375, 390 and 768 viewport widths (about 200 previously at 390). The 768 capture is a resized browser, not a cold tablet or native device test. The existing combined coaching/goals card remains the only immediate Home prompt.

## Evidence

- `home-390.png`, `home-375.png`, `home-320.png`, `home-768.png`: real production web export in Chromium, device scale factor 2.
- `controls.png`, `settings.png`, `quick-actions.png`: expanded utilities, opened Settings, and long-pressed energy.
- `work.png`, `after-week.png`: career view and job application/week advancement walkthrough.
- Previous layout: `../home-clean-guidance/home-390.png` at parent commit 421e200.

## Validation

- Startup/HUD/coach selection: 15 suites, 171 tests passed before the final disclosure layout revision.
- Final compact HUD, legibility and touch-target selection: 3 suites, 41 tests passed.
- App and test TypeScript checks passed. UI ratchet passed. Scoped ESLint: no errors, 10 existing warnings.
- Production web export succeeded; browser walkthrough completed without reported page errors.

Native iOS/Android, VoiceOver and Dynamic Type remain unverified. This is a focused layout improvement, not completion of the wider game redesign.
