# TurboModule Crash - Systematic Debug V12

**Date**: 2025-01-27  
**Issue**: Build 62 STILL crashing - Not ATT plugin alone  
**Status**: 🔬 **SYSTEMATIC DEBUGGING IN PROGRESS**

---

## Critical Finding

Build 62 removed:
- ✅ AdMob package
- ✅ expo-tracking-transparency plugin
- ✅ ATT JavaScript call
- ✅ IAP JavaScript call

**Result**: STILL CRASHES with same TurboModule error (0.28s after launch)

---

## Hypotheses

### Hypothesis A: expo-font plugin
- **What**: Auto-loads fonts at startup
- **Why suspect**: Plugin in app.config.js, may access native font APIs
- **Test**: Remove from plugins array

### Hypothesis B: expo-web-browser plugin
- **What**: Initializes native browser module
- **Why suspect**: Plugin in app.config.js, may access TurboModule
- **Test**: Remove from plugins array

### Hypothesis C: react-native-gesture-handler
- **What**: Imported in _layout.tsx, initializes gesture system
- **Why suspect**: Known to have native initialization requirements
- **Test**: Track import timing with logs

### Hypothesis D: expo-router
- **What**: Core routing system
- **Why suspect**: May have native dependencies that auto-initialize
- **Test**: Can't remove (required), but log around it

### Hypothesis E: Custom folly plugin
- **What**: `./plugins/withFollyCoroutinesFix.js`
- **Why suspect**: Custom native modification, may trigger issues
- **Test**: Remove from plugins array

---

## Build 63 Changes

### app.config.js
- **Removed**: expo-font plugin (Hypothesis A)
- **Removed**: expo-web-browser plugin (Hypothesis B)
- **Removed**: ./plugins/withFollyCoroutinesFix.js (Hypothesis E)
- **Kept**: expo-router (required for app to function)
- **Build**: Incremented to 63

### app/_layout.tsx
- **Added**: 6 instrumentation logs tracking module imports (Hypothesis C)
- **Logs track**: expo-router, StatusBar, safe-area-context, react-native, gesture-handler imports
- **Purpose**: Identify WHICH import triggers crash (if any reach before crash)

---

## Expected Outcomes

### If Build 63 Launches Successfully
→ One of the removed plugins (expo-font, expo-web-browser, or folly fix) was the culprit
→ Re-enable plugins one by one in Build 64/65/66 to isolate

### If Build 63 Still Crashes
→ Logs will show which imports completed before crash
→ The crash happens AFTER the last successful log
→ Next culprit is either:
  - The import immediately after last log
  - expo-router itself
  - Something in app/entry.ts
  - React Native core initialization

---

## Log Analysis Plan

After Build 63 crash:
1. Check debug.log for completed import stages
2. Last successful log = safe import
3. First missing log = crash location
4. Next hypothesis targets that specific import/plugin

---

## Systematic Elimination Matrix

| Component | Build 58-61 | Build 62 | Build 63 | Status |
|-----------|-------------|----------|----------|---------|
| AdMob package | ✅ | ❌ | ❌ | REMOVED |
| ATT plugin | ✅ | ❌ | ❌ | REMOVED |
| ATT JS call | ✅ | ❌ | ❌ | DISABLED |
| IAP JS call | ✅ | ❌ | ❌ | DISABLED |
| expo-font plugin | ✅ | ✅ | ❌ | TESTING |
| expo-web-browser plugin | ✅ | ✅ | ❌ | TESTING |
| folly fix plugin | ✅ | ✅ | ❌ | TESTING |
| expo-router | ✅ | ✅ | ✅ | REQUIRED |
| gesture-handler | ✅ | ✅ | ✅ | LOGGED |

---

## Next Steps Based on Results

### Scenario 1: Build 63 Works
1. Re-enable expo-font only → Build 64
2. If crashes → expo-font is culprit
3. If works → Re-enable expo-web-browser → Build 65
4. Continue until crash isolated

### Scenario 2: Build 63 Crashes, No Logs
→ Crash before ANY JavaScript runs
→ Must be expo-router plugin itself
→ Or React Native core issue
→ Check if we can disable expo-router plugins/features

### Scenario 3: Build 63 Crashes, Some Logs Present
→ Logs show crash point
→ Target the import immediately after last log
→ Next build removes/modifies that import

---

## Files Modified

1. **app.config.js**
   - Removed expo-font, expo-web-browser, folly fix plugins
   - Build 63

2. **app/_layout.tsx**
   - Added 6 instrumentation logs around imports
   - Tracks: expo-router, StatusBar, safe-area, react-native, gesture-handler

3. **This document**
   - Systematic debugging approach
   - Hypothesis tracking
   - Decision tree for next steps

---

## Status

🔬 **Build 63 Ready for Testing**  
⏳ **Awaiting**: TestFlight deployment & crash logs  
🎯 **Goal**: Identify exact plugin/import causing TurboModule crash  

---

**Confidence**: MEDIUM (systematic elimination should identify culprit)

**Note**: If Build 63 still crashes with no logs, the issue is deeper than plugins - likely in React Native core or expo-router itself.

