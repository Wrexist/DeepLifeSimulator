import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { Heart, Smile, Zap, Dumbbell, DollarSign, Gem } from 'lucide-react-native';
import StatBar from './anim/StatBar';

export default function StatsDisplay() {
  const { gameState } = useGame();
  const { stats } = gameState;

  const getStatColor = (stat: string, value: number) => {
    if (stat === 'money' || stat === 'fitness') {
      return '#3B82F6';
    }
    if (stat === 'gems') {
      return '#FBBF24';
    }
    if (value >= 75) return '#10B981';
    if (value >= 50) return '#F59E0B';
    if (value >= 25) return '#EF4444';
    return '#7F1D1D';
  };

  const formatMoney = (amount: number) => {
    const a = Math.floor(amount || 0);
    if (a >= 1_000_000_000_000_000) return `$${(a / 1_000_000_000_000_000).toFixed(2)}Q`;
    if (a >= 1_000_000_000_000) return `$${(a / 1_000_000_000_000).toFixed(2)}T`;
    if (a >= 1_000_000_000) return `$${(a / 1_000_000_000).toFixed(2)}B`;
    if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `$${(a / 1_000).toFixed(2)}K`;
    return `$${a}`;
  };

  const statItems = [
    { key: 'health', icon: Heart, label: 'Health', value: stats.health, max: 100 },
    { key: 'happiness', icon: Smile, label: 'Happiness', value: stats.happiness, max: 100 },
    { key: 'energy', icon: Zap, label: 'Energy', value: stats.energy, max: 100 },
    { key: 'fitness', icon: Dumbbell, label: 'Fitness', value: stats.fitness, max: null },
    { key: 'gems', icon: Gem, label: 'Gems', value: stats.gems, max: null },
    { key: 'money', icon: DollarSign, label: 'Money', value: stats.money, max: null },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Stats</Text>
      <View style={styles.statsGrid}>
        {statItems.map(({ key, icon: IconComponent, label, value, max }) => (
          <View key={key} style={styles.statCard}>
            <View style={styles.statHeader}>
              <IconComponent 
                size={20} 
                color={getStatColor(key, value)} 
              />
              <Text style={styles.statLabel}>{label}</Text>
            </View>
            <Text style={[styles.statValue, { color: getStatColor(key, value) }]}> 
              {key === 'money' ? formatMoney(value) : value}
              {max && `/${max}`}
            </Text>
            {max && (
              <StatBar pct={Math.min(100, (value / max) * 100)} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    width: '48%',
    marginBottom: 10,
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});