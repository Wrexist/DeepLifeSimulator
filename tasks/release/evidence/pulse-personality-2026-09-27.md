# Pulse personality - 27 September 2026

[Screenshot gallery](pulse-personality-2026-09-27/gallery.html)

## Changes

Replaced the 30 generic public-post slogans with authored everyday observations and varied subjects. Weekly public copy is selected without replacement, so distinct IDs no longer permit identical text in the same feed. The authored pool bounds a generated batch at 30; production calls request seven or the existing three-to-seven default. Weekly text selection stays stable while existing author/engagement generation remains unchanged.

Known-contact copy prefers recorded recent promotions, bonuses, new hobbies, reunions, calls and hangouts. Future events and records older than one game week are excluded from these current-event lines. Mood and personality provide quieter fallback voices. Contact copy also avoids text already used by another contact in the batch.

Existing NPC eligibility, posting probability, two-week history cooldown and cap are retained. Player posts, saved history, notifications, follower/reward math and schema 51 are unchanged. No new network or AI service was added. This does not make all ambient author identities or engagement counts deterministic; those existing generators remain in place.

## Verification

- 3 suites / 32 tests passed, exit 0, 64.696s. New tests cover seven unique posts across 52 weeks under identical random draws, weekly copy stability/variation, recent versus future/stale context, mood fallback and state non-mutation. Existing checks cover NPC eligibility/cooldown/cap, engagement math, and the eight-week compose/growth/scandal/recovery loop.
- Source and test-project TypeScript passed, exit 0.
- Changed-file lint passed, exit 0: one existing unused catch-variable warning in npcPosts, zero errors. UI ratchet passed unchanged: 142 gradients / 94 raw font sizes / 647 heavy weights. Diff check passed.
- Browser journeys at 375x667 and 768x1024 passed, exit 0, zero page errors. Feed and lower-post captures use isolated unlocked QA saves, DPR 2 and reduced motion; ambient like action remains operable. Context-specific lines are verified by tests; the captured fixture shows public posts.

## Remaining gates

V15 implementation complete; 29 audit items remain. Next: V16 Navigation consistency. Exact signed iPhone/iPad, Larger Text, VoiceOver and latest full CI remain required. Browser evidence is not native evidence. No merge or OTA publishing authorized.
