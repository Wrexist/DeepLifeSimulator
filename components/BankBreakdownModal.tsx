import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PiggyBank, TrendingUp } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { formatMoney } from '@/utils/moneyFormatting';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';
import { nonMirrorDeposits, MIRRORED_ACCOUNT_IDS } from '@/lib/banking/operations';
import { accountTypeLabel } from '@/components/banking/AccountRow';

interface BankBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BankBreakdownModal({ visible, onClose }: BankBreakdownModalProps) {
  const bankSavings = useGameSelector((s) => s.bankSavings);
  // The accounts the player opened themselves. `nonMirrorDeposits` drops
  // checking-default / savings-default, which mirror `stats.money` /
  // `bankSavings` - the legacy pool is already counted as `savings` below.
  const accounts = useGameSelector((s) => s.banking?.accounts);
  const stocks = useGameSelector((s) => s.stocks);
  const weeksLived = useGameSelector((s) => s.weeksLived);
  const { theme, isDark } = useTheme();

  const breakdown = useMemo(() => {
    const savings = bankSavings ?? 0;
    const selfOpened = (accounts ?? []).filter(
      (a) => a && !MIRRORED_ACCOUNT_IDS.has(a.id) && (a.balance ?? 0) > 0
    );
    const selfOpenedTotal = nonMirrorDeposits(accounts ?? []);

    // Calculate stock investments
    // CRITICAL: Get the latest stock prices to ensure sync with StocksApp
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStockInfo } = require('@/lib/economy/stockMarket');

    const stockHoldings = stocks?.holdings || [];
    const stockItems = stockHoldings.map(holding => {
      // Always use the latest stock price from stockMarket (source of truth)
      const stockInfo = getStockInfo(holding.symbol);
      const currentPrice = stockInfo.price || holding.currentPrice || 0;

      return {
        symbol: holding.symbol,
        shares: holding.shares,
        averagePrice: holding.averagePrice,
        currentPrice: currentPrice,
        totalValue: holding.shares * currentPrice,
        gainLoss: (currentPrice - holding.averagePrice) * holding.shares,
        gainLossPercent: holding.averagePrice > 0
          ? ((currentPrice - holding.averagePrice) / holding.averagePrice) * 100
          : 0,
      };
    });

    const totalStockValue = stockItems.reduce((sum, item) => sum + item.totalValue, 0);
    // Must match the HUD chip's total exactly - the chip is what opens this
    // modal, so any term missing from one and present in the other reads as a
    // bug in whichever the player looks at second.
    const totalSavings = savings + selfOpenedTotal + totalStockValue;

    return {
      savings,
      selfOpened,
      selfOpenedTotal,
      stockItems,
      totalStockValue,
      totalSavings,
    };
  }, [bankSavings, accounts, stocks, weeksLived]); // Recalculate when week changes

  return (
    <BaseModal visible={visible} onClose={onClose} title="Bank & Investments">
      {/* Total Savings */}
      <View style={[styles.totalCard, { backgroundColor: isDark ? '#334155' : '#F3F4F6' }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total Savings</Text>
        <Text style={[styles.totalValue, { color: isDark ? '#FBBF24' : '#F59E0B' }]}>
          {formatMoney(breakdown.totalSavings)}
        </Text>
        <Text style={[styles.exactValue, { color: theme.textSecondary }]}>
          {breakdown.totalSavings.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </Text>
      </View>

      {/* Bank Savings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <PiggyBank size={scale(18)} color="#F59E0B" />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Bank Savings
          </Text>
        </View>

        <View style={[styles.itemCard, { backgroundColor: isDark ? '#334155' : '#F9FAFB', borderColor: isDark ? '#4B5563' : '#E5E7EB' }]}>
          <View style={styles.itemHeader}>
            <View style={[styles.itemIconContainer, { backgroundColor: '#F59E0B20' }]}>
              <PiggyBank size={scale(16)} color="#F59E0B" />
            </View>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemLabel, { color: theme.text }]}>
                Savings Account
              </Text>
              <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
                Money deposited in your bank account
              </Text>
            </View>
            <Text style={[styles.itemValue, { color: theme.text }]}>
              {formatMoney(breakdown.savings)}
            </Text>
          </View>
          <Text style={[styles.exactValueSmall, { color: theme.textSecondary }]}>
            {breakdown.savings.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </Text>
        </View>

        {/* Accounts the player opened themselves. These carry a real balance and
            a real APR, and were previously absent from both this list and the
            total it rolls up to - so a funded high-yield account looked like it
            had swallowed the money. */}
        {breakdown.selfOpened.map((account) => (
          <View
            key={account.id}
            style={[styles.itemCard, { backgroundColor: isDark ? '#334155' : '#F9FAFB', borderColor: isDark ? '#4B5563' : '#E5E7EB' }]}
          >
            <View style={styles.itemHeader}>
              <View style={[styles.itemIconContainer, { backgroundColor: '#F59E0B20' }]}>
                <PiggyBank size={scale(16)} color="#F59E0B" />
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemLabel, { color: theme.text }]}>
                  {account.name}
                </Text>
                <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
                  {accountTypeLabel(account.type)}
                  {account.baseAPR > 0 ? ` · ${(account.baseAPR * 100).toFixed(2)}% APR` : ''}
                </Text>
              </View>
              <Text style={[styles.itemValue, { color: theme.text }]}>
                {formatMoney(account.balance)}
              </Text>
            </View>
            <Text style={[styles.exactValueSmall, { color: theme.textSecondary }]}>
              {(account.balance ?? 0).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </Text>
          </View>
        ))}
      </View>

      {/* Stock Investments */}
      {breakdown.stockItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={scale(18)} color="#10B981" />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Stock Investments
            </Text>
          </View>

          {breakdown.stockItems.map((item, index) => {
            const isPositive = item.gainLoss >= 0;
            return (
              <View key={index} style={[styles.itemCard, { backgroundColor: isDark ? '#334155' : '#F9FAFB', borderColor: isDark ? '#4B5563' : '#E5E7EB' }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconContainer, { backgroundColor: '#10B98120' }]}>
                    <TrendingUp size={scale(16)} color={isPositive ? '#10B981' : '#EF4444'} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemLabel, { color: theme.text }]}>
                      {item.symbol}
                    </Text>
                    <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
                      {item.shares.toLocaleString()} shares @ {formatMoney(item.currentPrice)} each
                    </Text>
                    <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
                      Avg: {formatMoney(item.averagePrice)} | Current: {formatMoney(item.currentPrice)}
                    </Text>
                  </View>
                  <View style={styles.itemValueContainer}>
                    <Text style={[styles.itemValue, { color: theme.text }]}>
                      {formatMoney(item.totalValue)}
                    </Text>
                    <Text style={[
                      styles.gainLossText,
                      isPositive ? styles.gainLossPositive : styles.gainLossNegative
                    ]}>
                      {isPositive ? '+' : ''}{formatMoney(item.gainLoss)} ({isPositive ? '+' : ''}{item.gainLossPercent.toFixed(2)}%)
                    </Text>
                  </View>
                </View>
                <Text style={[styles.exactValueSmall, { color: theme.textSecondary }]}>
                  {item.totalValue.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: isDark ? '#334155' : '#F3F4F6' }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>
          About Savings & Investments
        </Text>
        <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
          {'\u2022'} Bank savings are safe and secure{'\n'}
          {'\u2022'} Stock investments can gain or lose value{'\n'}
          {'\u2022'} Total savings = Bank savings + Your accounts + Stock investments{'\n'}
          {'\u2022'} Monitor your investments regularly{'\n'}
          {'\u2022'} Diversify your portfolio to reduce risk
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
    ...getPlatformShadows(6, 0.25, 4, 14),
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
  section: {
    marginBottom: scale(14),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  itemCard: {
    padding: scale(12),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(8),
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  itemIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
    marginBottom: scale(3),
  },
  itemDescription: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
  itemValueContainer: {
    alignItems: 'flex-end',
  },
  itemValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginBottom: scale(3),
  },
  gainLossText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  gainLossPositive: {
    color: '#10B981',
  },
  gainLossNegative: {
    color: '#EF4444',
  },
  exactValueSmall: {
    fontSize: fontScale(12),
    marginTop: scale(6),
    fontFamily: 'monospace',
  },
  summaryCard: {
    padding: scale(14),
    borderRadius: responsiveBorderRadius.md,
  },
  summaryTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginBottom: scale(8),
  },
  summaryText: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
});
