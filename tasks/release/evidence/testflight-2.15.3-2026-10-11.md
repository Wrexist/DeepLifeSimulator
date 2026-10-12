# Internal TestFlight candidate: 2.15.3 (192)

Recorded 11 October 2026. Internal QA upload from the open PR branch, not a public release.

| Field | Value | Evidence |
|---|---|---|
| Source | `9238d19b` (`release/artwork-testflight-2.15.2`, PR #233) | [PR #233](https://github.com/Wrexist/DeepLifeSimulator/pull/233) |
| Binary version | **2.15.3** | `package.json`, workflow input |
| CFBundleVersion | **192** | Workflow queried App Store Connect: highest existing build 191; resolved 192 |
| Profile / schema | `production` / `STATE_VERSION = 53` | Source (v53 reprices diet plans) |
| GitHub workflow | [Run 38109492651](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/38109492651), `eas-build-local-ios.yml` | `version=2.15.3`, `submit=true`, `wait_for_submission=true` |
| Workflow jobs | verify: success; build-ios: success; submit-ios: success | GitHub Actions run |
| Submission | EAS submission `2170df43-0254-4533-85e9-eec539cb2421` finished in 2m09s; App Store Connect accepted the upload | [EAS submission](https://expo.dev/accounts/isacm/projects/deeplife-simulator/submissions/2170df43-0254-4533-85e9-eec539cb2421) |
| Local validation | `npm run preflight` exit 0; full Jest 871 suites, 10,291 passed, 32 skipped | Local run, 11 October 2026 |
| Earlier attempt | Run 38108725107 failed in verify: no What's New entry for 2.15.3. Fixed in `9238d19b`; no binary was built | GitHub Actions run |
| Apple processing | **Not verified.** Upload acceptance is not proof that processing reached `VALID`. | - |

## Remaining acceptance

Confirm build 192 reaches `VALID` in App Store Connect, then on device: go live in Streaming and confirm the timer, energy and viewers move; open Life Skills and confirm nothing drifts and a skill spends points.
