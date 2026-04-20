/**
 * Utility to check if react-native-reanimated is available and working
 * 
 * DISABLED: react-native-reanimated removed to fix TurboModule crash
 * This now always returns false
 */

/**
 * Check if react-native-reanimated is available
 * Always returns false since package was removed
 */
export function isReanimatedAvailable(): boolean {
  return false;
}

/**
 * Safely get reanimated module, returns null if not available
 * Always returns null since package was removed
 */
export function getReanimatedModule(): any | null {
  return null;
}

