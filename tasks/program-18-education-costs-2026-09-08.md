# Program 18: education costs and enrollment safety

Date: September 8, 2026. Base: merged PR #197, `686adb1`.
Branch: `codex/program-18-honest-loops`.

## Goal and scope

A player should see the cash and debt consequences before enrolling. This is
an initial part of EDUC-1 and the tuition affordability work in #196. It does
not complete the full income-versus-bills forecast or introduce deferment.
The earlier draft status of #197 is historical: GitHub confirms it was merged
at 04:39 UTC. Merge status alone does not establish native SDK acceptance.

## Reproduced findings

| Finding | Impact | Evidence and correction |
|---|---|---|
| Duplicate enrollment bypasses the catalogue filter | P2: repeated cash charges or two loans, plus duplicate program IDs | Five failing cases before the fix, one passing withdrawal control. Enrollment now checks the latest state before any charge or loan. |
| Dead-life confirmation can create debt | P2: a stale modal changes the dead character | The same regression suite reproduces it. The action and quote use the existing blocked-player predicate. |
| Loan obligations hidden until after signing | P2 usability: no weekly payment, total interest or repayment-start information | The modal now reads the actual loan offer used by enrollment. |
| Aid copy incorrectly credits GPA | P3: policy or one-off award can be called a GPA-earned full ride | Copy now says tuition is covered by aid, without inventing a cause. |

Completed and paused records remain protected by program identity, matching
the catalogue's existing exclusion rule. Withdrawal removes the enrollment,
so a deliberate later enrollment is allowed and creates another obligation.
The old debt remains. No pre-existing duplicate records or historical charges
are silently removed or refunded.

## Implementation contract

`quoteEnrollment` now returns the offer's principal, APR, weekly payment,
term, total repayment, total interest, adjusted study duration, cash after
tuition and a blocked reason. The action consumes those values, re-quoting
inside its updater. The UI does not maintain another interest or duration
formula. Existing merit, award and political assistance rules are retained.

Cash mode shows cash left after tuition and explains the withdrawal policy.
Loan mode explains that tuition is funded directly, payments start next game
week during study, and pausing or withdrawing does not cancel debt. Totals
assume the stated rate and all scheduled payments on time. Rounded payment
figures are marked as approximate, using the existing money formatter.

Payment choice and cost details now precede the class picker. The payment
options expose radio roles and selection/disabled state. Confirm exposes a
button role and disabled state. Existing minimum target helpers protect those
controls, and cost rows can wrap. Close remains available when enrollment is
blocked.

## Economy, saves and performance

No rates, term lengths, assistance amounts or repayment rules change. Loan
principal still pays tuition directly without a wallet credit. Cash enrollment
still debits tuition once. The new duplicate guard closes an unintended extra
charge, rather than making education cheaper. A 520-week test compares total
principal and interest against the actual loan-autopay implementation.

No persisted field is added. Save schema stays 51 and existing loans/programs
round-trip in the same format. No new tick work, random draw or dependency is
introduced. The quote uses existing life-skill and political readers. The
existing action-time loan ID draw remains outside the React updater.

## Verification

- Before the action fix: enrollment safety regression failed five cases and
  passed the intentional withdrawal/re-enrollment control.
- After: safety plus existing education actions passed 15 tests in two suites.
- Offer/repayment and modal interactions passed another 15 tests in two suites.
- Source type-check: exit 0. Final test-tree type-check: zero errors, exit 0.
- Scoped lint: zero errors, one pre-existing action warning. Repository lint
  ratchet: zero errors, 715/715 warnings, exit 0. UI ratchet: exit 0.
- Web export: exit 0. The exported JavaScript was checked for both new cost
  disclosure strings. This proves bundling, not visual or native acceptance.
- Full configured suite: **772 suites, 9,729 tests and 308 snapshots passed**,
  exit 0 in 326 seconds. The configured stress/startup/save suites are included.
  Existing skips remain 17 suites and 32 tests. Known socialBoundaries late-import
  and worker teardown notices remain, without adding `--forceExit`.
- No native build was dispatched. Full native preflight was not rerun for this
  non-release slice. Source/test types, lint/UI ratchets and web export were run
  separately as recorded above.
- `git diff --check`: clean.

## Remaining work, in priority order

1. Native validation of the merged payment changes, and this enrollment screen
   at small phone widths, large fonts and with a screen reader.
2. A full cash-flow forecast using the authoritative income and mandatory-cost
   readers. Cash after tuition is explicitly not a promise of affordability
   after future bills. Housing and ordinary loan previews are not changed here.
3. Measure student-loan deferment or income-linked alternatives with personas
   before changing balance. Current immediate repayment is disclosed clearly.
4. Continue recap explanations and connected story work in the broader roadmap.

The browser rejected local preview navigation with `ERR_BLOCKED_BY_CLIENT`.
No screenshot or interactive browser/device acceptance is claimed. Component
render tests cover payment selection, broke state, full aid, stale death state
and the available close action.
