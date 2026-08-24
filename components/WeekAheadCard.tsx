/**
 * WeekAheadCard — "what is coming?"
 *
 * The tick has always known that a degree finishes in six weeks, that a loan
 * clears in three, that a baby is due, that a disease turns fatal. None of it
 * was visible until the week it landed, so every one arrived as a surprise —
 * including the ones that take money. This is the anticipation surface: it
 * schedules nothing and changes nothing, it only shows what other systems have
 * already committed to.
 *
 * Read-only and derived on render. Nothing here can be claimed.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  AlertTriangle,
  Baby,
  Briefcase,
  CalendarClock,
  GraduationCap,
  Heart,
  Landmark,
  Mail,
  PiggyBank,
  TrendingUp,
  Vote,
} from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { track } from '@/lib/analytics';
import { upcomingEvents } from '@/lib/anticipation';
import type { UpcomingEvent, UpcomingKind, UpcomingTone } from '@/lib/anticipation';
import { fontScale, scale, responsiveBorderRadius } from '@/utils/scaling';
import type { GameState } from '@/contexts/game/types';

/** Four is enough to feel like a week ahead without becoming a spreadsheet. */
const MAX_ROWS = 4;

const KIND_ICON: Record<UpcomingKind, typeof CalendarClock> = {
  education: GraduationCap,
  birth: Baby,
  wedding: Heart,
  loan: Landmark,
  debt: AlertTriangle,
  health: AlertTriangle,
  savings: PiggyBank,
  career: TrendingUp,
  election: Vote,
  letter: Mail,
};

const TONE_COLOR: Record<UpcomingTone, string> = {
  good: '#34D399',
  neutral: '#94A3B8',
  caution: '#FBBF24',
};

/** "Next week" / "in 3 weeks". `weeksAway: 0` means it is live right now — an
 *  arrears balance or a promotion in reach, neither of which has a date. */
export function horizonLabel(weeksAway: number): string {
  if (weeksAway <= 0) return 'Now';
  if (weeksAway === 1) return 'Next week';
  return `In ${weeksAway} weeks`;
}

function Row({ event }: { event: UpcomingEvent }) {
  const Icon = KIND_ICON[event.kind] ?? Briefcase;
  const color = TONE_COLOR[event.tone];
  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={[styles.rowIcon, { borderColor: color }]}>
        <Icon size={scale(14)} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={2}>
          {event.detail}
        </Text>
      </View>
      <Text style={[styles.rowWhen, { color }]}>{horizonLabel(event.weeksAway)}</Text>
    </View>
  );
}

function WeekAheadCard() {
  // Reads across education, relationships, loans, banking, diseases and
  // careers, so this card selects the whole snapshot rather than a slice —
  // the same trade-off `WeeklyChallengeCard`, `AmbitionCard` and
  // `LifeChapterCard` document. The derivation itself is a single pass over
  // eight small collectors, so the cost is the re-render, not the compute.
  const state = useGameSelector((s) => s) as GameState;
  const events = useMemo(() => upcomingEvents(state, { limit: MAX_ROWS }), [state]);

  // One impression per GAME WEEK, not per render. Keyed on `weeksLived` because
  // that is the only counter that advances exactly once per tick — a render
  // count would report a player who scrolled the home screen twice as twice as
  // engaged. Hooks run before the early return so the order stays stable.
  const weeksLived = state?.weeksLived ?? 0;
  const lastTrackedWeek = useRef<number | null>(null);
  useEffect(() => {
    if (events.length === 0) return;
    if (lastTrackedWeek.current === weeksLived) return;
    lastTrackedWeek.current = weeksLived;
    track('week_ahead_shown', { rows: events.length, soonest: events[0].weeksAway });
  }, [weeksLived, events]);

  // A quiet life has nothing coming, and that is a legitimate state — a card
  // saying "nothing is scheduled" would be noise on every early week.
  if (events.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.crest}>
          <CalendarClock size={scale(18)} color="#A78BFA" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>THE WEEKS AHEAD</Text>
          <Text style={styles.title}>What is coming</Text>
        </View>
      </View>
      <View style={styles.list}>
        {events.map((event) => (
          <Row key={event.id} event={event} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Hard Rule #7: full four-sided border, no decorative side stripe.
  card: {
    marginHorizontal: scale(16),
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.32)',
    gap: scale(12),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  crest: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  kicker: { color: '#A78BFA', fontSize: fontScale(10), fontWeight: '800', letterSpacing: 0.6 },
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
  rowTitle: { color: '#F1F5F9', fontSize: fontScale(12.5), fontWeight: '700' },
  rowDetail: { color: '#94A3B8', fontSize: fontScale(10.5), marginTop: scale(2) },
  rowWhen: { fontSize: fontScale(10.5), fontWeight: '800' },
});

export default React.memo(WeekAheadCard);
