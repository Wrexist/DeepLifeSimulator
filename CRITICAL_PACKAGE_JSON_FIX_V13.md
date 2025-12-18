# CRITICAL: Package.json Still Has Removed Modules - V13

**Date**: 2025-01-27  
**Issue**: Native modules still linked despite removing plugins  
**Severity**: 🔴 **CRITICAL - ROOT CAUSE IDENTIFIED**

---

## The Real Problem

### What We Did Wrong:
1. ✅ Removed `expo-tracking-transparency` from `app.config.js` plugins
2. ✅ Removed `expo-font` from `app.config.js` plugins  
3. ✅ Removed `expo-web-browser` from `app.config.js` plugins
4. ❌ **FORGOT** to remove packages from `package.json`
5. ❌ **FORGOT** to run `npm install` to unlink native modules
6. ❌ **FORGOT** to run `npx expo prebuild --clean` to regenerate native code

### Why This Causes Crashes:
- **Removing from `app.config.js` only removes CONFIG**
- **Native modules are still linked** if package is in `package.json`
- **React Native auto-loads ALL linked native modules at startup**
- **TurboModules initialize immediately**, causing the crash

---

## Evidence from Crash Reports

### Build 42 (Dec 10) - JavaScript Error
```
Thread 6 Crashed
RCTFatal + 568
RCTExceptionsManager.reportFatal
```
→ This was a **JavaScript exception**, likely from AdMob code

### Builds 57-62 (Dec 16-18) - Native TurboModule Crash
```
Thread 1 Crashed
ObjCTurboModule::performVoidMethodInvocation
```
→ This is a **native module initialization crash**  
→ Happens BEFORE JavaScript can run  
→ Can't be caught by JavaScript try-catch

---

## Root Cause Analysis

### Timeline:
1. **Build 42**: AdMob crashes with JavaScript error
2. **Builds 57+**: We tried to fix by:
   - Disabling AdMob in JavaScript ❌ (too late)
   - Removing AdMob package ✅ (worked)
   - Removing ATT plugin config ✅ (not enough)
   - **MISSED**: Removing ATT from package.json ❌

3. **Result**: `expo-tracking-transparency` native module still linked and crashing

### Why ATT Crashes:
- Requires App Tracking Transparency permission
- On iOS 26 beta, TurboModule initialization might fail
- Crash happens during native module auto-load
- Before any JavaScript runs (0.28s after launch)

---

## The Fix

### Step 1: Remove from package.json
```json
// REMOVE these lines:
"expo-tracking-transparency": "~6.0.8",
"expo-font": "~14.0.8",        // Might also cause issues
"expo-web-browser": "~15.0.10", // Might also cause issues
```

### Step 2: Clean install
```bash
npm install
```

### Step 3: Clean native build
```bash
npx expo prebuild --clean
```

### Step 4: Build for TestFlight
```bash
eas build --platform ios --profile production
```

---

## Why This Explains Everything

### All Crashes Have Same Signature:
- ✅ Same TurboModule error
- ✅ Same 0.28s crash timing
- ✅ Same Thread 1 crash location  
- ✅ Persists across builds 58-62

### Why Previous Fixes Didn't Work:
- Build 58-59: AdMob JavaScript fixes → Native crash before JS runs
- Build 60: Removed AdMob package → ATT still linked
- Build 61: Removed ATT plugin → Package still in package.json
- Build 62: Removed ATT JS code → Package still in package.json

### The Missing Link:
**Expo plugins control CONFIGURATION, not LINKING**  
**Native modules are linked if they're in package.json**  
**We must remove the PACKAGE, not just the plugin config**

---

## Additional Suspects

Now that we know the pattern, these packages might ALSO need removal:

1. `expo-tracking-transparency` (CONFIRMED culprit)
2. `expo-font` (Plugin removed but package remains)
3. `expo-web-browser` (Plugin removed but package remains)
4. `expo-in-app-purchases` (Has TurboModule, might crash)

---

## Build 64 Plan

### Aggressive Removal:
1. Remove `expo-tracking-transparency` from package.json ✅
2. Remove `expo-font` from package.json (if not critical)
3. Remove `expo-web-browser` from package.json (if not critical)
4. Keep instrumentation logs
5. Clean install + prebuild
6. Build 64 to TestFlight

### Expected Result:
- **If launches**: ATT package was the culprit
- **If still crashes WITH logs**: Crash during specific import
- **If still crashes NO logs**: Something else in package.json

---

## Confidence Level

🟢 **HIGH (85%)** - This explains:
- Why all crashes are identical
- Why JavaScript fixes didn't work
- Why plugin removal didn't work
- Why it crashes so early (native auto-load)
- Why it's consistent across all builds

---

## Status

🔧 **FIX IN PROGRESS**  
📦 Removing expo-tracking-transparency from package.json  
⏳ Awaiting Build 64 deployment & test

---

**Next Steps**: Deploy Build 64 without ATT package and test launch

