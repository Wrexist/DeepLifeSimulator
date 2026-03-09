/**
 * StatusBar Fallback Component
 * 
 * No-op StatusBar fallback component.
 * Used when expo-status-bar TurboModule fails to load.
 */

import React from 'react';

interface StatusBarFallbackProps {
  style?: 'auto' | 'inverted' | 'light' | 'dark';
  hidden?: boolean;
  networkActivityIndicatorVisible?: boolean;
  translucent?: boolean;
  backgroundColor?: string;
  barStyle?: 'default' | 'light-content' | 'dark-content';
  [key: string]: any; // Allow other props for compatibility
}

/**
 * Fallback StatusBar component
 * Returns an empty View (no-op) since we can't control the status bar without the native module
 * Must return a valid React element, not null, to avoid "Element type is invalid" errors
 */
import { View } from 'react-native';

export default function StatusBarFallback(_props: StatusBarFallbackProps) {
  // Status bar control requires native module
  // Without it, we can't change the status bar, so we return an empty View
  // CRITICAL: Must return a valid React element, not null, to avoid rendering errors
  return <View style={{ display: 'none' }} />;
}

