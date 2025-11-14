import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import { computeNetWorth, Asset, Liability } from '@/utils/netWorth';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const MINER_PRICES = {
  'asic_miner': 5000,
  'gpu_miner': 2000,
  'cpu_miner': 500,
};

const PieChart = ({ data }: { data: PieSlice[] }) => {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return null;

  const centerX = 100;
  const centerY = 100;
  const radius = 80;

  let currentAngle = 0;
  const paths = data.map((slice, index) => {
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return (
      <G key={index}>
        <Path d={pathData} fill={slice.color} />
      </G>
    );
  });

  return (
    <Svg width={200} height={200}>
      <G>
        {paths}
      </G>
    </Svg>
  );
};

export default function NetWorthDisplay() {
  const { gameState } = useGame();
  const { settings } = gameState;
  const { createMemoizedValue } = usePerformanceOptimization();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const previous = useRef(0);

  const formatMoney = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000_000_000_000) return `$${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    if (a >= 1_000_000_000_000) return `$${(a / 1_000_000_000_000).toFixed(2)}T`;
    if (a >= 1_000_000_000) return `$${(a / 1_000_000_000).toFixed(2)}B`;
    if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `$${(a / 1_000).toFixed(2)}K`;
    return `$${a}`;
  };

  // Optimize breakdown calculation with specific dependencies
  const breakdown = createMemoizedValue(() => {
    const assets: Asset[] = [
      { id: 'cash', type: 'cash', baseValue: gameState.stats.money },
      { id: 'savings', type: 'cash', baseValue: gameState.bankSavings || 0 },
    ];

    // Only process owned items
    const ownedItems = gameState.items.filter(i => i.owned);
    ownedItems.forEach(item =>
      assets.push({ id: item.id, type: 'collectible', baseValue: item.price })
    );

    // Only process companies with income
    gameState.companies.forEach(company => {
      if (company.weeklyIncome > 0) {
        assets.push({
          id: company.id,
          type: 'business',
          baseValue: 0,
          trailingWeeklyProfit: company.weeklyIncome,
          valuationMultiple: 10,
        });
      }
      
      // Only process miners if they exist
      if (company.miners) {
        Object.entries(company.miners).forEach(([id, count]) => {
          const price = MINER_PRICES[id as keyof typeof MINER_PRICES];
          if (price && count > 0) {
            assets.push({
              id: `${company.id}_miner_${id}`,
              type: 'hardware',
              baseValue: price * count,
            });
          }
        });
      }
    });

    // Only process owned real estate
    const ownedRealEstate = gameState.realEstate.filter(p => p.owned);
    ownedRealEstate.forEach(p => {
      assets.push({
        id: p.id,
        type: 'property',
        baseValue: p.price,
      });
    });

    // Only process stock holdings
    if (gameState.stocks?.holdings) {
      gameState.stocks.holdings.forEach(holding => {
        assets.push({
          id: `stock_${holding.symbol}`,
          type: 'investment',
          baseValue: holding.shares * holding.currentPrice,
        });
      });
    }

    const liabilities: Liability[] = [];
    return computeNetWorth(assets, liabilities);
  }, [
    gameState.stats.money,
    gameState.bankSavings,
    gameState.items.map(i => ({ id: i.id, owned: i.owned, price: i.price })),
    gameState.companies.map(c => ({ id: c.id, weeklyIncome: c.weeklyIncome, miners: c.miners })),
    gameState.realEstate.map(r => ({ id: r.id, owned: r.owned, price: r.price })),
    gameState.stocks?.holdings?.map(h => ({ symbol: h.symbol, shares: h.shares, currentPrice: h.currentPrice })) || []
  ]);

  const chartData: PieSlice[] = Object.entries(breakdown.byAssetType).map(
    ([label, value], idx) => ({
      label,
      value,
      color: colors[idx % colors.length],
    })
  );

  const containerStyle = [styles.container, settings.darkMode && styles.containerDark];
  const titleStyle = [styles.title, settings.darkMode && styles.titleDark];
  const netWorthStyle = [styles.netWorth, settings.darkMode && styles.netWorthDark];
  const legendLabelStyle = [styles.legendLabel, settings.darkMode && styles.legendLabelDark];

  useEffect(() => {
    let isMounted = true;
    const prev = previous.current;
    const diff = prev === 0 ? 0 : Math.abs(breakdown.netWorth - prev) / prev;
    
    if (diff > 0.05 && isMounted) {
      const sequenceAnimation = Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      ]);
      
      sequenceAnimation.start();
    }
    
    previous.current = breakdown.netWorth;

    return () => {
      isMounted = false;
    };
  }, [breakdown.netWorth, scaleAnim]);

  return (
    <View style={containerStyle}>
      <Text style={titleStyle}>Net Worth</Text>
      <Animated.Text style={[netWorthStyle, { transform: [{ scale: scaleAnim }] }]}>
        {formatMoney(breakdown.netWorth)}
      </Animated.Text>
      <View style={styles.chartSection}>
        <PieChart data={chartData} />
        <View style={styles.legend}>
          {chartData.map((slice, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: slice.color }]} />
              <Text style={legendLabelStyle}>
                {slice.label}: {formatMoney(slice.value)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  netWorth: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 16,
  },
  netWorthDark: {
    color: '#60A5FA',
  },
  chartSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legend: {
    marginLeft: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 14,
    color: '#374151',
  },
  legendLabelDark: {
    color: '#D1D5DB',
  },
});
