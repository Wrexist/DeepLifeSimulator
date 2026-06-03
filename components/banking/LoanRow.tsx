import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CreditCard, ChevronRight, AlertTriangle } from 'lucide-react-native';
import { Loan } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  loan: Loan;
  darkMode: boolean;
  onPress?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

function loanTypeLabel(type: Loan['type']): string {
  switch (type) {
    case 'personal':
      return 'Personal Loan';
    case 'auto':
      return 'Auto Loan';
    case 'business':
      return 'Business Loan';
    case 'mortgage':
      return 'Mortgage';
  }
}

export default function LoanRow({ loan, darkMode, onPress }: Props) {
  const theme = getThemeColors(darkMode);
  const progress = loan.principal > 0 ? 1 - loan.remaining / loan.principal : 0;
  const fillPct = Math.max(0, Math.min(1, progress));
  const hasMissed = (loan.latePayments ?? 0) > 0;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: theme.surface }]}>
          <CreditCard size={scale(18)} color={theme.text} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {loan.name || loanTypeLabel(loan.type)}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {loanTypeLabel(loan.type)} · {(loan.rateAPR * 100).toFixed(2)}% APR
          </Text>
        </View>
        <View style={styles.tail}>
          <Text style={[styles.remaining, { color: theme.text }]}>{formatMoney(loan.remaining)}</Text>
          <Text style={[styles.tailSub, { color: theme.textMuted }]}>remaining</Text>
        </View>
        {onPress && <ChevronRight size={scale(16)} color={theme.textMuted} />}
      </View>

      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${fillPct * 100}%`, backgroundColor: accent.info }]} />
      </View>

      <View style={styles.footRow}>
        <Text style={[styles.foot, { color: theme.textMuted }]}>
          {Math.round(fillPct * 100)}% paid · {loan.weeksRemaining}w left
        </Text>
        <Text style={[styles.foot, { color: theme.textMuted }]}>{formatMoney(loan.weeklyPayment)}/wk</Text>
      </View>

      {hasMissed && (
        <View style={styles.warningRow}>
          <AlertTriangle size={scale(12)} color={accent.danger} />
          <Text style={styles.warningText}>
            {loan.latePayments} late {loan.latePayments === 1 ? 'payment' : 'payments'} on file
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  sub: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  tail: {
    alignItems: 'flex-end',
  },
  remaining: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
  },
  tailSub: {
    fontSize: responsiveFontSize.xs,
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
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  foot: {
    fontSize: responsiveFontSize.xs,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warningText: {
    fontSize: responsiveFontSize.xs,
    color: accent.danger,
    fontWeight: '600',
  },
});
