import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/hooks/useTheme';
import { responsiveSpacing as layoutSpace, scale, responsiveBorderRadius, fontScale } from '@/utils/scaling';

const scenes = {
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
export default function SceneCard({ scene, title, subtitle }: { scene: SceneName; title: string; subtitle: string }) {
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
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={styles.copy}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.art, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]}>
      <Image source={scenes[scene]} style={styles.image} resizeMode="contain" />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', minHeight: scale(120), borderWidth: 1, borderRadius: responsiveBorderRadius.xl, overflow: 'hidden', marginBottom: layoutSpace.compact },
  copy: { flex: 1, padding: layoutSpace.md, paddingRight: 0, gap: layoutSpace.sm },
  title: { fontSize: fontScale(16), fontWeight: '600' },
  subtitle: { fontSize: fontScale(12), lineHeight: fontScale(18) },
  art: { width: '46%', height: scale(128) }, image: { width: '100%', height: '100%' },
});
