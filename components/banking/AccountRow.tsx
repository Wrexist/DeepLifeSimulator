import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Wallet, PiggyBank, Lock, ChevronRight, TrendingUp } from 'lucide-react-native';
import { BankAccount } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { MIRRORED_ACCOUNT_IDS } from '@/lib/banking/operations';

interface Props {
  account: BankAccount;
  currentWeek: number;
  darkMode: boolean;
  /** Row tap — opens the deposit flow (kept for backwards compat). */
  onPress?: () => void;
  /** Explicit action buttons. Hidden for mirrored (read-only) accounts. */
  onWithdraw?: () => void;
  onClose?: () => void;
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

export default function AccountRow({ account, currentWeek, darkMode, onPress, onWithdraw, onClose }: Props) {
  const theme = getThemeColors(darkMode);
  const isLocked = account.lockUntilWeek != null && currentWeek < account.lockUntilWeek;
  const weeksUntilUnlock = isLocked ? account.lockUntilWeek! - currentWeek : 0;
  const Icon = account.type === 'checking' ? Wallet : PiggyBank;
  // Mirrored default accounts are read-only views of cash / legacy savings —
  // withdraw/close are rejected by the action layer, so don't offer them at all.
  const isMirrored = MIRRORED_ACCOUNT_IDS.has(account.id);
  const showActions = !isMirrored && (!!onWithdraw || !!onClose);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <View style={styles.mainRow}>
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
                Locked until week {account.lockUntilWeek} ({weeksUntilUnlock} more{' '}
                {weeksUntilUnlock === 1 ? 'week' : 'weeks'})
              </Text>
            </View>
          )}
        </View>
        <View style={styles.tail}>
          <Text style={[styles.balance, { color: theme.text }]}>{formatMoney(account.balance)}</Text>
          {onPress && <ChevronRight size={scale(16)} color={theme.textMuted} />}
        </View>
      </View>

      {showActions && (
        <View style={styles.actionsRow}>
          {onPress && (
            <TouchableOpacity
              onPress={onPress}
              style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>Deposit</Text>
            </TouchableOpacity>
          )}
          {onWithdraw && (
            <TouchableOpacity
              onPress={onWithdraw}
              disabled={isLocked}
              style={[
                styles.actionBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
                isLocked && styles.actionDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>Withdraw</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              disabled={isLocked}
              style={[
                styles.actionBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
                isLocked && styles.actionDisabled,
              ]}
            >
              <Text style={[styles.actionText, { color: accent.danger }]}>Close</Text>
            </TouchableOpacity>
          )}
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
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.xs,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
});
