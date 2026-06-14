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
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Defensive: never let an a11y query failure crash a render path.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => setReduced(value),
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

export default useReducedMotion;
