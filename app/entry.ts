/**
 * Minimal entry point that loads Expo Router.
 * All initialization logic has been moved to app/_layout.tsx
 * to comply with Cursor Rule #1: "entry.ts stays dumb".
 * 
 * NOTE: Expo Router requires a default export, so we provide
 * a minimal component that returns null (expo-router/entry handles routing).
 */

// Load the Expo Router entry
import 'expo-router/entry';

// Export minimal component to satisfy Expo Router requirements
export default function Entry() {
  return null; // expo-router/entry handles actual routing
}

