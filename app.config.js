// Single source of truth: version from package.json
const { version } = require('./package.json');
// Build number can be overridden via EAS: BUILD_NUMBER env variable
const buildNumber = process.env.BUILD_NUMBER || "94";
const admobAppId = process.env.ADMOB_APP_ID || process.env.EXPO_PUBLIC_ADMOB_APP_ID || "ca-app-pub-2286247955186424~3290819490";
const admobIosAppId = process.env.ADMOB_IOS_APP_ID || process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || admobAppId;
const admobAndroidAppId = process.env.ADMOB_ANDROID_APP_ID || process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || admobAppId;

module.exports = {
  expo: {
    name: "DeepLife Simulator",
    slug: "deeplife-simulator",
    runtimeVersion: {
      policy: "sdkVersion"
    },
    updates: {
      url: "https://u.expo.dev/55bb8510-7ba6-4ec5-9174-cc370f5f6fdb"
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
    description: "The ultimate life simulation game where every choice matters",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.deeplife.simulator",
      buildNumber: buildNumber,
      deploymentTarget: "13.0",
      infoPlist: {
        NSUserTrackingUsageDescription: "This app would like to track your activity to provide personalized ads and improve your experience.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.deeplife.simulator",
      versionCode: parseInt(buildNumber, 10),
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
          delayAppMeasurementInit: true,
          userTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you."
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
