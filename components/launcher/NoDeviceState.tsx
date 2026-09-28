import { responsiveSpacing as layoutSpace, responsiveBorderRadius as layoutRadius ,
  responsivePadding,
  responsiveFontSize,
  responsiveSpacing,
  scale,
  fontScale,
} from '@/utils/scaling';
import { uiPalette } from '@/lib/config/theme';
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


export default function NoDeviceState({ device }: { device: 'computer' | 'phone' }) {
  const { t } = useTranslation();
  const { gameState } = useGame();
  const router = useRouter();
  const darkMode = gameState.settings.darkMode;
  const DeviceIcon = device === 'computer' ? Monitor : Smartphone;

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <View style={styles.iconContainer}>
        <DeviceIcon size={scale(80)} color={darkMode ? uiPalette.lightMuted : uiPalette.muted} />
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
    backgroundColor: uiPalette.white,
  },
  containerDark: {
    backgroundColor: uiPalette.navy,
  },
  iconContainer: {
    marginBottom: responsiveSpacing.xl,
  },
  // The one heading on this surface, so the heavier weight is earned.
  title: {
    fontSize: responsiveFontSize['2xl'],
    fontWeight: '700',
    color: uiPalette.navy,
    marginBottom: responsiveSpacing.md,
    textAlign: 'center',
  },
  titleDark: {
    color: uiPalette.paper,
  },
  message: {
    fontSize: responsiveFontSize.base,
    color: uiPalette.lightMuted,
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.4,
  },
  messageDark: {
    color: uiPalette.muted,
  },
  cta: {
    marginTop: layoutSpace.comfortable,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: layoutRadius.lg,
    paddingVertical: layoutSpace.compact,
    paddingHorizontal: layoutSpace.lg,
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
