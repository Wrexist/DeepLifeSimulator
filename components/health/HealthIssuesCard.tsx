import { responsiveSpacing as layoutSpace, responsiveBorderRadius as layoutRadius , fontScale, scale } from '@/utils/scaling';
import { uiPalette , accent } from '@/lib/config/theme';
/**
 * Health issues - every active problem and how to fix it, in one card ON the
 * Health screen.
 *
 * This block used to live inside IdentityCard on Home ("how healthy am I?"
 * was answered on four surfaces - the audit's duplication finding). The HUD's
 * health ring and disease badge stay the at-a-glance answer; the full list
 * with treatment guidance belongs where the treatments are.
 *
 * Self-nulls when there is nothing wrong: on the Health screen an "all clear"
 * line would just push the activities down.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';

import { tier1Title, vitalState } from '@/lib/config/hierarchy';


interface HealthIssue {
  id: string;
  title: string;
  fix: string;
  level: 'critical' | 'warning' | 'info';
}

/**
 * `lead`: the card is the Health screen's dominant element (the player is
 * sick or critical), so it takes the tier-1 title and a firmer danger rim -
 * scale AND colour, so the promotion reads as decided. In its normal place
 * under the vitals it stays tier 2.
 */
export default function HealthIssuesCard({ lead = false }: { lead?: boolean }) {
  const diseases = useGameSelector((s) => s.diseases);
  const stats = useGameSelector((s) => s.stats, shallowEqual);
  const restUsed = useGameSelector((s) => s.settings?.quickActionWeeks?.rest === s.weeksLived);
  const healthZeroWeeks = useGameSelector((s) => s.healthZeroWeeks);
  const happinessZeroWeeks = useGameSelector((s) => s.happinessZeroWeeks);

  const healthIssues = useMemo(() => {
    const issues: HealthIssue[] = [];

    (diseases || []).forEach((d, i) => {
      if (!d || !d.name) return;
      const hasDeathCountdown = 'weeksUntilDeath' in d && typeof (d as { weeksUntilDeath?: unknown }).weeksUntilDeath === 'number';
      const level: HealthIssue['level'] =
        hasDeathCountdown || d.severity === 'critical'
          ? 'critical'
          : d.severity === 'serious'
            ? 'warning'
            : 'info';
      const sevLabel = d.severity ? d.severity.charAt(0).toUpperCase() + d.severity.slice(1) : 'Mild';
      // The card sits on the Health screen now, so the fix points at the
      // activities below it rather than navigating the player here.
      const fix = !d.curable
        ? d.treatmentRequired
          ? 'A doctor or hospital can manage symptoms; this condition cannot be cured.'
          : 'This condition cannot be cured. Use recovery activities to support your vitals.'
        : d.severity === 'critical'
          ? 'Experimental Treatment is required to cure this condition.'
          : (d.treatmentRequired || hasDeathCountdown)
            ? 'A doctor may cure it; a hospital cures non-critical, curable illnesses.'
            : 'This can pass naturally, or you can seek treatment below.';
      issues.push({ id: `disease-${d.id}-${i}`, title: `${d.name} · ${sevLabel}`, fix, level });
    });

    // Bands from the one vital-state ladder (lib/config/hierarchy.ts). The
    // zero-week countdown is gameplay and stays exact; 'low' is the shared
    // LOW_VITAL band, so this card, the HUD and the tips agree on the word.
    const health = stats?.health ?? 100;
    if (health <= 0) {
      const weeksLeft = Math.max(1, 4 - (healthZeroWeeks || 0));
      issues.push({
        id: 'health-zero',
        title: `Health critical - ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} to recover`,
        fix: 'Use free Walk in Park or Meditation to raise health if you have energy. Rest restores energy, not health.',
        level: 'critical',
      });
    } else if (vitalState(health).level !== 'fair' && vitalState(health).level !== 'good') {
      issues.push({
        id: 'health-low',
        title: `${vitalState(health).word} health`,
        fix: 'Walk in Park and Meditation raise health for free; both need energy.',
        level: vitalState(health).level === 'critical' ? 'critical' : 'warning',
      });
    }

    const happiness = stats?.happiness ?? 100;
    if (happiness <= 0) {
      const weeksLeft = Math.max(1, 4 - (happinessZeroWeeks || 0));
      issues.push({
        id: 'happiness-zero',
        title: `Happiness critical - ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} to recover`,
        fix: 'Do something fun or spend time with people you care about.',
        level: 'critical',
      });
    } else if (vitalState(happiness).level !== 'fair' && vitalState(happiness).level !== 'good') {
      issues.push({
        id: 'happiness-low',
        title: `${vitalState(happiness).word} happiness`,
        fix: 'Meditation and Walk in Park raise happiness for free; both need energy.',
        level: vitalState(happiness).level === 'critical' ? 'critical' : 'warning',
      });
    }

    const energy = stats?.energy ?? 100;
    if (vitalState(energy).level !== 'fair' && vitalState(energy).level !== 'good') {
      issues.push({
        id: 'energy-low',
        title: `${vitalState(energy).word} energy`,
        fix: restUsed
          ? 'Rest is used for this week. It becomes available after Next week; check food in Market for energy now.'
          : 'Hold the blue Energy ring above, then choose Rest: free, +14 energy and -5 happiness, once per week.',
        level: vitalState(energy).level === 'critical' ? 'critical' : 'warning',
      });
    }

    return issues;
  }, [diseases, healthZeroWeeks, happinessZeroWeeks, restUsed, stats?.health, stats?.happiness, stats?.energy]);

  if (healthIssues.length === 0) return null;

  return (
    <View style={[styles.card, lead && styles.cardLead]}>
      <View style={styles.header}>
        <AlertTriangle size={scale(lead ? 22 : 18)} color="#EF4444" />
        <Text style={[styles.title, lead && styles.titleLead]} maxFontSizeMultiplier={1.3}>
          {lead ? `Treat this first (${healthIssues.length})` : `Health Issues (${healthIssues.length})`}
        </Text>
      </View>
      {healthIssues.map(issue => {
        // State colours only (danger / warning) - never a stat's identity hue,
        // which used to make a low-happiness row amber for two reasons at once.
        const color = issue.level === 'critical' ? accent.danger : accent.warning;
        return (
          <View key={issue.id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <View style={styles.rowText}>
              <Text style={styles.issueTitle}>{issue.title}</Text>
              <Text style={styles.issueFix}>{issue.fix}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: layoutSpace.compact,
    borderRadius: layoutRadius.xl,
    padding: layoutSpace.compact,
    backgroundColor: uiPalette.surface,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layoutSpace.sm,
    marginBottom: layoutSpace.sm,
  },
  title: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: uiPalette.paper,
    flex: 1,
  },
  titleLead: {
    ...tier1Title,
  },
  cardLead: {
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: layoutSpace.sm,
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: layoutRadius.sm,
    marginTop: layoutSpace.xs,
    marginRight: layoutSpace.sm,
  },
  rowText: {
    flex: 1,
  },
  issueTitle: {
    fontSize: fontScale(13.5),
    fontWeight: '600',
    color: uiPalette.lightSurface,
  },
  issueFix: {
    fontSize: fontScale(12),
    color: uiPalette.muted,
    marginTop: layoutSpace.xs,
  },
});
