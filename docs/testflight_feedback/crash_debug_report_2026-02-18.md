# TestFlight Crash Debug Report (2026-02-18)

## Inputs Reviewed
- `docs/testflight_feedback/crashlog.crash`
- `docs/testflight_feedback/feedback.json`
- Historical crash files in repo root: `TestFlight - Deep Life Simulator *.crash`
- Historical build log: `build/Build 51`

## Crash Signature
1. Immediate startup abort in build `2.3.0 (83)`:
   - `GADApplicationVerifyPublisherInitializedCorrectly` in last exception backtrace.
   - Evidence: `docs/testflight_feedback/crashlog.crash:34`, `docs/testflight_feedback/crashlog.crash:35`, `docs/testflight_feedback/crashlog.crash:166`, `docs/testflight_feedback/crashlog.crash:167`.
2. User feedback confirms instant startup failure:
   - Evidence: `docs/testflight_feedback/feedback.json` comment `"Crash directly"`.
3. Historical iOS build warning already called out this exact failure mode:
   - Evidence: `build/Build 51:3992` (`ios_app_id key not found ... App will crash without it.`).

## Root Cause (High Confidence)
- `react-native-google-mobile-ads` native module is present, but AdMob app ID config was removed from Expo config plugin path.
- On iOS, this can throw NSException in native Google Mobile Ads initialization and abort the app during startup.

## Stability Risks Found
1. Startup service flags in `app/_layout.tsx` were not reliably tied to feature flags, allowing accidental forced initialization of optional native modules.
2. Release preflight checks did not block AdMob plugin misconfiguration.

## Fixes Applied
1. Restored AdMob plugin configuration in Expo config:
   - `app.config.js:1`
   - `app.config.js:67`
2. Startup optional service initialization now follows feature flags:
   - `app/_layout.tsx:970`
   - `app/_layout.tsx:971`
   - `app/_layout.tsx:972`
3. AdMob feature flag is now explicit opt-in:
   - `lib/config/featureFlags.ts:18`
4. Added release preflight checks for AdMob native safety:
   - Plugin presence + app ID validity check: `scripts/preflight-check.js:215`
   - Guard against hardcoded forced startup flags: `scripts/preflight-check.js:308`
5. Added env template keys for AdMob app IDs:
   - `.env.example:16`
   - `.env.example:17`

## Validation Run
- Command: `npm run preflight -- --platform ios`
- Result: passed (existing project TS/lint noise remains non-blocking by script design; new AdMob and startup guard checks passed).

## Remaining Watch Items
1. IAP/ATT are still native startup tasks; keep them non-critical and feature-flagged.
2. If AdMob IDs are changed, run preflight before every TestFlight upload to avoid regression.
