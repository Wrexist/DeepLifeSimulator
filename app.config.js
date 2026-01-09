module.exports = {
  expo: {
    name: "DeepLife Simulator",
    slug: "deeplife-simulator",
    runtimeVersion: {
      policy: "sdkVersion"
    },
    extra: {
      eas: {
        projectId: "55bb8510-7ba6-4ec5-9174-cc370f5f6fdb"
      }
    },
    owner: "isacm",
    version: "2.2.7",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    description: "The ultimate life simulation game where every choice matters",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.deeplife.simulator",
      // Build number - increment for each App Store submission
      buildNumber: "79",
      // Minimum iOS version - matches Build 51 that worked
      deploymentTarget: "13.0",
      infoPlist: {
        NSUserTrackingUsageDescription: "This app would like to track your activity to provide personalized ads and improve your experience.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    // MINIMAL PLUGINS - matching Build 51 pattern that worked
    // All Xcode-patching plugins removed - they corrupt pbxproj file
    plugins: [
      [
        "expo-router",
        {
          root: "./app"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
