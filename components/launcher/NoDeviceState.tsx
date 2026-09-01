/**
 * The "you don't own this device yet" empty state, shared by both launcher
 * wrappers. Not a dead end: the CTA points straight at the surface that sells
 * the device (Life -> shop segment).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Monitor, Smartphone } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  scale,
  fontScale,
} from '@/utils/scaling';

export default function NoDeviceState({ device }: { device: 'computer' | 'phone' }) {
  const { t } = useTranslation();
  const { gameState } = useGame();
  const router = useRouter();
  const darkMode = gameState.settings.darkMode;
  const DeviceIcon = device === 'computer' ? Monitor : Smartphone;

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <View style={styles.iconContainer}>
        <DeviceIcon size={scale(80)} color={darkMode ? '#64748B' : '#94A3B8'} />
      </View>
      <Text style={[styles.title, darkMode && styles.titleDark]}>
        {device === 'computer' ? t('computer.noComputerAvailable') : t('mobile.noPhoneAvailable')}
      </Text>
      <Text style={[styles.message, darkMode && styles.messageDark]}>
        {device === 'computer' ? t('computer.noComputerMessage') : t('mobile.noPhoneMessage')}
      </Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={() =>
          router.navigate({ pathname: '/(tabs)/life', params: { segment: 'shop', ts: String(Date.now()) } })
        }
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Shop for a ${device} in the Market`}
      >
        <Text style={styles.ctaText}>Shop the Market</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsivePadding.xlarge,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#020617',
  },
  iconContainer: {
    marginBottom: responsiveSpacing.xl,
  },
  // The one heading on this surface, so the heavier weight is earned.
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: responsiveSpacing.md,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F8FAFC',
  },
  message: {
    fontSize: responsiveFontSize.base,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
  },
  messageDark: {
    color: '#94A3B8',
  },
  cta: {
    marginTop: scale(20),
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: scale(12),
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    minHeight: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#3B82F6',
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});
