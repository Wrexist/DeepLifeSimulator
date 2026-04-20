# Build and Submit to TestFlight - Scripts

This directory contains automated scripts to build and submit the app to TestFlight.

## Available Scripts

### Windows (PowerShell)
```powershell
.\scripts\build-and-submit-testflight.ps1
```

### macOS/Linux (Bash)
```bash
chmod +x scripts/build-and-submit-testflight.sh
./scripts/build-and-submit-testflight.sh
```

## Prerequisites

1. **EAS CLI installed**
   ```bash
   npm install -g eas-cli
   ```

2. **Logged in to EAS**
   ```bash
   eas login
   ```

3. **Apple account credentials configured**
   ```bash
   eas credentials
   ```

4. **Save-signing key configured for production (required)**
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY --value "<long-random-secret>"
   ```
   Keep this value stable across releases. Rotating it can invalidate signature verification for existing saves.
   Legacy fallback is supported for compatibility (`EXPO_PUBLIC_SAVE_SIGNATURE_KEY`) but is deprecated.
   Prefer `EXPO_PUBLIC_SAVE_HMAC_KEY` for all new and existing environments.
   For local preflight runs, also export `EXPO_PUBLIC_SAVE_HMAC_KEY` in your shell or `.env.local`.

### Optional feature flags (EAS / local)

| Variable | When to set | Notes |
|----------|-------------|-------|
| `EXPO_PUBLIC_ENABLE_IAP` | `false` | Skips treating IAP as required in some checks; use only for local experiments. |
| `EXPO_PUBLIC_ENABLE_ADMOB` | `true` | Opt-in ads at runtime; `npm run preflight` still requires valid AdMob app IDs in `app.config.js` while `react-native-google-mobile-ads` is installed. |
| `EXPO_PUBLIC_REQUIRE_SIGNED_SAVES` | `false` | Weakens save integrity; preflight warns. Not for production. |
| `EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION` | must be unset or `false` for release | Preflight fails if `true` when signed saves are enforced. |
| `EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES` | must be unset or `false` for release | Same as above. |

### `eas.json` production profile vs EAS secrets

The `production` build profile in [eas.json](../eas.json) sets `EXPO_PUBLIC_ENABLE_ADMOB`, `EXPO_PUBLIC_ENABLE_IAP`, and `EXPO_PUBLIC_ENABLE_ATT` to `"true"`. That means:

1. **Save signing**: `EXPO_PUBLIC_SAVE_HMAC_KEY` is **not** in `eas.json` (secrets must not be committed). Create it with `eas secret:create --scope project` (see above). Every production/TestFlight build must have this secret or saves will fail signing checks at runtime and `npm run preflight` will fail locally without it.

2. **AdMob**: With ads enabled, [app.config.js](../app.config.js) must define the `react-native-google-mobile-ads` plugin with valid `ca-app-pub-…~…` app IDs (or equivalent env vars documented in Expo). Preflight section 5 enforces this when the npm package is present.

3. **GitHub Actions**: [.github/workflows/eas-build.yml](../.github/workflows/eas-build.yml) runs `eas build --profile production`. Ensure the EAS project has the same secrets as your local release machine (`EXPO_TOKEN` in GitHub, plus project-scoped `EXPO_PUBLIC_SAVE_HMAC_KEY` on Expo).

## What the Scripts Do

1. **Check prerequisites** - Verifies EAS CLI is installed and you're logged in
2. **Run release preflight** - Blocks build if required production checks fail (including save-signing env validation)
3. **Display current version** - Shows version and build number from `app.config.js`
4. **Build iOS app** - Starts EAS build for iOS production
5. **Wait for build** (optional) - Monitors build progress and waits for completion
6. **Submit to TestFlight** - Automatically submits the build to App Store Connect

## Usage

### Quick Start (Windows)
```powershell
cd "C:\Users\IsacC\Downloads\DeeplifeSim-main OLD-WORKING(1.8.6)\DeeplifeSim-main"
.\scripts\build-and-submit-testflight.ps1
```

### Quick Start (macOS/Linux)
```bash
cd /path/to/project
chmod +x scripts/build-and-submit-testflight.sh
./scripts/build-and-submit-testflight.sh
```

## Manual Steps (Alternative)

If you prefer to do it manually:

### 1. Build
```bash
eas build --platform ios --profile production
```

### 2. Wait for build to complete
Monitor at: https://expo.dev/accounts/isacm/projects/deeplife-simulator/builds

### 3. Submit to TestFlight
```bash
eas submit --platform ios --profile production --latest
```

## Troubleshooting

### Build Fails
- Check if you're logged in: `eas whoami`
- Verify Apple credentials: `eas credentials`
- Check build credits: https://expo.dev/accounts/isacm/settings/billing
- Review build logs on EAS dashboard

### Submission Fails
- Ensure build is completed and successful
- Check App Store Connect for any issues
- Verify Apple Team ID and App ID in `eas.json`
- Try submitting manually from App Store Connect

### Script Errors
- Make sure you're in the project root directory
- Ensure EAS CLI is up to date: `npm install -g eas-cli@latest`
- Check PowerShell execution policy (Windows): `Set-ExecutionPolicy RemoteSigned`

## Current Configuration

- **Version**: 2.2.8
- **Build Number**: 83+
- **Bundle ID**: com.deeplife.simulator
- **Apple Team ID**: S3U8B8HH96
- **App Store Connect App ID**: 6749675615

## Notes

- Builds typically take 15-30 minutes
- TestFlight processing takes 10-30 minutes after submission
- You can monitor progress on the EAS dashboard
- Build credits: Check billing at https://expo.dev/accounts/isacm/settings/billing

