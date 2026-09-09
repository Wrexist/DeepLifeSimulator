import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, MapPin } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/hooks/useTheme';
import { resolveHomeScene } from '@/lib/home/homeScene';
import { scale, fontScale } from '@/utils/scaling';
import { formatMoney } from '@/utils/moneyFormatting';

const ART = {
  city: require('@/assets/images/home/city.webp'),
  room: require('@/assets/images/home/room.webp'),
  home: require('@/assets/images/home/home.webp'),
};

/** A small, state-driven window into the life. No simulation or saved flags. */
export default function HomeScene({ children }: { children?: React.ReactNode }) {
  const scene = useGameSelector(resolveHomeScene, shallowEqual);
  const reduced = useReducedMotion();
  const { theme } = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // A single settling motion when the environment changes. No background
    // loop, timer, or animation on every cash update / Home tab focus.
    reveal.stopAnimation();
    if (reduced) { reveal.setValue(1); return; }
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1, duration: 650, useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [scene.kind, reduced, reveal]);

  return (
    <View style={styles.section} testID="home-scene">
      <View style={styles.picture}>
        <Animated.View
          pointerEvents="none"
          style={{ transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1.035, 1] }) }] }}
        >
          <Image source={ART[scene.kind]} style={[styles.image, { height: Math.min(scale(220), height * 0.23) }]}
            resizeMode="contain" accessible={false} />
        </Animated.View>
        <View style={styles.location} pointerEvents="none">
          <MapPin size={scale(12)} color="#FFF7E9" />
          <Text style={styles.locationText}>{scene.tenure}</Text>
        </View>
      </View>
      <View style={[styles.caption, { backgroundColor: theme.surface }]}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">{scene.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {scene.rent > 0 ? `${formatMoney(scene.rent)}/week rent · ${scene.subtitle}` : scene.subtitle}
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Explore housing in the Shop"
          onPress={() => router.push({ pathname: '/(tabs)/life', params: { segment: 'shop', ts: String(Date.now()) } })}
          style={[styles.housing, { backgroundColor: theme.background }]} activeOpacity={0.8}>
          <ArrowUpRight size={scale(20)} color={theme.text} />
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: scale(12) },
  picture: { overflow: 'hidden', borderTopLeftRadius: scale(22), borderTopRightRadius: scale(22), backgroundColor: '#DCE5DE' },
  image: { width: '100%' },
  location: { position: 'absolute', left: scale(14), top: scale(14), flexDirection: 'row', alignItems: 'center', gap: scale(5), backgroundColor: '#172A2E', borderRadius: scale(20), paddingHorizontal: scale(10), paddingVertical: scale(6) },
  locationText: { color: '#FFF7E9', fontSize: fontScale(11), fontWeight: '600' },
  caption: { padding: scale(14), flexDirection: 'row', alignItems: 'center', gap: scale(12), borderBottomLeftRadius: scale(20), borderBottomRightRadius: scale(20), marginBottom: scale(10) },
  copy: { flex: 1, gap: scale(4) },
  title: { fontSize: fontScale(20), fontWeight: '600', letterSpacing: -0.4 },
  subtitle: { fontSize: fontScale(12), lineHeight: fontScale(18) },
  housing: { width: Math.max(44, scale(44)), height: Math.max(44, scale(44)), borderRadius: scale(15), alignItems: 'center', justifyContent: 'center' },
});
