# Weekly Audit 2026-08-14 — Fix Plan

## Verdict
- Static audit (`npm run audit:weekly`): 5 domains green. Sole warning (test-tree
  type errors "rose to 1010") was a COLD-CONTAINER false positive — audit's `tsc`
  ran mid `npm install`. Verified: app type-check clean, test tree 0 errors.
- Dynamic backstop: money-conservation + save-migration + longRunSaveLoad + performance suites all PASS.
- Deep pass (3 hunter subagents): save/state clean, logic/stability clean, economy found ONE real exploit.

## Blocking finding (FIXED)
- [x] **ECON — device-clock-farmable daily-gem faucet** (`SubscriptionActions.ts`
      `canClaimDailyGems`/`claimDailyGems`, surfaced by `DailyGemClaim.tsx`).
      The `gameWeek` gate exists in `canClaimDailyGemsFor` but is not passed here,
      so the faucet is gated only on UTC day-key + epoch mark — both only block a
      REWOUND clock. Forward-scrubbing the device date farms 20 gems/day (free) /
      250/day (member); gems are IAP currency. Sibling faucet (home.tsx login
      reward) was already closed with a `weeksLived` gate (ECON-1); this one was
      left open. Violates §4.4 ("gate on game state, not a device-clock day-string").

### Fix steps (mirror the v31 `lastLoginRewardWeek` pattern)
- [x] `contexts/game/types.ts`: add `settings.deepLifePlusLastGemClaimWeek?: number`.
- [x] `contexts/game/actions/SubscriptionActions.ts`: pass the game-week gate in
      `canClaimDailyGems`; stamp `deepLifePlusLastGemClaimWeek = state.weeksLived`
      in `claimDailyGems` (same updater as the grant).
- [x] `components/DailyGemClaim.tsx`: thread the same week gate into the CTA
      eligibility check so the button state matches the reducer.
- [x] Save format: STATE_VERSION 39 → 40; register migration 40 (carve-out bump,
      no backfill / no repair mirror — undefined default); update CLAUDE.md /
      DEV.md / WORKFLOW.md STATE_VERSION + v40 note.
- [x] Verify: type-check, `npm run audit:weekly`, save-migration + subscription tests.

## Non-blocking (already filed in open PR #121 — not re-reported)
- Vendor-discount favour magnitude ($25k/vendor/week) — owner sign-off on the number.
- Net-worth scope: miners & generic items counted by modal, not canonical — owner decision.
- `package-lock.json` avataaars dev→prod drift — already fixed in open PR #123.

## Lessons
- [x] Append the day-key-vs-weeksLived faucet lesson to tasks/lessons.md.
