import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export interface BlurViewFallbackProps extends ViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  blurType?: 'light' | 'dark' | 'xlight' | 'dark' | 'prominent' | 'regular' | 'extraLight' | 'systemMaterial' | 'systemMaterialLight' | 'systemMaterialDark' | 'systemChromeMaterial' | 'systemChromeMaterialLight' | 'systemChromeMaterialDark' | 'systemUltraThinMaterial' | 'systemUltraThinMaterialLight' | 'systemUltraThinMaterialDark' | 'systemThinMaterial' | 'systemThinMaterialLight' | 'systemThinMaterialDark' | 'systemThickMaterial' | 'systemThickMaterialLight' | 'systemThickMaterialDark';
  blurAmount?: number;
  reducedTransparencyFallbackColor?: string;
}

/**
 * BlurViewFallback - Safe fallback for expo-blur BlurView
 * 
 * Since expo-blur is a TurboModule that can crash on iOS 26+,
 * this component provides a safe fallback that mimics the visual
 * appearance using a semi-transparent View with backdrop blur effect.
 * 
 * @param props - BlurViewFallbackProps extending ViewProps
 * @returns A View component with blur-like styling
 */
export default function BlurViewFallback({
  intensity = 20,
  tint = 'default',
  blurType,
  blurAmount,
  reducedTransparencyFallbackColor,
  style,
  children,
  ...viewProps
}: BlurViewFallbackProps): React.JSX.Element {
  // Calculate opacity based on intensity (0-100 scale, default 20)
  // Higher intensity = more opaque background
  const opacity = Math.min(Math.max(intensity / 100, 0), 1);
  
  // Determine background color based on tint
  let backgroundColor = 'rgba(0, 0, 0, 0.1)'; // Default semi-transparent dark
  if (tint === 'light') {
    backgroundColor = `rgba(255, 255, 255, ${opacity * 0.3})`;
  } else if (tint === 'dark') {
    backgroundColor = `rgba(0, 0, 0, ${opacity * 0.3})`;
  } else {
    // Default: semi-transparent dark with slight blur effect
    backgroundColor = `rgba(31, 41, 55, ${opacity * 0.4})`;
  }

  return (
    <View
      style={[
        styles.blurContainer,
        { backgroundColor },
        style,
      ]}
      {...viewProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    // Mimic blur effect with semi-transparent background
    // Note: True blur requires native modules, so we use opacity instead
  },
});

