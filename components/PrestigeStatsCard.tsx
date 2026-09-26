import { uiPalette } from '@/lib/config/theme';
import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { Crown, Award, DollarSign } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { safeSettings } from '@/utils/safeGameState';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';
import { formatMoney } from '@/utils/moneyFormatting';
import { tier2 } from '@/lib/config/hierarchy';
import { fontScale } from '@/utils/scaling';

const LinearGradient = Gradient;

interface PrestigeStatsCardProps {
  onPress?: () => void;
  onShopPress?: () => void;
  onInfoPress?: () => void;
}

function PrestigeStatsCard({ onPress, onShopPress, onInfoPress }: PrestigeStatsCardProps) {
  const darkMode = useGameSelector((s) => safeSettings(s).darkMode);
  const prestigeAvailable = useGameSelector((s) => s.prestigeAvailable);
  const prestigeData = useGameSelector((s) => s.prestige);
  const currentNetWorth = useGameSelector((s) => netWorth(s));
  const prestigeLevel = prestigeData?.prestigeLevel || 0;
  const threshold = getPrestigeThreshold(prestigeLevel);
  const progress = Math.min(100, (currentNetWorth / threshold) * 100);

  if (!prestigeData) return null;

  return (
    <TouchableOpacity
      style={[styles.container, darkMode && styles.containerDark]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={
          darkMode
            ? [uiPalette.surface, uiPalette.navy]
            : [uiPalette.white, uiPalette.lightSurface]
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
            <View style={styles.titleContainer}>
              <Text style={[styles.title, darkMode && styles.titleDark]} numberOfLines={1} ellipsizeMode="tail">
                Prestige Level {prestigeData.prestigeLevel}
              </Text>
              <Text style={[styles.subtitle, darkMode && styles.subtitleDark]} numberOfLines={1} ellipsizeMode="tail">
                {prestigeData.totalPrestiges ?? 0} Prestige{(prestigeData.totalPrestiges ?? 0) !== 1 ? 's' : ''} Completed
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
            <Text style={[styles.statValue, darkMode && styles.statValueDark]}>
              {(prestigeData.prestigePoints ?? 0).toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>
              Points
            </Text>
          </View>
          <View style={styles.statItem}>
            <Award size={16} color="#3B82F6" />
            <Text style={[styles.statValue, darkMode && styles.statValueDark]}>
              {prestigeData.unlockedBonuses?.length ?? 0}
            </Text>
            <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>
              Bonuses
            </Text>
          </View>
          <View style={styles.statItem}>
            <DollarSign size={16} color="#10B981" />
            <Text style={[styles.statValue, darkMode && styles.statValueDark]}>
              {formatMoney(prestigeData.lifetimeStats?.maxNetWorth ?? 0)}
            </Text>
            <Text style={[styles.statLabel, darkMode && styles.statLabelDark]}>
              Max Net Worth
            </Text>
          </View>
        </View>

        {!prestigeAvailable && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, darkMode && styles.progressLabelDark]}>
                Next Prestige
              </Text>
              <Text style={[styles.progressText, darkMode && styles.progressTextDark]}>
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
    marginVertical: 8,
  },
  containerDark: {
    // No change needed
  },
  card: {
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
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
    ...tier2,
    color: uiPalette.surface,
    flexShrink: 1,
  },
  titleDark: {
    color: uiPalette.white,
  },
  subtitle: {
    fontSize: fontScale(12),
    color: uiPalette.lightMuted,
    marginTop: 2,
  },
  subtitleDark: {
    color: uiPalette.muted,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  infoButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  infoButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoButtonText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: uiPalette.white,
  },
  shopButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  shopButtonGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shopButtonText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: uiPalette.white,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    minHeight: 56,
  },
  statValue: {
    fontSize: fontScale(16),
    fontWeight: 'bold',
    color: uiPalette.surface,
    marginTop: 4,
    textAlign: 'center',
  },
  statValueDark: {
    color: uiPalette.white,
  },
  statLabel: {
    fontSize: fontScale(11),
    color: uiPalette.lightMuted,
    marginTop: 2,
  },
  statLabelDark: {
    color: uiPalette.muted,
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
    fontSize: fontScale(12),
    fontWeight: '600',
    color: uiPalette.lightMuted,
  },
  progressLabelDark: {
    color: uiPalette.muted,
  },
  progressText: {
    fontSize: fontScale(11),
    color: uiPalette.muted,
  },
  progressTextDark: {
    color: uiPalette.lightMuted,
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

export default React.memo(PrestigeStatsCard);

