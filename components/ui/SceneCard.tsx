import LifeLine from './LifeLine';
import { tier2, tier4 } from '@/lib/config/hierarchy';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/hooks/useTheme';
import { responsiveSpacing as layoutSpace, scale, responsiveBorderRadius } from '@/utils/scaling';

const scenes = {
  'contacts-modern': require('@/assets/images/scenes/contacts-modern.webp'),
  'health-modern': require('@/assets/images/scenes/health-modern.webp'),
  'work-food-modern': require('@/assets/images/scenes/work-food-modern.webp'),
  'work-office-modern': require('@/assets/images/scenes/work-office-modern.webp'),
  'work-study-modern': require('@/assets/images/scenes/work-study-modern.webp'),
  'work-lost-items': require('@/assets/images/scenes/work-lost-items.webp'),
  'work-delivery': require('@/assets/images/scenes/work-delivery.webp'),
  'work-cleaning': require('@/assets/images/scenes/work-cleaning.webp'),
  'work-garden': require('@/assets/images/scenes/work-garden.webp'),
  'work-pet-care': require('@/assets/images/scenes/work-pet-care.webp'),
  'work-study': require('@/assets/images/scenes/work-study.webp'),
  'work-network': require('@/assets/images/scenes/work-network.webp'),
  'work-retail': require('@/assets/images/scenes/work-retail.webp'),
  'work-recycling': require('@/assets/images/scenes/work-recycling.webp'),
  'work-vehicle': require('@/assets/images/scenes/work-vehicle.webp'),
  gym: require('@/assets/images/scenes/destination-gym.webp'),
  clinic: require('@/assets/images/scenes/destination-clinic.webp'),
  university: require('@/assets/images/scenes/destination-university.webp'),
  cafe: require('@/assets/images/scenes/destination-cafe.webp'),
  studio: require('@/assets/images/scenes/destination-studio.webp'),
  lounge: require('@/assets/images/scenes/destination-lounge.webp'),
  city: require('@/assets/images/home/city.webp'),
  home: require('@/assets/images/home/home.webp'),
  room: require('@/assets/images/home/room.webp'),
};
export type SceneName = keyof typeof scenes;

/** Local renders of original 3D models. Native-driver depth; no WebGL runtime. */
type SceneCardProps = { scene: SceneName } & (
  | { thumbnail: true; title?: never; subtitle?: never }
  | { thumbnail?: false; title: string; subtitle: string }
);

export default function SceneCard({ scene, title, subtitle, thumbnail = false }: SceneCardProps) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    drift.setValue(0);
    if (reduced || !focused || !active) return;
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 3600, useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 3600, useNativeDriver: true, isInteraction: false }),
    ]));
    motion.start();
    return () => { motion.stop(); drift.setValue(0); };
  }, [drift, reduced, focused, active]);
  return <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }, thumbnail && styles.thumbnail]}>
    {!thumbnail && <View style={styles.line} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><LifeLine color={theme.textSecondary} /></View>}
    {!thumbnail && <View style={styles.copy}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>}
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.art, thumbnail && styles.thumbnailArt, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }, { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }) }] }]}>
      <Image source={scenes[scene]} style={styles.image} resizeMode="contain" />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  thumbnail: { width: scale(72), minHeight: 0, marginBottom: 0, borderWidth: 0, backgroundColor: 'transparent', flexShrink: 0 },
  thumbnailArt: { width: scale(72), height: scale(56) },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: scale(96), borderWidth: 1, borderRadius: responsiveBorderRadius.md, overflow: 'hidden', marginBottom: layoutSpace.compact },
  copy: { flex: 1, padding: layoutSpace.md, paddingRight: 0, gap: layoutSpace.sm },
  title: { ...tier2 },
  subtitle: { ...tier4 },
  line: { position: 'absolute', bottom: 0, right: 0, width: '100%', height: scale(72), opacity: 0.1 },
  art: { width: '36%', height: scale(96) }, image: { width: '100%', height: '100%' },
});
