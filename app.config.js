module.exports = {
  expo: {
    name: "DeepLife Simulator",
    slug: "deeplife-simulator",
    // jsEngine: "jsc", // Removed - using default Hermes for better compatibility
    runtimeVersion: {
      policy: "sdkVersion"
    },
    // updates: COMPLETELY REMOVED to prevent TurboModule crash
    // updates: {
    //   url: "https://u.expo.dev/55bb8510-7ba6-4ec5-9174-cc370f5f6fdb",
    //   enabled: false,
    //   checkAutomatically: "NEVER",
    //   fallbackToCacheTimeout: 0
    // },
    extra: {
      eas: {
        projectId: "55bb8510-7ba6-4ec5-9174-cc370f5f6fdb"
      }
    },
    owner: "isacm",
    // Version number - ensure this matches App Store version
    // Note: If App Store shows different version (e.g., 1.2.x), align this accordingly
    version: "2.2.7",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    // Note: newArchEnabled removed - Expo Go always uses New Architecture in SDK 54
    // For production builds, configure via eas.json or native project settings if needed
    description: "The ultimate life simulation game where every choice matters",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.deeplife.simulator",
      // Build number - increment for each App Store submission
      buildNumber: "65",
      // Minimum iOS version - set to 13.0 to support iOS 26 beta and older devices
      deploymentTarget: "13.0",
      infoPlist: {
        NSUserTrackingUsageDescription: "This app would like to track your activity to provide personalized ads and improve your experience.",
        ITSAppUsesNonExemptEncryption: false
        // GADApplicationIdentifier REMOVED - AdMob disabled due to native crashes
        // "ca-app-pub-2286247955186424~3290819490"
      },
      config: {
        googleMobileAdsAppId: "ca-app-pub-2286247955186424~3290819490"
      },
    },
    android: {
      package: "com.deeplife.simulator",
      // Version code - increment for each Play Store submission
      versionCode: 3,
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#FFFFFF"
      },
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "POST_NOTIFICATIONS",
        "VIBRATE"
      ],
      config: {
        googleMobileAdsAppId: "ca-app-pub-2286247955186424~3290819490"
      },
      splash: {
        image: "./assets/images/icon.png",
        resizeMode: "contain",
        backgroundColor: "#FFFFFF"
      },
      allowBackup: true,
      softwareKeyboardLayoutMode: "pan"
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "expo-router",
        {
          root: "./app"
        }
      ],
      // CRITICAL: Fix for iOS 26 SDK strict header requirements
      // React Native 0.81.5 headers are not fully modularized for iOS 26
      "./plugins/withXcodeWarnings"
      // REMOVED: expo-font, expo-web-browser, expo-tracking-transparency
      // REMOVED: ./plugins/withFollyCoroutinesFix.js
      // All removed to eliminate TurboModule crash suspects
    ],
    experiments: {
      typedRoutes: true
    }
  }
};


