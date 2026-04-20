import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import { formatMoney } from '@/utils/moneyFormatting';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

interface MoneyBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MoneyBreakdownModal({ visible, onClose }: MoneyBreakdownModalProps) {
  const { gameState } = useGame();
  const { stats } = gameState;
  const { theme, isDark } = useTheme();
  const money = stats?.money ?? 0;

  return (
    <BaseModal visible={visible} onClose={onClose} title="Cash Balance">
      {/* Current Balance */}
      <View style={[styles.totalCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Current Cash</Text>
        <Text style={[styles.totalValue, { color: isDark ? '#22C55E' : '#16A34A' }]}>
          {formatMoney(money)}
        </Text>
        <Text style={[styles.exactValue, { color: theme.textSecondary }]}>
          {money.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </Text>
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>
          About Cash
        </Text>
        <Text style={[styles.infoText, { color: theme.textSecondary }]}>
          {'\u2022'} Cash is the money you have on hand{'\n'}
          {'\u2022'} Use cash to buy items, pay for activities, and make purchases{'\n'}
          {'\u2022'} You can deposit cash into your bank account for savings{'\n'}
          {'\u2022'} Cash doesn't earn interest - consider saving excess funds{'\n'}
          {'\u2022'} Keep some cash on hand for emergencies and daily expenses
        </Text>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    padding: scale(16),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(14),
    ...getShadow(2),
  },
  totalLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    marginBottom: scale(6),
  },
  totalValue: {
    fontSize: fontScale(28),
    fontWeight: '800',
    marginBottom: scale(8),
  },
  exactValue: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  infoCard: {
    padding: scale(14),
    borderRadius: responsiveBorderRadius.md,
  },
  infoTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginBottom: scale(8),
  },
  infoText: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
});
