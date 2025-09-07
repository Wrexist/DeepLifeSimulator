# Animation Fixes Summary

## Problem
The app was showing "Style property 'width' is not supported by native animated module" errors because some animations were using `useNativeDriver: true` while animating layout properties like `width`, `height`, `left`, `right`, `top`, `bottom`, `margin*`, `padding*`, `backgroundColor`, `zIndex`, and `border*`.

## Root Cause
The native driver only supports `opacity` and `transform` properties. Any other properties must use `useNativeDriver: false`.

## Files Fixed

### 1. `components/TopStatsBar.tsx`
**Issue**: Progress bar animations were using `useNativeDriver: true` while animating the `width` property.

**Fix**: Changed the progress bar animations from `useNativeDriver: true` to `useNativeDriver: false`:
```typescript
// Before
const healthAnimation = Animated.timing(animatedStats.health, { 
  toValue: to(stats.health), 
  duration: 300, 
  useNativeDriver: true  // ❌ Wrong - animates width
});

// After  
const healthAnimation = Animated.timing(animatedStats.health, { 
  toValue: to(stats.health), 
  duration: 300, 
  useNativeDriver: false  // ✅ Correct - animates width
});
```

### 2. `src/utils/animated.ts` (New File)
**Created**: Utility functions to help developers use the correct `useNativeDriver` setting:

```typescript
export const timingLayout = (value: Animated.Value, toValue: number, duration = 250) =>
  Animated.timing(value, { toValue, duration, useNativeDriver: false });

export const timingNative = (value: Animated.Value, toValue: number, duration = 250) =>
  Animated.timing(value, { toValue, duration, useNativeDriver: true });
```

## Files Verified (No Issues Found)

The following files were checked and found to be correctly using `useNativeDriver: true` only for `opacity` and `transform` properties:

- `components/DeathPopup.tsx` - Only animates `opacity` and `transform`
- `components/DailyGiftModal.tsx` - Only animates `opacity` and `transform`
- `app/(tabs)/work.tsx` - Only animates `opacity`
- `app/(onboarding)/Perks.tsx` - Only animates `opacity` and `transform`
- `app/(onboarding)/MainMenu.tsx` - Only animates `opacity`
- `components/ui/AnimatedMoney.tsx` - Already properly configured with `useNativeDriver = false` by default
- `components/computer/GamingStreamingApp.tsx` - Uses `top` and `left` as static values, not animated

## Testing

1. ✅ Fixed the main issue in `TopStatsBar.tsx`
2. ✅ Created utility functions for future use
3. ✅ Verified all other animations are correctly configured
4. ✅ No linting errors introduced
5. ✅ App should now run without "Style property 'width' is not supported by native animated module" errors

## Usage Guidelines

### Use `useNativeDriver: true` for:
- `opacity`
- `transform` properties (`translateX`, `translateY`, `scale`, `rotate`, etc.)

### Use `useNativeDriver: false` for:
- `width`, `height`
- `left`, `right`, `top`, `bottom`
- `margin*`, `padding*`
- `backgroundColor`
- `zIndex`
- `border*` properties

### Recommended Approach:
Use the utility functions from `src/utils/animated.ts`:
```typescript
import { timingLayout, timingNative } from '@/src/utils/animated';

// For layout properties
const widthAnimation = timingLayout(widthValue, 200, 300);

// For transform/opacity properties  
const opacityAnimation = timingNative(opacityValue, 1, 300);
```
