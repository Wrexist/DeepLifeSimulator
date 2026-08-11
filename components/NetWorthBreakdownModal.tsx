import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { X, DollarSign, Home, Car, Building2, TrendingUp, Wallet, Package, Landmark, Bitcoin, Gem } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { buildNetWorthItemisation, NetWorthGroup } from '@/utils/netWorthItemisation';
import { formatMoney } from '@/utils/moneyFormatting';
import { scale, fontScale } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';

interface NetWorthBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * How each group from `buildNetWorthItemisation` is presented. Presentation
 * only — the grouping, the ordering and the arithmetic all live in that pure
 * module, which is where the "rows must add up to the headline" invariant is
 * tested (`__tests__/economy/netWorthItemisation.test.ts`).
 */
const GROUP_PRESENTATION: Record<NetWorthGroup, { label: string; icon: any; color: string }> = {
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
  const isDarkMode = gameState.settings?.darkMode ?? false;

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <TrendingUp size={scale(24)} color="#10B981" />
              <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={1} ellipsizeMode="tail">
                Net Worth
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={scale(24)} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* Total Net Worth */}
            <View style={[styles.totalCard, isDarkMode && styles.totalCardDark]}>
              <Text style={[styles.totalLabel, isDarkMode && styles.totalLabelDark]}>Total Net Worth</Text>
              <Text style={[styles.totalValue, isDarkMode && styles.totalValueDark]}>
                {formatMoney(breakdown.netWorth)}
              </Text>
              <View style={styles.totalBreakdown}>
                <Text style={[styles.totalBreakdownText, isDarkMode && styles.totalBreakdownTextDark]}>
                  Total Assets: {formatMoney(breakdown.totalAssets)}
                </Text>
                {breakdown.totalLiabilities > 0 && (
                  <Text style={[styles.totalBreakdownText, isDarkMode && styles.totalBreakdownTextDark]}>
                    Total Liabilities: -{formatMoney(breakdown.totalLiabilities)}
                  </Text>
                )}
              </View>
            </View>

            {/* Asset Breakdown */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                Assets Breakdown
              </Text>
              
              {assetDetails.map((asset, index) => {
                const Icon = asset.icon;
                const percentage = breakdown.totalAssets > 0 
                  ? ((asset.value / breakdown.totalAssets) * 100).toFixed(1)
                  : '0.0';
                
                return (
                  <View key={index} style={[styles.assetCard, isDarkMode && styles.assetCardDark]}>
                    <View style={styles.assetHeader}>
                      <View style={[styles.assetIconContainer, { backgroundColor: `${asset.color}20` }]}>
                        <Icon size={scale(20)} color={asset.color} />
                      </View>
                      <View style={styles.assetInfo}>
                        <Text style={[styles.assetLabel, isDarkMode && styles.assetLabelDark]}>
                          {asset.label}
                        </Text>
                        <Text style={[styles.assetPercentage, isDarkMode && styles.assetPercentageDark]}>
                          {percentage}% of assets
                        </Text>
                      </View>
                      <Text style={[styles.assetValue, isDarkMode && styles.assetValueDark]}>
                        {formatMoney(asset.value)}
                      </Text>
                    </View>
                    
                    {asset.items && asset.items.length > 0 && (
                      <View style={styles.assetItems}>
                        {asset.items.map((item, itemIndex) => (
                          <View key={itemIndex} style={styles.assetItem}>
                            <View style={styles.assetItemDot} />
                            <Text style={[styles.assetItemName, isDarkMode && styles.assetItemNameDark]}>
                              {item.name}
                            </Text>
                            <Text style={[styles.assetItemValue, isDarkMode && styles.assetItemValueDark]}>
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
            <View style={[styles.summaryCard, isDarkMode && styles.summaryCardDark]}>
              <Text style={[styles.summaryTitle, isDarkMode && styles.summaryTitleDark]}>
                How Net Worth is Calculated
              </Text>
              <Text style={[styles.summaryText, isDarkMode && styles.summaryTextDark]}>
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  container: {
    width: '100%',
    maxWidth: scale(600),
    height: '90%',
    maxHeight: scale(800),
    backgroundColor: '#fff',
    borderRadius: scale(20),
    overflow: 'hidden',
    ...getShadow(20, '#000'),
  },
  containerDark: {
    backgroundColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    minHeight: scale(60),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    flex: 1,
    marginRight: scale(12),
  },
  title: {
    fontSize: fontScale(22),
    fontWeight: 'bold',
    color: '#0F172A',
    flexShrink: 1,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: scale(8),
    minWidth: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: scale(20),
  },
  totalCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: scale(16),
    padding: scale(20),
    marginBottom: scale(24),
    borderWidth: 2,
    borderColor: '#10B981',
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  totalCardDark: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  totalLabel: {
    fontSize: fontScale(16),
    color: '#059669',
    fontWeight: '600',
    marginBottom: scale(8),
  },
  totalLabelDark: {
    color: '#34D399',
  },
  totalValue: {
    fontSize: fontScale(32),
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: scale(12),
  },
  totalValueDark: {
    color: '#6EE7B7',
  },
  totalBreakdown: {
    gap: scale(4),
  },
  totalBreakdownText: {
    fontSize: fontScale(14),
    color: '#047857',
  },
  totalBreakdownTextDark: {
    color: '#6EE7B7',
  },
  section: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: scale(16),
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  assetCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assetCardDark: {
    backgroundColor: '#334155',
    borderColor: '#4B5563',
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
    color: '#1E293B',
    marginBottom: scale(2),
  },
  assetLabelDark: {
    color: '#FFFFFF',
  },
  assetPercentage: {
    fontSize: fontScale(12),
    color: '#6B7280',
  },
  assetPercentageDark: {
    color: '#94A3B8',
  },
  assetValue: {
    fontSize: fontScale(18),
    fontWeight: 'bold',
    color: '#10B981',
  },
  assetValueDark: {
    color: '#34D399',
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
    color: '#6B7280',
  },
  assetItemNameDark: {
    color: '#94A3B8',
  },
  assetItemValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1E293B',
  },
  assetItemValueDark: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: scale(12),
    padding: scale(16),
    marginTop: scale(8),
  },
  summaryCardDark: {
    backgroundColor: '#334155',
  },
  summaryTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: scale(8),
  },
  summaryTitleDark: {
    color: '#FFFFFF',
  },
  summaryText: {
    fontSize: fontScale(13),
    color: '#6B7280',
    lineHeight: fontScale(20),
  },
  summaryTextDark: {
    color: '#94A3B8',
  },
});

