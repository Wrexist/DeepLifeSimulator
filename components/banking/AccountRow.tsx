import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Wallet, PiggyBank, Lock, ChevronRight, TrendingUp } from 'lucide-react-native';
import { BankAccount } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  account: BankAccount;
  currentWeek: number;
  darkMode: boolean;
  onPress?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

function accountTypeLabel(type: BankAccount['type']): string {
  switch (type) {
    case 'checking':
      return 'Checking';
    case 'savings':
      return 'Savings';
    case 'highYieldSavings':
      return 'High-Yield Savings';
    case 'cd':
      return 'Certificate of Deposit';
    case 'moneyMarket':
      return 'Money Market';
  }
}

export default function AccountRow({ account, currentWeek, darkMode, onPress }: Props) {
  const theme = getThemeColors(darkMode);
  const isLocked = account.lockUntilWeek != null && currentWeek < account.lockUntilWeek;
  const weeksUntilUnlock = isLocked ? account.lockUntilWeek! - currentWeek : 0;
  const Icon = account.type === 'checking' ? Wallet : PiggyBank;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <View style={[styles.iconBubble, { backgroundColor: theme.surface }]}>
        <Icon size={scale(20)} color={theme.text} />
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {account.name}
          </Text>
          {account.baseAPR > 0 && (
            <View style={styles.aprChip}>
              <TrendingUp size={scale(10)} color={accent.success} />
              <Text style={styles.aprText}>{(account.baseAPR * 100).toFixed(2)}% APR</Text>
            </View>
          )}
        </View>
        <Text style={[styles.type, { color: theme.textMuted }]}>{accountTypeLabel(account.type)}</Text>
        {isLocked && (
          <View style={styles.lockRow}>
            <Lock size={scale(10)} color={theme.textMuted} />
            <Text style={[styles.lockText, { color: theme.textMuted }]}>
              Locked for {weeksUntilUnlock} more {weeksUntilUnlock === 1 ? 'week' : 'weeks'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.tail}>
        <Text style={[styles.balance, { color: theme.text }]}>{formatMoney(account.balance)}</Text>
        {onPress && <ChevronRight size={scale(16)} color={theme.textMuted} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.md,
  },
  iconBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  type: {
    fontSize: responsiveFontSize.sm,
    marginTop: 2,
  },
  aprChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  aprText: {
    fontSize: responsiveFontSize.xs,
    color: accent.success,
    fontWeight: '700',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  lockText: {
    fontSize: responsiveFontSize.xs,
  },
  tail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  balance: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
  },
});
