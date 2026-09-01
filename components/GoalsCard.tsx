/**
 * GoalsCard - ONE answer to "what should I do next?".
 *
 * The 2026-09-01 UI audit found the home feed stacking five copies of the same
 * checklist-with-progress-bars pattern (NextGoalsCard, LifeChapterCard,
 * AmbitionCard, ScenarioChallengeCard, WeeklyChallengeCard - plus WeekAhead
 * and LiveEvents in the same band), each answering the same question in a
 * different accent hue, so no checklist read as the one that mattered
 * (blueprint §2 item 2, §10). This card is the consolidation: the top three
 * objectives across all of those systems, one row each, with the full detail
 * cards behind a "Show details" disclosure on the home screen.
 *
 * READ-ONLY by construction, like every card it summarizes: it derives rows
 * from the SAME pure helpers those cards use (no duplicated progress math -
 * the number shown here is the number shown there), grants nothing, and its
 * only actions are navigation. Catalogue rows push the route the goal already
 * carries; every other system's detail lives on this same screen, so those
 * rows open the disclosure instead of inventing a destination.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  ChevronRight,
  Compass,
  Flag,
  ListChecks,
  Sparkles,
  Swords,
  Target,
} from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import Card, { IconBubble } from '@/components/ui/Card';
import { getActiveChapter, getChapterProgress } from '@/lib/progress/lifeChapters';
import {
  evaluateChallengeProgress,
  getWeeklyChallengeDefinition,
} from '@/lib/challenges/weeklyChallenges';
import { getAmbitionCompletion } from '@/lib/ambitions';
import { getActiveScenarioProgress } from '@/lib/scenarios/progress';
import { recommendGoals } from '@/lib/goals';
import type { GoalRoute } from '@/lib/goals';
import { objectiveFraction } from '@/components/WeeklyChallengeCard';
import { rewardLabel } from '@/components/LiveEventsCard';
import { useLiveOps } from '@/hooks/useLiveOps';
import { fontScale, scale } from '@/utils/scaling';
import type { ResolvedLiveEvent } from '@/lib/liveops/types';
import type { GameState } from '@/contexts/game/types';

/** Which system a row came from - drives the icon and accent only. */
export type GoalRowSystem =
  | 'chapter'
  | 'challenge'
  | 'liveops'
  | 'ambition'
  | 'scenario'
  | 'catalogue';

export interface GoalsCardRow {
  id: string;
  system: GoalRowSystem;
  title: string;
  /** 0..1 where the source provides one; absent = no bar (e.g. a claim row). */
  progress?: number;
  /** Preformatted fraction/summary line, e.g. "2/4 goals" or "200 gems". */
  fraction?: string;
  /** Only catalogue goals carry a destination; other systems' detail lives on
   *  the home screen itself, behind the disclosure this card fronts. */
  route?: GoalRoute;
}

/** Accent per source system - the same hue each detail card already owns, so a
 *  row here and its card below read as the same thing. Icon-only, per the
 *  Card contract (accent never colors the container). */
const SYSTEM_META: Record<GoalRowSystem, { color: string; Icon: typeof Target }> = {
  chapter: { color: '#A855F7', Icon: BookOpen },
  challenge: { color: '#F472B6', Icon: Swords },
  liveops: { color: '#38BDF8', Icon: Sparkles },
  ambition: { color: '#60A5FA', Icon: Target },
  scenario: { color: '#38BDF8', Icon: Flag },
  catalogue: { color: '#34D399', Icon: Compass },
};

/**
 * The priority ladder, most immediate first:
 * chapter goal → weekly challenge objective → live event → ambition milestone
 * → scenario condition → top catalogue recommendation.
 *
 * A claimable live event jumps its slot's content to the claim itself - it is
 * the only thing in the band the player can act on RIGHT NOW.
 *
 * Pure: everything comes from `state` plus the already-resolved live events
 * (resolution needs the wall clock and the frozen session, which belong to
 * `useLiveOps`, not here).
 */
export function buildGoalRows(
  state: GameState | undefined | null,
  liveEvents: readonly ResolvedLiveEvent[],
): GoalsCardRow[] {
  if (!state) return [];
  const rows: GoalsCardRow[] = [];

  // 1. Life Chapter - the tutorial/unlock spine, so it leads.
  const chapter = getActiveChapter(state);
  if (chapter) {
    const progress = getChapterProgress(chapter, state);
    const next = progress.goals.find((g) => !g.complete);
    if (next) {
      rows.push({
        id: `chapter:${next.id}`,
        system: 'chapter',
        title: next.title,
        progress: next.progress,
        fraction: `${progress.completedGoals}/${progress.totalGoals} goals`,
      });
    }
  }

  // 2. Weekly challenge - rotates on game weeks, but it is the shortest ladder.
  const challenge = state.weeklyChallenge;
  if (challenge?.challengeId && !challenge.rewardClaimed) {
    const definition = getWeeklyChallengeDefinition(challenge.challengeId);
    if (definition) {
      const objectives = evaluateChallengeProgress(challenge.challengeId, state);
      const met = objectives.filter((o) => o.completed).length;
      const next = objectives.find((o) => !o.completed);
      if (next) {
        rows.push({
          id: `challenge:${next.id}`,
          system: 'challenge',
          title: next.description,
          progress: objectiveFraction(next.current, next.target),
          fraction: `${met}/${objectives.length} objectives`,
        });
      }
    }
  }

  // 3. Live events - a claimable one beats an in-progress one: it is the only
  //    row here with a real-world window AND nothing left to earn.
  const claimable = liveEvents.find((e) => e.state === 'claimable');
  const active = liveEvents.find((e) => e.state === 'active');
  if (claimable) {
    rows.push({
      id: `liveops:${claimable.definition.id}:claim`,
      system: 'liveops',
      title: `Collect: ${claimable.definition.title}`,
      fraction: rewardLabel(claimable),
    });
  } else if (active) {
    const next = active.objectives.find((o) => !o.met);
    const met = active.objectives.filter((o) => o.met).length;
    if (next) {
      rows.push({
        id: `liveops:${active.definition.id}:${next.objectiveId}`,
        system: 'liveops',
        title: next.label,
        progress: objectiveFraction(next.current, next.target),
        fraction: `${met}/${active.objectives.length} done`,
      });
    }
  }

  // 4. Ambition - the lifelong aim; fully-reached ambitions have nothing to do
  //    (the tick pays them), so only an incomplete milestone earns a row.
  const ambition = getAmbitionCompletion(state);
  if (ambition && !ambition.alreadyClaimed) {
    const next = ambition.milestones.find((m) => !m.complete);
    if (next) {
      rows.push({
        id: `ambition:${next.id}`,
        system: 'ambition',
        title: next.title,
        progress: next.progress,
        fraction: `${ambition.reachedCount}/${ambition.totalCount} milestones`,
      });
    }
  }

  // 5. Scenario win conditions - settled at first prestige, the longest ladder.
  const scenario = getActiveScenarioProgress(state);
  if (scenario && !scenario.complete) {
    const next = scenario.rows.find((r) => !r.met);
    if (next) {
      rows.push({
        id: `scenario:${next.description}`,
        system: 'scenario',
        title: next.description,
        // Boolean-shaped conditions read 0 until met - a stuck-empty bar under
        // a condition with no numeric ladder reads as broken, so omit it.
        progress: next.progress > 0 ? next.progress : undefined,
        fraction: `${scenario.metCount}/${scenario.total} conditions`,
      });
    }
  }

  // 6. The situational recommendation - the only row with its own destination.
  const recommended = recommendGoals(state)[0];
  if (recommended) {
    rows.push({
      id: `catalogue:${recommended.id}`,
      system: 'catalogue',
      title: recommended.title,
      progress: recommended.progress,
      fraction: recommended.progressLabel,
      route: recommended.route,
    });
  }

  return rows;
}

/** Three rows is a glance; more is the backlog this card exists to replace. */
const MAX_ROWS = 3;

function Row({ row, onPress }: { row: GoalsCardRow; onPress?: () => void }) {
  const { color, Icon } = SYSTEM_META[row.system];
  const body = (
    <>
      <View style={[styles.rowIcon, { borderColor: color }]}>
        <Icon size={scale(14)} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.title}
        </Text>
        {typeof row.progress === 'number' && (
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round(row.progress * 100)}%`, backgroundColor: color },
              ]}
            />
          </View>
        )}
        {!!row.fraction && <Text style={styles.rowFraction}>{row.fraction}</Text>}
      </View>
      {onPress ? <ChevronRight size={scale(15)} color="#64748B" /> : null}
    </>
  );

  // A row with nothing to do on tap renders as plain text - a pressable that
  // does nothing is the dead-tap defect LifeChapterCard's banner documents.
  if (!onPress) {
    return (
      <View
        style={styles.row}
        accessibilityRole="text"
        accessibilityLabel={`${row.title}. ${row.fraction ?? ''}`}
      >
        {body}
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}. ${row.fraction ?? ''}`}
      accessibilityHint={row.route ? 'Opens the related screen' : 'Shows the full goal details'}
    >
      {body}
    </TouchableOpacity>
  );
}

function GoalsCard({ onShowDetails }: { onShowDetails?: () => void }) {
  const router = useRouter();
  // Every source system reads arbitrary state fields, so select the whole
  // snapshot - the trade-off each of the summarized cards documents.
  const state = useGameSelector((s) => s) as GameState;
  // The sanctioned live-ops read path; its funnel observer is idempotent per
  // session, so a second consumer costs nothing.
  const { events } = useLiveOps();

  const rows = useMemo(() => buildGoalRows(state, events).slice(0, MAX_ROWS), [state, events]);

  // A fresh save before any system has an objective sees nothing - the same
  // self-nulling contract as every card this one summarizes.
  if (rows.length === 0) return null;

  return (
    <Card>
      <View style={styles.header}>
        <IconBubble color="#34D399">
          <ListChecks size={scale(18)} color="#34D399" />
        </IconBubble>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>GOALS</Text>
          <Text style={styles.title}>What matters now</Text>
        </View>
      </View>
      <View style={styles.list}>
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            onPress={
              row.route
                ? () => router.push(row.route as GoalRoute)
                : onShowDetails
            }
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Container from components/ui/Card; crest from IconBubble.
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  kicker: { color: '#34D399', fontSize: fontScale(10), fontWeight: '600', letterSpacing: 0.6 },
  title: { color: '#F8FAFC', fontSize: fontScale(15), fontWeight: '700', marginTop: scale(1) },
  list: { gap: scale(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  rowIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  rowTitle: { color: '#F1F5F9', fontSize: fontScale(13), fontWeight: '600' },
  barBg: {
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: scale(5),
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: scale(2) },
  rowFraction: { color: '#94A3B8', fontSize: fontScale(10.5), fontWeight: '600', marginTop: scale(3) },
});

export default React.memo(GoalsCard);
