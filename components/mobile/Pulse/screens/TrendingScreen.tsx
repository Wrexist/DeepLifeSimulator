/**
 * TrendingScreen — ranked hashtags with optional "why is this trending?" reasons.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import TrendingChip from '../components/TrendingChip';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';
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
          nudge="Trends refresh each week — post or wait for an event to spike one."
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <SectionHeader title="Trending now" />
      {sorted.map((t, idx) => (
        <View key={`${t.tag}-${idx}`} style={[styles.row, { borderBottomColor: theme.border }]}>
          <View style={styles.rank}>
            <Text style={[styles.rankText, { color: theme.textSecondary }]}>{idx + 1}</Text>
          </View>
          <View style={styles.body}>
            <TrendingChip tag={t.tag} velocity={Math.round(t.velocity)} whyReason={t.whyReason} />
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
    fontWeight: '700',
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
