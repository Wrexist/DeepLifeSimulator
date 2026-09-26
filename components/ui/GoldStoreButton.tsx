/** Gold HUD vector circle with a reduced-motion-aware gleam. */
import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Store } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Warm gold, light→deep, so the circle reads as metal rather than as a flat
 *  yellow chip. Identical in both themes: the HUD sits on a dark bar in both. */
const GOLD_GRADIENT: [string, string] = ['#FDE68A', '#D97706'];

interface GoldStoreButtonProps {
  onPress: () => void;
  /** The shared HUD icon-button style, so this keeps the exact footprint of the
   *  Help and Settings buttons beside it. */
  buttonStyle?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function GoldStoreButton({
  onPress,
  buttonStyle,
  accessibilityLabel = 'Open Shop',
  accessibilityHint = 'Tap to open the shop for gems, upgrades, perks, and Remove Ads',
}: GoldStoreButtonProps) {
  const reduceMotion = useReducedMotion();
  const gradientId = `hud-gold-${useId().replace(/:/g, '')}`;

  // Opacity-only gleam leaves the vector outline stationary.
  const shine = useRef(new Animated.Value(0)).current;


  useEffect(() => {
    if (reduceMotion) return undefined;

    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(5000),
        Animated.timing(shine, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Reset while the highlight is invisible.
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );

    shineLoop.start();
    // Stopping on unmount matters: this button lives in the persistent HUD, so
    // a leaked loop would keep the driver awake for the whole session.
    return () => {
      shineLoop.stop();
      shine.setValue(0);
    };
  }, [reduceMotion, shine]);

  const shineOpacity = shine.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.22, 0],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={buttonStyle}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.fill}>
        <Svg pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { zIndex: -1 }]}
          width="100%" height="100%" viewBox="0 0 44 44">
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor={GOLD_GRADIENT[0]} />
              <Stop offset="1" stopColor={GOLD_GRADIENT[1]} />
            </LinearGradient>
          </Defs>
          <Circle cx={22} cy={22} r={21.5} fill={`url(#${gradientId})`} />
        </Svg>
        {!reduceMotion && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1, opacity: shineOpacity }]}>
            <Svg accessible={false} width="100%" height="100%" viewBox="0 0 44 44">
              <Circle cx={22} cy={22} r={21.5} fill="#FFFFFF" />
            </Svg>
          </Animated.View>
        )}
        <Store size={22} color="#7C2D12" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fill: {
    zIndex: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(GoldStoreButton);
