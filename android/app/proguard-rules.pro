# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# R6-AUDIT: keep rules for every native module the app uses. Without these,
# release builds (minifyEnabled true) obfuscate the classes the native side
# looks up by name → silent init failure → black screen / crash on launch.

# React Native core + TurboModule + bridge (native ↔ JS)
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.modules.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Expo core + autolinked modules
-keep class expo.modules.** { *; }
-keep class expo.core.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Google Mobile Ads (react-native-google-mobile-ads + GMS)
-keep class com.google.android.gms.** { *; }
-keep interface com.google.android.gms.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.**

# Play Billing Library (expo-in-app-purchases)
-keep class com.android.billingclient.** { *; }
-keep interface com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# AppTrackingTransparency / expo-tracking-transparency (no-op on Android, kept for safety)
-keep class expo.modules.trackingtransparency.** { *; }

# Lucide / SVG renderer (component class lookups by name)
-keep class com.horcrux.svg.** { *; }

# Generic: anything that exposes JNI methods must keep its native methods.
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep React component class names so JS-side className references resolve.
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
    public *;
}
