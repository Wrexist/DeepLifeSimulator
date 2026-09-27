# TestFlight 2.15.0 - 27 September 2026

Authorization: user requested all current work uploaded to GitHub, then the next local TestFlight build at version 2.15.0. Use the repository macOS local-build workflow, production signing and TestFlight submission; no main merge, production OTA or App Store review submission.

- [x] Inspect current version, local-build workflow, Git state and prior build outcome.
- [x] Commit remaining marketing notes/screenshots and upload the review branch. Candidate: `875b63a2ea32f0863b18c1a82c36dd700ef8f4e1`; draft PR #229.
- [x] Pass current preflight and full candidate tests; inspect latest branch checks.
- [x] Dispatch eas-build-local-ios.yml on the uploaded candidate with version=2.15.0, submit=true, wait_for_submission=true.
- [x] Verify run identity and report build/submission status with a monitoring link.

Package and changelog already use 2.15.0. app.config.js reads package version; workflow computes a fresh CFBundleVersion from ASC or epoch fallback. Earlier run 36190564705 compiled successfully but its submission watcher timed out while EAS was still IN_QUEUE; that is not evidence of an Apple rejection. Local ASC credentials are unavailable; the workflow uses repository/EAS credentials. Native creator acceptance follows installation of the new candidate.

## Candidate checks

- GitHub preflight 36351323876 and quality 36351323875: completed successfully on candidate 875b63a2.
- Preview workflow 36351323892: completed successfully, including app export and full tests. 859 suites passed / 17 skipped; 10,229 tests passed / 32 skipped; 308 snapshots passed. Jest time: 347.206 seconds.
- Redundant local preflight was interrupted during lint after static checks passed; redundant local full suite was interrupted after remote full tests passed. Both local processes exited 1 from interruption, not recorded as completed passes.
- Coverage run 36351323872 completed successfully: 62.22% statements, 45.20% branches, 54.45% functions, 63.61% lines. All existing floors passed; same 859 suites / 10,229 tests / 308 snapshots passed.

## Build started

[Run 36352338525](https://github.com/Wrexist/DeepLifeSimulator/actions/runs/36352338525) was dispatched successfully with version=2.15.0, submit=true and wait_for_submission=true. Verified head SHA: 875b63a2ea32f0863b18c1a82c36dd700ef8f4e1. At handoff the verify job is in progress; macOS local compilation, EAS submission and Apple processing are still pending. This documentation-only follow-up does not change the pinned binary candidate.

Next: monitor verification, macOS compilation and submission; confirm Apple processing before calling the build available in TestFlight. Then run the creator native keyboard/Larger Text protocol on the user's iPhone/iPad. StoreKit, ads and other exact-binary release gates remain separate; no release-ready claim is made.
