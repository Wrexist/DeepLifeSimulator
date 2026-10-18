# Internal TestFlight candidate: 2.16.0 (196)

Recorded 18 October 2026. Built from `main` on the owner's "build it".

| Field | Value | Evidence |
|---|---|---|
| Source | `6faafc33` (`main`, carries PRs #237-#241) | [PR #241](https://github.com/Wrexist/DeepLifeSimulator/pull/241) |
| Binary version / build | **2.16.0 (196)** | Workflow resolved 196 from App Store Connect (highest was 195) |
| Profile / schema | `production` / `STATE_VERSION = 55` | Source |
| GitHub workflow | [Run 39132650500](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/39132650500) | verify, build-ios, submit-ios: success |
| Submission | `1e07cc8f-84c9-43dd-ad0c-ce7530b38f36`, App Store Connect accepted the upload | [EAS submission](https://expo.dev/accounts/isacm/projects/deeplife-simulator/submissions/1e07cc8f-84c9-43dd-ad0c-ce7530b38f36) |
| Local validation | `npm run preflight` exit 0 (warnings: EAS-store secrets not verifiable locally, no standard iOS interstitial by design, 39 unreferenced images); full Jest 932 suites / 11,067 passed on the #241 tree | Local run |
| Apple processing | **Not verified.** App Store Connect needs the owner's login. | - |

## What to verify on device

1. Ads: the year-end break (opt-out rewarded interstitial, +15 gems, from the second in-game year), the daily reward doubler, and "Watch ad" finding an ad.
2. Perks screen: each Mindset card shows its tagline plus green upside and amber downside lines; the Identity card shows the active Mindset.
3. Prestige: the points breakdown shows an "Achievement Hunter" line when that bonus is owned.
4. A save from 2.15.x loads (v54 -> v55) with nothing lost.
