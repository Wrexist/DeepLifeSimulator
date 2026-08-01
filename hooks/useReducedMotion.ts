/**
 * useReducedMotion — shared accessibility hook for the OS "Reduce Motion" setting.
 *
 * Returns a reactive boolean that is `true` when the user has asked the system
 * to minimize animation. Components should skip/curtail non-essential motion
 * (looping pulses, parallax, spring overshoot) when this is true.
 *
 * Reactive: updates live if the user toggles the setting while the app is open.
 * Replaces the duplicated one-shot `AccessibilityInfo.isReduceMotionEnabled()`
 * calls scattered across the Pulse/Spark components.
 *
 * ── Missing APIs are survivable, not fatal ────────────────────────────────
 *
 * This hook used to guard only the PROMISE: `isReduceMotionEnabled().catch()`.
 * That covers a rejected query and nothing else — if the method itself is
 * absent, the call throws a TypeError synchronously, before any promise exists,
 * and takes down whichever screen mounted the hook. Not hypothetical: it is
 * exactly what happens under the repo's react-native test mock, where a single
 * animated component crashed the entire provider tree into the error boundary.
 *
 * An accessibility QUERY failing must never be worse than the setting being
 * off, so every entry point is existence-checked and wrapped. Not-known reads
 * as not-reduced, which is the same answer the hook starts with.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    let subscription: { remove?: () => void } | undefined;

    try {
      const query = AccessibilityInfo?.isReduceMotionEnabled;
      if (typeof query === 'function') {
        Promise.resolve(query.call(AccessibilityInfo))
          .then((value) => {
            if (mounted) setReduced(!!value);
          })
          .catch(() => {
            // A rejected query is just "not reduced".
          });
      }

      // Called directly rather than through the extracted reference: RN types
      // `addEventListener` as an overload set, and `.call` on it collapses to
      // the first overload ('announcementFinished').
      if (typeof AccessibilityInfo?.addEventListener === 'function') {
        subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
          if (mounted) setReduced(!!value);
        });
      }
    } catch {
      // Platform without the API — stay at "not reduced".
    }

    return () => {
      mounted = false;
      try {
        subscription?.remove?.();
      } catch {
        // Unsubscribing must not throw during teardown either.
      }
    };
  }, []);

  return reduced;
}

export default useReducedMotion;
