import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { uiPalette } from '@/lib/config/theme';

interface LiquidGlassDiscProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** One circular HUD surface. Icon colour carries meaning; no nested rings. */
export default function LiquidGlassDisc({ style, children }: LiquidGlassDiscProps) {
  return <View style={[styles.disc, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  disc: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: uiPalette.raised,
  },
});
