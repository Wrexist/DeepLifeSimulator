/**
 * GoldStoreButton - the HUD shop entry, in gold, with a periodic shine.
 *
 * WHY IT LOOKS LIKE THIS. The store button was the same quiet grey circle as
 * Help and Settings beside it, so the one button in the HUD that leads to the
 * shop read as chrome. Gold plus a slow shine makes it findable at a glance.
 *
 * WHY IT IS STILL A CIRCLE. An earlier design used a large blue "Shop" pill and
 * the owner rejected it for dominating the HUD (the note lives in
 * `TopStatsBar.tsx` where this is mounted). This keeps that footprint exactly -
 * same diameter, same row, same spacing - and changes only the finish. Louder
 * colour, not more space.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. No badge, no dot, no counter, no bounce on
 * every render, and nothing that implies unread content or a deadline. A red
 * badge on a shop is a notification that lies, and the design brief for this
 * app rules those out by name. The shine says "this is the shop"; it does not
 * say "you have missed something".
 *
 * MOTION BUDGET. Two looped animations, both transform/opacity only, both on
 * the native driver, so the JS thread is untouched while they run. The shine
 * runs for ~1.1s and then rests for ~5s - a continuous sweep reads as a loading
 * spinner and stops being noticed within a minute. `useReducedMotion` disables
 * both entirely and leaves the gold, which is the part that does the work.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Store } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale } from '@/utils/scaling';

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

  // 0 → 1 sweeps the highlight across; held at 0 between passes.
  const shine = useRef(new Animated.Value(0)).current;
  // A breath, not a bounce: 6% is visible in peripheral vision and invisible
  // when you are looking straight at it.
  const pulse = useRef(new Animated.Value(0)).current;

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
        // Snap back with the highlight already off-screen, so the reset is not
        // a second sweep in the opposite direction.
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    shineLoop.start();
    pulseLoop.start();
    // Stopping on unmount matters: this button lives in the persistent HUD, so
    // a leaked loop would keep the driver awake for the whole session.
    return () => {
      shineLoop.stop();
      pulseLoop.stop();
      shine.setValue(0);
      pulse.setValue(0);
    };
  }, [reduceMotion, shine, pulse]);

  const shineTranslate = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-scale(44), scale(44)],
  });
  const scalePulse = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={buttonStyle}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[styles.fill, { transform: [{ scale: scalePulse }] }]}>
        <Gradient
          colors={GOLD_GRADIENT}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Deep brown rather than white: on a light gold fill a white glyph
              loses contrast, and the storefront shape is what identifies the
              button. */}
          <Store size={22} color="#7C2D12" />

          {/* The sweep. `pointerEvents="none"` so it can never eat the tap -
              a decorative overlay that swallows presses on the shop button
              would be an expensive bug to find. */}
          {!reduceMotion && (
            <Animated.View
              pointerEvents="none"
              style={[styles.shine, { transform: [{ translateX: shineTranslate }, { rotate: '18deg' }] }]}
            />
          )}
        </Gradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%', borderRadius: 999, overflow: 'hidden' },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    // Clips the sweep to the circle. Without it the highlight is a bar
    // crossing the whole HUD.
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: -scale(14),
    bottom: -scale(14),
    width: scale(10),
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
});

export default React.memo(GoldStoreButton);
