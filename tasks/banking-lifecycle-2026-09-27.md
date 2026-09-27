# A06 Banking lifecycle - 27 September 2026

- [x] Read canonical state, banking actions, shared controls and approved presentation baseline; refresh Git/PR evidence.
- [x] Fix confirmed transfer precision/minimum-balance issues in shared controls and Bank/Bank Pro.
- [x] Prevent account withdrawal/closure and reward redemption from losing value at the cash ceiling.
- [x] Run banking/loan/card/bill/budget/tax regressions, source/test types and full suite after financial changes.
- [x] Capture compact phone/tablet banking interactions and record remaining native acceptance.
- [x] Update audit register/evidence and commit locally without publishing.

No schema, interest-rate, repayment or credit-score policy changes planned.

User addition: restyle shared notifications as navy game cards, correct web font fallback, preserve actions/dismissal/reduced motion and prevent wrapped-message overlap.

Verification: 267 focused tests passed; full run completed with 847 passing/3 failing suites, then all three failures passed on isolated rerun (17 tests). Clean final-commit CI and signed native acceptance remain open.
