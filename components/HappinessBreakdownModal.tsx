import React, { useMemo } from 'react';
import { TrendingDown, Briefcase, GraduationCap, Utensils, Home, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import { closeCircle, closeCircleHappiness, CLOSE_BOND_HAPPINESS_CAP } from '@/lib/social/closeness';
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import type { StatBreakdownSection } from '@/components/ui/StatBreakdownModal';

interface HappinessBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HappinessBreakdownModal({ visible, onClose }: HappinessBreakdownModalProps) {
  const { gameState } = useGame();
  const { stats, careers, currentJob, educations } = gameState;

  const breakdown = useMemo(() => {
    const drains: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];
    const incomes: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];

    // Natural decay and the job toll come from the ONE projection the tick's
    // formula is pinned to (`lib/economy/vitalDrift.ts`). This modal used to
    // restate the decay formula with no grace ramp, no prestige bonus and a
    // different net worth, and charged every career a flat -3 - so the number
    // here disagreed with the recap line and with what the tick applied.
    const drift = projectWeeklyVitalDrift(gameState);
    const decayCause = drift.causes.find((c) => c.id === 'decay');
    const jobCause = drift.causes.find((c) => c.id === 'job');

    if (decayCause && decayCause.happiness < 0) {
      drains.push({
        label: 'Natural Decay',
        value: decayCause.happiness,
        icon: TrendingDown,
        color: '#EF4444',
        description: 'Happiness naturally decreases over time; wealth slows it, never speeds it',
      });
    }

    // The job's weekly toll, exactly as the tick charges it (a busker's week
    // is +4 - the one entry job whose work is itself a lift).
    if (currentJob && jobCause && jobCause.happiness !== 0) {
      const career = careers?.find(c => c.id === currentJob && c.accepted);
      if (career) {
        const label = `Career: ${career.levels?.[career.level]?.name || career.id}`;
        if (jobCause.happiness < 0) {
          drains.push({
            label,
            value: jobCause.happiness,
            icon: Briefcase,
            color: '#EF4444',
            description: `Working costs ${Math.abs(jobCause.happiness)} happiness per week`,
          });
        } else {
          incomes.push({
            label,
            value: jobCause.happiness,
            icon: Briefcase,
            color: '#10B981',
            description: `You enjoy the work: +${jobCause.happiness} happiness per week`,
          });
        }
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
        label: `Pending Application: ${pendingApplication.levels?.[0]?.name || pendingApplication.id}`,
        value: 0,
        icon: Briefcase,
        color: '#94A3B8',
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

    // Housing, from the SAME function the weekly tick applies
    // (`computeHousingWellbeing`) - an owned home, a rental, or the penalty
    // for neither. The old owned-only `currentResidence` copy here is the
    // divergence __tests__/economy/rentalLadder.test.ts exists to prevent:
    // a modal that predicts a number the tick never delivers.
    const housing = computeHousingWellbeing({ realEstate: gameState.realEstate, rental: gameState.rental });
    if (housing.happiness > 0) {
      incomes.push({
        label: 'Your housing',
        value: housing.happiness,
        icon: Home,
        color: '#10B981',
        description: `Your home adds ${housing.happiness} happiness per week`,
      });
    } else if (housing.happiness < 0) {
      drains.push({
        label: housing.homeless ? 'No place to live' : 'Your housing',
        value: housing.happiness,
        icon: Home,
        color: '#EF4444',
        description: housing.homeless
          ? `Sleeping rough costs ${Math.abs(housing.happiness)} happiness per week - rent or buy a home`
          : `Your housing costs ${Math.abs(housing.happiness)} happiness per week`,
      });
    }

    /**
     * The people you are close to.
     *
     * Read from `closeCircleHappiness` - the SAME function the tick applies
     * (`applyRelationshipHealth` -> the relationships pass) - because the rule
     * this modal already follows for decay and the job toll is that the number
     * on screen is produced by the code that charges it, never restated
     * (CLAUDE.md 4.3).
     *
     * Shown at ZERO too, unlike the other lines, and that is deliberate: a
     * player with three acquaintances at bond 50 needs to be told what the
     * missing line is worth and what it would take, or "friendship does
     * nothing" stays true in their head after it stopped being true in the
     * code.
     */
    const circle = closeCircle(gameState);
    const circleHappiness = closeCircleHappiness(gameState);
    if (circleHappiness > 0) {
      incomes.push({
        label: circle.length === 1 ? `${circle[0].name}` : `${circle.length} close relationships`,
        value: circleHappiness,
        icon: Users,
        color: '#10B981',
        description:
          circle.length >= CLOSE_BOND_HAPPINESS_CAP
            ? `The people you are closest to add ${circleHappiness} happiness per week - the most a circle can give`
            : `Adds ${circleHappiness} per week, up to ${CLOSE_BOND_HAPPINESS_CAP} with ${CLOSE_BOND_HAPPINESS_CAP} close relationships`,
      });
    } else {
      incomes.push({
        label: 'Nobody close yet',
        value: 0,
        icon: Users,
        color: '#6B7280',
        description: `A relationship at 60+ adds 1 happiness per week, up to ${CLOSE_BOND_HAPPINESS_CAP} - and is who turns up when things go wrong`,
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
    // `realEstate`/`rental` are listed because the housing line above reads
    // them (via computeHousingWellbeing). Without them this memo kept the
    // pre-tenancy numbers after the player rented - a modal advertising a
    // weekly effect different from the one the tick applies, which is the
    // exact class of divergence the shared helper was adopted to close.
  }, [stats?.happiness, currentJob, careers, educations, gameState]);

  const sections: StatBreakdownSection[] = [];
  if (breakdown.incomes.length > 0) {
    sections.push({
      title: 'Happiness Income (Next Week)',
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
      title: 'Happiness Drain (Next Week)',
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
      title="Happiness Breakdown"
      hero={{
        label: 'Current Happiness',
        valueText: `${Math.round(breakdown.currentHappiness)} / 100`,
        subLines: [{ text: `Projected Next Week: ${Math.round(breakdown.projectedHappiness)} / 100` }],
        netChange: {
          text: `${breakdown.netChange >= 0 ? '+' : ''}${breakdown.netChange.toFixed(1)} Happiness`,
          positive: breakdown.netChange >= 0,
        },
      }}
      sections={sections}
      summary={{
        title: 'How Happiness Works',
        text: (
          <>
            {'\u2022'} Happiness naturally decreases over time; wealth slows it down{'\n'}
            {'\u2022'} Working at a career reduces happiness by 3 per week{'\n'}
            {'\u2022'} Studying multiple educations simultaneously increases happiness drain{'\n'}
            {'\u2022'} Paused educations don't affect happiness{'\n'}
            {'\u2022'} Use health activities and hobbies to restore happiness{'\n'}
            {'\n'}
            Net Change = Income - Drain
          </>
        ),
      }}
    />
  );
}
