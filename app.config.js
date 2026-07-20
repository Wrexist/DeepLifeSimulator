// Single source of truth: version from package.json
const { version } = require('./package.json');
// Build number can be overridden via EAS: BUILD_NUMBER env variable
const buildNumber = process.env.BUILD_NUMBER || "99";
const admobAppId = process.env.ADMOB_APP_ID || process.env.EXPO_PUBLIC_ADMOB_APP_ID || "ca-app-pub-2286247955186424~7015403477";
const admobIosAppId = process.env.ADMOB_IOS_APP_ID || process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || admobAppId;
const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID || process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || admobAppId;
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
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission: "This identifier will be used to deliver personalized ads to you."
        }
      ],
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
