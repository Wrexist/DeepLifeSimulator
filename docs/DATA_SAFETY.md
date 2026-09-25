# Data Safety (Google Play) + App Privacy (Apple) — answer set

Ready-to-enter answers for the store privacy forms, derived from the SDKs the app
actually ships. **Owner: confirm each row against current behavior before
submitting — you are attesting to its accuracy.**

Data-collecting SDKs in the **production** build (`eas.json` → `build.production.env`,
re-checked 2026-09-25):
- **Google AdMob** (`react-native-google-mobile-ads`, `EXPO_PUBLIC_ENABLE_ADMOB`) — ads; Advertising ID + device info.
- **Firebase Analytics** (`@react-native-firebase/analytics`, `EXPO_PUBLIC_ENABLE_FIREBASE`) — app usage/events, device IDs, and categorised failure counts (e.g. `save_failed` with a category, never the error text).
- **RevenueCat** (`react-native-purchases`, `EXPO_PUBLIC_USE_REVENUECAT`) — purchase history and an app-generated RevenueCat user ID, plus device info for receipt validation. This row was missing.
- **Google Play Billing / StoreKit** (`expo-iap`) — purchase history.

NOT in the production build — do not declare them:
- **Sentry** was removed (iOS 26 TurboModule crash). It is not a dependency any
  more; `package.json` lists it only under `overrides` (a version floor), and
  the `require` in `components/ErrorBoundary.tsx` is guarded and finds nothing.
  There is **no crash reporter** in production.
- **Remote logging** (`services/RemoteLoggingService.ts`) has no endpoint
  (`remoteUrl` is null), so logs never leave the device.
- **Cloud save** (`CloudSyncService`) is flag-gated (`EXPO_PUBLIC_ENABLE_CLOUD_SAVE`)
  and set only in the `preview` profile, so production game saves stay on the
  device. Re-add the "game saves" row the day that flag ships in production.

---

## Google Play — Data safety

**Does your app collect or share user data?** → **Yes.**
**Is data encrypted in transit?** → **Yes.**
**Do you provide a way to request data deletion?** → match your privacy policy (recommend **Yes**, via the support email).

| Data type | Collected | Shared | Purpose(s) | Notes |
|---|---|---|---|---|
| Device or other IDs | Yes | Yes | Advertising or marketing, Analytics | AdMob + Firebase |
| Advertising ID (Device ID) | Yes | Yes (Google) | Advertising or marketing | AdMob |
| App interactions | Yes | No | Analytics | Firebase Analytics |
| Diagnostics | Yes | No | Analytics, App functionality | Firebase Analytics (categorised failure events; no crash reporter ships) |
| Purchase history | Yes | No | App functionality | Play Billing + RevenueCat (receipt validation, entitlements) |
| User IDs (app-generated, not personal) | Yes | No | App functionality | RevenueCat app user ID |

- **No** personal data (name, email, address, phone), **no** precise location, **no** contacts/photos/messages, **no** financial account/payment info collected by the app (Google/Apple handle purchase payment).
- "Shared" = leaves the app to a third party. AdMob's Advertising ID sharing is the main one; mark data-safety "sharing" accordingly.

---

## Apple App Store Connect — App Privacy

**Does this app collect data?** → **Yes.**

| Data type | Linked to identity | Used for tracking | Purposes |
|---|---|---|---|
| Device ID | No* | **Yes** | Third-Party Advertising, Analytics |
| Advertising Data | No | **Yes** | Third-Party Advertising |
| Product Interaction / Usage Data | No | No | Analytics, App Functionality |
| Performance/Diagnostics | No | No | Analytics, App Functionality |
| Purchase History | No | No | App Functionality |
| User ID (RevenueCat app user ID) | No | No | App Functionality |

Crash Data and User Content (game saves) are **not** collected by the production
build today - see the SDK list above.

- **"Used for tracking = Yes"** for ad-related data → you MUST show the **ATT** prompt (already wired via `expo-tracking-transparency`).
- \*RevenueCat's app user ID is anonymous and app-generated. If the app ever signs players in (or ships cloud save keyed to an account), revisit "Linked to identity".

---

## Copy-paste privacy-policy data list (for the support site)

The app collects: advertising identifiers and device information (for ads via
Google AdMob), app-usage/analytics events, device identifiers and anonymous
failure counts (Firebase Analytics), and purchase history with an anonymous,
app-generated purchase ID (Google Play / App Store billing and RevenueCat).
Your game saves stay on your device. It does not collect your name, email,
phone number, precise location, or contacts. See `privacy-policy.html` for the full text.
