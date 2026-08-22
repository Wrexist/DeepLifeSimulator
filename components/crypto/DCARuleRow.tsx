import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Repeat, Trash2 } from 'lucide-react-native';
import { CryptoDCARule } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';

import { formatMoney } from '@/utils/moneyFormatting';

interface Props {
  rule: CryptoDCARule;
  currentWeek: number;
  darkMode: boolean;
  onDelete?: () => void;
}

export default function DCARuleRow({ rule, currentWeek, darkMode, onDelete }: Props) {
  const theme = getThemeColors(darkMode);
  const weeksUntil = rule.nextExecutionWeek - currentWeek;
  const dueText =
    weeksUntil <= 0
      ? 'Due now'
      : weeksUntil === 1
        ? 'Next week'
        : `In ${weeksUntil} weeks`;
  const avgCost =
    rule.totalCoinsBought > 0 ? rule.totalInvested / rule.totalCoinsBought : 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={[styles.iconBubble, { backgroundColor: theme.surface }]}>
        <Repeat size={scale(16)} color={theme.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.text }]}>
          {formatMoney(rule.amount)} → {rule.cryptoId.toUpperCase()}
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          {rule.cadence === 'weekly' ? 'Weekly' : 'Monthly'} · {dueText}
        </Text>
        {rule.totalInvested > 0 && (
          <Text style={[styles.stats, { color: theme.textSecondary }]}>
            {formatMoney(rule.totalInvested)} invested · {rule.totalCoinsBought.toFixed(4)} {rule.cryptoId.toUpperCase()} · avg {formatMoney(avgCost)}
          </Text>
        )}
      </View>
      {onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={hitSlopToMinTarget(scale(14))}
          style={[styles.delBtn, minTouchTargetStyle]}
          accessibilityRole="button"
          accessibilityLabel="Delete this recurring buy rule"
        >
          <Trash2 size={scale(14)} color={accent.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  sub: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  stats: {
    fontSize: responsiveFontSize.xs,
    marginTop: 4,
  },
  delBtn: {
    padding: responsiveSpacing.xs,
  },
});
