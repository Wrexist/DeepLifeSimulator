# Internal TestFlight candidate: 2.15.4 (193)

Recorded 11 October 2026. Internal QA upload from the open PR branch, not a public release.

| Field | Value | Evidence |
|---|---|---|
| Source | `cbc16ed7` (`release/artwork-testflight-2.15.2`, PR #233) | [PR #233](https://github.com/Wrexist/DeepLifeSimulator/pull/233) |
| Binary version / build | **2.15.4 (193)** | Workflow resolved 193 from App Store Connect |
| Profile / schema | `production` / `STATE_VERSION = 53` | Source |
| GitHub workflow | [Run 38137834634](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/38137834634) | verify, build-ios, submit-ios: success |
| Submission | `3dfc40ad-1d87-4a98-8ced-be3f3634d989`, App Store Connect accepted the upload | [EAS submission](https://expo.dev/accounts/isacm/projects/deeplife-simulator/submissions/3dfc40ad-1d87-4a98-8ced-be3f3634d989) |
| Local validation | `npm run preflight` exit 0; full Jest 873 suites, 10,298 passed | Local run |
| Apple processing | **Not verified.** | - |

## What to verify on device

Stream recap card after Stop and after running out of energy; Life Skills unlocks from the panel button only; locked apps visible with progress line and three-route explanation; phone launcher shows "Computer apps" as Needs a Computer.
