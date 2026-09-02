import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown, Sparkles, Flame, Briefcase, Mail, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { driftDrainLabels, projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
import { useTheme } from '@/hooks/useTheme';
import { useFeedback } from '@/utils/feedbackSystem';
import { scale, fontScale } from '@/utils/scaling';

/**
 * Compact, NON-BLOCKING weekly recap shown on the home dashboard.
 *
 * Weekly event pop-ups were intentionally removed (they interrupted the Next
 * Week flow). This strip restores the sense of progress/reward WITHOUT a modal:
 * after each week it quietly shows the net cash change plus any income, lucky
 * bonus, and streak bonus the tick already computed (gameState.weekResult). It
 * never pops up, never needs a tap, and simply updates in place.
 */
/** A vital drifting this much or more per week is worth a line of its own. */
const DRIFT_WORTH_NAMING = 3;

function LastWeekRecap() {
  const { isDark } = useTheme();
  const router = useRouter();
  // The projection is derived inside the selector and flattened to primitives,
  // so the card re-renders only when the ANSWER changes, not on every state
  // mutation (CLAUDE.md §4.1).
  const drift = useGameSelector(
    (s) => {
      const d = projectWeeklyVitalDrift(s);
      return { health: d.health, happiness: d.happiness, causes: driftDrainLabels(d).join(' · ') };
    },
    shallowEqual,
  ) as { health: number; happiness: number; causes: string };
  const data = useGameSelector(
    (s) => ({
      weekResult: s?.weekResult,
      playStreak: s?.playStreak,
      weeksLived: s?.weeksLived,
      pendingEventCount: s?.pendingEvents?.length ?? 0,
      weekSummaryEnabled: s?.settings?.weeklySummaryEnabled !== false,
    }),
    shallowEqual,
  ) as {
    weekResult?: import('@/contexts/game/types').GameState['weekResult'];
    playStreak?: import('@/contexts/game/types').GameState['playStreak'];
    weeksLived?: number;
    pendingEventCount?: number;
    weekSummaryEnabled?: boolean;
  };

  const wr = data?.weekResult;
  const weeksLived = data?.weeksLived ?? 0;
  const lucky = wr?.luckyBonus ?? 0;

  // Juice: a quick pop each new week, plus a celebratory haptic when a Lucky
  // bonus lands. Hooks must run unconditionally, so this sits above the early
  // returns and keys off weeksLived so it only fires once per advanced week.
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fb = useFeedback();
  const lastWeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (!wr || weeksLived < 1 || lastWeekRef.current === weeksLived) return;
    lastWeekRef.current = weeksLived;
    scaleAnim.setValue(0.96);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
    if (lucky > 0) fb.haptic('success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeksLived]);

  // Nothing to show until the player has actually advanced a week with a result.
  // The Settings "Week Summary" switch used to gate the (removed) blocking
  // WeeklyResultSheet; this card is that feature's surviving surface, so the
  // switch now gates it.
  if (!data?.weekSummaryEnabled) return null;
  if (!wr || weeksLived < 1) return null;

  const net = wr.netChange ?? 0;
  const income = wr.incomeEarned ?? 0;
  const expenses = wr.expensesPaid ?? 0;
  const streakBonus = wr.streakBonus ?? 0;
  const streakCount = data?.playStreak?.count ?? 0;
  // `careerProgressPercent` is the career's CUMULATIVE progress toward the
  // next level (the tick stores `activeCareer.progress`), not last week's gain.
  // It used to render as "Career +48%", which reads as a weekly jump; week 8's
  // "+100%" then sat beside a promotion nobody had been told to collect.
  const careerProgress = Math.round(wr.careerProgressPercent ?? 0);
  const pendingEvents = data?.pendingEventCount ?? 0;

  // Only go silent when there is truly NOTHING to say. Previously any
  // money-flat week returned null - which also swallowed career progress and
  // even the "decisions waiting" badge, making those weeks feel dead.
  // A cliffhanger teaser counts as something to say: it is the "tune in next
  // week" hook, and a money-flat week is exactly when it matters most.
  const moneyMoved = income !== 0 || expenses !== 0 || net !== 0 || lucky !== 0;
  if (!moneyMoved && careerProgress === 0 && pendingEvents === 0 && !wr.cliffhangerTeaser) return null;

  const positive = net >= 0;
  const netColor = positive ? '#34D399' : '#F87171';
  const fmt = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString()}`;
  const subColor = isDark ? 'rgba(226, 232, 240, 0.6)' : 'rgba(15, 23, 42, 0.55)';

  return (
    <Animated.View
      style={[
        styles.card,
        isDark ? styles.cardDark : styles.cardLight,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: subColor }]}>LAST WEEK</Text>
        {moneyMoved ? (
          <View style={styles.netCluster}>
            {positive ? (
              <TrendingUp size={scale(15)} color={netColor} />
            ) : (
              <TrendingDown size={scale(15)} color={netColor} />
            )}
            <Text style={[styles.netValue, { color: netColor }]}>
              {positive ? '+' : '-'}
              {fmt(net)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.chip, { color: subColor }]}>A quiet week for your wallet</Text>
        )}
      </View>

      <View style={styles.chipRow}>
        {income > 0 && (
          <Text style={[styles.chip, { color: subColor }]}>
            Income <Text style={styles.chipPos}>+{fmt(income)}</Text>
          </Text>
        )}
        {expenses > 0 && (
          <Text style={[styles.chip, { color: subColor }]}>
            Expenses <Text style={styles.chipNeg}>-{fmt(expenses)}</Text>
          </Text>
        )}
        {lucky > 0 && (
          <View style={styles.badge}>
            <Sparkles size={scale(11)} color="#FBBF24" />
            <Text style={styles.badgeLucky}>Lucky +{fmt(lucky)}</Text>
          </View>
        )}
        {streakBonus > 0 && streakCount > 1 && (
          <View style={styles.badge}>
            <Flame size={scale(11)} color="#A78BFA" />
            <Text style={styles.badgeStreak}>
              {streakCount}wk streak +{fmt(streakBonus)}
            </Text>
          </View>
        )}
        {careerProgress > 0 && (
          <View style={styles.badge}>
            <Briefcase size={scale(11)} color="#60A5FA" />
            <Text style={styles.badgeCareer}>
              {careerProgress >= 100 ? 'Promotion ready' : `Promotion ${careerProgress}%`}
            </Text>
          </View>
        )}
        {pendingEvents > 0 && (
          <View style={styles.badge}>
            <Mail size={scale(11)} color="#F59E0B" />
            <Text style={styles.badgeDecision}>
              {pendingEvents === 1 ? 'A decision is waiting' : `${pendingEvents} decisions waiting`}
            </Text>
          </View>
        )}
      </View>

      {/* Where the vitals are going and why. Measured on a fresh life, the
          three causes below cost ~9 happiness and ~6 health a week and nothing
          named them until the ≤20 tip - by which point the character was four
          weeks from dying with $4,000 in the bank. One line, the causes, and
          the destination where the free offsets live. Program 6. */}
      {(drift.happiness <= -DRIFT_WORTH_NAMING || drift.health <= -DRIFT_WORTH_NAMING) && (
        <TouchableOpacity
          style={styles.driftRow}
          onPress={() => router.push(`/(tabs)/life?segment=health&ts=${Date.now()}` as never)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Each week: ${drift.happiness} happiness, ${drift.health} health. ${drift.causes}. Opens Health.`}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.driftLine, { color: subColor }]} numberOfLines={1}>
              Each week{' '}
              {drift.happiness <= -DRIFT_WORTH_NAMING && (
                <Text style={[styles.driftValue, { color: STAT_IDENTITY.happiness.color }]}>
                  {drift.happiness} happiness
                </Text>
              )}
              {drift.happiness <= -DRIFT_WORTH_NAMING && drift.health <= -DRIFT_WORTH_NAMING ? ' · ' : ''}
              {drift.health <= -DRIFT_WORTH_NAMING && (
                <Text style={[styles.driftValue, { color: STAT_IDENTITY.health.color }]}>
                  {drift.health} health
                </Text>
              )}
            </Text>
            {!!drift.causes && (
              <Text style={[styles.driftCauses, { color: subColor }]} numberOfLines={1}>
                {drift.causes} · free fixes in Health
              </Text>
            )}
          </View>
          <ChevronRight size={scale(14)} color="#64748B" />
        </TouchableOpacity>
      )}

      {/* The cliffhanger teaser - the game's one "tune in next week" beat.
          It used to render only inside WeeklyResultSheet, which is gated
          three ways (meaningful-week check, the weeklySummaryEnabled setting,
          lowest modal priority), so the hook that exists to pull the player
          into the next tap was usually invisible. This strip is the surface
          that is ALWAYS seen after a tick. */}
      {!!wr.cliffhangerTeaser && (
        <Text style={[styles.teaser, { color: isDark ? '#C4B5FD' : '#6D28D9' }]} numberOfLines={2}>
          {wr.cliffhangerTeaser}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: scale(6),
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    gap: scale(8),
  },
  cardDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  netCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  netValue: {
    fontSize: fontScale(17),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: scale(10),
  },
  chip: {
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  chipPos: {
    color: '#34D399',
    fontWeight: '700',
  },
  chipNeg: {
    color: '#F87171',
    fontWeight: '700',
  },
  driftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(10),
    paddingTop: scale(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
  },
  driftLine: {
    fontSize: fontScale(12),
    fontWeight: '500',
  },
  driftValue: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  driftCauses: {
    fontSize: fontScale(11),
    marginTop: scale(2),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  badgeLucky: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#FBBF24',
  },
  badgeStreak: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#A78BFA',
  },
  badgeCareer: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#60A5FA',
  },
  badgeDecision: {
    fontSize: fontScale(11),
    fontWeight: '700',
    color: '#F59E0B',
  },
  teaser: {
    fontSize: fontScale(11.5),
    fontWeight: '600',
    fontStyle: 'italic',
  },
});

export default React.memo(LastWeekRecap);
