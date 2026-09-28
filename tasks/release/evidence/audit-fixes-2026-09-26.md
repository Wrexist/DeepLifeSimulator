# Audit follow-through - 26 September 2026

Baseline `1009ef92`; branch `codex/visual-ux-rebuild-2026-09-26`, draft PR #229. No dependency, schema, OTA or native-build changes. The runtime fixes are listed in [the implementation checklist](../../audit-fixes-2026-09-26.md).

## What changed

D01-D08 and D10-D12 have implementation fixes. Family addresses part of D09; its HUD gem-plus target remains open. The register still has 47 open items, including partially completed D09; this does not imply that every remaining item is a release blocker.

Prestige now holds the save/load mutex for its protected backup, canonical reset and forced durable write. A stale queued autosave cannot restore the outgoing life. UI celebration waits for durability. A final write failure leaves the new life in memory, retains the protected outgoing backup, and presents a save-only retry. No rollback or pending-recovery schema was invented. Process termination between reset and write still requires native acceptance; the previous on-disk life and its backup are the fallback until the new life is saved.

Bank amounts are parsed as complete values, with comma thousands and period decimals. Confirmation displays/announces the exact amount, invalid values cannot submit, presets meet minimum height, and reduced motion disables modal fading. FIRE uses weeks played in this life and describes its assumptions; the compact layout keeps estimates readable. Profile's collapsed and expanded week counts agree. Campaign UI acknowledges its receipt only after commit and avoids false success on concurrent cash, energy or company changes.

## Verification

- Focused prestige/provider and same-handler persistence: 2 suites / 10 tests passed, exit 0.
- Focused amount entry, FIRE and campaign energy: 3 suites / 30 tests passed, exit 0.
- Prestige save/retry UI: 1 suite / 1 test passed, exit 0.
- Campaign UI races: success, money loss, energy loss, sold company and duplicate taps are covered by 4 tests in the full run.
- Post-review save/lifecycle run: 3 suites / 27 tests passed, exit 0, including reset/heir/revive sequencing and provider unmount while backup owns the mutex. Existing lifecycle tests now await the asynchronous durable result.
- Final focused run after UI corrections: 6 suites / 40 tests, exit 0, 17.587 s. Local preflight completed with exit 0 (0 type errors, 0 lint errors / 698 warnings, UI ratchets unchanged). A subsequent mounted-provider guard is covered by the 27-test run and final CI. Full-suite CI on `678aa513` passed: **826 suites / 10,047 tests / 308 snapshots**, 617.949 s, exit 0. Existing opt-in skips: 17 suites / 32 tests. Coverage: 60.92% statements, 43.41% branches, 52.80% functions, 62.30% lines; no metric regressed. CI preflight and quality passed. [Coverage run](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/36259783647).
- Browser: grouped `1,000` deposits exactly $1,000; invalid `1,00` is visibly rejected with confirmation disabled. Profile displays `Age 20 - 0 weeks` (typographic separator in UI). Planning assumptions and estimate labels are visible at 375px. Tablet invalid-input capture at 768px.
- [Screenshots](audit-fixes-2026-09-26/gallery.html) and [browser results](audit-fixes-2026-09-26/browser-fixes.json).

The first local full run was interrupted after it discovered prior scratch reproductions that deliberately asserted the original defects. Those reproductions remain archived as `.test.ts.txt`; maintained regression tests replace them. The first preflight exited 1 on optional prestige data in the new test fixture; the fixture was corrected without changing floors. Initial browser captures also caught an intermediate amount-formatting edit and crowded FIRE labels; both were corrected before the final screenshots. The local broad run then completed its assertions with 3 failed suites / 9 failed tests: two suites had cached the intermediate amount-formatting module and the lifecycle suite expected synchronous prestige. The process retained pending old-style prestige calls and was stopped with exit 1; it is not a pass. Fresh runs of amount entry and PoliticalApp passed, the lifecycle tests now await durability, and the newly added unmount regression confirms mutex release. Final clean CI is the full-suite acceptance gate.

## Still unverified

Signed iPhone/iPad rendering; native keyboard and Larger Text; VoiceOver focus and announcements; background/kill/relaunch while prestige is saving; old-installed saves; real StoreKit restore/interrupted fulfillment, ads and cloud providers. Existing native audio packages still need their separately authorized signed binary. No production action was taken. PR publishing workflow 36259508973 was cancelled before its preview update step; separate validation continues.

Next: finish D09 HUD gem-plus hit area, then D13-D14 display labels. All V, A and O items remain tracked in [the original register](../../whole-app-audit-2026-09-26.md).


## Additional presentation follow-through

After the save/finance revision passed its full suite, an isolated UI follow-through closed D07, D08, D10 and the remaining D11 work:

- Pulse passes the canonical profile and age to stories, composer, profile, player posts, comments and post details. Uploaded photos retain their error/retry handling and fall back to the stored portrait/config. Header photo precedence agrees with the other player surfaces.
- Education uses canonical action fills: white on cash green is 5.48:1 (previously 2.54:1), and white on loan blue is 5.73:1. These are enabled-control measurements; disabled text is not claimed to meet normal-text contrast.
- Locked segments with an explanation handler announce an operable control; locked segments without a handler are disabled. Enrollment follows changing reduced-motion preferences.
- Family measures 81.8 x 44 CSS px at 375px viewport. The gem-plus target is intentionally still tracked as unfinished D09. Physical native hit-testing remains open.
- Source types, changed-file lint (0 errors, 6 existing warnings), UI ratchets and browser captures pass. Final focused UI run: 4 suites / 26 tests passed, exit 0, 18.507 s. Source and test-tree types pass with 0 errors. The full-suite result above validates the preceding save/finance revision; it is not presented as an exact-head full run for these later UI changes.
- An initial avatar test looked for a memo wrapper that React's test renderer does not expose. It now verifies the actual selected portrait image after a failed photo and checks URI replacement; the corrected test passes without changing app behavior.

Both preview-publishing workflow runs 36259508973 and 36259783747 were cancelled before publication. Validation workflows ran separately. No native build or production update was dispatched.
