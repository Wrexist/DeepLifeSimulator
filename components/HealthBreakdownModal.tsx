import React, { useMemo } from 'react';
import { TrendingDown, Briefcase, GraduationCap, Utensils, AlertTriangle, Home } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import type { StatBreakdownSection } from '@/components/ui/StatBreakdownModal';

interface HealthBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HealthBreakdownModal({ visible, onClose }: HealthBreakdownModalProps) {
  const stats = useGameSelector((s) => s.stats, shallowEqual);
  const careers = useGameSelector((s) => s.careers);
  const currentJob = useGameSelector((s) => s.currentJob);
  const educations = useGameSelector((s) => s.educations);
  const diseases = useGameSelector((s) => s.diseases);
  const bankSavings = useGameSelector((s) => s.bankSavings);
  const dietPlans = useGameSelector((s) => s.dietPlans);
  const realEstate = useGameSelector((s) => s.realEstate);
  const rental = useGameSelector((s) => s.rental, shallowEqual);

  const breakdown = useMemo(() => {
    const drains: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];
    const incomes: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];

    // Calculate natural decay
    const netWorth = (stats?.money || 0) + (bankSavings || 0);
    const safeNetWorth = isFinite(netWorth) && netWorth > 0 ? netWorth : 1000;
    const wealthMultiplier = Math.max(0.5, Math.min(2.0, 100000 / Math.max(1000, safeNetWorth)));
    const prestigeMultiplier = 1.0; // Simplified for display
    const statDecayRate = 4;
    const effectiveDecayRate = statDecayRate * wealthMultiplier * prestigeMultiplier;
    const naturalDecay = Math.round(effectiveDecayRate * 0.6);

    if (naturalDecay > 0) {
      drains.push({
        label: 'Natural Decay',
        value: -naturalDecay,
        icon: TrendingDown,
        color: '#EF4444',
        description: `Health naturally decreases over time (based on wealth)`,
      });
    }

    // Calculate health drain from career
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career) {
        drains.push({
          label: `Career: ${career.levels?.[career.level]?.name || career.id}`,
          value: -2,
          icon: Briefcase,
          color: '#EF4444',
          description: `Working reduces health by 2 per week`,
        });
      }
    }

    // Calculate health drain from active educations
    const activeEducations = (educations || []).filter(edu =>
      edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0
    );

    if (activeEducations.length > 0) {
      const numActiveEducations = activeEducations.length;
      const baseHealthPenalty = -3;
      const stressMultiplier = numActiveEducations === 1 ? 1.0 :
                               numActiveEducations === 2 ? 1.3 :
                               1.6;
      const totalHealthDrain = Math.round(baseHealthPenalty * numActiveEducations * stressMultiplier);

      drains.push({
        label: `Education (${numActiveEducations} active)`,
        value: totalHealthDrain,
        icon: GraduationCap,
        color: '#F59E0B',
        description: `Studying ${numActiveEducations > 1 ? 'multiple courses' : 'a course'} reduces health`,
      });
    }

    // Show pending applications
    const pendingApplication = careers?.find(c => c && c.applied && !c.accepted);
    if (pendingApplication && !currentJob) {
      drains.push({
        label: `Pending Application: ${pendingApplication.levels?.[0]?.name || pendingApplication.id}`,
        value: 0,
        icon: Briefcase,
        color: '#94A3B8',
        description: 'Pending applications do not affect health until you start working',
      });
    }

    // Add active diet plan health gain
    const activeDietPlan = (dietPlans || []).find(plan => plan && plan.active);
    if (activeDietPlan && activeDietPlan.healthGain > 0) {
      incomes.push({
        label: `${activeDietPlan.name} Diet`,
        value: activeDietPlan.healthGain,
        icon: Utensils,
        color: '#10B981',
        description: `Active diet plan provides ${activeDietPlan.healthGain} health per week`,
      });
    }

    // Add disease effects to health drain
    if (diseases && diseases.length > 0) {
      const diseaseHealthEffects: Record<string, number> = {};

      diseases.forEach(disease => {
        if (disease.effects && typeof disease.effects.health === 'number') {
          const healthEffect = disease.effects.health;
          if (healthEffect < 0) {
            // Group diseases by name for display
            const diseaseName = disease.name || 'Unknown Disease';
            diseaseHealthEffects[diseaseName] = (diseaseHealthEffects[diseaseName] || 0) + healthEffect;
          }
        }
      });

      // Add each disease's health effect to drains
      Object.entries(diseaseHealthEffects).forEach(([diseaseName, healthEffect]) => {
        drains.push({
          label: `Disease: ${diseaseName}`,
          value: healthEffect,
          icon: AlertTriangle,
          color: '#EF4444',
          description: `Active disease reduces health by ${Math.abs(healthEffect)} per week`,
        });
      });
    }

    // Note: Real estate health boosts are applied once when moving in (not weekly)
    // Health traits from properties provide a one-time boost, unlike happiness/energy which are weekly

    // Housing, from the SAME function the weekly tick applies
    // (`computeHousingWellbeing`) - an owned home, a rental, or the penalty
    // for neither. The old owned-only `currentResidence` copy here is the
    // divergence __tests__/economy/rentalLadder.test.ts exists to prevent:
    // a modal that predicts a number the tick never delivers.
    const housing = computeHousingWellbeing({ realEstate, rental });
    if (housing.health > 0) {
      incomes.push({
        label: 'Your housing',
        value: housing.health,
        icon: Home,
        color: '#10B981',
        description: `Your home adds ${housing.health} health per week`,
      });
    } else if (housing.health < 0) {
      drains.push({
        label: housing.homeless ? 'No place to live' : 'Your housing',
        value: housing.health,
        icon: Home,
        color: '#EF4444',
        description: housing.homeless
          ? `Sleeping rough costs ${Math.abs(housing.health)} health per week - rent or buy a home`
          : `Your housing costs ${Math.abs(housing.health)} health per week`,
      });
    }

    // Calculate total drain and income
    const totalDrain = drains.reduce((sum, d) => sum + Math.abs(d.value), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + i.value, 0);
    const netChange = totalIncome - totalDrain;

    // Calculate projected health after next week
    const currentHealth = stats?.health || 0;
    const projectedHealth = Math.max(0, Math.min(100, currentHealth + netChange));

    return {
      drains,
      incomes,
      totalDrain,
      totalIncome,
      netChange,
      currentHealth,
      projectedHealth,
    };
  }, [stats?.health, currentJob, careers, educations, stats?.money, bankSavings, dietPlans, realEstate, rental, diseases]);

  const sections: StatBreakdownSection[] = [];
  if (breakdown.incomes.length > 0) {
    sections.push({
      title: 'Health Income (Next Week)',
      kind: 'income',
      entries: breakdown.incomes.map((income) => ({
        label: income.label,
        valueText: `+${income.value}`,
        positive: true,
        icon: income.icon,
        color: income.color,
        description: income.description,
      })),
    });
  }
  if (breakdown.drains.length > 0) {
    sections.push({
      title: 'Health Drain (Next Week)',
      kind: 'drain',
      entries: breakdown.drains.map((drain) => ({
        label: drain.label,
        valueText: `${drain.value}`,
        positive: false,
        icon: drain.icon,
        color: drain.color,
        description: drain.description,
      })),
    });
  }

  return (
    <StatBreakdownModal
      visible={visible}
      onClose={onClose}
      title="Health Breakdown"
      hero={{
        label: 'Current Health',
        valueText: `${Math.round(breakdown.currentHealth)} / 100`,
        subLines: [{ text: `Projected Next Week: ${Math.round(breakdown.projectedHealth)} / 100` }],
        netChange: {
          text: `${breakdown.netChange >= 0 ? '+' : ''}${breakdown.netChange.toFixed(1)} Health`,
          positive: breakdown.netChange >= 0,
        },
      }}
      sections={sections}
      summary={{
        title: 'How Health Works',
        text: (
          <>
            {'\u2022'} Health naturally decreases over time based on your wealth{'\n'}
            {'\u2022'} Working at a career reduces health by 2 per week{'\n'}
            {'\u2022'} Studying multiple educations simultaneously increases health drain{'\n'}
            {'\u2022'} Paused educations don't affect health{'\n'}
            {'\u2022'} Use health activities, food, and medical services to restore health{'\n'}
            {'\n'}
            Net Change = Income - Drain
          </>
        ),
      }}
    />
  );
}
