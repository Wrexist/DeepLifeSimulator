# Contacts action clarity - 27 September 2026

[Screenshot gallery](contacts-clarity-2026-09-27/gallery.html)

## Changes

Expanded personal profiles use compact decision rows for Call, Hang out, Ask to borrow, Lend $100 and non-family Build bond. They explain cost, variable bond gain, borrowing/refusal penalties and the Favors repayment/collection destination before tapping. The shared note correctly states no energy charge and once-per-contact-per-week limits.

Unavailable actions retain their descriptions and display a specific reason: used this week, required cash, or maximum bond. Borrowing after five refusals explains the existing guaranteed result. Family bond eligibility remains unchanged. The Attention call no longer promises a fixed +3 gain and exposes its weekly disabled state.

All actions still use their existing handlers and atomic guards. Call/Hang out arguments are shared with their displayed costs; the canonical money, NPC outcomes, IOUs, saves and relationship rules are unchanged. Scope is these core personal actions, not a rewrite of dating, gifts or network favors.

## Verification

- 3 focused suites / 21 tests passed, exit 0, 110.596s: parent/friend/partner rendering, affordability, cooldown, maximum bond, guaranteed borrowing, interaction recency, repayment and duplicate redemption guards.
- Lending suite: 5 tests passed, exit 0, 76.849s: debit/IOU/collection round trip, weekly gate, duplicate debit protection and unaffordable rejection. Total 26 focused tests.
- Changed-file lint passed, exit 0, three existing ContactsApp memo warnings and zero errors. UI ratchet passed unchanged: 142 gradients / 94 raw font sizes / 647 heavy weights. Diff check passed.
- Browser journeys at 375x667 and 768x1024 passed, exit 0, zero page errors: expanded parent action copy, Call used-state and Lend used-state after action. Screenshots use isolated unlocked QA saves, DPR 2 and reduced motion. Friend and partner variants were checked in render tests.
- Source and test-project TypeScript passed, exit 0. The test-project check was slow but completed successfully.

## Remaining gates

V14 implementation complete; 30 audit items remain. Next: V15 Pulse personality. Exact signed iPhone/iPad, Larger Text, VoiceOver and latest full CI remain acceptance gates. Browser checks are not native evidence. No merge or OTA publishing authorized.
