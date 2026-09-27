# Weekly-loop interaction ? 27 September 2026

[Phone/tablet screenshots](weekly-loop-2026-09-27/gallery.html) ? [Browser measurements](weekly-loop-2026-09-27/results.json)

## Changes

- A synchronous HUD guard owns the press before React paints disabled, preventing two queued frame callbacks from rapid taps.
- Removed the five-second UI unlock: a slow transition remains busy until canonical progression settles. No second simulation or save formula was introduced.
- Annual ad eligibility uses the committed week and current ad entitlement/life-relative clock. No-op/failed transitions do not invent progress. Pending modal decisions join death, wedding, jail and life-moment suppression; mail can still wait.
- Queued frames cancel on HUD unmount; an in-flight completion cannot show an ad after leaving. One lifecycle cleanup replaces accumulating per-press cleanup registrations.
- Unexpected rejection is handled through existing error presentation and releases the button. Busy accessibility state is explicit; reduced motion disables the loading spin.

Approved HUD layout, canonical simulation, recap accounting, save ownership and schema 51 are unchanged. Source changes are confined to TopStatsBar.

## Measured verification

- 12 focused suites: 63 tests passed, exit 0, 81.991s. Covers the HUD, real canonical tick abort/recovery, partial saves, recap cash/expenses/transfers, event routing, interstitial cadence, save completion and replay lock timeout.
- Final HUD suite, including the added reduced-motion case: 7 tests passed, exit 0, 45.321s. 64 distinct tests across the two runs; do not add overlapping tests twice.
- Source and test-project TypeScript: exit 0.
- Changed-file lint: exit 0, zero errors, four pre-existing HUD warnings. UI ratchet unchanged: 142 gradients / 94 raw font sizes / 645 heavy weights. Diff check passed.
- Browser 375x667 and 768x1024, DPR 2, reduced motion, isolated QA saves: immediate double click advanced persisted weeksLived 104 -> 105, exactly once; control returned enabled. Zero page errors. Screenshots inspected at both sizes.
- Initial browser attempt failed because Metro was stopped; restarting Metro resolved it. Initial implementation/test iterations exposed an incorrect error-hook name and leftover timer cleanup; corrected before the passing runs.

## Remaining acceptance and handoff

A03 remains open for signed iPhone/iPad native ad presentation, VoiceOver/Larger Text, slow storage/quota recovery, background/kill/relaunch, old-save combinations and annual-transition/event-priority permutations. Automated ad tests cannot prove SDK modal behavior. Current controls intentionally remain busy if the underlying action never settles; recovering a truly hung native action requires separate runtime diagnosis, not allowing duplicate work.

No full suite was rerun for this HUD-only change; the previous full CI pass belongs to the career commit and is not claimed for this patch. Draft PR229 remains at its prior head until these local changes are pushed. No merge, OTA, paid build or native acceptance performed.

26 acceptance/operational items remain open. Next independent task: A04 Health and low-cash recovery.
