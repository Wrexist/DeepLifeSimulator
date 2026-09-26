import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { uiPalette } from '@/lib/config/theme';

interface LiquidGlassDiscProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/** Vector outline with room for edge coverage; never clip through the curve. */
export default function LiquidGlassDisc({ style, children }: LiquidGlassDiscProps) {
  return (
    <View style={[styles.disc, style]}>
      <Svg pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
        width="100%" height="100%" viewBox="0 0 44 44">
        <Circle cx={22} cy={22} r={21.5} fill={uiPalette.raised} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    zIndex: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
