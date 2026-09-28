# Creator native keyboard and Larger Text acceptance - 27 September 2026

## Status

**UNREACHED on native.** User-reported audit count: **0**. That count is tracked separately from acceptance evidence; it does not certify a native pass or release readiness.

Candidate source: `d72505feb957a4f55d43b23f42d76479f9751b27`, package 2.15.0. No installed native build/update identity has been verified against this source. Earlier public builds must not be used to certify these local changes.

## Capability checks

- Local host: Windows/PowerShell. `xcrun`, `xcodebuild`, `idevice_id` and `adb` not present on PATH.
- Windows present-device inventory returned no iPhone, iPad or Apple Mobile device.
- Available tool inventory has no native iOS simulator/device automation provider.
- Remote Desktop Commander listed one online computer, Phantomen. A read-only `node -p "process.platform"` returned `win32` there as well.
- No native device-farm configuration was discovered among the checked environment-variable names. Values were not printed.
- Read-only Git refresh completed; draft PR #229 remains on the visual rebuild branch. No build, OTA, push, store operation or device setting was changed.

## Ready-to-run protocol

Use an isolated new-life/save slot, not an existing player save. Record device model, OS, installed version/build, development/OTA update identity and matching source. Capture actual native evidence for each case; use PASS, FAIL or UNREACHED, with a short reproduction for failures.

Start: Custom life > Food Courier > Continue To Identity. Check both Portraits and Custom. Use first name `Alex`, last name `Reed`, then a 20-character name in each field.

| Case | Required observation | Current result |
| --- | --- | --- |
| Compact iPhone, default text | Preview, category chips and Continue remain reachable; no safe-area collisions. | UNREACHED |
| First name + software keyboard | Field/caret and typed text remain visible; form scrolls without the footer covering the active field. | UNREACHED |
| Keyboard Next | One press focuses Last Name and leaves the keyboard open. Repeat after scrolling. | UNREACHED |
| Keyboard Done / drag dismissal | Done dismisses; dragging dismisses without jumping to a different choice or losing text. | UNREACHED |
| Continue while keyboard open | A single intentional tap reaches Perks, preserving typed names and selected appearance; no obscured or duplicate action. | UNREACHED |
| Return from Perks | Names, selected mode, custom features and identity selections remain intact. | UNREACHED |
| Largest standard text | Name, action labels and option labels remain readable; screen can scroll to all fields. | UNREACHED |
| Largest accessibility text | Category controls wrap with 44-point targets; two-line option labels fit their rail; screen/footer leave a usable scrolling area. | UNREACHED |
| Change text size while creator is open | Layout updates; selected appearance/name do not reset; current selection remains discoverable. | UNREACHED |
| Keyboard + largest accessibility text | Active field remains visible, Next/Done work, Continue can be reached. | UNREACHED |
| iPad portrait/landscape | Name fields share a row at ordinary size and stack at large text; no clipped footer or unsafe edges. | UNREACHED |
| iPad narrow split view / keyboard variants | Content reflows; software, floating and hardware keyboard navigation do not trap focus. | UNREACHED |
| VoiceOver | Name fields, category and option selection, portrait arrows and Continue have meaningful announcements and focus order. | UNREACHED |
| Reduced Motion | Selection/scroll/focus remains functional with reduced motion enabled. | UNREACHED |

Restore the tester's original text-size and accessibility settings after the session. Record screenshots at default and largest text, and a short native recording of keyboard Next/Done and Continue. A browser recording or CSS zoom is not a substitute.

## Independent source review

The creator has automatic keyboard insets, Next/Done handlers, a non-blurring first-name submit, wrapping action labels, a font-scale-aware two-line appearance rail, and a large-text fallback to stacked identity fields. These are implementation facts, not native acceptance results. The preceding layout pass has 59 focused tests and three-width browser evidence: [layout evidence](character-layout-2026-09-27.md). No runtime code was changed in this verification attempt and those tests were not rerun solely for documentation.

## Next dependency

Provide access to an iPhone/iPad running this candidate, or a connected Mac with an iOS Simulator and this source. A user-assisted native session can follow the table above. The setup question was sent during this task; no native case has been marked passed without that session.
