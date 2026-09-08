# Program 18: cash-flow correctness

Date: September 8, 2026. Base: `52c16cf` on open PR #199.
Main remained `686adb1`. This continues the tuition/cash-flow work from #196.

## What was found and fixed

Before expanding affordability previews, the existing cash-flow card needed
its inputs and scheduled loan obligations corrected. This slice fixes those
prerequisites. It does not complete the full post-bills forecast.

| Finding | Player impact | Correction |
|---|---|---|
| Forecast always uses nominal loan payment | Overstates the last payment and bills paid-off debt | Same payoff cap as the actual collector |
| Fallback installment omits accrued interest and mishandles ended terms | Forecast differs from the next actual obligation | Extracted the existing weekly collector math, including legacy APR normalization |
| Home selector omits transitive inputs | Rental, education, pet, luxury, paid-boost and other state reads see missing data | Includes the fields consumed by the existing economy, salary and net-worth readers |
| Memo dependencies omit real changes | Diet activation and prepaid-subscription expiry can leave costs stale | Memoize against the selected snapshot instead of incomplete dependency lists |
| Named-loan lookup uses the first matching name | Two student loans can show the same balance and APR | Each row retains its own loan identity and terms |
| Decimal APR shown as percentage without conversion | A 6% loan can be described as 0.06% | Display normalizes through the same loan-term reader |
| Pension omitted from projection | Retired lives appear to lose a real recurring income | Uses the actual frozen pension reader, adds it through computeWeeklyIncome and shows a named income row |

These are reproduced/source-confirmed P2 display or projection failures, not
claims about reported customer incidents. Six loan parity cases failed before
the fix and two controls passed. Six real-component regression cases also
failed against the original IdentityCard source, after correcting the test
harness's avatar mock path and Cash Flow label. The candidate source was
restored after that isolated baseline run. No harness failure is counted as
a product reproduction.

## Shared loan contract

`lib/banking/loanPayment.ts` owns the obligation BEFORE cash affordability:
remaining balance, normalized APR, accrued interest, remaining weeks and the
capped amount due. The weekly collector, expense total and itemized card all
read it. Paid-off/missing balances yield zero, a final payment is capped at
balance plus interest, and a missing payment falls back to the existing
amortization rule. Decimal/percentage APR compatibility is retained.

The collector still decides whether to pay using the existing bankruptcy floor
and breathing-room rule. It still compounds missed-payment penalties under the
same cap. A forecast shows the amount owed even if it cannot be collected.
Hiding that obligation would suggest that insufficient cash removes the debt.

## State, performance and save impact

No GameState field, migration, native dependency or random draw is added.
Schema remains 51. Existing valid-loan collection results stay byte-identical
in the 308 subsystem snapshots. The financial-independence reader also consumes
calcWeeklyExpenses, so it now uses the corrected debt obligation.

The home card retains its shallow-equal selection rather than subscribing to
the complete save. Its selected snapshot now includes transitive dependencies
such as overdue debt, deposits, crypto and luxury values used by netWorth and
passive-income caps. Memoized projections refresh when that snapshot changes.
This can recompute more often than the previous stale caches, which was
necessary for correctness. No device rendering-performance claim is made.

## Verification

- Loan parity plus rendered state regressions, existing expense tests, education
  quote/520-week repayment and subsystem-equivalence snapshots: 5 suites,
  431 tests and 308 snapshots passed, exit 0.
- A final additional rendered payroll test checks the real work-pay boost and
  jailed payroll withholding in the full configured run.
- Source and test-tree type checks: zero errors, exit 0.
- Repository lint ratchet: zero errors and 715/715 warnings, exit 0.
- UI ratchet: exit 0. Web export: exit 0. The exported bundle contains the
  new pension row. No native build was dispatched.
- Full configured suite: 774 suites, 9,744 tests and 308 snapshots passed,
  exit 0. Existing skips: 17 suites and 32 tests. Includes the final payroll
  regression and configured stress/startup/save coverage. The known
  socialBoundaries late-import and worker-teardown notices remain. No
  `--forceExit` was added.
- `git diff --check`: clean.

Rendered tests open the existing Details section and Cash Flow entry, then
exercise updates to the real component. They mock only the state hook/avatar
boundary and use the actual income/expense readers. They prove conditional
rendering and refresh behavior, not physical layout or accessibility on iOS.
The prior local browser attempt was blocked with ERR_BLOCKED_BY_CLIENT, so no
new screenshots or native visual acceptance are claimed.

## Remaining forecast work

The repaired card is still an estimate and must not become a hard affordability
gate yet. Source inspection found two additional contracts to resolve next:

1. Real-estate income is calculated through the separate tenant/housing tick,
   while the current card still uses the older passive-income projection.
   Rental income must enter the cash and tax projection once, with the actual
   rental multiplier and caps. Incarceration also excludes company cash in the
   tick, beyond the payroll withholding already handled here.
2. Warehouse mining power is paid out of mined crypto. Its economic cost is
   currently included in the generic expense total. A wallet forecast must
   distinguish that cost from a cash debit, while financial-independence and
   net-worth views may still need the economic cost.

Then add explicit old-arrears settlement, variable-income exclusions and
upfront-action deltas before showing projected spendable cash after tuition,
housing or a new ordinary loan. Student-loan deferment remains a balance
experiment rather than an unmeasured change to the repayment contract.
