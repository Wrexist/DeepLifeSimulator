# DeepLife Simulator — project notes

## Releases / TestFlight

**Always bump the app version before cutting a new TestFlight/EAS build.**

- Edit `version` in `package.json` so every build shows a clearly newer number
  than the last one shipped to TestFlight.
- The displayed app version and iOS `CFBundleShortVersionString` are derived from
  `package.json` via `app.config.js` — that one field is the single source of truth.
- The iOS build number / Android `versionCode` come from the `BUILD_NUMBER` env
  var at EAS build time (`app.config.js`), not from a committed file, so it does
  not need a code change.
- The actual TestFlight/EAS build is triggered by the owner; the version bump is
  the part done in the repo beforehand.
