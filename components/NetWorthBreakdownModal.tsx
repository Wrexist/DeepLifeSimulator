import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { X, DollarSign, Home, Car, Building2, TrendingUp, Wallet, Coins, Briefcase, Package, Gem } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { Asset, Liability, computeNetWorth } from '@/utils/netWorth';
import { formatMoney } from '@/utils/moneyFormatting';
import { scale, fontScale, responsivePadding, responsiveBorderRadius } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import { MINER_PRICES } from '@/lib/economy/constants';

interface NetWorthBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function NetWorthBreakdownModal({ visible, onClose }: NetWorthBreakdownModalProps) {
  const { gameState } = useGame();
  const { settings, stats, bankSavings, items, companies, realEstate, vehicles } = gameState;
  const isDarkMode = settings?.darkMode ?? false;

  const breakdown = useMemo(() => {
    const assets: Asset[] = [
      { id: 'cash', type: 'cash', baseValue: stats.money },
      { id: 'savings', type: 'cash', baseValue: bankSavings || 0 },
    ];
    
    // Items
    (items || [])
      .filter(i => i?.owned)
      .forEach(item => assets.push({ id: item.id, type: 'item', baseValue: item.price }));
    
    // Companies
    companies?.forEach(company => {
      assets.push({
        id: company.id,
        type: 'business',
        baseValue: 0,
        trailingWeeklyProfit: company.weeklyIncome,
        valuationMultiple: 10,
      });
      Object.entries(company.miners || {}).forEach(([id, count]) => {
        const price = MINER_PRICES[id as keyof typeof MINER_PRICES];
        if (price && (count as number) > 0) {
          assets.push({
            id: `${company.id}_miner_${id}`,
            type: 'hardware',
            baseValue: price * (count as number),
          });
        }
      });
    });
    
    // Real Estate
    (realEstate || [])
      .filter(p => p?.owned)
      .forEach(p => assets.push({ id: p.id, type: 'property', baseValue: p.price }));
    
    // Vehicles (depreciated value)
    (vehicles || []).forEach(vehicle => {
      const baseSellPercent = 0.8;
      const conditionMultiplier = 0.2 + (vehicle.condition / 100) * 0.8;
      const mileagePenalty = Math.min(0.3, (vehicle.mileage || 0) / 500000);
      const depreciatedValue = vehicle.price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
      assets.push({ id: vehicle.id, type: 'vehicle', baseValue: Math.floor(depreciatedValue) });
    });
    
    const liabilities: Liability[] = [];
    return computeNetWorth(assets, liabilities);
  }, [stats.money, bankSavings, items, companies, realEstate, vehicles]);

  const assetDetails = useMemo(() => {
    const details: Array<{ label: string; value: number; icon: any; color: string; items?: Array<{ name: string; value: number }> }> = [];
    
    // Cash
    if (stats.money > 0) {
      details.push({
        label: 'Cash',
        value: stats.money,
        icon: DollarSign,
        color: '#10B981',
        items: [{ name: 'Wallet', value: stats.money }],
      });
    }
    
    // Bank Savings
    if (bankSavings > 0) {
      details.push({
        label: 'Bank Savings',
        value: bankSavings,
        icon: Wallet,
        color: '#3B82F6',
        items: [{ name: 'Savings Account', value: bankSavings }],
      });
    }
    
    // Real Estate
    const realEstateValue = breakdown.byAssetType.property || 0;
    if (realEstateValue > 0) {
      const properties = (realEstate || [])
        .filter(p => p?.owned)
        .map(p => ({ name: p.name || p.id, value: p.price || 0 }));
      details.push({
        label: 'Real Estate',
        value: realEstateValue,
        icon: Home,
        color: '#8B5CF6',
        items: properties,
      });
    }
    
    // Vehicles
    const vehicleValue = breakdown.byAssetType.vehicle || 0;
    if (vehicleValue > 0) {
      const vehicleList = (vehicles || []).map(v => {
        const baseSellPercent = 0.8;
        const conditionMultiplier = 0.2 + (v.condition / 100) * 0.8;
        const mileagePenalty = Math.min(0.3, (v.mileage || 0) / 500000);
        const depreciatedValue = v.price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
        return { name: v.name || v.id, value: Math.floor(depreciatedValue) };
      });
      details.push({
        label: 'Vehicles',
        value: vehicleValue,
        icon: Car,
        color: '#F59E0B',
        items: vehicleList,
      });
    }
    
    // Businesses/Companies
    const businessValue = breakdown.byAssetType.business || 0;
    if (businessValue > 0) {
      const businessList = (companies || []).map(c => ({
        name: c.name || c.id,
        value: (c.weeklyIncome || 0) * 10,
      }));
      details.push({
        label: 'Businesses',
        value: businessValue,
        icon: Building2,
        color: '#EF4444',
        items: businessList,
      });
    }
    
    // Hardware/Miners
    const hardwareValue = breakdown.byAssetType.hardware || 0;
    if (hardwareValue > 0) {
      const hardwareItems: Array<{ name: string; value: number }> = [];
      companies?.forEach(company => {
        Object.entries(company.miners || {}).forEach(([id, count]) => {
          const price = MINER_PRICES[id as keyof typeof MINER_PRICES];
          if (price && (count as number) > 0) {
            hardwareItems.push({
              name: `${company.name || company.id} - ${id} Miner${(count as number) > 1 ? 's' : ''} (${count}x)`,
              value: price * (count as number),
            });
          }
        });
      });
      details.push({
        label: 'Hardware',
        value: hardwareValue,
        icon: Package,
        color: '#6366F1',
        items: hardwareItems,
      });
    }
    
    // Items
    const itemValue = breakdown.byAssetType.item || 0;
    if (itemValue > 0) {
      const itemList = (items || [])
        .filter(i => i?.owned)
        .map(i => ({ name: i.name || i.id, value: i.price || 0 }));
      details.push({
        label: 'Items',
        value: itemValue,
        icon: Package,
        color: '#14B8A6',
        items: itemList,
      });
    }
    
    return details;
  }, [breakdown, stats.money, bankSavings, realEstate, vehicles, companies, items]);

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
                • Bank Savings: Money in savings accounts{'\n'}
                • Real Estate: Market value of owned properties{'\n'}
                • Vehicles: Depreciated value based on condition and mileage{'\n'}
                • Businesses: Valued at 10x weekly income{'\n'}
                • Hardware: Total value of mining equipment{'\n'}
                • Items: Market value of owned items{'\n'}
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
    backgroundColor: '#1F2937',
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
    color: '#111827',
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
    color: '#111827',
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
    backgroundColor: '#374151',
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
    color: '#1F2937',
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
    color: '#9CA3AF',
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
    color: '#9CA3AF',
  },
  assetItemValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#1F2937',
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
    backgroundColor: '#374151',
  },
  summaryTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    color: '#1F2937',
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
    color: '#9CA3AF',
  },
});

