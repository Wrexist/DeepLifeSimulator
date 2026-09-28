# Navigation consistency - 27 September 2026

[Screenshot gallery](navigation-consistency-2026-09-27/gallery.html)

## Changes

AppHeader now has one leading Back/title arrangement. Contacts, Hustle portfolio/company/creation and Spark partner profiles no longer opt into centered titles. Branded search bars use the same AppBackButton with a minimum 44-point target. DeepMail puts Back to Apps on the left and folders on the right; message detail says Back to mail, which remains accurate across folders. Existing callbacks, modal Close behavior, primary tabs, HUD, game logic and schema 51 are preserved.

## Verification

- Three focused suites / 38 tests passed, exit 0 (44.343s): shared header/back callbacks and targets, mail rendering and mail filtering regressions.
- Source and test-project TypeScript passed, exit 0.
- Changed-file lint passed: zero errors, five existing warnings. UI ratchet passed unchanged at 142 gradients / 94 raw font sizes / 647 heavy weights. Diff check passed.
- Browser checks at 375x667 and 768x1024 passed, exit 0, zero page errors. Contacts/Hustle leading Back geometry, Hustle creation return, mail search clearing, folder backdrop dismissal and return to Apps verified. Screenshots use isolated QA storage, DPR 2 and reduced motion. Reviewed compact Contacts/Mail and tablet Hustle captures.
- Browser harness retries corrected an ambiguous Clear search locator and a backdrop tap that landed inside the folder panel; final interactions.json records the successful run. The empty fixture inbox did not exercise message-detail Back in-browser.

## Remaining gates

V16 implementation complete; 28 audit items remain. Next: V17 Typography and component debt. Latest branch CI and signed iPhone/iPad acceptance, including VoiceOver, Larger Text and nested mail/Spark paths, remain open. Browser evidence is not native evidence. No merge or OTA publication.
