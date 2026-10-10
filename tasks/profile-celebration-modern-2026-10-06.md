# Profile, rewards and launcher consistency — 6 October 2026

- [x] Export approved badge/crown/trophy masters to compact runtime WebP.
- [x] Align Profile achievements and promotion/toast framing; preserve claim,
  reward, category, secrecy and modal/animation ownership.
- [x] Align phone/computer launcher surfaces without replacing branded icons.
- [x] Check focused reward/launcher tests, types/lint and phone/tablet browser.

No new asset generation or native dependencies. Original A–C masters stay intact.

## Changed

- Six approved masters optimized into 256px WebP, **51,834 bytes** total.
  Source/runtime hashes in `art/astra-v1/reward-runtime.json`.
- AchievementsProgress now uses bronze/silver/gold/platinum for the existing
  common/rare/epic/legendary rarity classification. Labels remain visible and
  numbers remain native text; no painted numerals or invented rank.
- Profile's historical achievement browser uses the shared trophy for completed
  records and retains locks for incomplete records. Home summary and full-sheet
  header use the same trophy. Category and secret labels remain intact.
- Promotion uses the approved crown, removes its strong crest glow and uses
  navy card fill. Existing staged reveal, reduced-motion handling, exact pay,
  sounds/haptics, confetti, dismissal and celebration gate are unchanged.
- Achievement toast has navy fill and category-color border instead of a large
  category-colored surface; content and reward behavior unchanged.
- Shared phone/computer launcher uses solid navy/light tiles and subtle borders.
  Branded app icons, locked shelves, claim badges and navigation stay intact.

## Verification

- Five focused suites: **49 tests passed**, exit 0, 12.926s. Includes promotion
  payload/pay, render/reduced-motion and celebration-gate behavior, achievement
  double-claim/prestige protection, store wiring and launcher section gates.
- Source TypeScript and changed-file lint passed, exit 0.
- Live Expo web at 375x667 and 768x1024: Profile opens, historical browser expands,
  Apps renders and Contacts opens; no page errors. Full achievement sheets open
  and close at both widths; inspected the actual bronze/silver/gold rows.
- Screens and test JSON: `release/evidence/profile-celebration-modern-2026-10-06/`.
- Promotion/toast appearance has source/render checks, not a captured live
  promotion or native-device acceptance. Native Larger Text/VoiceOver, motion,
  safe areas and exact signed build remain open.

Next: inspect store/property/vehicle catalogue framing before replacing any
approved catalogue art. No push, merge, build, OTA or publication performed.
