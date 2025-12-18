/**
 * Moti Stub - Temporary replacement for moti package
 * 
 * Moti was removed to fix TurboModule crash.
 * This provides non-animated versions of Moti components.
 */

import React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';

// MotiView is just a View without animations
export const MotiView: React.FC<ViewProps & { animate?: any; transition?: any; from?: any }> = ({ 
  animate, 
  transition, 
  from, 
  ...props 
}) => {
  // Ignore animation props, just render as View
  return <View {...props} />;
};

// MotiText is just a Text without animations
export const MotiText: React.FC<TextProps & { animate?: any; transition?: any; from?: any }> = ({ 
  animate, 
  transition, 
  from, 
  ...props 
}) => {
  // Ignore animation props, just render as Text
  return <Text {...props} />;
};

