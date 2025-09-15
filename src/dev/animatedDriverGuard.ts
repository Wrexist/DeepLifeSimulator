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
    // eslint-disable-next-line no-console
    console.error(
      `[AnimatedDriverGuard] Same Animated.Value used with both drivers!`,
      { firstMode: rec.mode, now: mode, firstStack: rec.firstStack, nowStack: getStack() }
    );
  }
}

export function installAnimatedDriverGuard() {
  if (!isDev) return;

  const origTiming = Animated.timing;
  // @ts-ignore
  Animated.timing = (value: any, config: any) => {
    mark(value, config?.useNativeDriver ? 'native' : 'js');
    return origTiming(value, config);
  };

  const origSpring = Animated.spring;
  // @ts-ignore
  Animated.spring = (value: any, config: any) => {
    mark(value, config?.useNativeDriver ? 'native' : 'js');
    return origSpring(value, config);
  };

  const origDecay = Animated.decay;
  // @ts-ignore
  Animated.decay = (value: any, config: any) => {
    mark(value, config?.useNativeDriver ? 'native' : 'js');
    return origDecay(value, config);
  };

  // eslint-disable-next-line no-console
  console.log('[AnimatedDriverGuard] installed');
}
