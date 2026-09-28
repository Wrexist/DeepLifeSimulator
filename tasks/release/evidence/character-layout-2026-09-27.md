# Character creator layout - 27 September 2026

The user supplied the current remaining audit count of **40**. Earlier 26-item reports remain historical; no invented new findings or native acceptance closures.

## Changes

- Custom-category padding now fits eight categories in two rows at 320px, versus three in the baseline. Every category retains at least 44x44 measured targets. The swatches are visible above the fixed Continue footer in the compact capture.
- Option labels allow two lines. The rail reserves two scaled line heights, independent of category length, to retain stable layout while accommodating system font scale.
- First name uses Next to focus Last name; Last name uses Done to dismiss. The scrolling editor requests automatic iOS keyboard insets and drag dismissal. Web needs the compatible blurOnSubmit setting alongside native submitBehavior.
- Tablet name fields share one row; compact layouts and larger system text keep a vertical form. Action labels can shrink/wrap within their controls.
- Approved navy hierarchy, portraits, editable features, aging, inherited DNA, identity validation and save schema 51 retained. No dependencies or gameplay rules changed.

## Measured verification

- Final focused suite: 5 suites / 59 tests passed, exit 0, 16.532 seconds. Appearance editor, identity draft, onboarding choices, navigation copy and illustrated portrait behavior.
- Source TypeScript: exit 0. Changed-file lint: exit 0, no warnings or errors. Diff whitespace check passed.
- UI ratchet unchanged and passed: 141 gradients / 94 raw font sizes / 645 heavy weights.
- Browser 320x568, 375x667 and 768x1024: portrait arrow, custom category/option, Next-field focus, typed-name continuity and encoded custom avatar persistence to Perks passed; no page errors. Each final category measured at least 44px in both dimensions. Tablet names share a row; phone names stack.
- Earlier browser attempts exposed web blur behavior and a test selector that omitted the accessible category suffix. Final script waits for committed focus rather than sampling immediately after Enter; final run exit 0. Failed/interrupted attempts are not counted as passes.
- Full suite not repeated for this presentation-only pass. The preceding relationship pass records its full-suite timing failure and controlled baseline/current reruns separately.

[Before/after screenshot gallery](character-layout-2026-09-27/gallery.html)
[Browser measurements](character-layout-2026-09-27/results.json)

## Remaining gates and next task

Signed iPhone/iPad keyboard avoidance, VoiceOver, Larger Text at accessibility sizes, rotation and hardware-keyboard behavior remain unverified. Browser layout is not native evidence. Next concrete creator acceptance: native keyboard and text-size pass, keeping the compact controls and preserved draft.

Local branch only; no push/merge/OTA/build. Draft PR #229 still refers to remote da850215b98e3373d84642bf2bb2b2a304409de6, so those historical checks do not validate this local patch. Unrelated marketing work is preserved.
