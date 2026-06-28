import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gem, Settings, User } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { accent } from '@/lib/config/theme';
import { fontScale, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';

interface MainMenuHeaderProps {
  /** Display name line (e.g. current career title), falls back to "Player". */
  name: string;
  /** Player "level" — mapped from current age. */
  level: number;
  /** XP progress through the current life-year, 0..1. */
  xpProgress: number;
  xpCurrent: number;
  xpMax: number;
  gems: number;
  greeting: string;
  onSettings: () => void;
}

/**
 * Profile bar shown at the top of the Main Menu when a save exists: avatar,
 * greeting + name + level chip, XP bar, gems pill, and a settings gear.
 */
export default function MainMenuHeader({
  name,
  level,
  xpProgress,
  xpCurrent,
  xpMax,
  gems,
  greeting,
  onSettings,
}: MainMenuHeaderProps) {
  const isDarkMode = useGameSelector((s) => Boolean(s?.settings?.darkMode));
  const theme = getOnboardingTheme(isDarkMode);
  const clamped = Math.max(0, Math.min(1, xpProgress));

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarRing}>
        <View style={styles.avatarInner}>
          <User color={theme.title} size={scale(26)} />
        </View>
      </View>

      {/* Greeting + level + XP */}
      <View style={styles.middle}>
        <Text style={[styles.greeting, { color: theme.subtitle }]} numberOfLines={1}>
          {greeting}
        </Text>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.title }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.levelChip, { borderColor: accent.purple }]}>
            <Text style={styles.levelText}>Lv. {level}</Text>
          </View>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${clamped * 100}%` }]} />
        </View>
        <Text style={[styles.xpLabel, { color: theme.subtitle }]}>
          {xpCurrent.toLocaleString()} / {xpMax.toLocaleString()} XP
        </Text>
      </View>

      {/* Gems + settings */}
      <View style={styles.actions}>
        <View style={[styles.gemPill, { borderColor: theme.glassBorder }]}>
          <Gem color={accent.info} size={scale(16)} />
          <Text style={[styles.gemText, { color: theme.title }]}>{gems.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          accessibilityLabel="Settings"
          accessibilityRole="button"
          onPress={onSettings}
          style={[styles.gearButton, { borderColor: theme.glassBorder }]}
        >
          <Settings color={theme.title} size={scale(18)} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    width: '100%',
  },
  avatarRing: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#60A5FA',
    shadowOpacity: 0.7,
    shadowRadius: scale(10),
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  avatarInner: {
    width: scale(46),
    height: scale(46),
    borderRadius: scale(23),
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(4),
  },
  name: {
    fontSize: fontScale(18),
    fontWeight: '800',
    flexShrink: 1,
  },
  levelChip: {
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.full,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(1),
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
  },
  levelText: {
    fontSize: fontScale(10),
    fontWeight: '700',
    color: '#C4B5FD',
  },
  xpTrack: {
    height: verticalScale(6),
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  xpFill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
    backgroundColor: '#34D399',
  },
  xpLabel: {
    fontSize: fontScale(10),
    fontWeight: '600',
    marginTop: verticalScale(3),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    alignSelf: 'flex-start',
  },
  gemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(6),
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  gemText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  gearButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
});
