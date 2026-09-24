# Banner impression measurement — 24 September 2026

Base: `7cb9d22c79e45cde33b6276fa71414c3686cf143` (current main when checked).

## Problem and scope

The banner PAID callback reported RevenueCat ad revenue but not the separate displayed event. Two paid banner callbacks produced two revenue records and zero displayed records in the regression reproduction. This makes displayed-impression metrics incomplete; it is not evidence that historical revenue can be reconstructed or that any campaign is profitable.

Use the existing guarded lifecycle reporter to report each paid banner impression, including zero-value impressions. Reuse its newly minted impression ID for the revenue event. A refreshed banner gets a new ID. No ad frequency, player UI, purchase, consent, dependency or SDK changes.

## Evidence and acceptance

- RED: before implementation, regression expected 2 display reports and observed 0; Jest exit 1.
- GREEN in original checkout: 4 suites / 58 tests, exit 0; source type check and targeted lint exit 0.
- Isolated branch: same 4 suites / 58 tests PASS, exit 0, 131.084 seconds; source type check and targeted lint exit 0. The branch excludes unrelated local changes. Installed dependencies are shared through a local junction; source and tests come from this isolated checkout. Windows Jest expanded the dotted `.codex` root incorrectly in its default testMatch and initially found no tests; rerun used `--testMatch '**/*.test.ts'` with the same four explicit `--runTestsByPath` files. No tests or repository gates were disabled.
- Added behavioral cases: refresh IDs and revenue/display correlation; zero-value impression; display-reporter failure does not prevent revenue reporting; missing ad-unit identifier reports neither event.
- Native signed-build acceptance: UNREACHED. Must verify delivery and report behavior on the exact candidate before claiming production correction. No OTA, native build or Apple submission performed.

Reference: https://www.revenuecat.com/docs/ad-monetization/manual-integration — displayed and revenue are separate tracker methods. The pinned installed SDK exposes both methods; no upgrade was needed.

## Next acceptance

Final isolated test-tree type check: `tsc --noEmit -p tsconfig.tests.json` PASS, exit 0. Both source/test type checks and targeted lint are complete.

Inspect final-head CI, then verify a signed iOS candidate's banner callback and matching RevenueCat display/revenue records, including automatic refresh. Preserve existing consent behavior. Do not infer full native release acceptance from mocked tests. Existing R08/R09 native gates remain open.
