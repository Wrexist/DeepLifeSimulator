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
  Sparkles,
  Swords,
  Target,
} from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { Card } from '@/components/ui/Card';
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
import { kicker, rhythm, tier3, tier4 } from '@/lib/config/hierarchy';
import type { ResolvedLiveEvent } from '@/lib/liveops/types';
import type { GameState } from '@/contexts/game/types';
import { unlockTier } from '@/lib/progress/featureUnlocks';

/** "$1,500", "$5k", "$1.2M" - the same shape the catalogue's money pairs use. */
const compactMoney = (n: number): string => {
  const v = Math.max(0, Math.round(n));
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 10_000) return `$${Math.round(v / 1000)}k`;
  return `$${v.toLocaleString()}`;
};

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

  // 2. The situational recommendation - the ONLY row with its own destination,
  //    so it is pinned second. It used to come last, after the challenge, the
  //    live event, the ambition and the scenario, and with three slots that
  //    meant a fresh life NEVER saw it: "Get your health back up" (<60) and
  //    "Do something you enjoy" (<45) were computed every week and shown on
  //    none of them while the character slid to zero (Program 6 walkthrough).
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

  // 3. Weekly challenge - rotates on game weeks, but it is the shortest ladder.
  //    Hidden below tier 2: every challenge is a mid-game bundle (properties,
  //    educations, pets, followers, $10k+ savings) whose objectives all sit
  //    behind the same padlocks the Apps grid shows, so for a new life the row
  //    read "Have 80+ fitness · 0/4 objectives" as the lead goal at fitness 10.
  //    Same gate as the Apps grid, so the goal feed never names a system the
  //    player cannot open. The card itself (Home → details) is untouched.
  const challenge = state.weeklyChallenge;
  if (challenge?.challengeId && !challenge.rewardClaimed && unlockTier(state) >= 2) {
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
        // A money objective reads as money ("$1,500 / $5,000"); "0/3 done"
        // under a 30%-full bar read as a contradiction to a new player.
        fraction: /\$/.test(next.label)
          ? `${compactMoney(next.current)} / ${compactMoney(next.target)}`
          : `${met}/${active.objectives.length} objectives`,
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

  return rows;
}

/** Three rows is a glance; more is the backlog this card exists to replace. */
const MAX_ROWS = 3;

/**
 * NOW and NEXT are different tiers, not different rows. The lead row is the
 * one objective that matters most right now (the ladder in `buildGoalRows`
 * puts it first), so it alone gets a crest, tier-2 type and a full-height
 * bar; the rows under it are what comes after - tier 3, a dot for the
 * system colour, a hairline bar. Two axes down (scale AND density), so the
 * difference reads as a decision rather than a rendering glitch. Three equal
 * rows told the player three things mattered equally, which is never true.
 */
function Row({ row, lead, onPress }: { row: GoalsCardRow; lead: boolean; onPress?: () => void }) {
  const { color, Icon } = SYSTEM_META[row.system];
  const body = (
    <>
      {lead ? (
        <View style={[styles.rowIcon, { borderColor: color }]}>
          <Icon size={scale(16)} color={color} />
        </View>
      ) : (
        <View style={[styles.rowDot, { backgroundColor: color }]} />
      )}
      <View style={{ flex: 1 }}>
        <Text
          style={lead ? styles.leadTitle : styles.rowTitle}
          numberOfLines={lead ? 2 : 1}
          maxFontSizeMultiplier={1.4}
        >
          {row.title}
        </Text>
        {typeof row.progress === 'number' && (
          <View style={lead ? styles.leadBarBg : styles.barBg}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.round(row.progress * 100)}%`, backgroundColor: color },
              ]}
            />
          </View>
        )}
        {!!row.fraction && (
          <Text style={lead ? styles.leadFraction : styles.rowFraction}>{row.fraction}</Text>
        )}
      </View>
      {onPress ? <ChevronRight size={scale(15)} color="#64748B" /> : null}
    </>
  );

  const rowStyle = lead ? styles.leadRow : styles.row;
  // A row with nothing to do on tap renders as plain text - a pressable that
  // does nothing is the dead-tap defect LifeChapterCard's banner documents.
  if (!onPress) {
    return (
      <View
        style={rowStyle}
        accessibilityRole="text"
        accessibilityLabel={`${row.title}. ${row.fraction ?? ''}`}
      >
        {body}
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={rowStyle}
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

  const pressFor = (row: GoalsCardRow) =>
    row.route
      ? () =>
          router.push(
            (row.route!.includes('segment=') ? `${row.route}&ts=${Date.now()}` : row.route) as never
          )
      : onShowDetails;

  const [leadRow, ...nextRows] = rows;

  return (
    <Card>
      {/* No crest header: the lead row's own crest is the card's crest, so
          the title would only have competed with the objective it names. */}
      <Text style={styles.kicker} accessibilityRole="header">
        What matters now
      </Text>
      <Row row={leadRow} lead onPress={pressFor(leadRow)} />
      {nextRows.length > 0 && (
        <View style={styles.next}>
          <Text style={styles.nextKicker}>Next</Text>
          {nextRows.map((row) => (
            <Row key={row.id} row={row} lead={false} onPress={pressFor(row)} />
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Container from components/ui/Card.
  kicker: { ...kicker, color: '#94A3B8' },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  rowIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(11),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  leadTitle: {
    color: '#F8FAFC',
    fontSize: fontScale(17),
    lineHeight: fontScale(22),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  leadBarBg: {
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: scale(7),
    overflow: 'hidden',
  },
  leadFraction: { ...tier4, color: '#94A3B8', marginTop: scale(4) },
  next: {
    gap: rhythm.tight,
    paddingTop: rhythm.tight,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  nextKicker: { ...kicker, color: '#64748B' },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  rowDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  rowTitle: { ...tier3, color: '#CBD5E1' },
  barBg: {
    height: scale(3),
    borderRadius: scale(2),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: scale(4),
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: scale(3) },
  rowFraction: { ...tier4, color: '#64748B', marginTop: scale(2) },
});

export default React.memo(GoalsCard);
