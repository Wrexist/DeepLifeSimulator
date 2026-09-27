# TestFlight 2.15.0 - 27 September 2026

Authorization: user requested all current work uploaded to GitHub, then the next local TestFlight build at version 2.15.0. Use the repository macOS local-build workflow, production signing and TestFlight submission; no main merge, production OTA or App Store review submission.

- [x] Inspect current version, local-build workflow, Git state and prior build outcome.
- [ ] Commit remaining marketing notes/screenshots and upload the review branch.
- [ ] Pass current preflight and full candidate tests; inspect latest branch checks.
- [ ] Dispatch eas-build-local-ios.yml on the uploaded candidate with version=2.15.0, submit=true, wait_for_submission=true.
- [ ] Verify run identity and report build/submission status with a monitoring link.

Package and changelog already use 2.15.0. app.config.js reads package version; workflow computes a fresh CFBundleVersion from ASC or epoch fallback. Earlier run 36190564705 compiled successfully but its submission watcher timed out while EAS was still IN_QUEUE; that is not evidence of an Apple rejection. Local ASC credentials are unavailable; the workflow uses repository/EAS credentials. Native creator acceptance follows installation of the new candidate.
