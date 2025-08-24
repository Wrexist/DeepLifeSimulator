import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import { Asset, Liability, computeNetWorth } from '@/utils/netWorth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6'];

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PropertyUpgrade {
  id: string;
  cost: number;
  rentIncrease: number;
  purchased: boolean;
}

interface Property {
  id: string;
  price: number;
  dailyIncome: number;
  owned: boolean;
  status: 'vacant' | 'owner' | 'rented';
  upgrades: PropertyUpgrade[];
}

const MINER_PRICES = {
  basic: 500,
  advanced: 2000,
  pro: 8000,
  industrial: 25000,
  quantum: 100000,
} as const;

const PieChart = ({ data }: { data: PieSlice[] }) => {
  const total = data.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const radius = 60;
  return (
    <Svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
      <G x={radius} y={radius}>
        {data.map(slice => {
          const startAngle = (cumulative / total) * Math.PI * 2;
          const endAngle = ((cumulative + slice.value) / total) * Math.PI * 2;
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
          const x1 = Math.cos(startAngle) * radius;
          const y1 = Math.sin(startAngle) * radius;
          const x2 = Math.cos(endAngle) * radius;
          const y2 = Math.sin(endAngle) * radius;
          cumulative += slice.value;
          const d = `M0 0 L${x1} ${y1} A${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return <Path key={slice.label} d={d} fill={slice.color} />;
        })}
      </G>
    </Svg>
  );
};

export default function NetWorthDisplay() {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [properties, setProperties] = useState<Property[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const previous = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('realEstateProperties');
        if (saved) {
          setProperties(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load real estate properties', error);
      }
    })();
  }, []);

  const breakdown = useMemo(() => {
    const assets: Asset[] = [
      { id: 'cash', type: 'cash', baseValue: gameState.stats.money },
      { id: 'savings', type: 'cash', baseValue: gameState.bankSavings || 0 },
    ];

    gameState.items
      .filter(i => i.owned)
      .forEach(item =>
        assets.push({ id: item.id, type: 'collectible', baseValue: item.price })
      );

    gameState.companies.forEach(company => {
      assets.push({
        id: company.id,
        type: 'business',
        baseValue: 0,
        trailingWeeklyProfit: company.weeklyIncome,
        valuationMultiple: 10,
      });
      Object.entries(company.miners || {}).forEach(([id, count]) => {
        const price = MINER_PRICES[id as keyof typeof MINER_PRICES];
        if (price) {
          assets.push({
            id: `${company.id}_miner_${id}`,
            type: 'hardware',
            baseValue: price * count,
          });
        }
      });
    });

    properties
      .filter(p => p.owned)
      .forEach(p => {
        const upgradesValue = p.upgrades
          .filter(u => u.purchased)
          .reduce((sum, u) => sum + u.cost, 0);
        assets.push({
          id: p.id,
          type: 'property',
          baseValue: p.price + upgradesValue,
        });
      });

    const liabilities: Liability[] = [];

    return computeNetWorth(assets, liabilities);
  }, [gameState, properties]);

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
    const prev = previous.current;
    const diff = prev === 0 ? 0 : Math.abs(breakdown.netWorth - prev) / prev;
    if (diff > 0.05) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
    previous.current = breakdown.netWorth;
  }, [breakdown.netWorth, scaleAnim]);

  return (
    <View style={containerStyle}>
      <Text style={titleStyle}>Net Worth</Text>
      <Animated.Text style={[netWorthStyle, { transform: [{ scale: scaleAnim }] }]}>
        ${breakdown.netWorth.toLocaleString()}
      </Animated.Text>
      <View style={styles.chartSection}>
        <PieChart data={chartData} />
        <View style={styles.legend}>
          {chartData.map(slice => (
            <View key={slice.label} style={styles.legendItem}>
              <View style={[styles.colorBox, { backgroundColor: slice.color }]} />
              <Text style={legendLabelStyle}>
                {slice.label}: ${Math.round(slice.value).toLocaleString()}
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
  colorBox: {
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
