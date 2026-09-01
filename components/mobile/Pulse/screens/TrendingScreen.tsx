/**
 * TrendingScreen - ranked hashtags with optional "why is this trending?" reasons.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import Chip from '@/components/ui/Chip';
import SectionTitle from '@/components/ui/SectionTitle';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import EmptyState from '../components/EmptyState';
import { PULSE_COLORS } from '../styles/pulseTheme';
import type { PulseTrendingHashtag } from '@/contexts/game/types';

const SOURCE_LABELS: Record<string, string> = {
  organic: 'Organic',
  scandal: 'Scandal',
  event: 'Event',
  brand: 'Brand',
  season: 'Seasonal',
  player: 'You posted this',
};

export default function TrendingScreen() {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const all: PulseTrendingHashtag[] = useMemo(
    () => gameState.socialMedia?.trendingHashtags ?? [],
    [gameState.socialMedia?.trendingHashtags],
  );
  const sorted = useMemo(() => [...all].sort((a, b) => b.velocity - a.velocity), [all]);

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          observation="No trends yet this week."
          nudge="Trends refresh each week - post or wait for an event to spike one."
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <SectionTitle title="Trending now" style={styles.section} />
      {sorted.map((t, idx) => (
        <View key={`${t.tag}-${idx}`} style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={styles.rank}>
            <Text style={[styles.rankText, { color: theme.textSecondary }]}>{idx + 1}</Text>
          </View>
          <View style={styles.body}>
            <View style={styles.tagRow}>
              <Chip label={t.tag} size="md" />
              <Chip
                label={`${Math.abs(Math.round(t.velocity))}%`}
                tone={t.velocity >= 0 ? 'success' : 'danger'}
                icon={
                  t.velocity >= 0
                    ? <TrendingUp size={fontScale(10)} color={PULSE_COLORS.success} strokeWidth={3} />
                    : <TrendingDown size={fontScale(10)} color={PULSE_COLORS.danger} strokeWidth={3} />
                }
                accessibilityLabel={`${t.tag}, trending ${t.velocity >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(t.velocity))} percent`}
              />
            </View>
            <Text style={[styles.count, { color: theme.textSecondary }]}>
              {(t.postCount ?? 0).toLocaleString()} posts · {SOURCE_LABELS[t.source] ?? t.source}
            </Text>
            {t.whyReason ? (
              <Text style={[styles.why, { color: theme.text }]} numberOfLines={2}>
                Why? {t.whyReason}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: scale(140),
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    gap: responsiveSpacing.sm,
  },
  rank: {
    width: scale(24),
    alignItems: 'center',
    paddingTop: 4,
  },
  rankText: {
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  section: {
    marginHorizontal: responsiveSpacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    flexWrap: 'wrap',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  count: {
    fontSize: fontScale(11),
  },
  why: {
    fontSize: fontScale(13),
    marginTop: 2,
  },
});
