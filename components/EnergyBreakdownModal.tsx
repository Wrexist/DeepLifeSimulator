import React, { useMemo } from 'react';
import { Briefcase, GraduationCap, Coffee, Home, Utensils } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import type { StatBreakdownSection } from '@/components/ui/StatBreakdownModal';

interface EnergyBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EnergyBreakdownModal({ visible, onClose }: EnergyBreakdownModalProps) {
  const stats = useGameSelector((s) => s.stats, shallowEqual);
  const careers = useGameSelector((s) => s.careers);
  const currentJob = useGameSelector((s) => s.currentJob);
  const educations = useGameSelector((s) => s.educations);
  const prestige = useGameSelector((s) => s.prestige);
  const dietPlans = useGameSelector((s) => s.dietPlans);
  const realEstate = useGameSelector((s) => s.realEstate);
  const rental = useGameSelector((s) => s.rental, shallowEqual);

  const breakdown = useMemo(() => {
    const drains: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];
    const incomes: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];

    // Calculate energy drain from career (active job)
    if (currentJob) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career && career.levels && career.levels.length > 0) {
        const currentLevel = career.levels[career.level] || career.levels[0];
        if (currentLevel && currentLevel.energyCost) {
          drains.push({
            label: `Career: ${currentLevel.name}`,
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
      const pendingLevel = pendingApplication.levels?.[0];
      drains.push({
        label: `Pending Application: ${pendingLevel?.name || pendingApplication.id}`,
        value: 0,
        icon: Briefcase,
        color: '#94A3B8',
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
    const activeDietPlan = (dietPlans || []).find(plan => plan && plan.active);
    if (activeDietPlan && activeDietPlan.energyGain > 0) {
      incomes.push({
        label: `${activeDietPlan.name} Diet`,
        value: activeDietPlan.energyGain,
        icon: Utensils,
        color: '#10B981',
        description: `Active diet plan provides ${activeDietPlan.energyGain} energy per week`,
      });
    }

    // Housing, from the SAME function the weekly tick applies
    // (`computeHousingWellbeing`) - an owned home, a rental, or the penalty
    // for neither. The old owned-only `currentResidence` copy here is the
    // divergence __tests__/economy/rentalLadder.test.ts exists to prevent:
    // a modal that predicts a number the tick never delivers.
    const housing = computeHousingWellbeing({ realEstate, rental });
    if (housing.energy > 0) {
      incomes.push({
        label: 'Your housing',
        value: housing.energy,
        icon: Home,
        color: '#10B981',
        description: `Your home restores ${housing.energy} energy per week`,
      });
    } else if (housing.energy < 0) {
      drains.push({
        label: housing.homeless ? 'No place to live' : 'Your housing',
        value: housing.energy,
        icon: Home,
        color: '#EF4444',
        description: housing.homeless
          ? `Sleeping rough costs ${Math.abs(housing.energy)} energy per week - rent or buy a home`
          : `Your housing costs ${Math.abs(housing.energy)} energy per week`,
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
  }, [stats?.energy, currentJob, careers, educations, prestige, dietPlans, realEstate, rental]);

  const sections: StatBreakdownSection[] = [];
  if (breakdown.incomes.length > 0) {
    sections.push({
      title: 'Energy Income (Next Week)',
      kind: 'income' as const,
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
      title: 'Energy Drain (Next Week)',
      kind: 'drain' as const,
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
      title="Energy Breakdown"
      hero={{
        label: 'Current Energy',
        valueText: `${Math.round(breakdown.currentEnergy)} / 100`,
        subLines: [{ text: `Projected Next Week: ${Math.round(breakdown.projectedEnergy)} / 100` }],
        netChange: {
          text: `${breakdown.netChange >= 0 ? '+' : ''}${breakdown.netChange.toFixed(1)} Energy`,
          positive: breakdown.netChange >= 0,
        },
      }}
      sections={sections}
      summary={{
        title: 'How Energy Works',
        text: (
          <>
            {'\u2022'} Energy is restored each week when you advance to the next week{'\n'}
            {'\u2022'} Working at a career drains energy based on the job's requirements{'\n'}
            {'\u2022'} Studying multiple educations simultaneously increases energy drain{'\n'}
            {'\u2022'} Paused educations don't drain energy{'\n'}
            {'\u2022'} Prestige bonuses can increase energy regeneration{'\n'}
            {'\n'}
            Net Change = Income - Drain
          </>
        ),
      }}
    />
  );
}
