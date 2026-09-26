# Audit follow-through - 26 September 2026

Baseline `1009ef92`; branch `codex/visual-ux-rebuild-2026-09-26`, draft PR #229. No dependency, schema, OTA or native-build changes. The runtime fixes are listed in [the implementation checklist](../../audit-fixes-2026-09-26.md).

## What changed

D01-D06 and D12 have implementation fixes. Bank also addresses its portion of D11. The register still has 51 open items, including partially completed D11; this does not imply that every remaining item is a release blocker.

Prestige now holds the save/load mutex for its protected backup, canonical reset and forced durable write. A stale queued autosave cannot restore the outgoing life. UI celebration waits for durability. A final write failure leaves the new life in memory, retains the protected outgoing backup, and presents a save-only retry. No rollback or pending-recovery schema was invented. Process termination between reset and write still requires native acceptance; the previous on-disk life and its backup are the fallback until the new life is saved.

Bank amounts are parsed as complete values, with comma thousands and period decimals. Confirmation displays/announces the exact amount, invalid values cannot submit, presets meet minimum height, and reduced motion disables modal fading. FIRE uses weeks played in this life and describes its assumptions; the compact layout keeps estimates readable. Profile's collapsed and expanded week counts agree. Campaign UI acknowledges its receipt only after commit and avoids false success on concurrent cash, energy or company changes.

## Verification

- Focused prestige/provider and same-handler persistence: 2 suites / 10 tests passed, exit 0.
- Focused amount entry, FIRE and campaign energy: 3 suites / 30 tests passed, exit 0.
- Prestige save/retry UI: 1 suite / 1 test passed, exit 0.
- Campaign UI races: success, money loss, energy loss, sold company and duplicate taps are covered by 4 tests in the full run.
- Final focused run after UI corrections: 6 suites / 40 tests, exit 0, 17.587 s. Full-suite and final preflight results are pending completion below.
- Browser: grouped `1,000` deposits exactly $1,000; invalid `1,00` is visibly rejected with confirmation disabled. Profile displays `Age 20 - 0 weeks` (typographic separator in UI). Planning assumptions and estimate labels are visible at 375px. Tablet invalid-input capture at 768px.
- [Screenshots](audit-fixes-2026-09-26/gallery.html) and [browser results](audit-fixes-2026-09-26/browser-fixes.json).

The first local full run was interrupted after it discovered prior scratch reproductions that deliberately asserted the original defects. Those reproductions remain archived as `.test.ts.txt`; maintained regression tests replace them. The first preflight exited 1 on optional prestige data in the new test fixture; the fixture was corrected without changing floors. Initial browser captures also caught an intermediate amount-formatting edit and crowded FIRE labels; both were corrected before the final screenshots. These intermediate runs are not passes.

## Still unverified

Signed iPhone/iPad rendering; native keyboard and Larger Text; VoiceOver focus and announcements; background/kill/relaunch while prestige is saving; old-installed saves; real StoreKit restore/interrupted fulfillment, ads and cloud providers. Existing native audio packages still need their separately authorized signed binary. No production action was taken.

Next: D07 avatar identity, then D08-D11 accessible controls and D13-D14 display labels. All V, A and O items remain tracked in [the original register](../../whole-app-audit-2026-09-26.md).
