# Market/inventory and equipment - 27 September 2026

[Screenshot gallery](market-equipment-2026-09-27/gallery.html) - [Browser results](market-equipment-2026-09-27/results.json)

## Changes

- Owned equipment keeps its feature guidance and is explicitly labelled Owned instead of presenting a purchase price alongside Sell.
- Unaffordable Market items state the cash shortfall.
- Gym membership and passport sales now require confirmation, explaining loss of workouts/weekly benefits or international-travel booking access. Cancellation changes nothing.
- Market sale labels, confirmation amounts and feedback use ITEM_SELL_RATE, matching the existing canonical sale action instead of repeating a separate literal.
- Streaming accessories and PC upgrades now disable unaffordable actions, show missing cash and expose disabled accessibility state. Exactly affordable equipment remains purchasable; owned/max-tier states remain distinct.

Schema 51, transaction implementations, prices, resale rate, progression and save logic are unchanged. Approved Market/creator layouts remain intact.

## Verification

- 3 focused suites / 28 tests passed, exit 0, 48.897s: new Market/gear render interactions, existing same-batch buy/sell guards, real provider item/gold-upgrade lifecycle and mixed weekly ticks.
- 3 further focused suites / 19 tests passed, exit 0, 39.59s: creator progression/live sessions/PC cap, composer and shop price labels. Total 47 distinct tests.
- Source and test TypeScript passed, exit 0. Changed-file lint: exit 0, zero errors and four pre-existing Market warnings. UI ratchet unchanged: 142 gradients / 94 raw font sizes / 645 heavy weights. Diff check passed.
- Browser 375x667 and 768x1024, DPR 2, reduced motion, isolated QA saves: buy gym membership -> cancel sale -> confirm sale -> rebuy -> canonical Next Week autosave -> reopen -> ownership retained. Zero page errors.
- Both widths: open Streaming with $0, select Shop, verify microphone is disabled; zero page errors. Screenshots reviewed.
- Initial browser reload script incorrectly required a Continue button after refreshing a game route. The final run allows either menu continuation or already-restored navigation and passed at both sizes. An intermediate run was interrupted while correcting this assumption; it is not counted as a pass.

## Remaining acceptance

A05 stays open for signed iPhone/iPad, VoiceOver/Larger Text, native modal handoff, background/kill/relaunch during transactions, all item/discount/equipment permutations and full phone/computer resale/rebuy with each app's persisted data. The gym browser round trip does not substitute for every device/equipment permutation. Unit coverage verifies device flags and duplicate guards but not native lifecycle behavior.

No full suite rerun for this presentation-only patch; earlier PR coverage/quality/preflight passed on the prior head and are not claimed for this patch. The previously cancelled EAS Update check is unrelated to source verification. Local branch only; no push, merge, OTA or paid build.

26 acceptance/operational items remain. Next independent task: A06 Full banking lifecycle.
