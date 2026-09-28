# Relationships and family - 27 September 2026

Scope: A10 source and browser follow-through. Save schema remains 51. No dependencies, game prices, pregnancy duration, artwork or navigation changed.

## Fixed

- Dates now recheck cash, energy, living player, jail and romantic partner inside the queued transaction. Rejection preserves the entire state; paid dates cannot grant full benefits for a partial charge. Free chat remains available with enough energy.
- Romantic gifts cannot charge or grant bond after the target becomes a friend or the player dies.
- Wedding deposits require a current engagement. Manual wedding execution rejects cancelled/replaced/future plans and conflicting spouses.
- Engagement cancellation applies its bond and happiness penalties together, once, including canonical daily-summary tracking. An engagement begun at week zero is recognized.
- Family planning uses one eligibility helper in the screen and action, including the existing screen's adult/commitment gates, bond, cash reserve, existing pregnancy and 40-week birth cooldown. Queued updates recheck all requirements.
- Engagement cancellation now quotes 20 bond points and explicitly discloses that the ring and deposit are not refunded.
- The navy family confirmation explains the $5,000 reserve, no immediate charge, expected 10-week birth and deferred unpaid birth cost.

## Verification

- 63 distinct focused tests passed across queued-transaction regressions, dating recency, wedding/divorce atomicity, provider lifecycle, Family rendering and a new real weekly birth regression. Latest targeted run: 3 suites / 40 tests, exit 0, 38.267 seconds.
- Source and final test TypeScript checks passed (exit 0).
- Changed-file lint: exit 0, no errors; 12 existing warnings in the two action owners (getter dependencies and internal require calls).
- UI ratchet unchanged: 141 gradients / 94 raw sizes / 645 heavy weights. Diff whitespace check passed.
- Full suite completed, exit 1, 730.755 seconds: 857 suites passed / 1 failed / 17 skipped; 10,227 tests passed / 1 failed / 32 skipped; 308 snapshots passed. Only failure: tickTiming projected 1,676.48ms against the unchanged 1,000ms limit while other local checks ran. One worker required forced teardown; this also remains a clean-CI concern. First isolated rerun also failed: 1,192.88ms, exit 1. A separate clean worktree at pre-change 37601857 then passed at 725ms (exit 0); the final current-tree run passed at 721ms (exit 0, 25.734s). The unchanged 1,000ms threshold was preserved. This comparison did not reproduce a patch slowdown; the failed full run is still not a clean full-suite pass. A diagnostic current-tree attempt was interrupted after Jest reported duplicate mock names from the nested baseline worktree; that attempt is not a pass. The baseline worktree and its dependency junction were removed before the final passing run. The newly added weekly birth test ran separately (it was added after full-suite discovery). Final cancellation-copy regression also passed separately: 5 tests, exit 0.
- Browser at 375x667 and 768x1024: confirmation cancellation unchanged, successful conception with no cash debit, pregnancy saved and retained after reopening; no page errors. Screenshots manually inspected. Synthetic saves only.
- An initial browser script incorrectly waited for a native alert on web and was stopped (exit 1, not acceptance evidence). The corrected script asserts the actual pregnancy state and completed with exit 0.

[Phone/tablet screenshot gallery](relationships-family-2026-09-27/gallery.html)
[Browser assertions](relationships-family-2026-09-27/results.json)

## Remaining acceptance

A10 remains open in the 26-item register. This pass does not certify all relationship permutations. Still needed: native modal priority and alerts, VoiceOver/Larger Text, background/kill/relaunch and old-save/device checks; interactive Spark matching/chat, Contacts lending/repayment, bereavement and heir selection across old saves. Existing regression owners for those paths remain in the full suite.

A further source follow-through should move legacy synchronous relationship success messages and milestone auto-posts to committed-result ownership: inner transaction guards protect state, but some callers can still announce the outer precheck's result when a queued update later rejects. This follow-through is not claimed fixed here.

No push, merge, OTA or signed build. Remote PR #229 remains a draft at da850215b98e3373d84642bf2bb2b2a304409de6; its older coverage/preflight/quality passes are not evidence for these local edits. Main refreshed at 9e729ac2bb0491d96796ce22d7aee49066894e5e.
