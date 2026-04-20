import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';
import OnboardingStepBar from './OnboardingStepBar';

interface OnboardingTopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onInfo?: () => void;
  currentStep?: number;
  totalSteps?: number;
}

export default function OnboardingTopBar({
  title,
  subtitle,
  onBack,
  onInfo,
  currentStep,
  totalSteps,
}: OnboardingTopBarProps) {
  const router = useRouter();
  const { gameState } = useGame();
  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

  const handleBack = () => {
    haptic.light();
    (onBack ?? (() => router.back()))();
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          style={[styles.iconButton, { borderColor: theme.glassBorder }]}
        >
          <ArrowLeft color={theme.title} size={scale(20)} />
        </TouchableOpacity>

        <View style={styles.textBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.title }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} style={[styles.subtitle, { color: theme.subtitle }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {onInfo ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="More information"
            onPress={onInfo}
            style={[styles.iconButton, { borderColor: theme.glassBorder }]}
          >
            <Info color={theme.title} size={scale(18)} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {currentStep != null && totalSteps != null && (
        <OnboardingStepBar currentStep={currentStep} totalSteps={totalSteps} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: responsiveSpacing.lg,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: scale(14),
    borderWidth: 1,
    height: scale(44),
    justifyContent: 'center',
    width: scale(44),
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '800',
    lineHeight: fontScale(28),
    marginBottom: scale(2),
  },
  subtitle: {
    fontSize: fontScale(12),
    fontWeight: '500',
    lineHeight: fontScale(16),
  },
  placeholder: {
    width: scale(44),
  },
});
