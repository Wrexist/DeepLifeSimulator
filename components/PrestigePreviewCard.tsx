import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
const LinearGradient = LinearGradientFallback;
import { Crown, TrendingUp, Sparkles } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';

interface PrestigePreviewCardProps {
  onPress?: () => void;
}

function PrestigePreviewCard({ onPress }: PrestigePreviewCardProps) {
  const { gameState } = useGame();
  const currentNetWorth = netWorth(gameState);
  const prestigeLevel = 0; // Preview for players who haven't prestiged yet
  const threshold = getPrestigeThreshold(prestigeLevel);
  const progress = Math.min(100, (currentNetWorth / threshold) * 100);

  const formatMoney = (amount: number) => {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    if (amount > 10_000) return `$${(amount / 1_000).toFixed(2)}K`;
    return `$${Math.floor(amount).toLocaleString()}`;
  };

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
            <View style={styles.textContainer}>
              <Text style={[styles.title, gameState.settings.darkMode && styles.titleDark]}>
                Prestige System
              </Text>
              <Text style={[styles.subtitle, gameState.settings.darkMode && styles.subtitleDark]}>
                Reach {formatMoney(threshold)} net worth to unlock
              </Text>
            </View>
          </View>
          <View style={styles.sparkleIcon}>
            <Sparkles size={20} color="#F59E0B" />
          </View>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, gameState.settings.darkMode && styles.descriptionDark]}>
            Prestige to reset your character and earn permanent bonuses that make your next life easier!
          </Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressLabelContainer}>
              <TrendingUp size={16} color="#F59E0B" />
              <Text style={[styles.progressLabel, gameState.settings.darkMode && styles.progressLabelDark]}>
                Progress to Prestige
              </Text>
            </View>
            <Text style={[styles.progressText, gameState.settings.darkMode && styles.progressTextDark]}>
              {formatMoney(currentNetWorth)} / {formatMoney(threshold)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressPercent, gameState.settings.darkMode && styles.progressPercentDark]}>
            {progress.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.benefitsContainer}>
          <Text style={[styles.benefitsTitle, gameState.settings.darkMode && styles.benefitsTitleDark]}>
            Prestige Benefits:
          </Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Crown size={14} color="#F59E0B" />
              <Text style={[styles.benefitText, gameState.settings.darkMode && styles.benefitTextDark]}>
                Earn Prestige Points to buy permanent bonuses
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <TrendingUp size={14} color="#10B981" />
              <Text style={[styles.benefitText, gameState.settings.darkMode && styles.benefitTextDark]}>
                Start stronger with bonus stats, money, and multipliers
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Sparkles size={14} color="#8B5CF6" />
              <Text style={[styles.benefitText, gameState.settings.darkMode && styles.benefitTextDark]}>
                Unlock special abilities and quality-of-life improvements
              </Text>
            </View>
          </View>
        </View>
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
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  textContainer: {
    flex: 1,
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
  sparkleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    borderRadius: 8,
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  descriptionDark: {
    color: '#D1D5DB',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontWeight: '600',
  },
  progressTextDark: {
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'right',
  },
  progressPercentDark: {
    color: '#9CA3AF',
  },
  benefitsContainer: {
    marginTop: 8,
  },
  benefitsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  benefitsTitleDark: {
    color: '#FFFFFF',
  },
  benefitsList: {
    gap: 6,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
    lineHeight: 16,
  },
  benefitTextDark: {
    color: '#9CA3AF',
  },
});

export default React.memo(PrestigePreviewCard);


