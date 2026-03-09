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
   For local preflight runs, also export `EXPO_PUBLIC_SAVE_HMAC_KEY` in your shell or `.env.local`.

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

