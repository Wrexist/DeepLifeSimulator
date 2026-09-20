# Mobile launch readiness - Android first release + iOS - 19 September 2026

**Verdict: source/config GREEN for both platforms; store + device acceptance
remain HOLD.** Nothing here is a signed build, a store record or a device test.
Android is a FIRST release, so it needs Play-listing assets and store forms that
do not exist yet - those are listed exactly.

Branch `codex/restore-precompact-hud` (PR #215, all checks green). Binary
`2.13.0`, save schema `51`, Expo SDK `~54.0.37` (React Native 0.81).

## Verified locally (commands + results)

| Check | Result |
|---|---|
| `npx expo-doctor` | **18/18 checks passed** |
| Routes | 17 routes, no conflicts |
| Android preflight (`preflight-check --platform android`) | **ALL PREFLIGHT CHECKS PASSED** (2 warnings, both external - below) |
| iOS preflight (`preflight-check --platform ios`) | **ALL PREFLIGHT CHECKS PASSED** |
| Android production export (`expo export --platform android`) | exit 0, Hermes bundle 13.6 MB |
| iOS production export (`expo export --platform ios`) | exit 0, Hermes bundle 13.6 MB |
| Content quality | passes every floor |
| Live-ops calendar | runway OK (one advisory: 'early' stage quiet 53 days) |
| Full test suite | 805 suites / 9893 tests / 308 snapshots pass |
| Image payload | 149 images, 20.2 MB (ratchet 45 MB, Play base-AAB limit 200 MB) |

## Android first release

### Already correct in the repo

- `android.package` `com.deeplife.simulator`; `versionCode` from `BUILD_NUMBER`
  (default 99), validated at config-eval time so a bad value fails fast.
- **targetSdk / compileSdk = 36** (Android 16). Expo SDK 54's default, confirmed
  in `expo-modules-core/android/ExpoModulesCorePlugin.gradle` (`safeExtGet(..., 36)`).
  This meets Google Play's current new-app requirement; no config restatement
  needed.
- Release build is an **AAB** (`buildType: app-bundle`), with lint-vital skipped
  in the Gradle command (matches the iOS/Android release workflow).
- Permissions are minimal and correct: `INTERNET`, `ACCESS_NETWORK_STATE`,
  `com.google.android.gms.permission.AD_ID` (AdMob), `com.android.vending.BILLING`.
- Adaptive icon + `backgroundColor` `#1a1a2e`; splash configured.
- Firebase `google-services.json` present and tracked; `@react-native-firebase/app`
  plugin wired.
- `expo-iap` (Play Billing capability) plugin wired; `COMMIT`/products read from
  the SDK at runtime.
- Edge-to-edge: Expo SDK 54 forces it for API 35+; the app handles insets via
  `react-native-safe-area-context` in 55 files (device check still required).
- Every real `<Modal>` sets `onRequestClose` except one dev-only log viewer,
  fixed in this pass (`components/dev/LogViewer.tsx`).

### Required before publishing to Play (external - not doable from source)

1. **AdMob Android ad units - ✅ RESOLVED (2026-09-19).** An Android AdMob app
   (`ca-app-pub-2286247955186424~9052280895`) was created with banner,
   interstitial and rewarded units; all four values
   (`EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` + the three units) are set in the EAS
   production env and `app.config.js` defaults to the new App ID. The Android
   build workflow's `--warn-missing-android-admob` downgrade was removed, so
   missing Android ad units now fail the build closed. RevenueCat remains
   complete for both platforms, as are the IAP verify URL and save HMAC key.
2. **Play Console listing + forms** (none exist today):
   - Store listing text: title <= 30, short description <= 80, full description <= 4000.
   - App icon **512x512 PNG** (32-bit, no alpha needed).
   - **Feature graphic 1024x500** (required).
   - Phone screenshots: at least 2, each side 320-3840px and **aspect ratio no
     more than 2:1**. **Done** - `marketing/play-store/screenshots/` holds the 8
     designed 1080x1920 (9:16) storyboards, rendered by
     `screenshots/player-stories-2026-09/source/build.mjs --devices=play-phone`
     (a `play-phone` size was added for this). The iOS shots are 2.17:1 and must
     NOT be uploaded.
   - Data safety form, content rating questionnaire, Ads declaration ("contains
     ads"), target audience, privacy policy URL
     (`https://wrexist.github.io/DeepLifeSimulator/privacy.html`).
3. **Play Billing products** created and active in Play Console (matches the
   `expo-iap` catalogue), plus a license-tester account for purchase acceptance.
4. **Play App Signing** + a service-account key for `eas submit`
   (`play-service-account.json`, gitignored - absent locally by design).
5. **versionCode strategy**: `eas.json` uses `appVersionSource: remote` with
   `autoIncrement: true`; confirm the remote counter before the first upload.
6. **Device acceptance on the exact signed AAB** (no emulator substitutes for
   the store flows): Android 15/16 edge-to-edge safe areas, hardware back on
   every modal, purchase + restore, ads (rewarded/banner), old-save upgrade,
   background/kill/relaunch.

## iOS

Same source/config state and the same external gates already tracked in the
release queue (R04 journeys, R06 purchases, R07 store/assets, R08 signed
candidate, R09 device/accessibility, R10 submission). Live store record is
`1.5.5`; latest ASC upload is `2.14.0 (186)`, predating current fixes;
`marketing/aso/metadata.mjs` still targets `1.5.0`. ATT string and privacy
manifest are configured; no change needed here.

## Blockers, ordered

1. Android AdMob units + Play listing assets/forms (external, Android-specific).
2. Play Billing products + tester (external).
3. Signed candidate + TestFlight/Play internal track (external, requires
   authorization to dispatch a build).
4. Device acceptance matrix (iOS + Android) - unavailable in this environment.

## Commands to run once authorized (not run here)

```bash
# 1. Set the Android ad units (else the build ships Google TEST ads).
eas env:create --environment production --name EXPO_PUBLIC_ADMOB_BANNER_ANDROID     --value <id> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID --value <id> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_ADMOB_REWARDED_ANDROID   --value <id> --visibility plaintext

# 2. Signed Android App Bundle (first Android release).
eas build --platform android --profile production

# 3. Upload to the Play internal track (needs play-service-account.json).
eas submit --platform android --profile production
```

Confirm the remote `versionCode` before the first upload (`appVersionSource:
remote`, `autoIncrement: true` in eas.json). Dispatch/submit only with explicit
authorization.

## Changed in this pass

- `components/dev/LogViewer.tsx`: added `onRequestClose` (Android back).
- This evidence document.

No store, build, submission or provider action was taken. Source/config gates
are green; the release remains HOLD until the external items above exist.
