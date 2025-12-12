import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, TrendingUp, Award, Users, DollarSign } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';

interface PrestigeStatsCardProps {
  onPress?: () => void;
  onShopPress?: () => void;
  onInfoPress?: () => void;
}

export default function PrestigeStatsCard({ onPress, onShopPress, onInfoPress }: PrestigeStatsCardProps) {
  const { gameState } = useGame();
  const prestigeData = gameState.prestige;
  const currentNetWorth = netWorth(gameState);
  const prestigeLevel = prestigeData?.prestigeLevel || 0;
  const threshold = getPrestigeThreshold(prestigeLevel);
  const progress = Math.min(100, (currentNetWorth / threshold) * 100);

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
    return `$${amount}`;
  };

  if (!prestigeData) return null;

  return (
    <TouchableOpacity
      style={[styles.container, gameState.settings.darkMode && styles.containerDark]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={
          gameState.settings.darkMode
            ? ['#1F2937', '#111827']
            : ['#FFFFFF', '#F3F4F6']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Crown size={24} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>
                Prestige Level {prestigeData.prestigeLevel}
              </Text>
              <Text style={[styles.subtitle, gameState.settings.darkMode && styles.subtitleDark]}>
                {prestigeData.totalPrestiges} Prestige{prestigeData.totalPrestiges !== 1 ? 's' : ''} Completed
              </Text>
            </View>
          </View>
          <View style={styles.buttonRow}>
            {onInfoPress && (
              <TouchableOpacity
                style={styles.infoButton}
                onPress={e => {
                  e.stopPropagation();
                  onInfoPress();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.infoButtonGradient}
                >
                  <Text style={styles.infoButtonText}>Info</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {onShopPress && (
              <TouchableOpacity
                style={styles.shopButton}
                onPress={e => {
                  e.stopPropagation();
                  onShopPress();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shopButtonGradient}
                >
                  <Text style={styles.shopButtonText}>Shop</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Crown size={16} color="#F59E0B" />
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {prestigeData.prestigePoints.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              Points
            </Text>
          </View>
          <View style={styles.statItem}>
            <Award size={16} color="#3B82F6" />
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {prestigeData.unlockedBonuses.length}
            </Text>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              Bonuses
            </Text>
          </View>
          <View style={styles.statItem}>
            <DollarSign size={16} color="#10B981" />
            <Text style={[styles.statValue, gameState.settings.darkMode && styles.statValueDark]}>
              {formatMoney(prestigeData.lifetimeStats.maxNetWorth)}
            </Text>
            <Text style={[styles.statLabel, gameState.settings.darkMode && styles.statLabelDark]}>
              Max Net Worth
            </Text>
          </View>
        </View>

        {!gameState.prestigeAvailable && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, gameState.settings.darkMode && styles.progressLabelDark]}>
                Next Prestige
              </Text>
              <Text style={[styles.progressText, gameState.settings.darkMode && styles.progressTextDark]}>
                {formatMoney(currentNetWorth)} / {formatMoney(threshold)}
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  containerDark: {
    // No change needed
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  infoButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  infoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  shopButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  shopButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shopButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  statValueDark: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statLabelDark: {
    color: '#9CA3AF',
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  progressLabelDark: {
    color: '#9CA3AF',
  },
  progressText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  progressTextDark: {
    color: '#6B7280',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
});

