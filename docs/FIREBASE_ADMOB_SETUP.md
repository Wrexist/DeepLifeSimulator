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

## Part B — Code wiring (I do this once you have the two service files)

Keep everything behind the existing gates so a broken native module can't crash boot,
mirroring `AdMobService`'s lazy-load + circuit-breaker pattern.

1. **Deps**
   ```
   npx expo install @react-native-firebase/app @react-native-firebase/analytics
   ```

2. **Service files** — commit (or inject via EAS secret file) at repo root:
   - `GoogleService-Info.plist`
   - `google-services.json`

3. **`app.config.js`** — register the plugin + files:
   ```js
   plugins: [
     // ...existing...
     '@react-native-firebase/app',
     ['expo-build-properties', { ios: { useFrameworks: 'static' } }], // RNFirebase requirement
   ],
   ios:     { ...ios,     googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? './GoogleService-Info.plist' },
   android: { ...android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON     ?? './google-services.json' },
   ```

4. **Init behind consent** — do NOT auto-init at module load. Gate on the same
   ATT/consent + feature flag the ad stack uses:
   - Add a flag, e.g. `firebaseAnalytics: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_FIREBASE === 'true'`.
   - Lazy-require `@react-native-firebase/analytics` inside a try/catch (never require at module top).
   - Call `analytics().setAnalyticsCollectionEnabled(isTrackingAllowed())` after
     ATT resolves — reuse `utils/trackingTransparency`.
   - AdMob picks up the linked GA property automatically; no per-event code is
     required just for ARPU.

5. **Prebuild + verify**
   ```
   npx expo prebuild --clean
   # build to a device; confirm boot is stable on iOS 26 before shipping
   ```
   Watch for the TurboModule crash class that took out Sentry. If it recurs,
   keep `EXPO_PUBLIC_ENABLE_FIREBASE` unset (flag defaults off) to ship without it.

---

## Rollback / kill switch

`firebaseAnalytics` defaults **off** (opt-in via `EXPO_PUBLIC_ENABLE_FIREBASE=true`),
so an unset env var ships a build with the SDK present but analytics-collection
disabled — same fail-safe posture as `adMob` / `analytics` today.
