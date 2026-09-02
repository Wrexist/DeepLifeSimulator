import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { Crown, TrendingUp, Sparkles } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { safeSettings } from '@/utils/safeGameState';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { netWorth } from '@/lib/progress/achievements';
import { formatMoney } from '@/utils/moneyFormatting';
import { tier2 } from '@/lib/config/hierarchy';
import { fontScale } from '@/utils/scaling';

const LinearGradient = Gradient;

interface PrestigePreviewCardProps {
  onPress?: () => void;
}

function PrestigePreviewCard({ onPress }: PrestigePreviewCardProps) {
  const currentNetWorth = useGameSelector((s) => netWorth(s));
  const darkMode = useGameSelector((s) => safeSettings(s).darkMode);
  const prestigeLevel = 0; // Preview for players who haven't prestiged yet
  const threshold = getPrestigeThreshold(prestigeLevel);
  const progress = Math.min(100, (currentNetWorth / threshold) * 100);

  return (
    <TouchableOpacity
      style={[styles.container, darkMode && styles.containerDark]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={
          darkMode
            ? ['#1E293B', '#0F172A']
            : ['#FFFFFF', '#F1F5F9']
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
              <Text style={[styles.title, darkMode && styles.titleDark]}>
                Prestige System
              </Text>
              <Text style={[styles.subtitle, darkMode && styles.subtitleDark]}>
                Reach {formatMoney(threshold)} net worth to unlock
              </Text>
            </View>
          </View>
          <View style={styles.sparkleIcon}>
            <Sparkles size={20} color="#F59E0B" />
          </View>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={[styles.description, darkMode && styles.descriptionDark]}>
            Prestige to reset your character and earn permanent bonuses that make your next life easier!
          </Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressLabelContainer}>
              <TrendingUp size={16} color="#F59E0B" />
              <Text style={[styles.progressLabel, darkMode && styles.progressLabelDark]}>
                Progress to Prestige
              </Text>
            </View>
            <Text style={[styles.progressText, darkMode && styles.progressTextDark]}>
              {formatMoney(currentNetWorth)} / {formatMoney(threshold)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressPercent, darkMode && styles.progressPercentDark]}>
            {progress.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.benefitsContainer}>
          <Text style={[styles.benefitsTitle, darkMode && styles.benefitsTitleDark]}>
            Prestige Benefits:
          </Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Crown size={14} color="#F59E0B" />
              <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
                Earn Prestige Points to buy permanent bonuses
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <TrendingUp size={14} color="#10B981" />
              <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
                Start stronger with bonus stats, money, and multipliers
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Sparkles size={14} color="#8B5CF6" />
              <Text style={[styles.benefitText, darkMode && styles.benefitTextDark]}>
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    ...tier2,
    color: '#1E293B',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: fontScale(12),
    color: '#64748B',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#94A3B8',
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
    fontSize: fontScale(13),
    color: '#475569',
    lineHeight: fontScale(18),
  },
  descriptionDark: {
    color: '#CBD5E1',
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
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#64748B',
  },
  progressLabelDark: {
    color: '#94A3B8',
  },
  progressText: {
    fontSize: fontScale(11),
    color: '#94A3B8',
    fontWeight: '600',
  },
  progressTextDark: {
    color: '#64748B',
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
    fontSize: fontScale(10),
    color: '#64748B',
    textAlign: 'right',
  },
  progressPercentDark: {
    color: '#94A3B8',
  },
  benefitsContainer: {
    marginTop: 8,
  },
  benefitsTitle: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#1E293B',
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
    fontSize: fontScale(11),
    color: '#64748B',
    flex: 1,
    lineHeight: fontScale(16),
  },
  benefitTextDark: {
    color: '#94A3B8',
  },
});

export default React.memo(PrestigePreviewCard);

