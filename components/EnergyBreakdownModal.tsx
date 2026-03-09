import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp, Briefcase, GraduationCap, Coffee, Utensils } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';
import { getShadow } from '@/utils/shadow';
import BaseModal from '@/components/ui/BaseModal';
import { useTheme } from '@/hooks/useTheme';

interface EnergyBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EnergyBreakdownModal({ visible, onClose }: EnergyBreakdownModalProps) {
  const { gameState } = useGame();
  const { stats, careers, currentJob, educations, prestige } = gameState;
  const { theme, isDark } = useTheme();

  const breakdown = useMemo(() => {
    const drains: Array<{ label: string; value: number; icon: any; color: string; description?: string }> = [];
    const incomes: Array<{ label: string; value: number; icon: any; color: string; description?: string }> = [];

    // Calculate energy drain from career (active job)
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career && career.levels && career.levels.length > 0) {
        const currentLevel = career.levels.find(l => l.level === (career.currentLevel || 1));
        if (currentLevel && currentLevel.energyCost) {
          drains.push({
            label: `Career: ${career.name}`,
            value: -currentLevel.energyCost,
            icon: Briefcase,
            color: '#EF4444',
            description: `Working drains ${currentLevel.energyCost} energy per week`,
          });
        }
      }
    }

    // Show pending applications (they don't drain energy, but good to show)
    const pendingApplication = careers?.find(c => c && c.applied && !c.accepted);
    if (pendingApplication && !currentJob) {
      drains.push({
        label: `Pending Application: ${pendingApplication.name}`,
        value: 0,
        icon: Briefcase,
        color: '#9CA3AF',
        description: 'Pending applications do not drain energy until you start working',
      });
    }

    // Calculate energy drain from active educations
    const activeEducations = (educations || []).filter(edu =>
      edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
    );

    if (activeEducations.length > 0) {
      const numActiveEducations = activeEducations.length;
      const baseEnergyPenalty = -7; // Base penalty per education
      const stressMultiplier = numActiveEducations === 1 ? 1.0 :
                               numActiveEducations === 2 ? 1.3 :
                               1.6;
      const totalEnergyDrain = Math.round(baseEnergyPenalty * numActiveEducations * stressMultiplier);

      drains.push({
        label: `Education (${numActiveEducations} active)`,
        value: totalEnergyDrain,
        icon: GraduationCap,
        color: '#F59E0B',
        description: `Studying ${numActiveEducations > 1 ? 'multiple courses' : 'a course'} drains energy`,
      });
    }

    // Calculate energy income from week progression
    const baseEnergyRegen = 30;
    const unlockedBonuses = prestige?.unlockedBonuses || [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnergyRegenMultiplier } = require('@/lib/prestige/applyBonuses');
    const energyRegenMultiplier = getEnergyRegenMultiplier(unlockedBonuses);
    const safeEnergyRegenMultiplier = typeof energyRegenMultiplier === 'number' && isFinite(energyRegenMultiplier) && energyRegenMultiplier > 0 ? energyRegenMultiplier : 1.0;
    const energyRegen = Math.round(baseEnergyRegen * safeEnergyRegenMultiplier);

    incomes.push({
      label: 'Week Progression',
      value: energyRegen,
      icon: Coffee,
      color: '#10B981',
      description: `Resting and sleeping restores ${energyRegen} energy per week${safeEnergyRegenMultiplier > 1.0 ? ` (${((safeEnergyRegenMultiplier - 1) * 100).toFixed(0)}% bonus from prestige)` : ''}`,
    });

    // Add active diet plan energy gain
    const activeDietPlan = (gameState.dietPlans || []).find(plan => plan && plan.active);
    if (activeDietPlan && activeDietPlan.energyGain > 0) {
      incomes.push({
        label: `${activeDietPlan.name} Diet`,
        value: activeDietPlan.energyGain,
        icon: Utensils,
        color: '#10B981',
        description: `Active diet plan provides ${activeDietPlan.energyGain} energy per week`,
      });
    }

    // Add real estate energy boost from current residence
    const currentResidence = (gameState.realEstate || []).find(p => {
      const hasStatus = 'status' in p && p.status === 'owner';
      const hasCurrentResidence = 'currentResidence' in p && p.currentResidence === true;
      return p.owned && hasStatus && hasCurrentResidence;
    });
    if (currentResidence && currentResidence.weeklyEnergy > 0) {
      incomes.push({
        label: `Living in ${currentResidence.name}`,
        value: currentResidence.weeklyEnergy,
        icon: Coffee, // Home icon was undefined; using Coffee as placeholder
        color: '#10B981',
        description: `Your current residence provides ${currentResidence.weeklyEnergy} energy per week`,
      });
    }

    // Calculate total drain and income
    const totalDrain = drains.reduce((sum, d) => sum + Math.abs(d.value), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + i.value, 0);
    const netChange = totalIncome - totalDrain;

    // Calculate projected energy after next week
    const currentEnergy = stats?.energy || 0;
    const projectedEnergy = Math.max(0, Math.min(100, currentEnergy + netChange));

    return {
      drains,
      incomes,
      totalDrain,
      totalIncome,
      netChange,
      currentEnergy,
      projectedEnergy,
    };
  }, [stats?.energy, currentJob, careers, educations, prestige, gameState.dietPlans, gameState.realEstate]);

  return (
    <BaseModal visible={visible} onClose={onClose} title="Energy Breakdown">
      {/* Current Energy */}
      <View style={[styles.totalCard, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
        <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Current Energy</Text>
        <Text style={[styles.totalValue, { color: theme.text }]}>
          {Math.round(breakdown.currentEnergy)} / 100
        </Text>
        <View style={styles.totalBreakdown}>
          <Text style={[styles.totalBreakdownText, { color: theme.textSecondary }]}>
            Projected Next Week: {Math.round(breakdown.projectedEnergy)} / 100
          </Text>
          <Text style={[
            styles.netChangeText,
            breakdown.netChange >= 0 ? styles.netChangePositive : styles.netChangeNegative
          ]}>
            {breakdown.netChange >= 0 ? '+' : ''}{breakdown.netChange.toFixed(1)} Energy
          </Text>
        </View>
      </View>

      {/* Energy Income */}
      {breakdown.incomes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={scale(18)} color="#10B981" />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Energy Income (Next Week)
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

      {/* Energy Drain */}
      {breakdown.drains.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={scale(18)} color="#EF4444" />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Energy Drain (Next Week)
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
          How Energy Works
        </Text>
        <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
          {'\u2022'} Energy is restored each week when you advance to the next week{'\n'}
          {'\u2022'} Working at a career drains energy based on the job's requirements{'\n'}
          {'\u2022'} Studying multiple educations simultaneously increases energy drain{'\n'}
          {'\u2022'} Paused educations don't drain energy{'\n'}
          {'\u2022'} Prestige bonuses can increase energy regeneration{'\n'}
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
