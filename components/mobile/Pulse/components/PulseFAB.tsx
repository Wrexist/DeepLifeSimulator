/**
 * PulseFAB — floating gradient compose button.
 *
 * Sits absolute, bottom-right, above the tab bar. Brand magenta-indigo
 * gradient + shadow + center plus icon. Press triggers haptic + onPress.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import { scale, responsiveIconSize, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { pulseHaptics } from '../utils/pulseHaptics';
import { PULSE_GRADIENT } from '../styles/pulseTheme';

const LinearGradient = Gradient;

interface PulseFABProps {
  onPress: () => void;
  accessibilityLabel?: string;
  /**
   * Extra bottom offset (px) added to the base gap. When the app runs
   * full-screen the tab bar owns the safe-area inset, so the FAB is lifted by
   * the same amount to keep its gap above the bar constant across devices.
   */
  bottomOffset?: number;
}

export default function PulseFAB({ onPress, accessibilityLabel = 'Compose new post', bottomOffset = 0 }: PulseFABProps) {
  return (
    <Pressable
      onPress={() => {
        pulseHaptics.medium();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.touch, { bottom: scale(80) + bottomOffset }, pressed && styles.pressed]}
      hitSlop={8}
    >
      <LinearGradient colors={PULSE_GRADIENT as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
        <View style={styles.iconWrap}>
          <Plus size={responsiveIconSize.lg} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: {
    position: 'absolute',
    right: scale(20),
    // `bottom` is applied inline (base gap + safe-area offset) so the FAB
    // clears the tab bar consistently whether or not the inset lives there.
    zIndex: Z_INDEX.DROPDOWN,
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  fab: {
    flex: 1,
    borderRadius: touchTargets.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
