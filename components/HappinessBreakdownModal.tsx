import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp, Briefcase, GraduationCap, Utensils, Home } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

interface HappinessBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HappinessBreakdownModal({ visible, onClose }: HappinessBreakdownModalProps) {
  const { gameState } = useGame();
  const { stats, careers, currentJob, educations, prestige } = gameState;
  const { theme, isDark } = useTheme();

  const breakdown = useMemo(() => {
    const drains: Array<{ label: string; value: number; icon: any; color: string; description?: string }> = [];
    const incomes: Array<{ label: string; value: number; icon: any; color: string; description?: string }> = [];

    // Calculate natural decay
    const netWorth = (stats?.money || 0) + (gameState.bankSavings || 0);
    const safeNetWorth = isFinite(netWorth) && netWorth > 0 ? netWorth : 1000;
    const wealthMultiplier = Math.max(0.5, Math.min(2.0, 100000 / Math.max(1000, safeNetWorth)));
    const prestigeMultiplier = 1.0; // Simplified for display
    const statDecayRate = 4;
    const effectiveDecayRate = statDecayRate * wealthMultiplier * prestigeMultiplier;
    const naturalDecay = Math.round(effectiveDecayRate * 0.8);

    if (naturalDecay > 0) {
      drains.push({
        label: 'Natural Decay',
        value: -naturalDecay,
        icon: TrendingDown,
        color: '#EF4444',
        description: `Happiness naturally decreases over time (based on wealth)`,
      });
    }

    // Calculate happiness drain from career
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career) {
        drains.push({
          label: `Career: ${career.name}`,
          value: -3,
          icon: Briefcase,
          color: '#EF4444',
          description: `Working reduces happiness by 3 per week`,
        });
      }
    }

    // Calculate happiness drain from active educations
    const activeEducations = (educations || []).filter(edu =>
      edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
    );

    if (activeEducations.length > 0) {
      const numActiveEducations = activeEducations.length;
      const baseHappinessPenalty = -6;
      const stressMultiplier = numActiveEducations === 1 ? 1.0 :
                               numActiveEducations === 2 ? 1.3 :
                               1.6;
      const totalHappinessDrain = Math.round(baseHappinessPenalty * numActiveEducations * stressMultiplier);

      drains.push({
        label: `Education (${numActiveEducations} active)`,
        value: totalHappinessDrain,
        icon: GraduationCap,
        color: '#F59E0B',
        description: `Studying ${numActiveEducations > 1 ? 'multiple courses' : 'a course'} reduces happiness`,
      });
    }

    // Show pending applications
    const pendingApplication = careers?.find(c => c && c.applied && !c.accepted);
    if (pendingApplication && !currentJob) {
      drains.push({
        label: `Pending Application: ${pendingApplication.name}`,
        value: 0,
        icon: Briefcase,
        color: '#9CA3AF',
        description: 'Pending applications do not affect happiness until you start working',
      });
    }

    // Add active diet plan happiness gain (if applicable)
    const activeDietPlan = (gameState.dietPlans || []).find(plan => plan && plan.active);
    if (activeDietPlan && activeDietPlan.happinessGain && activeDietPlan.happinessGain > 0) {
      incomes.push({
        label: `${activeDietPlan.name} Diet`,
        value: activeDietPlan.happinessGain,
        icon: Utensils,
        color: '#10B981',
        description: `Active diet plan provides ${activeDietPlan.happinessGain} happiness per week`,
      });
    }

    // Add real estate happiness boost from current residence
    const currentResidence = (gameState.realEstate || []).find(p => {
      const hasStatus = 'status' in p && p.status === 'owner';
      const hasCurrentResidence = 'currentResidence' in p && p.currentResidence === true;
      return p.owned && hasStatus && hasCurrentResidence;
    });
    if (currentResidence && currentResidence.weeklyHappiness > 0) {
      incomes.push({
        label: `Living in ${currentResidence.name}`,
        value: currentResidence.weeklyHappiness,
        icon: Home,
        color: '#10B981',
        description: `Your current residence provides ${currentResidence.weeklyHappiness} happiness per week`,
      });
    }

    // Calculate total drain and income
    const totalDrain = drains.reduce((sum, d) => sum + Math.abs(d.value), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + i.value, 0);
    const netChange = totalIncome - totalDrain;

    // Calculate projected happiness after next week
    const currentHappiness = stats?.happiness || 0;
    const projectedHappiness = Math.max(0, Math.min(100, currentHappiness + netChange));

    return {
      drains,
      incomes,
      totalDrain,
      totalIncome,
      netChange,
      currentHappiness,
      projectedHappiness,
    };
  }, [stats?.happiness, currentJob, careers, educations, prestige, stats?.money, gameState.bankSavings, gameState.dietPlans]);

  return (
    <BaseModal visible={visible} onClose={onClose} title="Happiness Breakdown">
      {/* Current Happiness */}
      <View style={[styles.totalCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Current Happiness</Text>
        <Text style={[styles.totalValue, { color: theme.text }]}>
          {Math.round(breakdown.currentHappiness)} / 100
        </Text>
        <View style={styles.totalBreakdown}>
          <Text style={[styles.totalBreakdownText, { color: theme.textSecondary }]}>
            Projected Next Week: {Math.round(breakdown.projectedHappiness)} / 100
          </Text>
          <Text style={[
            styles.netChangeText,
            breakdown.netChange >= 0 ? styles.netChangePositive : styles.netChangeNegative
          ]}>
            {breakdown.netChange >= 0 ? '+' : ''}{breakdown.netChange.toFixed(1)} Happiness
          </Text>
        </View>
      </View>

      {/* Happiness Income */}
      {breakdown.incomes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={scale(18)} color="#10B981" />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Happiness Income (Next Week)
            </Text>
          </View>

          {breakdown.incomes.map((income, index) => {
            const Icon = income.icon;
            return (
              <View key={index} style={[styles.itemCard, { backgroundColor: isDark ? '#374151' : '#F9FAFB', borderColor: isDark ? '#4B5563' : '#E5E7EB' }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconContainer, { backgroundColor: `${income.color}20` }]}>
                    <Icon size={scale(16)} color={income.color} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemLabel, { color: theme.text }]}>
                      {income.label}
                    </Text>
                    {income.description && (
                      <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
                        {income.description}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.itemValue, styles.positiveValue]}>
                    +{income.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Happiness Drain */}
      {breakdown.drains.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={scale(18)} color="#EF4444" />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Happiness Drain (Next Week)
            </Text>
          </View>

          {breakdown.drains.map((drain, index) => {
            const Icon = drain.icon;
            return (
              <View key={index} style={[styles.itemCard, { backgroundColor: isDark ? '#374151' : '#F9FAFB', borderColor: isDark ? '#4B5563' : '#E5E7EB' }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconContainer, { backgroundColor: `${drain.color}20` }]}>
                    <Icon size={scale(16)} color={drain.color} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemLabel, { color: theme.text }]}>
                      {drain.label}
                    </Text>
                    {drain.description && (
                      <Text style={[styles.itemDescription, { color: theme.textSecondary }]}>
                        {drain.description}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.itemValue, styles.negativeValue]}>
                    {drain.value}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>
          How Happiness Works
        </Text>
        <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
          {'\u2022'} Happiness naturally decreases over time based on your wealth{'\n'}
          {'\u2022'} Working at a career reduces happiness by 3 per week{'\n'}
          {'\u2022'} Studying multiple educations simultaneously increases happiness drain{'\n'}
          {'\u2022'} Paused educations don't affect happiness{'\n'}
          {'\u2022'} Use health activities and hobbies to restore happiness{'\n'}
          {'\n'}
          Net Change = Income - Drain
        </Text>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    padding: scale(16),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(14),
    ...getShadow(2),
  },
  totalLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    marginBottom: scale(6),
  },
  totalValue: {
    fontSize: fontScale(28),
    fontWeight: '800',
    marginBottom: scale(8),
  },
  totalBreakdown: {
    gap: scale(3),
  },
  totalBreakdownText: {
    fontSize: fontScale(12),
  },
  netChangeText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    marginTop: scale(4),
  },
  netChangePositive: {
    color: '#10B981',
  },
  netChangeNegative: {
    color: '#EF4444',
  },
  section: {
    marginBottom: scale(14),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: scale(8),
  },
  sectionTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  itemCard: {
    padding: scale(12),
    borderRadius: responsiveBorderRadius.md,
    marginBottom: scale(8),
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  itemIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemLabel: {
    fontSize: fontScale(14),
    fontWeight: '600',
    marginBottom: scale(3),
  },
  itemDescription: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
  itemValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
  },
  summaryCard: {
    padding: scale(14),
    borderRadius: responsiveBorderRadius.md,
  },
  summaryTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginBottom: scale(8),
  },
  summaryText: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
});
