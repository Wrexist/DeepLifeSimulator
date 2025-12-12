# DeepLife Simulator - Native Startup Crash Analysis

## Crash Report Summary
- **Build**: 2.2.5 (35)
- **Crash Location**: `ErrorRecovery.tryRelaunchFromCache()` → `StartupProcedure.throwException(_:)`
- **Crash Type**: `EXC_CRASH (SIGABRT)` - Native abort
- **Thread**: Thread 4 (Background thread)
- **Timing**: Immediate crash on app launch, before JavaScript loads

## Root Cause Analysis

The crash is happening in Expo's native error recovery system (`ErrorRecovery.swift`), which is trying to recover from a previous crash but failing. This creates a crash loop.

## Detailed List of Potential Causes

### 1. **React Native Reanimated Configuration Issues** ⚠️ HIGH PRIORITY

#### 1.1 Babel Plugin Configuration
- **Status**: ✅ Fixed - Plugin added to babel.config.js
- **Issue**: `react-native-reanimated` is imported at top of `app/_layout.tsx` but requires Babel plugin
- **Current Config**: Plugin is present and last in array
- **Risk**: If plugin isn't being applied during build, reanimated will crash on native init

#### 1.2 Reanimated Version Compatibility
- **Current Version**: `~3.16.1`
- **React Native Version**: `0.81.5`
- **Expo SDK**: `54.0.27`
- **Issue**: Version 3.16.1 might have compatibility issues with RN 0.81.5
- **Risk**: Native module initialization failure

#### 1.3 Reanimated Import Order
- **Location**: `app/_layout.tsx:1` - `import "react-native-reanimated";`
- **Issue**: Imported before any other modules, must be initialized first
- **Risk**: If native module isn't ready, crash occurs

### 2. **Expo Updates Error Recovery Loop** ⚠️ HIGH PRIORITY

#### 2.1 Error Recovery Configuration
- **Current Config**: `checkAutomatically: "ON_ERROR_RECOVERY"`
- **Issue**: This setting triggers error recovery when a crash is detected, but if the crash is persistent, it creates a loop
- **Location**: `app.config.js:11`
- **Risk**: Error recovery tries to relaunch from cache, but if the underlying issue isn't fixed, it crashes again

#### 2.2 Updates Module Initialization
- **Package**: `expo-updates@~29.0.15`
- **Issue**: Updates module might be trying to check for updates during startup, causing native crash
- **Location**: `utils/versionCheck.ts:75-110` - Called during game initialization
- **Risk**: Native module initialization failure if Updates isn't properly configured

#### 2.3 Cached Crash State
- **Issue**: Previous crashes might have left corrupted cache state
- **Location**: Expo's error recovery cache
- **Risk**: Error recovery tries to use corrupted cache, causing immediate crash

### 3. **React Native Worklets** ⚠️ MEDIUM PRIORITY

#### 3.1 Worklets Package Present But Plugin Removed
- **Packages**: `react-native-worklets@^0.5.1`, `react-native-worklets-core@^1.6.2`
- **Babel Plugin**: ❌ Removed from babel.config.js
- **Issue**: Worklets are still in dependencies but plugin was removed to fix reanimated conflict
- **Risk**: If worklets are used anywhere, they'll crash without the plugin

#### 3.2 Worklets Native Module
- **Issue**: Worklets native module might be trying to initialize even without Babel plugin
- **Location**: Native module initialization
- **Risk**: Native module initialization failure

### 4. **Native Module Initialization Order** ⚠️ MEDIUM PRIORITY

#### 4.1 Multiple Native Modules Initializing
- **Modules**: 
  - `react-native-reanimated`
  - `react-native-google-mobile-ads`
  - `expo-in-app-purchases`
  - `expo-tracking-transparency`
  - `expo-updates`
  - `react-native-worklets`
- **Issue**: Native modules might be initializing in wrong order or conflicting
- **Risk**: One module fails, causing cascade failure

#### 4.2 AdMob Native Module
- **Package**: `react-native-google-mobile-ads@^14.0.0`
- **Issue**: AdMob tries to initialize during app startup in `app/_layout.tsx:111`
- **Location**: `app/_layout.tsx:109-112`
- **Risk**: If AdMob native module isn't properly linked, it could crash

#### 4.3 IAP Native Module
- **Package**: `expo-in-app-purchases@^14.5.0`
- **Issue**: IAP service initializes during app startup
- **Location**: `app/_layout.tsx:128`
- **Risk**: Native module initialization failure

### 5. **Expo Router Configuration** ⚠️ MEDIUM PRIORITY

#### 5.1 Router Plugin Configuration
- **Plugin**: `expo-router` with `root: "./app"`
- **Issue**: Router might be trying to initialize before native modules are ready
- **Location**: `app.config.js:74-78`
- **Risk**: Router initialization failure

#### 5.2 Typed Routes Experiment
- **Config**: `experiments: { typedRoutes: true }`
- **Issue**: Experimental feature might have bugs causing crashes
- **Location**: `app.config.js:91-93`
- **Risk**: Experimental feature instability

### 6. **React Native Gesture Handler** ⚠️ LOW PRIORITY

#### 6.1 Gesture Handler Root View
- **Package**: `react-native-gesture-handler@~2.28.0`
- **Usage**: Wraps entire app in `GestureHandlerRootView`
- **Location**: `app/_layout.tsx:55`
- **Issue**: Must be initialized before reanimated
- **Risk**: Initialization order issue

### 7. **Expo Tracking Transparency** ⚠️ LOW PRIORITY

#### 7.1 ATT Permission Request
- **Package**: `expo-tracking-transparency@~6.0.8`
- **Issue**: Requesting ATT permission during startup
- **Location**: `app/_layout.tsx:82`
- **Risk**: Native permission request failure

### 8. **React Version Compatibility** ⚠️ LOW PRIORITY

#### 8.1 React 19.1.0
- **Current**: `react@19.1.0`, `react-dom@19.1.0`
- **Issue**: React 19 is very new and might have compatibility issues with Expo SDK 54
- **Risk**: React version incompatibility with native modules

### 9. **Hermes JavaScript Engine** ⚠️ LOW PRIORITY

#### 9.1 Hermes Runtime
- **Evidence**: Hermes threads visible in crash report (Thread 13, 14)
- **Issue**: Hermes might have issues with reanimated or other native modules
- **Risk**: JavaScript engine compatibility issues

### 10. **Build Configuration Issues** ⚠️ MEDIUM PRIORITY

#### 10.1 Folly Coroutines Fix
- **Status**: ✅ Fixed via Podfile patch
- **Issue**: Folly coroutines were disabled, but might still cause issues
- **Risk**: Build-time vs runtime mismatch

#### 10.2 New Architecture Disabled
- **Config**: `newArchEnabled: false`
- **Issue**: Some modules might expect new architecture
- **Risk**: Module compatibility issues

## Most Likely Root Causes (Prioritized)

### 🔴 CRITICAL - Most Likely Causes:

1. **Expo Updates Error Recovery Loop**
   - `checkAutomatically: "ON_ERROR_RECOVERY"` is triggering error recovery
   - Error recovery tries to relaunch from cache
   - Cache contains crash state, causing immediate crash
   - **Solution**: Disable error recovery or change to "ON_LOAD"

2. **React Native Reanimated Native Module Failure**
   - Reanimated is imported but native module fails to initialize
   - Babel plugin might not be applied correctly during EAS build
   - **Solution**: Verify plugin is applied, or temporarily remove reanimated import

3. **Cached Crash State**
   - Previous crashes left corrupted state in Expo's cache
   - Error recovery tries to use corrupted cache
   - **Solution**: Clear Expo cache or disable error recovery

### 🟡 HIGH PRIORITY:

4. **Native Module Initialization Order**
   - Multiple native modules initializing simultaneously
   - One fails, causing cascade
   - **Solution**: Delay native module initialization or add better error handling

5. **React Native Worklets Conflict**
   - Worklets package present but plugin removed
   - Native module might still try to initialize
   - **Solution**: Remove worklets packages entirely if not used

6. **Expo Updates Module Initialization**
   - Updates module might be checking for updates during startup
   - Native module initialization failure
   - **Solution**: Disable updates or delay initialization

## Recommended Fixes (In Order of Priority)

### Fix 1: Disable Expo Error Recovery
- Change `checkAutomatically: "ON_ERROR_RECOVERY"` to `"ON_LOAD"` or `"NEVER"`
- This prevents error recovery from trying to relaunch from corrupted cache

### Fix 2: Temporarily Remove Reanimated Import
- Comment out `import "react-native-reanimated";` in `app/_layout.tsx`
- Test if app launches without reanimated
- If it works, reanimated is the issue

### Fix 3: Disable Expo Updates
- Set `enabled: false` in updates config
- Test if app launches without updates
- If it works, updates module is the issue

### Fix 4: Remove React Native Worklets
- Remove `react-native-worklets` and `react-native-worklets-core` from package.json
- Remove worklets podspec patch from fix-podspec.js
- Rebuild and test

### Fix 5: Delay Native Module Initialization
- Move AdMob and IAP initialization to after app is fully loaded
- Use lazy loading for all native modules

### Fix 6: Clear Expo Cache
- Add code to clear Expo's error recovery cache on first launch
- Or disable error recovery entirely

## Testing Strategy

1. **Test 1**: Disable error recovery → Build → Test
2. **Test 2**: Remove reanimated import → Build → Test
3. **Test 3**: Disable updates → Build → Test
4. **Test 4**: Remove worklets → Build → Test
5. **Test 5**: Combine fixes → Build → Test

## Files to Modify

1. `app.config.js` - Update expo-updates configuration
2. `app/_layout.tsx` - Remove or delay reanimated import
3. `package.json` - Remove worklets if not needed
4. `babel.config.js` - Verify reanimated plugin configuration
5. `scripts/fix-podspec.js` - Remove worklets patch if removing worklets

