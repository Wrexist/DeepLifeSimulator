import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Receipt, Trash2, Repeat, AlertTriangle } from 'lucide-react-native';
import { BillPayRule } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard, getGlassIconContainer } from '@/utils/glassmorphismStyles';

interface Props {
  rule: BillPayRule;
  currentWeek: number;
  darkMode: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

export default function BillPayRow({ rule, currentWeek, darkMode, onToggle, onDelete }: Props) {
  const theme = getThemeColors(darkMode);
  const weeksUntilDue = rule.nextDueWeek - currentWeek;
  const dueText =
    weeksUntilDue <= 0
      ? 'Due now'
      : weeksUntilDue === 1
        ? 'Due next week'
        : `Due in ${weeksUntilDue} weeks`;

  return (
    <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl }]}>
      <View style={[getGlassIconContainer(darkMode, 36), { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.30)' }]}>
        <Receipt size={scale(18)} color={accent.info} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {rule.label}
        </Text>
        <View style={styles.metaRow}>
          <Repeat size={scale(10)} color={theme.textMuted} />
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {rule.cadence === 'weekly' ? 'Weekly' : 'Monthly'} · {dueText}
          </Text>
        </View>
        {rule.missedCount > 0 && (
          <View style={styles.warningRow}>
            <AlertTriangle size={scale(10)} color={accent.danger} />
            <Text style={styles.warningText}>
              {rule.missedCount} missed {rule.missedCount === 1 ? 'payment' : 'payments'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.tail}>
        <Text style={[styles.amount, { color: theme.text }]}>{formatMoney(rule.amount)}</Text>
        <View style={styles.actions}>
          {onToggle && <Switch value={rule.enabled} onValueChange={onToggle} />}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
              <Trash2 size={scale(14)} color={accent.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    fontSize: responsiveFontSize.xs,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  warningText: {
    fontSize: responsiveFontSize.xs,
    color: accent.danger,
    fontWeight: '600',
  },
  tail: {
    alignItems: 'flex-end',
    gap: responsiveSpacing.xs,
  },
  amount: {
    fontSize: responsiveFontSize.md,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  deleteBtn: {
    padding: responsiveSpacing.xs,
  },
});
