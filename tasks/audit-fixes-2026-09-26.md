# Audit fixes - 26 September 2026

- [x] D01: serialize prestige backup/write; durable outcome, retry-only-save UI and provider races.
- [x] D05/D06: strict amount parsing and accessible amount confirmation.
- [x] D02/D04/D12: life-relative planning/summary and honest estimate labels.
- [x] D03: acknowledge committed campaign outcome.
- [ ] Run focused regressions, integration/full suite and preflight; capture changed UI.
- [ ] Update audit/todo/evidence and reviewable PR; no production deployment.

## Implementation

- D01: prestige acquires the owning save/load mutex, backs up the outgoing in-memory life, revalidates state and selected slot, commits the canonical prestige result, and awaits a rejecting durable write. Duplicate submissions are blocked. Queued autosaves reread state after acquiring ownership so they cannot restore the outgoing life. No save schema change.
- If the backup fails, the outgoing life stays active. If the final write fails, the new life stays in memory and the protected outgoing backup remains available; the modal offers a save-only retry and withholds celebration. This is not proof of OS-kill recovery at every instruction boundary; native acceptance remains open.
- D05/D06: full-string amount parsing supports comma thousands and period decimals; invalid tails/grouping are rejected. Empty input cannot clear a budget. Confirmation displays and announces the exact amount. Presets have button semantics and minimum target height, and the dialog respects reduced motion (the Bank portion of D11).
- D02/D04/D12: FIRE uses elapsed weeks in the current life, Profile summary matches its expanded count, and planning explicitly labels estimates and their expense/savings assumptions. Retirement eligibility, expense rules and weekly simulation are unchanged.
- D03: campaign launch returns a queued receipt ID. UI success, save and field clearing follow its committed presence. Cash/energy/company races reject without success feedback or charges. Duplicate taps and invalid duration/spend are guarded.

## Remaining work

Continue with D07 avatar identity, D08 enrollment contrast, D09 target sizes, D10 locked-control semantics and the remaining enrollment portion of D11. Then D13 historical week labels, D14 career requirement names, V01-V18 presentation work, A01-A22 acceptance cases and O01-O04 maintenance in the [full register](whole-app-audit-2026-09-26.md).

Browser screenshots and verification results: [fix evidence](release/evidence/audit-fixes-2026-09-26.md).
