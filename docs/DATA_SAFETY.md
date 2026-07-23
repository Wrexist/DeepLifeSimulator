# Data Safety (Google Play) + App Privacy (Apple) — answer set

Ready-to-enter answers for the store privacy forms, derived from the SDKs the app
actually ships. **Owner: confirm each row against current behavior before
submitting — you are attesting to its accuracy.**

Data-collecting SDKs in the build (from `package.json` / config):
- **Google AdMob** (`react-native-google-mobile-ads`) — ads; Advertising ID + device info.
- **Firebase Analytics** (`@react-native-firebase/analytics`) — app usage/events, device IDs.
- **Sentry** (`@sentry/react-native`) — crash logs & diagnostics.
- **Google Play Billing** (IAP) — purchase history.
- **CloudSyncService** — game-save data keyed to an app-generated user/device ID (no email/password login).

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
| Crash logs | Yes | No | App functionality (stability) | Sentry |
| Diagnostics | Yes | No | App functionality | Sentry / remote logging |
| Purchase history | Yes | No | App functionality | Play Billing / IAP |
| Other user-generated content (game saves) | Yes | No | App functionality (cloud sync) | CloudSyncService, keyed to an app ID |

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
| Crash Data | No | No | App Functionality |
| Performance/Diagnostics | No | No | App Functionality |
| Purchase History | No | No | App Functionality |
| User Content (game saves) | No | No | App Functionality |

- **"Used for tracking = Yes"** for ad-related data → you MUST show the **ATT** prompt (already wired via `expo-tracking-transparency`).
- \*If CloudSync's ID can identify a person across services, flip "Linked to identity" to Yes for that data — owner to confirm the ID model.

---

## Copy-paste privacy-policy data list (for the support site)

The app collects: advertising identifiers and device information (for ads via
Google AdMob), app-usage/analytics events and device identifiers (Firebase
Analytics), crash and diagnostic data (Sentry), purchase history (Google Play /
App Store billing), and game-save data synced to an app-generated identifier
(cloud save). It does not collect your name, email, phone number, precise
location, or contacts. See `privacy-policy.html` for the full text.
