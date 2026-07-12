# Firebase ↔ AdMob linking (unlocks ARPU + user metrics)

**Why:** In the AdMob dashboard, **ARPU ("ARPU för annonser")** and user-level
metrics stay blank until your AdMob account is linked to a **Google Analytics
for Firebase** property. The screenshot state — `ARPU — · Kräver en länk till
Firebase` — is exactly this: no Firebase link yet.

**Important:** this is **mostly a console + native-config task**, not a pure code
change. It also adds **native Firebase SDKs**, which is the same class of
dependency that caused the iOS 26 TurboModule crash we disabled Sentry for
(`FEATURE_FLAGS.analytics = false` in `lib/config/featureFlags.ts`). Treat the
first build after this as a stability checkpoint.

---

## Part A — Console (you do this; no code)

1. **Firebase project**
   - console.firebase.google.com → create (or reuse) a project.
   - Add an **iOS app** (bundle id must match `app.config.js` → `ios.bundleIdentifier`).
   - Add an **Android app** (package must match `android.package`).
   - Download **`GoogleService-Info.plist`** (iOS) and **`google-services.json`** (Android).
   - In the Firebase project, make sure **Google Analytics is enabled** (creates a GA4 property).

2. **Link AdMob → Firebase**  *(this is the actual "unlock ARPU" switch)*
   - apps.admob.com → **Apps** → select the app → **App settings**.
   - Under **Linked services / Firebase**, link to the Firebase project + app above.
   - Enable **user metrics**. ARPU/impression-level data starts populating within ~24–48h.

3. (Optional but recommended) Turn on **Impression-level ad revenue** in AdMob so
   per-impression revenue flows into GA4.

> Nothing in the app renders ARPU — it's an AdMob-dashboard metric. The app's
> only job is to ship the Firebase/GA SDK so AdMob can attribute revenue to users.

---

## Part B — Code wiring ✅ DONE (project `deep-life-simulator-2779c`)

All wired behind the existing gates, mirroring `AdMobService`'s lazy-load +
error-isolation so a broken native module can't crash boot:

- **Deps:** `@react-native-firebase/app` + `@react-native-firebase/analytics` `^23.8.8` (package.json).
- **Service files** at repo root: `GoogleService-Info.plist`, `google-services.json`
  (paths overridable via `GOOGLE_SERVICE_INFO_PLIST` / `GOOGLE_SERVICES_JSON` for EAS secret files).
- **`app.config.js`:** `@react-native-firebase/app` plugin + `ios.googleServicesFile` /
  `android.googleServicesFile`. `use_frameworks` is deliberately **NOT** forced
  (see the note in the file) — RNFirebase v23 builds without it, and forcing static
  frameworks risks breaking the working `react-native-google-mobile-ads` link.
- **Flag:** `FEATURE_FLAGS.firebaseAnalytics` — opt-in via `EXPO_PUBLIC_ENABLE_FIREBASE=true`,
  off by default (same fail-safe posture as `adMob` / `analytics`).
- **Init:** `services/FirebaseAnalyticsService.ts` lazy-requires analytics and calls
  `setAnalyticsCollectionEnabled(isTrackingAllowed())`. Wired into the boot
  orchestrator in `app/_layout.tsx` **after** the ATT task (sequential), so the
  tracking choice is known before collection is toggled.

### To ACTIVATE (remaining — your steps)

1. **Console (Part A above):** ensure **Google Analytics is enabled** on the Firebase
   project and **link AdMob → this Firebase property**. ⚠️ The provided configs have
   `IS_ANALYTICS_ENABLED = false` — that means GA was not enabled when they were
   downloaded. Enable GA in the Firebase project, then **re-download** both service
   files and replace the ones at repo root, or ARPU will stay blank.
2. Set the EAS/env secret **`EXPO_PUBLIC_ENABLE_FIREBASE=true`** for the build profile.
3. **Prebuild + verify:**
   ```
   npx expo prebuild --clean
   # build to a device; confirm boot is stable on iOS 26 before shipping
   ```
   Watch for the TurboModule crash class that took out Sentry. If it recurs,
   unset `EXPO_PUBLIC_ENABLE_FIREBASE` to ship without it (SDK present, inert).

---

## Rollback / kill switch

`firebaseAnalytics` defaults **off** (opt-in via `EXPO_PUBLIC_ENABLE_FIREBASE=true`),
so an unset env var ships a build with the SDK present but analytics-collection
disabled — same fail-safe posture as `adMob` / `analytics` today.
