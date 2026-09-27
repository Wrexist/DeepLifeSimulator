# Semantic color consistency - 27 September 2026

[Screenshot gallery](semantic-colors-2026-09-27/gallery.html)

## Changes

CashChip owns its cash identity using financeColors.cash; removed the tint override from its API and all 15 call sites. Fictional app accents remain on their navigation, artwork and actions. Header text retains the adaptive foreground rather than using low-contrast accent text.

Pets health, happiness and energy now use the approved STAT_IDENTITY colors. Happiness uses the smile glyph on the stage, care action and vet benefit. Vet health benefits also use health identity. Weekly changes are separate: signed amounts with Weekly gain, Weekly loss or No change captions. Zero effects are neutral; zero sick/vaccinated counts are neutral and sickness explicitly says No sick pets when none are ill. Existing critical labels, care/adoption actions, bonding calculation, weekly effects and save schema 51 are unchanged.

## Verification

- 3 focused suites / 30 tests passed, exit 0, 20.926s. Covers shared cash/action behavior, signed positive/negative/zero/invalid effects, HUD identity invariants and the wired weekly pet decay/bonding/death effects.
- Source and test-project TypeScript passed, exit 0.
- Changed-file lint passed with zero errors. Initial run reported 39 warnings; two newly unused imports were removed and those two files passed cleanly. 37 pre-existing warnings remain in the broader changed-file set.
- Diff check and UI ratchet passed unchanged: 142 gradients / 94 raw sizes / 645 heavy weights.
- Browser checks at 375x667 and 768x1024 passed, exit 0, zero page errors: identical cash backgrounds in Hustle/Stocks/Pets, neutral empty-pet summaries and canonical dog adoption with real weekly gains. Screenshots use isolated QA saves, reduced motion and DPR 2. Reviewed empty and adopted phone states; negative effects are covered by tests rather than a neglected-pet browser fixture.
- Previous PR revision quality/preflight/coverage passed; latest revision CI remains separate.

## Remaining gates

V18 implementation complete; 26 acceptance/operational audit items remain. Next: A01 Full custom onboarding (scenario, identity, perks, start and save/reload). Exact signed iPhone/iPad, VoiceOver/Larger Text, light-theme contrast and critical/negative pet states remain native acceptance cases. No merge or OTA publication.
