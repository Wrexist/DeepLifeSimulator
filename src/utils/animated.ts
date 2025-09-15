// src/utils/animated.ts
import { Animated, Platform } from 'react-native';

/**
 * Native driver is not available on React Native Web. Using it there prints
 * warnings like “useNativeDriver is not supported…”. We therefore enable the
 * native driver only on iOS/Android and gracefully fall back to JS on web.
 */
const NATIVE_OK = Platform.OS !== 'web';

/**
 * ---- QUICK HELP ----
 * - Use *Layout* helpers when animating layout/paint props:
 *     width, height, margin/padding, backgroundColor, shadow, border*, zIndex
 *   → these MUST use useNativeDriver:false.
 *
 * - Use *Native* helpers for transform/opacity:
 *     transform (translate/scale/rotate), opacity
 *   → useNativeDriver:true on device (auto-fallback to false on web).
 */

/* -------------------------------------------------------------------------- */
/*                                   TIMING                                   */
/* -------------------------------------------------------------------------- */

export const timingLayout = (
  value: Animated.Value,
  toValue: number,
  duration = 250,
  extra: Partial<Animated.TimingAnimationConfig> = {}
) =>
  Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: false,
    ...extra,
  });

export const timingNative = (
  value: Animated.Value,
  toValue: number,
  duration = 250,
  extra: Partial<Animated.TimingAnimationConfig> = {}
) =>
  Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: NATIVE_OK,
    ...extra,
  });

/* -------------------------------------------------------------------------- */
/*                                   SPRING                                   */
/* -------------------------------------------------------------------------- */

export const springLayout = (
  value: Animated.Value,
  toValue: number,
  extra: Partial<Animated.SpringAnimationConfig> = {}
) =>
  Animated.spring(value, {
    toValue,
    useNativeDriver: false,
    ...extra,
  });

export const springNative = (
  value: Animated.Value,
  toValue: number,
  extra: Partial<Animated.SpringAnimationConfig> = {}
) =>
  Animated.spring(value, {
    toValue,
    useNativeDriver: NATIVE_OK,
    ...extra,
  });

/* -------------------------------------------------------------------------- */
/*                                    DECAY                                   */
/* -------------------------------------------------------------------------- */

export const decayLayout = (
  value: Animated.Value,
  extra: Partial<Animated.DecayAnimationConfig> = {}
) =>
  Animated.decay(value, {
    useNativeDriver: false,
    ...extra,
  });

export const decayNative = (
  value: Animated.Value,
  extra: Partial<Animated.DecayAnimationConfig> = {}
) =>
  Animated.decay(value, {
    useNativeDriver: NATIVE_OK,
    ...extra,
  });

/* -------------------------------------------------------------------------- */
/*                              SMALL CONVENIENCE                             */
/* -------------------------------------------------------------------------- */

/** Force driver choice explicitly (useful inside custom animations). */
export const asNative = <T extends Animated.AnimationConfig>(cfg: T): T =>
  ({ useNativeDriver: NATIVE_OK, ...cfg } as T);

export const asLayout = <T extends Animated.AnimationConfig>(cfg: T): T =>
  ({ useNativeDriver: false, ...cfg } as T);

/** Clamp a number between min and max (handy for values going into animations). */
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

/** Convert a 0–100 progress number into a 0–1 scale value. */
export const progressToUnit = (p: number) => clamp(p / 100, 0, 1);

/** Export the internal flag in case you need it elsewhere. */
export { NATIVE_OK };
