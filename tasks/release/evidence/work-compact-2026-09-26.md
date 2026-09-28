# Work first action — 26 September 2026

V02 presentation follow-through. Baseline `6b42e079` passed coverage, preflight and quality on draft PR #229. No changes to save schema 51, job-board ordering, eligibility, salary calculations, application actions or the approved HUD.

## Change

The lead career's original environment render now sits beside its description as a compact thumbnail instead of occupying a separate banner. It retains the shared scene's focus/background and reduced-motion behavior. Redundant “On the clock” copy is removed. Work's list aligns with the tabs and current-job card at the shared 16-point gutter, and the gap above the tabs is smaller. Salary, lock explanations, metadata disclosure and action height are preserved.

## Measured result

Isolated Tyler Nguyen fixture: age 20, $1,500, unemployed, fresh Food Courier scenario. Career board leads with the eligible Fast Food Worker at $110/week. DPR 2, reduced motion; these are browser coordinates, not signed-device evidence.

| Viewport | First enabled Apply before | After | Improvement |
|---|---|---|---|
| 375×667 | y620–664, height 44 | y540–584, height 44 | 80px higher; fully visible above bottom navigation. |
| 768×1024 | y714.5–767.5, height 53 | y618.5–671.5, height 53 | 96px higher; more of the next opportunity is visible. |

[Before/after gallery](work-compact-2026-09-26/gallery.html)

- PASS: applying to the first eligible job produces Home's Application under review state.
- PASS: expanding the lead card reveals Energy -12/week, Happiness -3 and Health -2, with Apply still reachable.
- PASS: Retail Associate remains disabled and explains its Reputation 5 requirement.
- PASS: newly employed fixture retains Manage your job; the board does not replace that control.
- PASS: 320px preview remains scrollable with Apply reachable; no document horizontal overflow in any of the five interaction cases. Zero browser page errors.
- PASS: 4 focused suites / 17 tests, 19.658 s, exit 0. Existing tests cover weekly stat labels, initial Career selection, catalogue partition and readable requirements.
- PASS: source TypeScript, exit 0. Changed-file lint, exit 0: 0 errors / 7 existing warnings. UI ratchet unchanged: 148 gradients / 94 raw font sizes / 650 heavy weights. No new dependencies or test exceptions.

## Remaining acceptance and next task

Native iPhone/iPad safe areas, Larger Text and VoiceOver remain unverified. Browser screenshots do not establish native rendering or release readiness. Full newest-commit PR checks are separate from the focused local results. No OTA, merge or signed build is authorized by this task.

Next: V03 Life density — bring the first useful activity higher while retaining readable vitals, costs and requirements. The register has 42 remaining V/A/O items after V02's implementation fix.
