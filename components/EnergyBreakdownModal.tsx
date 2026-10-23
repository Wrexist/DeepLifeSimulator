import { uiPalette } from '@/lib/config/theme';
import React, { useMemo } from 'react';
import { Briefcase, GraduationCap, Coffee, Home, Package, Utensils } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import type { DriftCause, DriftCauseId } from '@/lib/economy/vitalDrift';
import StatBreakdownModal from '@/components/ui/StatBreakdownModal';
import type { StatBreakdownSection } from '@/components/ui/StatBreakdownModal';

interface EnergyBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
}

const CAUSE_ICONS: Record<DriftCauseId, LucideIcon> = {
  decay: Coffee,
  rest: Coffee,
  home: Home,
  job: Briefcase,
  items: Package,
  education: GraduationCap,
  diet: Utensils,
};

/** Player-facing copy for one energy line. */
function describeEnergyCause(cause: DriftCause): string {
  const amount = Math.abs(cause.energy);
  switch (cause.id) {
    case 'rest':
      return `Resting and sleeping restores ${amount} energy per week`;
    case 'job':
      return `Working drains ${amount} energy per week`;
    case 'education':
      return `Studying costs ${amount} energy per week`;
    case 'diet':
      return `Active diet plan provides ${amount} energy per week`;
    case 'items':
      return cause.energy > 0
        ? `What you own restores ${amount} energy per week`
        : `What you own costs ${amount} energy per week`;
    case 'home':
      if (cause.label === 'No home') {
        return `Sleeping rough costs ${amount} energy per week - rent or buy a home`;
      }
      return cause.energy > 0
        ? `Your home restores ${amount} energy per week`
        : `Your housing costs ${amount} energy per week`;
    default:
      return `${cause.energy > 0 ? '+' : '-'}${amount} energy per week`;
  }
}

export default function EnergyBreakdownModal({ visible, onClose }: EnergyBreakdownModalProps) {
  const energy = useGameSelector((s) => s.stats?.energy ?? 0);
  const careers = useGameSelector((s) => s.careers);
  const currentJob = useGameSelector((s) => s.currentJob);
  // Every energy line comes from the shared projection (lib/economy/vitalDrift),
  // which reads the same functions the weekly tick applies. This modal used to
  // restate them: a +30 regen against the tick's +40 (and no Energy Boost), a
  // job drain read off `levels[].energyCost` - a field no career sets - and no
  // line at all for the bed's +10 (TICK2-2).
  const energyCauses = useGameSelector(
    (s) => projectWeeklyVitalDrift(s).causes.filter((c) => c.energy !== 0),
    (a, b) =>
      a.length === b.length &&
      a.every((c, i) => c.id === b[i].id && c.label === b[i].label && c.energy === b[i].energy),
  );

  const breakdown = useMemo(() => {
    const drains: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];
    const incomes: { label: string; value: number; icon: LucideIcon; color: string; description?: string }[] = [];

    for (const cause of energyCauses) {
      const entry = {
        label: cause.id === 'rest' ? 'Week Progression' : cause.id === 'job' ? `Career: ${cause.label}` : cause.label,
        value: cause.energy,
        icon: CAUSE_ICONS[cause.id] ?? Coffee,
        color: cause.energy > 0 ? '#10B981' : cause.id === 'education' ? '#F59E0B' : '#EF4444',
        description: describeEnergyCause(cause),
      };
      if (cause.energy > 0) incomes.push(entry);
      else drains.push(entry);
    }

    // Show pending applications (they don't drain energy, but good to show)
    const pendingApplication = careers?.find(c => c && c.applied && !c.accepted);
    if (pendingApplication && !currentJob) {
      const pendingLevel = pendingApplication.levels?.[0];
      drains.push({
        label: `Pending Application: ${pendingLevel?.name || pendingApplication.id}`,
        value: 0,
        icon: Briefcase,
        color: uiPalette.muted,
        description: 'Pending applications do not drain energy until you start working',
      });
    }

    // Calculate total drain and income
    const totalDrain = drains.reduce((sum, d) => sum + Math.abs(d.value), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + i.value, 0);
    const netChange = totalIncome - totalDrain;

    // Projected energy after next week: the tick applies every line and caps
    // once at the end, so the sum is clamped once here too.
    const currentEnergy = energy || 0;
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
  }, [energy, currentJob, careers, energyCauses]);

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
            {'\u2022'} Prestige bonuses, Energy Boost and the Stamina skill increase regeneration{'\n'}
            {'\u2022'} Energy is capped at 100 after every gain and drain is applied{'\n'}
            {'\n'}
            Net Change = Income - Drain
          </>
        ),
      }}
    />
  );
}
