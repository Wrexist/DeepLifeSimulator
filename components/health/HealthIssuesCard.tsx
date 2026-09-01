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
import { fontScale, scale } from '@/utils/scaling';

interface HealthIssue {
  id: string;
  title: string;
  fix: string;
  level: 'critical' | 'warning' | 'info';
}

export default function HealthIssuesCard() {
  const diseases = useGameSelector((s) => s.diseases);
  const stats = useGameSelector((s) => s.stats, shallowEqual);
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
      const fix = (d.treatmentRequired || hasDeathCountdown)
        ? 'See a doctor or hospital below to treat it.'
        : 'Rest and eat well - it should pass, or treat it below.';
      issues.push({ id: `disease-${d.id}-${i}`, title: `${d.name} · ${sevLabel}`, fix, level });
    });

    const health = stats?.health ?? 100;
    if (health <= 0) {
      const weeksLeft = Math.max(1, 4 - (healthZeroWeeks || 0));
      issues.push({
        id: 'health-zero',
        title: `Health critical - ${weeksLeft} week${weeksLeft !== 1 ? 's' : ''} to recover`,
        fix: "Eat, rest and start a diet plan below before it's too late.",
        level: 'critical',
      });
    } else if (health <= 30) {
      issues.push({
        id: 'health-low',
        title: 'Low health',
        fix: 'Improve your diet, rest, and exercise.',
        level: 'warning',
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
    } else if (happiness <= 30) {
      issues.push({
        id: 'happiness-low',
        title: 'Low happiness',
        fix: 'Spend on hobbies, socialize, or take a break to recover.',
        level: 'warning',
      });
    }

    const energy = stats?.energy ?? 100;
    if (energy <= 20) {
      issues.push({
        id: 'energy-low',
        title: 'Low energy',
        fix: 'Rest or sleep to recover energy before working.',
        level: 'info',
      });
    }

    return issues;
  }, [diseases, healthZeroWeeks, happinessZeroWeeks, stats?.health, stats?.happiness, stats?.energy]);

  if (healthIssues.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AlertTriangle size={scale(18)} color="#EF4444" />
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {`Health Issues (${healthIssues.length})`}
        </Text>
      </View>
      {healthIssues.map(issue => {
        const color =
          issue.level === 'critical' ? '#EF4444' : issue.level === 'warning' ? '#F59E0B' : '#3B82F6';
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
    marginBottom: scale(12),
    borderRadius: scale(16),
    padding: scale(14),
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(8),
  },
  title: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#F8FAFC',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scale(8),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginTop: scale(5),
    marginRight: scale(8),
  },
  rowText: {
    flex: 1,
  },
  issueTitle: {
    fontSize: fontScale(13.5),
    fontWeight: '600',
    color: '#F1F5F9',
  },
  issueFix: {
    fontSize: fontScale(12),
    color: '#94A3B8',
    marginTop: scale(1),
  },
});
