# CRITICAL: Remove AdMob from Native Build

**Date**: 2025-01-27  
**Issue**: Build 60 still crashing - JavaScript disable flag DOES NOT WORK  
**Status**: 🚨 **MUST REBUILD WITHOUT ADMOB**

---

## Why JavaScript Disable Didn't Work

### The Real Problem

React Native **auto-loads all linked native modules at startup** - regardless of JavaScript code.

**What happens**:
1. App launches
2. React Native loads linked native modules (including AdMob)
3. **AdMob native module crashes during initialization**
4. JavaScript never gets a chance to run
5. Our disable flags are never executed

**Build 60 was already compiled with AdMob linked**, so the JavaScript disable flags had zero effect.

---

## Required Steps to Fix (MUST DO ALL)

### Step 1: Remove AdMob Package

Open terminal in project root and run:

```bash
npm uninstall react-native-google-mobile-ads
```

This will:
- Remove the package from `node_modules`
- Remove it from `package.json`
- Remove it from `package-lock.json`

### Step 2: Clean iOS Build (CRITICAL)

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

This will:
- Remove all CocoaPods (including AdMob SDK)
- Reinstall only the required pods
- Remove AdMob from the native build

### Step 3: Clean Build Cache

```bash
# Clean Expo cache
npx expo start -c

# Or clean React Native cache
npm start -- --reset-cache
```

### Step 4: Rebuild for TestFlight

```bash
# Clean build
eas build --platform ios --profile production --clear-cache

# Or if using local build:
npx expo run:ios --configuration Release
```

### Step 5: Verify AdMob is Removed

Check that these files no longer reference AdMob:
- `ios/Podfile.lock` - should NOT contain `Google-Mobile-Ads-SDK`
- `package.json` - should NOT contain `react-native-google-mobile-ads`

---

## Files Already Modified (No Further Changes Needed)

These files already have the AdMob code disabled:
- ✅ `services/AdMobService.ts` - Emergency disable flag
- ✅ `app/_layout.tsx` - AdMob initialization commented out
- ✅ `components/BannerAd.tsx` - Emergency disable flag

**But these changes are NOT ENOUGH** - the native module is still linked and auto-loads.

---

## Alternative: Temporary Package.json Edit (If Can't Rebuild Yet)

If you cannot rebuild immediately, you can try editing `package.json` to comment out AdMob:

```json
{
  "dependencies": {
    // "react-native-google-mobile-ads": "^14.0.0",  // COMMENTED OUT
    // ... other dependencies
  }
}
```

Then run:
```bash
npm install
cd ios && pod install && cd ..
```

**But you MUST rebuild the iOS app for this to take effect.**

---

## Why This Will Work

Once AdMob is removed from the native build:
- ✅ Native module won't be linked
- ✅ TurboModule won't try to initialize it
- ✅ No native crash possible
- ✅ App will launch successfully

---

## After Removal

The app will:
- ✅ Launch successfully
- ✅ Run all game features normally
- ✅ Show NO ads (expected)
- ✅ Be stable for TestFlight testing

---

## Long-Term Ad Solution

### Option A: Try Alternative Ad SDK
- AppLovin MAX (more stable)
- Unity Ads
- IronSource
- Custom ad server

### Option B: Fix AdMob Native Integration
- Contact Google AdMob support
- Check iOS version compatibility
- Review AdMob SDK version

### Option C: Launch Without Ads
- Focus on TestFlight testing
- Add ads later after game is stable
- Monetize through IAP only

---

## Quick Reference Commands

```bash
# Full clean rebuild process
npm uninstall react-native-google-mobile-ads
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
npx expo start -c
eas build --platform ios --profile production --clear-cache
```

---

## Important Notes

1. **You MUST rebuild** - JavaScript changes alone won't fix this
2. **Clean pod cache** - ensure old AdMob SDK is removed
3. **Clear build cache** - prevent cached native modules
4. **Test locally first** - run `npx expo run:ios` to verify before EAS build
5. **Build 61+ required** - Build 60 will still crash (already compiled with AdMob)

---

## Verification After Rebuild

After rebuilding, verify:
- [ ] App launches successfully
- [ ] No TurboModule crash
- [ ] Game features work normally
- [ ] `ios/Podfile.lock` does NOT contain AdMob
- [ ] Crash-free for at least 5 minutes

---

**Next Build: 61+**  
**Expected Result**: No crashes, stable app, no ads

---

## Critical Takeaway

**Native module crashes cannot be fixed with JavaScript code.** The only solution is to remove the crashing native module from the build entirely.

