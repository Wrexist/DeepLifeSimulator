import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameProvider } from '@/contexts/GameContext';
import { UIUXProvider } from '@/contexts/UIUXContext';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingContext';
import TopStatsBar from '@/components/TopStatsBar';
import DailySummaryModal from '@/components/DailySummaryModal';
import DailyGiftManager from '@/components/DailyGiftManager';
import AchievementToast from '@/components/anim/AchievementToast';
import UIUXOverlay from '@/components/UIUXOverlay';
import { setViewportOverride } from '@/utils/scaling';

const PRESETS = [
  // iPhone SE and older
  { label: 'iPhone SE (375×667)', w: 375, h: 667 },
  { label: 'iPhone 6/7/8 (375×667)', w: 375, h: 667 },
  { label: 'iPhone 6/7/8 Plus (414×736)', w: 414, h: 736 },
  
  // iPhone X series
  { label: 'iPhone X/XS (375×812)', w: 375, h: 812 },
  { label: 'iPhone XR/XS Max (414×896)', w: 414, h: 896 },
  
  // iPhone 11/12/13 series
  { label: 'iPhone 11/12/13 (390×844)', w: 390, h: 844 },
  { label: 'iPhone 11/12/13 Pro Max (428×926)', w: 428, h: 926 },
  
  // iPhone 14/15 series
  { label: 'iPhone 14/15 (393×852)', w: 393, h: 852 },
  { label: 'iPhone 14/15 Plus (430×932)', w: 430, h: 932 },
  { label: 'iPhone 14/15 Pro (393×852)', w: 393, h: 852 },
  { label: 'iPhone 14/15 Pro Max (430×932)', w: 430, h: 932 },
  
  // iPhone 16 series (latest)
  { label: 'iPhone 16 (393×852)', w: 393, h: 852 },
  { label: 'iPhone 16 Plus (430×932)', w: 430, h: 932 },
  { label: 'iPhone 16 Pro (393×852)', w: 393, h: 852 },
  { label: 'iPhone 16 Pro Max (430×932)', w: 430, h: 932 },
  
  // iPad models
  { label: 'iPad 9/10 (768×1024)', w: 768, h: 1024 },
  { label: 'iPad Air (820×1180)', w: 820, h: 1180 },
  { label: 'iPad Pro 11" (834×1194)', w: 834, h: 1194 },
  { label: 'iPad Pro 12.9" (1024×1366)', w: 1024, h: 1366 },
  { label: 'iPad Mini (744×1133)', w: 744, h: 1133 },
  
  // Desktop resolutions
  { label: 'Desktop 1280', w: 1280, h: 800 },
  { label: 'Desktop 1440', w: 1440, h: 900 },
  { label: 'Desktop 1920', w: 1920, h: 1080 },
];

export default function Preview() {
  const apply = (w?: number, h?: number) => {
    setViewportOverride(w, h);
    if (Platform.OS === 'web') {
      // Redirect to the main app with the new viewport
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaProvider>
      <GameProvider>
        <UIUXProvider>
          <OnboardingProvider>
            <PreviewContent apply={apply} />
          </OnboardingProvider>
        </UIUXProvider>
      </GameProvider>
    </SafeAreaProvider>
  );
}

function PreviewContent({ apply }: { apply: (w?: number, h?: number) => void }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={[styles.statusBar, { height: insets.top }]} />
      
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Viewport Preview (web)</Text>

        <View style={styles.row}>
          {PRESETS.map(p => (
            <TouchableOpacity key={p.label} style={styles.button} onPress={() => apply(p.w, p.h)}>
              <Text style={styles.buttonText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.button, styles.reset]} onPress={() => apply(undefined, undefined)}>
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Själva appen renderas nedan med full layout. */}
        <View style={styles.frameOuter}>
          <View style={styles.frame}>
            <TopStatsBar />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
            <DailySummaryModal />
            <DailyGiftManager />
            <AchievementToast />
            <UIUXOverlay />
          </View>
        </View>

        <Text style={styles.hint}>
          Tips: Klicka på en preset för att gå till spelet med den upplösningen. Du kan också sätta ?w=393&h=852 i URL:en.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  statusBar: {
    backgroundColor: '#fff',
  },
  container: { padding: 16, gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  reset: { backgroundColor: '#374151' },
  buttonText: { color: '#fff', fontWeight: '700' },
  frameOuter: {
    borderWidth: 1, borderColor: '#e5e7eb', padding: 8, borderRadius: 12, backgroundColor: '#f9fafb'
  },
  frame: { width: '100%', flex: 1 },
  hint: { opacity: 0.7, marginTop: 8 },
});
