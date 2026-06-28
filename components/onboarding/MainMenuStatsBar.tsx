import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Brain, Calendar, Heart, Wallet } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { accent } from '@/lib/config/theme';
import { fontScale, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';

interface MainMenuStatsBarProps {
  day: number;
  happiness: number;
  skills: number;
  cash: number;
  labels: { day: string; happiness: string; skills: string; cash: string };
}

function formatCash(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

/**
 * Glass stats strip pinned to the bottom of the Main Menu when a save exists.
 * Shows real save data: days lived, happiness, unlocked skills, cash on hand.
 */
export default function MainMenuStatsBar({ day, happiness, skills, cash, labels }: MainMenuStatsBarProps) {
  const isDarkMode = useGameSelector((s) => Boolean(s?.settings?.darkMode));
  const theme = getOnboardingTheme(isDarkMode);

  const items = [
    { icon: <Calendar color={accent.info} size={scale(18)} />, value: `${day.toLocaleString()}`, label: labels.day },
    { icon: <Heart color={accent.danger} size={scale(18)} />, value: `${Math.round(happiness)}%`, label: labels.happiness },
    { icon: <Brain color={accent.purple} size={scale(18)} />, value: `${skills}`, label: labels.skills },
    { icon: <Wallet color={accent.success} size={scale(18)} />, value: formatCash(cash), label: labels.cash },
  ];

  return (
    <BlurViewFallback
      intensity={28}
      tint={isDarkMode ? 'dark' : 'light'}
      style={[styles.container, { borderColor: theme.glassBorder }]}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.glassBorder }]} /> : null}
          <View style={styles.cell}>
            {item.icon}
            <Text style={[styles.value, { color: theme.title }]} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={[styles.label, { color: theme.subtitle }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </BlurViewFallback>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.xl,
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(8),
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: verticalScale(3),
  },
  divider: {
    width: 1,
    height: verticalScale(34),
    opacity: 0.6,
  },
  value: {
    fontSize: fontScale(15),
    fontWeight: '800',
  },
  label: {
    fontSize: fontScale(10),
    fontWeight: '600',
  },
});
