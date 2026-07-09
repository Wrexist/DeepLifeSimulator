import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, Plus } from 'lucide-react-native';
import { SavingsGoal } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer } from '@/utils/glassmorphismStyles';

interface Props {
  goal: SavingsGoal;
  darkMode: boolean;
  onContribute?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

const CATEGORY_COLOR: Record<string, string> = {
  emergency: accent.danger,
  house: accent.info,
  vacation: '#06b6d4',
  retirement: '#a855f7',
  other: '#64748b',
};

// RGB triplets that mirror CATEGORY_COLOR — used for the Recipe C tinted bubble
// (15% fill / 30% rim) so the categorical hue survives while its volume drops.
const CATEGORY_RGB: Record<string, string> = {
  emergency: '239, 68, 68',
  house: '59, 130, 246',
  vacation: '6, 182, 212',
  retirement: '168, 85, 247',
  other: '100, 116, 139',
};

export default function SavingsGoalCard({ goal, darkMode, onContribute }: Props) {
  const theme = getThemeColors(darkMode);
  const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const pct = Math.max(0, Math.min(1, progress));
  const color = CATEGORY_COLOR[goal.category] ?? '#64748b';
  const rgb = CATEGORY_RGB[goal.category] ?? '100, 116, 139';
  const complete = pct >= 1;

  return (
    <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl }]}>
      <View style={styles.headerRow}>
        <View style={[getGlassIconContainer(darkMode, 32), { backgroundColor: `rgba(${rgb}, 0.15)`, borderWidth: 1, borderColor: `rgba(${rgb}, 0.30)` }]}>
          <Target size={scale(16)} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}
          </Text>
        </View>
        {onContribute && !complete && (
          <TouchableOpacity
            onPress={onContribute}
            style={[styles.addBtn, { backgroundColor: `rgba(${rgb}, 0.15)`, borderColor: `rgba(${rgb}, 0.30)` }]}
          >
            <Plus size={scale(14)} color={color} />
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.pctText, { color: complete ? color : theme.textMuted }]}>
        {complete ? 'Goal reached!' : `${Math.round(pct * 100)}% complete`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  sub: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  addBtn: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  track: {
    height: scale(6),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  pctText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
