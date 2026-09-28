# A09 Businesses lifecycle - 27 September 2026

[Actual phone/tablet screenshot gallery](business-lifecycle-2026-09-27/gallery.html)

## Changes

- Founding, hiring, firing, IPO and acquisition feedback now waits for the resulting state before saving/celebrating or navigating. Immediate refs prevent duplicate submissions while React commits. Declined interviews are also saved, preserving their energy cost and candidate removal.
- Salary and sign-on bonus sliders retain cents through the canonical parser instead of truncating with parseInt. Hiring shows interview energy, weekly salary and one-time bonus, the final offer near Send, and actionable cash/energy/headcount requirements. Interest copy reflects the actual guaranteed/possible/refused score bands.
- Named-hire dismissal asks for confirmation with four weeks' severance and the reputation effect. Generic staff removal cannot bypass that dismissal or leave a named roster larger than headcount. Generic add/remove finds the company by ID in fresh state, protecting reordered/removed companies.
- IPO preview, entry-point eligibility and execution share quoteIPO. The commit rechecks company existence, revenue, scandal, listing status, float bounds, valuation and available cash capacity. Invalid/rejected IPOs cannot change ownership or grant proceeds. Earnings timing is life-relative or a countdown, not an absolute age-seeded week.
- Acquisitions validate a finite positive asking price, use the still-pending fresh offer and require an existing owner company. They preserve the original revenue/synergy/price formulas and atomic money/reputation grant.
- Sale wording now accurately describes half the current base/upgrade valuation, rather than promising half of historical spending. Named versus generic hiring costs are distinguished.
- No simulation rates, artwork, dependencies, persistence schema or save migration changed. STATE_VERSION remains 51. The existing acquisition absorbs revenue into the buyer; there is no separate merger feature to invent in this audit. Existing company sale is the exit path inspected.

## Verification

- Focused business batch: 18 suites / 191 cases exercised. Initially six acquisition cases failed because two old fixtures had no owning company; adding real company records preserved their original cash, reputation, synergy and duplicate-charge assertions. All 16 cases in those two suites then passed, exit 0 (22.721s).
- Final transaction/feedback rerun: 2 suites / 39 tests passed, exit 0 (16.068s), including three new generic staff regressions and two founding commit/race checks. Earlier 3-suite feedback/canonical-week rerun: 14 tests passed, exit 0 (40.294s). These overlap the broader batch; they are not additive totals.
- Declined-interview UI regression also passed: 12 feedback tests, exit 0 (36.207s); it proves the energy debit/candidate removal is saved without charging a bonus.
- Real Next Week payroll differential test: increasing a named salary by $100 changes committed cash by exactly $100, proving one charge through the canonical simulation. Existing researchWeeklyTick verifies research advances once per week and retains results across hydrated save continuation.
- Full suite completed with failure: 854 suites passed, 3 failed, 17 skipped; 10,209 tests passed, 5 failed, 32 skipped; all 308 snapshots passed; 617.917s. Exit 1. No test skip configuration or performance/coverage floor changed.
- Full-run failures: timing projected 1,222.52ms versus the unchanged 1,000ms limit; PoliticalApp's three render cases hit AmountSlider because the shared RN test mock lacked PanResponder; one banking source assertion required style to be the first JSX prop despite the actual flexShrink/height constraints remaining present.
- Corrected the shared RN mock to retain gesture callbacks and made the source assertion independent of JSX prop order. Existing shrinking, height-bound, full-product-list and political Career assertions are retained. Final unredirected rerun: 4 suites / 32 tests passed, exit 0, 22.615s. Projected 52-week timing was 734ms, below the unchanged 1,000ms limit. See rerun-summary.json.
- The original full run remains a failure; targeted reruns do not constitute a single clean full-suite pass. Clean final-commit CI and signed-device timing remain release gates.
- Final source and test-project TypeScript passed, exit 0. Changed-file lint passed with zero errors and one pre-existing unused effectiveMultiplier warning in company.ts. New business components/tests have no lint warnings.
- UI ratchet passed unchanged: 141 gradients / 94 raw sizes / 645 heavy weights. Diff whitespace check passed.
- Final browser journeys passed at 375x667 and 768x1024, DPR 2, reduced motion, exit 0, zero page errors. Found a company for the quoted $50,000; launch a campaign and verify $1,000 up front; build lab/start research; advance the real HUD Next Week; verify research progress and campaign continuity; cancel/confirm sale; reload and verify removal. See founding-results.json.
- Mature-company journeys passed at both widths: hire, verify general Remove is disabled for an all-named team, cancel/confirm $8,000 severance, launch 25% IPO and verify 75% ownership, buy an acquisition and verify $200,000 debit/$1,000 base weekly revenue gain, then reload. See mature-results.json.
- Low-resource journeys passed at both widths: $0 blocks generic hiring/acquisition, zero energy disables Send with a five-energy explanation, and $5,000 weekly revenue blocks IPO with the canonical requirement. See low-resources-results.json.
- Final screenshots inspected: offer recap remains near Send, the settled severance dialog is readable, and IPO uses a 12-week countdown. Native/device behavior remains unverified.

## Audit trail and limitations

- An isolated diagnostic confirmed `AmountSlider.tsx` failed on the absent mock `PanResponder.create`; the failing diagnostic left handles open and was stopped after capturing the cause (not counted as a pass). A redirected rerun reported all 32 tests passing and 697ms timing, but PowerShell returned an error status for redirected stderr; the final unredirected rerun completed with exit 0 and 734ms timing.
- A first full run was deliberately interrupted after the later generic-staff defect was found; it is not a pass. The full suite was restarted with all transaction fixes integrated.
- An initial component-test mock incorrectly requested actual native modules; replaced it with the project's existing React Native mock plus PanResponder. Initial browser acquisition navigation used the modal title instead of the action label and misread an absent web aria-expanded attribute; the harness now uses the actual visible action. No assertions about successful transactions were removed.
- Alert screenshots wait for the presentation animation to settle. Only isolated synthetic browser saves were used; user saves were not modified.
- Native iPhone/iPad VoiceOver, Larger Text, nested modal priority, reduced-motion behavior on device, old-save and background/kill/relaunch remain open. Further family-business succession, long-running multi-company/scandal/IPO-quarter permutations and provider/device acceptance remain release gates. Browser save/reopen is not native interruption evidence.
- 26 acceptance/operational audit items remain open. Next independent task: A10 Relationships and family.
- Git refreshed: origin/main 9e729ac2; draft PR 229 remote head da850215. Existing remote coverage/quality/preflight passes predate these local changes; the update job is the previously cancelled failure. No push, merge, OTA, paid build or release performed.
