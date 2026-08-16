// Single source of truth: version from package.json
const { version } = require('./package.json');
// Build number can be overridden via EAS: BUILD_NUMBER env variable.
// Validated HERE, at config-eval time. `android.versionCode` is
// `parseInt(buildNumber, 10)`, so a non-numeric or empty-but-set BUILD_NUMBER
// used to produce `versionCode: NaN` — which serializes to `null` and is only
// rejected ~20 minutes into the Gradle build. Failing at config eval turns that
// into an immediate, readable error. The "99" fallback for an UNSET variable is
// documented behavior (see lib/config/buildTag.ts) and is unchanged.
// 2026-08-16 audit L13.
const rawBuildNumber = process.env.BUILD_NUMBER;
const trimmedBuildNumber = rawBuildNumber === undefined ? "" : String(rawBuildNumber).trim();
let buildNumber = "99";
if (trimmedBuildNumber !== "") {
  const parsed = Number.parseInt(trimmedBuildNumber, 10);
  // Digits only: `parseInt` happily returns 12 for "12abc" and NaN for "abc",
  // and only the first of those is silent enough to reach Gradle.
  if (!/^\d+$/.test(trimmedBuildNumber) || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `BUILD_NUMBER must be a positive integer, got ${JSON.stringify(rawBuildNumber)}. ` +
      `It becomes the iOS CFBundleVersion and the Android versionCode; a non-numeric ` +
      `value yields versionCode NaN and is rejected ~20 minutes into the Gradle build.`
    );
  }
  buildNumber = String(parsed);
}
// AdMob App IDs — one per platform (iOS and Android are separate AdMob apps).
// Defaults are the real per-platform App IDs; override via EAS env vars if needed.
//   iOS     ~7015403477  (confirmed — used by the iOS build that serves ads)
//   Android ~3290819490  (matches the committed AndroidManifest; Android ships
//                         ad-free until its ad units are created in AdMob)
const admobIosAppId = process.env.ADMOB_IOS_APP_ID || process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-2286247955186424~7015403477";
const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID || process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-2286247955186424~3290819490";
// Firebase config files (unlocks AdMob ARPU once the account is linked to the
// Firebase/GA property). Paths can be overridden via EAS secret files.
const iosGoogleServicesFile = process.env.GOOGLE_SERVICE_INFO_PLIST || "./GoogleService-Info.plist";
const androidGoogleServicesFile = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";

module.exports = {
  expo: {
    name: "DeepLife Simulator",
    slug: "deeplife-simulator",
    runtimeVersion: {
      policy: "sdkVersion"
    },
    // CRITICAL (TestFlight determinism): expo-updates is HARD-DISABLED so the
    // ONLY JS that ever runs is the bundle embedded in the native binary. With
    // updates enabled + runtimeVersion policy "sdkVersion", a stale/broken OTA
    // bundle published to runtime "exposdk:54.0.0" would override every new
    // native build on launch — the classic "I shipped the fix 20 times and it
    // still crashes the same way" trap. `enabled: false` is the only setting
    // that 100% guarantees the embedded (fixed) bundle runs; checkAutomatically
    // NEVER alone would still let an already-cached bad update load. Re-enable
    // OTA only after the app is stable in TestFlight (and pin a real
    // runtimeVersion, not the SDK-wide one, before doing so).
    updates: {
      url: "https://u.expo.dev/55bb8510-7ba6-4ec5-9174-cc370f5f6fdb",
      enabled: false,
      checkAutomatically: "ON_ERROR_RECOVERY",
      fallbackToCacheTimeout: 0
    },
    extra: {
      eas: {
        projectId: "55bb8510-7ba6-4ec5-9174-cc370f5f6fdb"
      }
    },
    owner: "isacm",
    version: version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "deeplife",
    userInterfaceStyle: "automatic",
    description: "Real economics, real choices. Start at 18 with nothing, take loans, invest, and build wealth — or go bankrupt trying. Every decision compounds.",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.deeplife.simulator",
      buildNumber: buildNumber,
      // Firebase (iOS): required for AdMob ARPU / user metrics.
      googleServicesFile: iosGoogleServicesFile,
      infoPlist: {
        // NSUserTrackingUsageDescription is now provided by the
        // expo-tracking-transparency config plugin (see `plugins` below).
        // Listing it here would shadow the plugin's wiring of the ATT
        // framework — keep only non-ATT keys here.
        ITSAppUsesNonExemptEncryption: false
      },
      // Apple privacy manifest (required since 2024). App-level declarations:
      //  • NSPrivacyTracking: false — see the ITMS-91064 note below. This is the
      //    APP bundle's own manifest; the tracking is done by the AdMob /
      //    Firebase SDKs, which ship their own manifests declaring it. Apple
      //    aggregates every manifest in the IPA, so the app's privacy report
      //    still reports tracking. The user-facing "Data Used to Track You"
      //    nutrition label comes from the App Privacy questionnaire in App Store
      //    Connect (IDFA ⇒ tracking), NOT from this key — keep that answered yes.
      //  • Required-reason APIs: the standard RN/Expo set — NSUserDefaults
      //    (AsyncStorage, CA92.1), file timestamps (C617.1), system boot time
      //    (35F9.1), disk space (E174.1). Over-declaring reasons is safe; the
      //    rejection risk is UNDER-declaring, so we list the common set.
      //
      // DO NOT set NSPrivacyTracking back to true without also filling
      // NSPrivacyTrackingDomains — that combination is what put builds 161/162
      // into "Invalid Binary":
      //   ITMS-91064: Invalid tracking information — "NSPrivacyTracking must be
      //   true if NSPrivacyTrackingDomains isn't empty."
      // Apple enforces the invariant in BOTH directions: per its docs, when
      // NSPrivacyTracking is true "you need to provide a list of internet
      // domains in NSPrivacyTrackingDomains". true + empty/absent = rejected at
      // upload validation, before review ever sees the build. An empty array is
      // NOT a fix — zero entries is still zero entries.
      //
      // And do NOT "fix" it by listing Google's ad-serving domains here either:
      // iOS BLOCKS network requests to every domain in this array whenever ATT
      // permission is denied. Listing googlesyndication.com / doubleclick.net
      // would stop ads from loading at all (not just personalized ones) for the
      // majority of users who decline the ATT prompt — the manifest would
      // validate and the ad revenue would go to zero. That is exactly why the
      // Google Mobile Ads SDK keeps its serving domains out of this key.
      // scripts/preflight-check.js §5b enforces this invariant before a build.
      privacyManifests: {
          NSPrivacyTracking: false,
          NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"]
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
            NSPrivacyAccessedAPITypeReasons: ["C617.1"]
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"]
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
            NSPrivacyAccessedAPITypeReasons: ["E174.1"]
          }
        ]
      }
    },
    android: {
      package: "com.deeplife.simulator",
      versionCode: parseInt(buildNumber, 10),
      // Firebase (Android): required for AdMob ARPU / user metrics.
      googleServicesFile: androidGoogleServicesFile,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#1a1a2e"
      },
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "com.google.android.gms.permission.AD_ID",
        "com.android.vending.BILLING"
      ]
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    // MINIMAL PLUGINS - matching Build 51 pattern that worked
    // All Xcode-patching plugins removed - they corrupt pbxproj file
    // NOTE: Keep AdMob plugin configured whenever the package is installed.
    // Missing iosAppId causes native startup aborts in TestFlight builds.
    // IMPORTANT: Plugin uses camelCase property names (iosAppId, NOT ios_app_id)
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "15.1",
            // NOTE: RNFirebase v23 builds WITHOUT use_frameworks in this setup,
            // so it is intentionally NOT forced here — forcing static frameworks
            // risks breaking the working react-native-google-mobile-ads link. If
            // a future pod install fails demanding it, add `useFrameworks: "static"`
            // here and re-verify the AdMob build. See docs/FIREBASE_ADMOB_SETUP.md.
            //
            // Firebase iOS pod-install fix: FirebaseCoreInternal (a Swift pod)
            // imports GoogleUtilities, which — as a static library without
            // `use_frameworks!` — does not generate module maps by default, so
            // `pod install` aborts with "GoogleUtilities does not define
            // modules". Declaring it here with modular_headers renders
            // `pod 'GoogleUtilities', :modular_headers => true` in the Podfile
            // (see expo-modules-autolinking autolinking_manager.rb), the exact
            // remedy CocoaPods recommends — without switching the whole target to
            // static frameworks (which the note above warns against).
            extraPods: [
              { name: "GoogleUtilities", modular_headers: true },
            ],
          },
        },
      ],
      // Firebase core — wires GoogleService-Info.plist / google-services.json so
      // AdMob can attribute revenue to users (unlocks ARPU). Hard Rule #4:
      // package in package.json ⇒ config plugin listed here.
      "@react-native-firebase/app",
      [
        "expo-router",
        {
          root: "./app"
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          iosAppId: admobIosAppId,
          androidAppId: admobAndroidAppId,
          delayAppMeasurementInit: true
          // P2-12: NSUserTrackingUsageDescription is owned by the
          // expo-tracking-transparency plugin below (single source of truth).
          // Two plugins writing the same Info.plist key drift apart over time and
          // plugin ordering decides which wins — so it's set in exactly one place.
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/icon.png",
          backgroundColor: "#1a1a2e",
          imageWidth: 200,
          resizeMode: "contain"
        }
      ],
      // P0-13: expo-tracking-transparency is installed and used at runtime
      // (utils/trackingTransparency.ts); its config plugin wires the
      // AppTrackingTransparency.framework linkage and NSUserTrackingUsageDescription.
      // Hard Rule #4: never list a package in package.json without its plugin.
      // PURPOSE STRING — rejected once as "placeholder or otherwise insufficient"
      // by App Review's automated scan (Guideline 5.1.1 / 5.1.2). The old value was
      // Expo's documentation boilerplate, "This identifier will be used to deliver
      // personalized ads to you." — a sentence that names the resource but never
      // says what the app does with it, which is the exact shape Apple's examples
      // call out as failing ("App would like to access your Contacts").
      //
      // A passing string needs BOTH halves:
      //   1. how this app uses the data ("to keep the ads in DeepLife relevant"),
      //   2. a CONCRETE example of the result ("other life-simulation games
      //      instead of unrelated products"), plus what happens on decline so the
      //      choice is honest.
      // Keep both halves if this is ever reworded — dropping the example is what
      // trips the scan. This is the ONLY NS*UsageDescription in the binary; no
      // other plugin or SDK in this project contributes one (see preflight §5c,
      // which fails the build on boilerplate/short strings).
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission:
            "DeepLife Simulator uses your advertising identifier to keep the ads you watch for in-game rewards relevant — for example, other life-simulation games instead of unrelated products. Declining still shows ads, just not personalized ones."
        }
      ],
      // NOTE (Hard Rule #4 — "package in package.json ⇒ config plugin here"):
      // expo-store-review is intentionally absent from this list. It ships NO
      // app.plugin.js (verified against the 9.0.9 tarball) — it is a plain
      // autolinked native module with nothing to configure at prebuild time.
      // There is no plugin to add, so the rule is satisfied by omission.
      //
      // In-app purchases. expo-iap replaces the deprecated expo-in-app-purchases
      // (which no longer links on SDK 54). Its config plugin wires the StoreKit /
      // Play Billing capability — Hard Rule #4: package in package.json ⇒ plugin here.
      "expo-iap"
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
