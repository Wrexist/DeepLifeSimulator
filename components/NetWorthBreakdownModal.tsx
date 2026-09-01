import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DollarSign, Home, Car, Building2, TrendingUp, Wallet, Package, Landmark, Bitcoin, Gem } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { buildNetWorthItemisation, NetWorthGroup } from '@/utils/netWorthItemisation';
import { formatMoney } from '@/utils/moneyFormatting';
import { scale, fontScale } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

interface NetWorthBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * How each group from `buildNetWorthItemisation` is presented. Presentation
 * only - the grouping, the ordering and the arithmetic all live in that pure
 * module, which is where the "rows must add up to the headline" invariant is
 * tested (`__tests__/economy/netWorthItemisation.test.ts`).
 */
const GROUP_PRESENTATION: Record<NetWorthGroup, { label: string; icon: LucideIcon; color: string }> = {
  cash: { label: 'Cash', icon: DollarSign, color: '#10B981' },
  savings: { label: 'Bank Savings', icon: Wallet, color: '#3B82F6' },
  accounts: { label: 'Your Accounts', icon: Landmark, color: '#0EA5E9' },
  crypto: { label: 'Crypto', icon: Bitcoin, color: '#F97316' },
  stocks: { label: 'Stocks', icon: TrendingUp, color: '#22C55E' },
  luxury: { label: 'Luxury', icon: Gem, color: '#EC4899' },
  property: { label: 'Real Estate', icon: Home, color: '#8B5CF6' },
  vehicle: { label: 'Vehicles', icon: Car, color: '#F59E0B' },
  business: { label: 'Businesses', icon: Building2, color: '#EF4444' },
  hardware: { label: 'Hardware', icon: Package, color: '#6366F1' },
  item: { label: 'Items', icon: Package, color: '#14B8A6' },
};

export default function NetWorthBreakdownModal({ visible, onClose }: NetWorthBreakdownModalProps) {
  const { gameState } = useGame();
  const { theme, isDark } = useTheme();

  const { breakdown, rows } = useMemo(() => buildNetWorthItemisation(gameState), [gameState]);

  const assetDetails = useMemo(
    () =>
      rows.map((row) => ({
        ...GROUP_PRESENTATION[row.group],
        value: row.value,
        items: row.items,
      })),
    [rows],
  );

  return (
    <BaseModal visible={visible} onClose={onClose} title="Net Worth">
      {/* Total Net Worth */}
      <View
        style={[
          styles.totalCard,
          { backgroundColor: isDark ? '#064E3B' : '#F0FDF4' },
        ]}
      >
        <Text style={[styles.totalLabel, { color: isDark ? '#34D399' : '#059669' }]}>Total Net Worth</Text>
        <Text style={[styles.totalValue, { color: isDark ? '#6EE7B7' : '#10B981' }]}>
          {formatMoney(breakdown.netWorth)}
        </Text>
        <View style={styles.totalBreakdown}>
          <Text style={[styles.totalBreakdownText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
            Total Assets: {formatMoney(breakdown.totalAssets)}
          </Text>
          {breakdown.totalLiabilities > 0 && (
            <Text style={[styles.totalBreakdownText, { color: isDark ? '#6EE7B7' : '#047857' }]}>
              Total Liabilities: -{formatMoney(breakdown.totalLiabilities)}
            </Text>
          )}
        </View>
      </View>

      {/* Asset Breakdown */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Assets Breakdown
        </Text>

        {assetDetails.map((asset, index) => {
          const Icon = asset.icon;
          const percentage = breakdown.totalAssets > 0
            ? ((asset.value / breakdown.totalAssets) * 100).toFixed(1)
            : '0.0';

          return (
            <View
              key={index}
              style={[
                styles.assetCard,
                {
                  backgroundColor: isDark ? '#334155' : '#F8FAFC',
                  borderColor: isDark ? '#475569' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.assetHeader}>
                <View style={[styles.assetIconContainer, { backgroundColor: `${asset.color}20` }]}>
                  <Icon size={scale(20)} color={asset.color} />
                </View>
                <View style={styles.assetInfo}>
                  <Text style={[styles.assetLabel, { color: theme.text }]}>
                    {asset.label}
                  </Text>
                  <Text style={[styles.assetPercentage, { color: theme.textSecondary }]}>
                    {percentage}% of assets
                  </Text>
                </View>
                <Text style={[styles.assetValue, { color: isDark ? '#34D399' : '#10B981' }]}>
                  {formatMoney(asset.value)}
                </Text>
              </View>

              {asset.items && asset.items.length > 0 && (
                <View style={styles.assetItems}>
                  {asset.items.map((item, itemIndex) => (
                    <View key={itemIndex} style={styles.assetItem}>
                      <View style={styles.assetItemDot} />
                      <Text style={[styles.assetItemName, { color: theme.textSecondary }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.assetItemValue, { color: theme.text }]}>
                        {formatMoney(item.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>
          How Net Worth is Calculated
        </Text>
        <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
          • Cash: Your current wallet balance{'\n'}
          • Bank Savings: Money in your savings{'\n'}
          • Your Accounts: Balances in accounts you opened{'\n'}
          • Crypto: Coins held, at today's price{'\n'}
          • Stocks: Shares held, at today's price{'\n'}
          • Luxury: Resale value, condition included{'\n'}
          • Real Estate: Current market value of owned properties{'\n'}
          • Vehicles: Depreciated value based on condition and mileage{'\n'}
          • Businesses: Valued at one year of income (52x weekly){'\n'}
          • Hardware: Total value of mining equipment{'\n'}
          • Items: Market value of owned items{'\n'}
          • Loans: Outstanding balances are subtracted{'\n'}
          {'\n'}
          Net Worth = Total Assets - Total Liabilities
        </Text>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  // NOTE: colours are supplied at render time from useTheme() in the component
  // body - the old static `*Dark` twin keys are gone on purpose.
  totalCard: {
    borderRadius: scale(16),
    padding: scale(20),
    marginBottom: scale(24),
    borderWidth: 2,
    borderColor: '#10B981',
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  totalLabel: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginBottom: scale(8),
  },
  totalValue: {
    fontSize: fontScale(32),
    fontWeight: 'bold',
    marginBottom: scale(12),
  },
  totalBreakdown: {
    gap: scale(4),
  },
  totalBreakdownText: {
    fontSize: fontScale(14),
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    marginBottom: scale(16),
  },
  assetCard: {
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
    borderWidth: 1,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  assetIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  assetInfo: {
    flex: 1,
  },
  assetLabel: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginBottom: scale(2),
  },
  assetPercentage: {
    fontSize: fontScale(12),
  },
  assetValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
  },
  assetItems: {
    marginTop: scale(8),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  assetItemDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#10B981',
    marginRight: scale(8),
  },
  assetItemName: {
    flex: 1,
    fontSize: fontScale(14),
  },
  assetItemValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: scale(12),
    padding: scale(16),
    marginTop: scale(8),
  },
  summaryTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginBottom: scale(8),
  },
  summaryText: {
    fontSize: fontScale(13),
    lineHeight: fontScale(20),
  },
});
