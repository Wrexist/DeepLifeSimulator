# Custom onboarding acceptance - 27 September 2026

[Screenshot gallery](custom-onboarding-2026-09-27/gallery.html)

## Confirmed defects fixed

Perk selections lived only in the Perks screen; mindset always initialized empty. Going back to edit identity discarded those choices. Both now belong to the existing debounced onboarding draft. The canonical start/save pipeline still receives the selected values, and successful completion clears the draft. Quick Start explicitly clears a previously drafted mindset. Existing drafts without the optional field remain compatible; GameState schema stays 51.

Scenario validation accepted NaN ages and NaN/infinite cash. It now requires finite values before building a life. The new regression failed on those three cases before the fix and passes afterward.

## Verification

- Render regression selects an unlocked perk and a mindset, remounts Perks, verifies both remain selected, deselects the mindset and clears the draft.
- Browser journeys passed at 375x667 and 768x1024 using isolated fresh storage and reduced motion. Food Courier, Alex Morgan, male/bisexual, portrait and randomized custom-avatar paths both reach Home. Returning to identity retains Frugal. The durable save retains identity, avatar and mindset after navigating to the root and continuing; weeksLived is unchanged and equals lifeStartWeek. Successful start removes the draft. Zero page errors. Screenshots are browser evidence, not signed-device evidence.
- Changed-file lint: exit 0, zero errors, 10 existing Perks warnings. UI ratchet unchanged at 142 gradients / 94 raw sizes / 645 heavy weights. Diff check passed.
- Final focused run: 19 suites / 406 tests passed, Jest exit 0, 72.695s. Includes every life-path scenario through the real weekly transition, start/slot protection, save round-trip and render coverage. Source and test-project TypeScript both passed, exit 0.

## Remaining acceptance

A01 remains open: native keyboard/safe areas, Larger Text/VoiceOver, interrupted native start/background/relaunch, challenge permutations and purchase-dependent perks still need evidence. The Perks screen also retains older decorative styling; align it to the approved compact creator treatment in a later presentation pass. No new paid entitlement, save schema, weekly formula or game rules introduced.

26 acceptance/operational items remain. Next independent task: A02 Career lifecycle. No production deployment or signed native acceptance.
