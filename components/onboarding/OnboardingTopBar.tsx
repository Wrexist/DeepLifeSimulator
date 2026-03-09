import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Info } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';

interface OnboardingTopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onInfo?: () => void;
}

export default function OnboardingTopBar({ title, subtitle, onBack, onInfo }: OnboardingTopBarProps) {
  const router = useRouter();
  const { gameState } = useGame();
  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onBack ?? (() => router.back())}
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
        <TouchableOpacity accessibilityRole="button" onPress={onInfo} style={[styles.iconButton, { borderColor: theme.glassBorder }]}>
          <Info color={theme.title} size={scale(18)} />
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: responsiveSpacing.md,
    marginBottom: responsiveSpacing.lg,
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
