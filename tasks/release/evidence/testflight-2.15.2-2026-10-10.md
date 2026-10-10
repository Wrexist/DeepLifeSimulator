# Internal TestFlight candidate: 2.15.2 (191)

Recorded 10 October 2026. This is an internal QA upload from an open PR branch, not a public release.

| Field | Value | Evidence |
|---|---|---|
| Source | `680a7a51c7bbc4a231c10116ebbc7351e7b568cf` (`release/artwork-testflight-2.15.2`, PR #233) | [PR #233](https://github.com/Wrexist/DeepLifeSimulator/pull/233) |
| Binary version | **2.15.2** | Workflow input and build log |
| CFBundleVersion | **191** | Workflow queried App Store Connect: highest existing build was 190; resolved 191 |
| Profile / schema | `production` / `STATE_VERSION = 52` | Workflow and source |
| GitHub workflow | [Run 38056456464](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/38056456464), `eas-build-local-ios.yml` | `version=2.15.2`, `submit=true`, `wait_for_submission=true` |
| Workflow jobs | verify: success; build-ios: success; submit-ios: success | GitHub Actions run |
| Production verification | GitHub verification job passed, including production-config preflight and full tests | Run 38056456464 |
| Build | macOS local build succeeded; IPA artifact uploaded (68,031,690 bytes) | build-ios log |
| Submission | EAS submission `f424a7a6-7e62-4261-9acc-60809e0f59bc` finished in 2m07s; App Store Connect accepted the upload | submit-ios log and [EAS submission](https://expo.dev/accounts/isacm/projects/deeplife-simulator/submissions/f424a7a6-7e62-4261-9acc-60809e0f59bc) |
| PR checks | coverage, preflight, quality and update: all passed on `680a7a51` | [PR #233](https://github.com/Wrexist/DeepLifeSimulator/pull/233) |
| Local validation | `npm run preflight`, `npm test -- --ci` (865 suites, 10,274 passed, 32 skipped), and `node ./node_modules/expo/bin/cli export --platform ios` all exited 0 | Local run, 10 October 2026 |
| Apple processing | **Not verified.** App Store Connect redirected to login in this session. Upload acceptance is not proof that processing reached `VALID`. | Read-only browser attempt; no authenticated ASC session available |

## Scope and remaining acceptance

This build is from PR #233 and is not merged to `main`. No production OTA or public App Store release was triggered. Keep the prior R08 evidence for 2.15.1 (190) as the historical identity of that older candidate; do not treat it as validation of this source.

Next, confirm build 191 reaches `VALID` in App Store Connect. Then run the R06 purchase/fulfillment cases and R09 device/accessibility matrix on this exact signed build. Until those cases pass, the release queue remains on hold.
