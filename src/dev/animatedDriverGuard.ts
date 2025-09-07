// DEV-ONLY helper: detects when the same Animated.Value is animated sometimes with
// useNativeDriver:true and sometimes with false. Logs file/stack so you can fix it.
import { Animated } from 'react-native';

type Mode = 'native' | 'js';
const reg = new WeakMap<object, { mode: Mode; firstStack?: string }>();
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

function getStack() {
  try { throw new Error('stack'); } catch (e: any) { return e?.stack; }
}

function wrapTiming() {
  const orig = Animated.timing;
  // @ts-ignore
  Animated.timing = (value: any, config: any) => {
    if (isDev && value) {
      const mode: Mode = config?.useNativeDriver ? 'native' : 'js';
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
    return orig(value, config);
  };
}

function wrapSpring() {
  const orig = Animated.spring;
  // @ts-ignore
  Animated.spring = (value: any, config: any) => {
    if (isDev && value) {
      const mode: Mode = config?.useNativeDriver ? 'native' : 'js';
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
    return orig(value, config);
  };
}

function wrapDecay() {
  const orig = Animated.decay;
  // @ts-ignore
  Animated.decay = (value: any, config: any) => {
    if (isDev && value) {
      const mode: Mode = config?.useNativeDriver ? 'native' : 'js';
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
    return orig(value, config);
  };
}

export function installAnimatedDriverGuard() {
  if (!isDev) return;
  wrapTiming();
  wrapSpring();
  wrapDecay();
  // eslint-disable-next-line no-console
  console.log('[AnimatedDriverGuard] installed');
}
