/**
 * LinearGradient Fallback Component
 * 
 * Fallback component that mimics expo-linear-gradient using View + background colors.
 * Used when expo-linear-gradient TurboModule fails to load.
 */

import React from 'react';
import { View, StyleProp, StyleSheet, ViewStyle } from 'react-native';

interface LinearGradientFallbackProps {
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  [key: string]: any; // Allow other props for compatibility
}

/**
 * Fallback LinearGradient component
 * Uses a simple View with the first color as background
 * For more complex gradients, we'd need a proper gradient library
 */
export default function LinearGradientFallback(props: LinearGradientFallbackProps = {}) {
  // Defensive: Ensure props is a valid object
  const safeProps = props && typeof props === 'object' ? props : {};
  
  // Extract with defaults - handle all edge cases
  const {
    colors = [],
    start,
    end,
    locations,
    style,
    children,
    ...otherProps
  } = safeProps;
  
  // Validate and sanitize colors prop to prevent crashes
  // Ensure we always have a valid array with at least one color
  const safeColors = Array.isArray(colors) && colors.length > 0 ? colors : ['transparent'];
  
  // Use the first color as the background
  // In a real implementation, you might want to use react-native-linear-gradient
  // or another library that doesn't require TurboModules
  const backgroundColor = safeColors[0];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        style,
      ]}
      {...otherProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Base styles for the fallback
  },
});

