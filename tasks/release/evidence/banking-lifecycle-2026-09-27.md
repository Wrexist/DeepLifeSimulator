# A06 Banking lifecycle and shared notifications - 27 September 2026

[Actual screenshot gallery](banking-lifecycle-2026-09-27/gallery.html)

## Changes

- Bank transfer Max keeps fractional balances instead of flooring interest away. Amounts and account details display cents. The shared amount sheet also preserves the full USD Max.
- Bank's transfer control reserves the account minimum; Bank Pro withdrawal/transfer caps now reserve it too. Existing CD lock gates and domain minimum checks remain authoritative.
- Non-mirror withdrawals, account closure and credit-card reward redemption reject atomically if the cash ceiling cannot receive the whole amount. A rejected operation leaves both sides untouched.
- Overdrawn accounts cannot be closed to erase debt. Both Bank interfaces explain that the overdraft must be repaid first.
- User-requested notification polish: solid navy card, subtle border, colored icon disc, semibold system type, 44-point dismiss/action controls. This fixes the web fallback to a serif font from an unavailable Roboto-Medium family.
- Notifications default above bottom navigation, keeping the HUD readable. Provider stacks use natural layout height, so wrapped messages cannot overlap at the old fixed 56-point interval. Explicit top positioning, dismiss timers, action callbacks, deduplication, reduced motion and notification preferences remain supported.
- UI gradient ceiling tightened from 142 to 141 after removing the toast gradient.

No save-schema change (51), dependency additions, interest/credit-score rebalance or replacement weekly formula.

## Verification

- Banking/loan/bill/budget/interest/credit-score controls: 20 suites, 199 tests passed, exit 0, 9.982s.
- Card charge/pay/redeem, tax ledger/base, political loan rates and rendered loan quote: 5 suites, 48 tests passed, exit 0, 6.765s.
- Notification action/dismissal, bridge and settings policy: 3 suites, 20 tests passed, exit 0, 13.205s.
- Total focused: 267 tests. Initial transfer-render runs exposed a missing PanResponder in the repository's RN mock; the test now supplies only that gesture boundary on the existing mock. Final run passes. No product failure was hidden by mocking the transfer action.
- Browser: 375x667 and 768x1024, DPR 2, reduced motion, isolated synthetic saves. Withdraw full $100.75 -> verify $0 savings -> deposit $800 -> reopen -> verify $800 available. Both passed with zero page errors.
- Bank Pro: synthetic high-yield account at $1,200.75 with a $1,000 minimum -> Max offers/withdraws $200.75 -> another $1 withdrawal is disabled. Both widths passed with zero page errors. An initial QA seed used an invalid account enum; the seed was corrected to the canonical `highYieldSavings` before the passing run.
- Purchase gym -> confirm sale -> two notifications; real browser bounds verify they do not overlap each other or the bottom navigation. Screenshots inspected at both widths.
- Lint: zero errors, three pre-existing warnings (two banking memo dependencies, one existing lazy require). UI ratchet and diff check pass.
- Source and test-project TypeScript passed, exit 0. Full suite completed, exit 1: 847 suites passed, 3 failed, 17 skipped; 10,157 tests passed, 3 failed, 32 skipped; 308 snapshots passed; 939.501s. No skip configuration changed.
- Full-run failures: local tick timing projected 1,633.84ms against the unchanged 1,000ms limit; two source-inspection tests still expected the pre-A04 absolute Health badge and old recovery text. The Health assertions now enforce an in-flow rounded Active badge and the accurate free-Walk/Meditation/Rest guidance. Their existing gameplay-threshold and no-side-stripe checks remain.
- Isolated rerun of all three failing suites passed: 3 suites / 17 tests, exit 0, 19.466s. Timing measured 742ms, below the unchanged 1,000ms limit. The original full run remains recorded as failed; this is not a claim of a single clean full pass. Final-commit CI remains a release gate.

## Remaining acceptance

A06 is not closed: signed iPhone/iPad keyboard, VoiceOver/Larger Text, background/kill/relaunch, old-save permutations, CD maturity, defaults and full Bank Pro account/card/bill UI journeys still require acceptance. Automated domain checks do not prove those device cases. Browser save/reopen is not native storage-interruption evidence.

26 acceptance/operational items remain. Next independent task: A07 Stocks and crypto.

Git: fetched origin; main 9e729ac2. Draft PR 229 remote head da850215 has passing coverage/quality/preflight; its update workflow was intentionally cancelled previously. These results do not cover the new local edits. No merge, push, OTA or paid build.
