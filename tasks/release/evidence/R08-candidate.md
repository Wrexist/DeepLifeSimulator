# R08 - Signed release candidate: 2.15.1 (190)

Recorded 2026-10-05. All values below were observed, not assumed. No secrets.

| Field | Value | Evidence |
|---|---|---|
| Source SHA | `0d014ffe20c724d15881ad672525d06873b00c49` (merge of PR #231 into `main`) | Actions run head SHA |
| App source at `main` HEAD | identical to the build SHA. The only later commit, `0943d971`, touches `discord/state/last-notified-pr.json` | `git diff --stat 0d014ffe 0943d971` |
| Binary version | **2.15.1** (`package.json`; app config resolved `"version": "2.15.1"` in the build log) | build-ios log |
| CFBundleVersion | **190** (minted by `scripts/next-build-number.mjs`) | build-ios log, `BUILD_NUMBER: 190` |
| Build profile | `production` (`--profile production`) | build-ios log |
| Schema | `STATE_VERSION = 52` | `contexts/game/initialState.ts` |
| Store record | 1.6.0 (unchanged; binary and store numbers are deliberately different, CLAUDE.md §9) | `marketing/aso/metadata.mjs` |
| Workflow | `eas-build-local-ios.yml`, run [37273628059](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/37273628059), dispatched with `version=2.15.1 submit=true wait_for_submission=true` | Actions |
| Jobs | verify: success · build-ios: success · submit-ios: success | Actions |
| Production preflight | verify job "Preflight (production config)": **ALL PREFLIGHT CHECKS PASSED** (baseline `eas.json build.production.env`) | verify log |
| Local preflight | `npm run preflight` exit 0 on the PR #231 head | PR #231 |
| PR #231 checks | preflight, quality, coverage, update: all pass | PR #231 |
| Commit checks on `0d014ffe` | update, verify, build-ios, submit-ios, GitHub activity: success. **Store release watcher: failure**, unrelated to the build: the Discord webhook returns 404 "Unknown Webhook" and has failed every scheduled run since at least 2026-10-03 | `gh run view 37273558371` |
| iOS export | `npx expo export --platform ios` on `0943d971` (same app source): **exit 0**, Hermes bundle `entry-f932978a….hbc` 13.8 MB | local run 2026-10-05 |
| Upload | EAS submission `11c5def9-f796-41b6-9f4a-de1eae65eb24` FINISHED in 2m38s: "App Store Connect accepted the upload" | submit-ios log |
| TestFlight processing | **PENDING owner confirmation.** The upload being accepted does not prove it processed; Apple can still return Invalid Binary | owner to confirm |

## What this candidate contains that 2.15.0 (875b63a2, build on run 36352338525) does not

- #230: DeepLife+ subscribers no longer see ads; Remove Ads re-asserted on every save, restore and new life; lapsed-subscriber hold (v52 `settings.adsRemovedHeldForPlus`); one-time DeepLife+ welcome gems; play streak counts real days; NaN cash guard; sweep fixes (double taps, heir parents, Time Machine crypto carry-over, Athlete's Journey, career experience).
- `7e713409`: gem wallet and contextual Work artwork.

## To verify (close R08)

1. Owner confirms 2.15.1 (190) shows **processed / Ready to Test** in TestFlight, not Invalid Binary.
2. Then freeze this identity for R06 (purchases) and R09 (device/accessibility). Any app or native code change after `0d014ffe` makes a new candidate and repeats the affected acceptance.
