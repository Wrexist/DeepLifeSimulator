/**
 * useHardwareBack — wire an Android hardware-back-button handler that
 * returns `true` (consumed) so the default navigator behavior is skipped.
 *
 * R3-C: round 2 found that ZERO screens in the project had Android back
 * handlers, so deep-linked players or anyone using the system gesture got
 * dumped into a blank screen mid-flow. This hook is the canonical pattern
 * for onboarding screens, modals, and any screen with custom navigation.
 *
 * Usage:
 *   useHardwareBack(handleBackPress); // returns true means "consumed"
 *
 * Pass a handler that returns true to consume the press, false to let
 * the default navigator behavior run.
 */
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useHardwareBack(handler: () => boolean | void) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const result = handler();
      // Return `true` to indicate the press was handled (default navigator
      // back is skipped). `undefined`/`false` lets the default behavior run.
      return result === true;
    });
    return () => subscription.remove();
  }, [handler]);
}
