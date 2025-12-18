# TurboModule Crash - Root Cause Investigation V10

**Date**: 2025-01-27  
**Issue**: Build 61 STILL crashing - NOT AdMob!  
**Status**: 🔍 **TESTING: IAP OR ATT IS THE CULPRIT**

---

## Critical Discovery

### Build 61 Crash Analysis

**Same TurboModule crash**:
```
Thread 1 Crashed:
9   React - ObjCTurboModule::performVoidMethodInvocation + 192
10  React - std::__1::__function::__func<facebook::react::ObjCTurboModule::performVoidMethodInvocation...
```

**Duration**: ~0.5 seconds from launch to crash

**Key Finding**: The crash persists even after **completely removing AdMob**. This proves AdMob was NOT the root cause!

---

## Real Culprit Candidates

Build 61 removed AdMob entirely, yet the TurboModule crash continues. The remaining native modules that initialize at startup:

### Suspect #1: expo-in-app-purchases (IAP) ⚠️
**Location**: `app/_layout.tsx` line 633  
**Call**: `await iapService.initialize()`  
**Risk**: HIGH - Initializes TurboModule for App Store connectivity

### Suspect #2: expo-tracking-transparency (ATT) ⚠️
**Location**: `app/_layout.tsx` line 574  
**Call**: `await requestTrackingPermission()`  
**Risk**: HIGH - Requires iOS framework initialization

### Why These Are Suspects

1. **Both are called at app startup** (line 566 - 5 second delay)
2. **Both access iOS native APIs** that require TurboModule
3. **Both were present in ALL crashing builds** (58, 59, 60, 61)
4. **Both initialize before UI renders** (same timing as AdMob)

---

## Test Strategy for Build 62

### Approach: Disable Both IAP and ATT

Temporarily disable BOTH native module calls to test if app launches:

```typescript
// BEFORE (Build 61):
const hasPermission = await requestTrackingPermission(); // ATT
const success = await iapService.initialize(); // IAP

// AFTER (Build 62):
// Both commented out - testing crash fix
```

### Expected Results

| Scenario | Result | Conclusion |
|----------|--------|------------|
| Build 62 still crashes | Neither IAP nor ATT | Another native module is the issue |
| Build 62 launches successfully | IAP or ATT (or both) | Re-enable one at a time to isolate |

---

## Files Modified for Build 62

### 1. `app/_layout.tsx`
- **Line 573-584**: ATT call commented out
- **Line 631-638**: IAP call commented out
- **Added**: Logging to indicate both are disabled for testing

### 2. `app.config.js`
- **buildNumber**: Incremented to `62`

---

## If Build 62 Launches Successfully

### Step 1: Isolate the Culprit

Re-enable ONE at a time in Build 63:

**Test A - Re-enable IAP only**:
```typescript
const success = await iapService.initialize(); // Uncomment
// ATT stays commented out
```

**Test B - Re-enable ATT only**:
```typescript
const hasPermission = await requestTrackingPermission(); // Uncomment
// IAP stays commented out
```

### Step 2: Fix the Culprit

Once isolated, apply the same defensive measures as AdMob:
- Lazy loading
- Promise.resolve() wrappers
- Function type checks
- Try-catch protection
- Or remove entirely

---

## If Build 62 Still Crashes

### Other Potential Native Modules

Check these modules that load at startup:

1. **expo-constants**
   - Used for environment detection
   - Usually safe but worth checking

2. **@react-native-community/netinfo**
   - Used in `RemoteLoggingService.ts`
   - Could crash if network API unavailable

3. **expo-notifications**
   - Used in notification system
   - Could crash if permissions unavailable

4. **React Native Reanimated**
   - Already loaded in `app/entry.ts`
   - Usually safe (already guarded)

5. **expo-router**
   - Core routing
   - Unlikely but possible

---

## Hypothesis

**Most Likely Culprit**: `expo-in-app-purchases`

**Reasoning**:
1. IAP connects to App Store APIs via TurboModule
2. Similar native API access pattern as AdMob
3. Requires iOS StoreKit framework
4. Called at same timing as AdMob (5 second delay)
5. Would explain why all builds crashed (IAP was always present)

**Second Most Likely**: `expo-tracking-transparency`

**Reasoning**:
1. ATT requires iOS 14+ framework
2. Accesses advertising identifier
3. Similar to AdMob's ATT access
4. Called BEFORE IAP in startup sequence

---

## Build 62 Testing Checklist

After Build 62 is deployed to TestFlight:

- [ ] App launches without crash
- [ ] Main menu appears
- [ ] No TurboModule error in logs
- [ ] Game functions normally
- [ ] IAP NOT available (expected)
- [ ] ATT NOT requested (expected)

If all pass → Proceed to isolation testing (Build 63)

---

## Long-Term Solution

Once culprit is identified:

### Option A: Fix Native Module
- Add defensive error handling
- Lazy load with delays
- Wrap in Promise.resolve()
- Add function type checks

### Option B: Remove Completely
- Disable IAP (use simulation mode)
- Disable ATT (skip tracking)
- Focus on game stability

### Option C: Switch Implementation
- Use different IAP library
- Use different tracking method
- Avoid TurboModule-based solutions

---

## Critical Insight

**The real problem**: Not AdMob specifically, but **any native module that uses TurboModule and accesses iOS frameworks during initialization** can crash.

**Root cause**: iOS 26 beta or React Native SDK incompatibility with TurboModule initialization timing.

**Solution**: Either fix the timing (more delays, lazy loading) or remove the problematic native modules entirely.

---

## Status

🔬 **Build 62**: Testing with IAP and ATT disabled  
⏳ **Waiting**: TestFlight deployment results  
🎯 **Goal**: Identify the actual crashing native module  

---

**Next Steps**:
1. Deploy Build 62
2. Test on TestFlight
3. If successful → Re-enable modules one at a time (Build 63/64)
4. If still crashes → Check other native modules

---

**Confidence**: MEDIUM-HIGH

If IAP or ATT is the culprit, Build 62 should launch. If not, we need to investigate deeper into other native modules.

