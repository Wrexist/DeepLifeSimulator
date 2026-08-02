// src/dev/animatedDriverGuard.ts
// Dev-ONLY: logga när SAMMA Animated.Value körs ibland native (true) och ibland JS (false).
import { Animated } from 'react-native';

type Mode = 'native' | 'js';
const reg = new WeakMap<object, { mode: Mode; firstStack?: string }>();
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

function getStack() {
  try { throw new Error('stack'); } catch (e: any) { return e?.stack; }
}

function mark(value: any, mode: Mode) {
  if (!isDev || !value) return;
  const rec = reg.get(value);
  if (!rec) {
    reg.set(value, { mode, firstStack: getStack() });
  } else if (rec.mode !== mode) {
    if (__DEV__) {
       
      console.error(
        `[AnimatedDriverGuard] Same Animated.Value used with both drivers!`,
        { firstMode: rec.mode, now: mode, firstStack: rec.firstStack, nowStack: getStack() }
      );
    }
  }
}

export function installAnimatedDriverGuard() {
  if (!isDev) return;

  // Only `timing` still needs a suppression: RN's types declare it in a way
  // that rejects the assignment, while `spring` and `decay` do not. Their
  // directives were removed after TypeScript reported them as suppressing
  // nothing (TS2578) — a stale `@ts-expect-error` is worse than none, because
  // it will silently swallow a REAL error that appears on that line later.
  const origTiming = Animated.timing;
  // @ts-expect-error -- dev-only monkey-patch of the read-only Animated.timing method to instrument native-driver usage
  Animated.timing = (value: any, config: any) => {
    mark(value, config?.useNativeDriver ? 'native' : 'js');
    return origTiming(value, config);
  };

  const origSpring = Animated.spring;
  Animated.spring = (value: any, config: any) => {
    mark(value, config?.useNativeDriver ? 'native' : 'js');
    return origSpring(value, config);
  };

  const origDecay = Animated.decay;
  Animated.decay = (value: any, config: any) => {
    mark(value, config?.useNativeDriver ? 'native' : 'js');
    return origDecay(value, config);
  };

  if (__DEV__) {
     
    console.log('[AnimatedDriverGuard] installed');
  }
}
