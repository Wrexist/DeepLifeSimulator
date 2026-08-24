/**
 * NextGoalsCard - "what should I be working toward?"
 *
 * The game answers "what happened" (LastWeekRecap), "what is the ladder"
 * (LifeChapterCard) and "what is the lifelong aim" (AmbitionCard), but nothing
 * read the player's actual situation and answered the question they ask on
 * opening the app. The one system that tried was deleted as unreachable, and
 * nothing replaced it - see `lib/goals/engine.ts`.
 *
 * Read-only by construction. It recommends and routes; it never grants, and
 * there is nothing here to claim twice. The recommendation is derived on
 * render from live state, the same pattern `WeeklyChallengeCard`,
 * `AmbitionCard` and `LifeChapterCard` use, and it is deterministic, so it
 * cannot reshuffle between renders (CLAUDE.md §35).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Compass, Flag, Sparkles, Target } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { goalsAchievedBetween, recommendGoals } from '@/lib/goals';
import type { AchievedGoal, GoalHorizon, RecommendedGoal } from '@/lib/goals';
import { track } from '@/lib/analytics';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

/** Per-horizon presentation. The labels are the player-facing vocabulary for
 *  the three time-scales; the engine's own names are internal. */
const HORIZON_META: Record<
  GoalHorizon,
  { label: string; color: string; tint: string; Icon: typeof Target }
> = {
  now: { label: 'NOW', color: '#34D399', tint: 'rgba(52, 211, 153, 0.13)', Icon: Target },
  soon: { label: 'SOON', color: '#60A5FA', tint: 'rgba(96, 165, 250, 0.13)', Icon: Flag },
  dream: { label: 'DREAM', color: '#C084FC', tint: 'rgba(192, 132, 252, 0.13)', Icon: Sparkles },
};

function GoalRow({ goal, onPress }: { goal: RecommendedGoal; onPress: () => void }) {
  const meta = HORIZON_META[goal.horizon];
  const { Icon } = meta;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${goal.title}. ${goal.progressLabel}.`}
    >
      <View style={[styles.rowIcon, { backgroundColor: meta.tint, borderColor: meta.color }]}>
        <Icon size={scale(15)} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowKicker, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {goal.title}
        </Text>
        <Text style={styles.rowRationale} numberOfLines={2}>
          {goal.rationale}
        </Text>
        <View style={styles.barBg}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.round(goal.progress * 100)}%`, backgroundColor: meta.color },
            ]}
          />
        </View>
        <Text style={styles.rowProgress}>{goal.progressLabel}</Text>
      </View>
      <ChevronRight size={scale(16)} color="#64748B" />
    </TouchableOpacity>
  );
}

function NextGoalsCard() {
  const router = useRouter();
  // The catalogue reads across careers, education, property, family and
  // banking, so this card selects the whole snapshot - the same trade-off
  // WeeklyChallengeCard documents for the same reason.
  const state = useGameSelector((s) => s) as GameState;

  const goals = useMemo(() => recommendGoals(state), [state]);

  // ── Acknowledgement ──────────────────────────────────────────────────────
  //
  // A goal that simply vanishes on completion gives the player nothing back.
  // This holds the LAST state in a ref and diffs against it, so reaching a
  // goal leaves a visible mark before the next recommendation takes its place.
  //
  // Deliberately IN-CARD and not a toast. `showAchievementToast` is hard-gated
  // to genuine rewarded achievements (see `utils/achievementToast.ts`) and
  // hijacking it here would be exactly the dilution that gate exists to
  // prevent - and a popup for every savings rung is the modal spam the design
  // rules out. The moment belongs where the goal was.
  //
  // Ephemeral by design: the ref lives for the session, so a reach that
  // happened before launch is not announced on open. That moment has passed,
  // and re-announcing it on every cold start would be worse than silence. It
  // also means nothing is stored, so there is nothing to double-claim.
  const previousState = useRef<GameState | null>(null);
  const [reached, setReached] = useState<AchievedGoal | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const before = previousState.current;
    previousState.current = state;
    if (!before) return undefined;

    const achieved = goalsAchievedBetween(before, state);
    if (achieved.length === 0) return undefined;

    // One at a time, most immediate first. Several goals can advance in a
    // single week and stacking them would bury the one that mattered.
    const top = achieved[0];
    setReached(top);
    track('goal_reached', { goalId: top.id, horizon: top.horizon, level: top.level });

    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setReached(null), 6000);
    return undefined;
  }, [state]);

  // Clearing on unmount only - the timer above is intentionally re-armed rather
  // than torn down between renders, so a second reach extends the banner
  // instead of cancelling it mid-read.
  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  // A player with nothing eligible in any horizon sees nothing, rather than a
  // card apologising for being empty - unless there is something to
  // acknowledge, which is worth a card on its own.
  if (goals.length === 0 && !reached) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.crest}>
          <Compass size={scale(18)} color="#38BDF8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WHAT NEXT</Text>
          <Text style={styles.title}>Your next moves</Text>
        </View>
      </View>

      {reached && (
        <View style={styles.reachedRow} accessibilityRole="text">
          <View style={styles.reachedIcon}>
            <Check size={scale(13)} color="#34D399" />
          </View>
          <Text style={styles.reachedText} numberOfLines={1}>
            Reached: {reached.title}
          </Text>
        </View>
      )}

      <View style={styles.list}>
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            onPress={() => {
              track('goal_tapped', {
                goalId: goal.id,
                horizon: goal.horizon,
                progress: Math.round(goal.progress * 100),
              });
              router.push(goal.route);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Hard Rule #7: a full four-sided border, never a one-sided accent stripe.
  card: {
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.32)',
    gap: scale(12),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  crest: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  kicker: { color: '#38BDF8', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.6 },
  title: { color: '#F8FAFC', fontSize: fontScale(15), fontWeight: '700', marginTop: scale(1) },
  list: { gap: scale(10) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10) },
  rowIcon: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: scale(2),
  },
  rowKicker: { fontSize: fontScale(9), fontWeight: '800', letterSpacing: 0.6 },
  rowTitle: { color: '#F1F5F9', fontSize: fontScale(13), fontWeight: '700', marginTop: scale(1) },
  rowRationale: { color: '#94A3B8', fontSize: fontScale(10.5), marginTop: scale(2) },
  barBg: {
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginTop: scale(6),
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: scale(2) },
  rowProgress: { color: '#CBD5E1', fontSize: fontScale(10.5), fontWeight: '600', marginTop: scale(4) },
  reachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    borderRadius: scale(10),
    backgroundColor: 'rgba(52, 211, 153, 0.10)',
    // Hard Rule #7: all four sides.
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  reachedIcon: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
  },
  reachedText: { flex: 1, color: '#A7F3D0', fontSize: fontScale(12), fontWeight: '700' },
});

export default React.memo(NextGoalsCard);
