import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TrendingUp, TrendingDown, Sparkles, Flame } from 'lucide-react-native';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
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
function LastWeekRecap() {
  const { isDark } = useTheme();
  const data = useGameSelector(
    (s) => ({
      weekResult: s?.weekResult,
      playStreak: s?.playStreak,
      weeksLived: s?.weeksLived,
    }),
    shallowEqual,
  ) as {
    weekResult?: import('@/contexts/game/types').GameState['weekResult'];
    playStreak?: import('@/contexts/game/types').GameState['playStreak'];
    weeksLived?: number;
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
  if (!wr || weeksLived < 1) return null;

  const net = wr.netChange ?? 0;
  const income = wr.incomeEarned ?? 0;
  const expenses = wr.expensesPaid ?? 0;
  const streakBonus = wr.streakBonus ?? 0;
  const streakCount = data?.playStreak?.count ?? 0;

  // A truly empty week (no money movement at all) stays silent rather than
  // showing a hollow "$0" recap.
  if (income === 0 && expenses === 0 && net === 0 && lucky === 0) return null;

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
              {streakCount}d streak +{fmt(streakBonus)}
            </Text>
          </View>
        )}
      </View>
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
});

export default React.memo(LastWeekRecap);
