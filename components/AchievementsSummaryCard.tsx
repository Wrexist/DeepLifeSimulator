/**
 * AchievementsSummaryCard - compact Home summary of achievements.
 *
 * A completion ring plus the next 2-3 claimable / in-progress achievements,
 * tapping through to the full AchievementsProgress list ("View all"). Keeps the
 * heavy full list off the Home tab while preserving one-tap access to it.
 *
 * ## Reading the same numbers twice
 *
 * The first version said "7 / 158 completed · 151 in progress" in the subtitle
 * and "7 of 158" again inside the ring - the same fact, rendered twice, one of
 * them truncating ("151 in…") because the row could not hold it. And "in
 * progress" was not a number worth the space it took: it is just total minus
 * completed, so it moves only when the other number moves.
 *
 * So the three surfaces now say three different things. The ring is the share
 * of the catalogue, as a percentage. The subtitle is the count. The chip is the
 * only ACTIONABLE fact on the card - how many are sitting there ready to claim
 * - and it is styled to be the thing the eye lands on, because it is the only
 * reason to tap through right now.
 *
 * Surface tokens are lifted from the Home feed's own cards (`progressLinkCard`
 * in `app/(tabs)/home.tsx`) rather than invented here: same inset, same
 * translucent slate, same hairline, same circular icon bubble. It sits directly
 * under that card, and two cards an inch apart should not be two designs.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Trophy, ChevronRight, Gem, Sparkles, Target } from 'lucide-react-native';
import { useAchievements } from '@/hooks/useAchievements';
import ProgressRing from '@/components/ui/ProgressRing';
import { accent } from '@/lib/config/theme';
import { scale, fontScale, responsivePadding, responsiveBorderRadius } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';

interface AchievementsSummaryCardProps {
  onViewAll: () => void;
}

export default function AchievementsSummaryCard({ onViewAll }: AchievementsSummaryCardProps) {
  const { achievements } = useAchievements();

  const { total, completed, claimableCount, highlights } = useMemo(() => {
    const total = achievements.length;
    const completed = achievements.filter(a => a.claimed || (a.progress ?? 0) >= 1).length;
    const claimable = achievements.filter(a => (a.progress ?? 0) >= 0.9999 && !a.claimed);
    const ongoing = achievements
      .filter(a => !a.claimed && (a.progress ?? 0) < 0.9999)
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    // Claimable first (actionable), then closest-to-done. Cap at 3.
    const highlights = [...claimable, ...ongoing].slice(0, 3);
    return { total, completed, claimableCount: claimable.length, highlights };
  }, [achievements]);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onViewAll}
      accessibilityRole="button"
      accessibilityLabel={`Achievements: ${completed} of ${total} completed${
        claimableCount > 0 ? `, ${claimableCount} ready to claim` : ''
      }. Tap to view all.`}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.trophyBubble}>
          <Trophy size={scale(17)} color={accent.warning} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Achievements</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {completed} of {total} unlocked
          </Text>
        </View>
        {claimableCount > 0 && (
          <View style={styles.claimChip}>
            <Sparkles size={scale(10)} color={accent.warning} />
            <Text style={styles.claimChipText}>{claimableCount}</Text>
          </View>
        )}
        <ChevronRight size={scale(16)} color="#64748B" />
      </View>

      <View style={styles.body}>
        <ProgressRing
          value={pct}
          size={56}
          strokeWidth={5}
          ambient={false}
          showPill={false}
          accentColor={accent.purple}
          trackColor="rgba(148,163,184,0.18)"
          label="Achievements completed"
        >
          <Text style={styles.ringNum}>{pct}%</Text>
          <Text style={styles.ringOf}>done</Text>
        </ProgressRing>

        <View style={styles.list}>
          {highlights.length === 0 ? (
            <Text style={styles.empty}>All caught up - nothing in progress right now.</Text>
          ) : (
            highlights.map(a => {
              const claimable = (a.progress ?? 0) >= 0.9999 && !a.claimed;
              const rowPct = Math.min(100, Math.round((a.progress ?? 0) * 100));
              return (
                <View key={a.id} style={styles.row}>
                  <View style={[styles.rowIcon, claimable ? styles.rowIconClaim : styles.rowIconProgress]}>
                    {claimable
                      ? <Sparkles size={scale(11)} color={accent.warning} />
                      : <Target size={scale(11)} color="#818CF8" />}
                  </View>
                  <View style={styles.rowMid}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
                      <View style={styles.reward}>
                        <Gem size={scale(10)} color="#818CF8" />
                        <Text style={styles.rewardText}>{a.goldReward}</Text>
                      </View>
                    </View>
                    {claimable ? (
                      <Text style={styles.rowClaim}>Ready to claim</Text>
                    ) : (
                      // The bar carries the number too - an unlabelled 8%-filled
                      // sliver is indistinguishable from an empty one.
                      <View style={styles.rowBarRow}>
                        <View style={styles.rowBar}>
                          <View style={[styles.rowBarFill, { width: `${rowPct}%` }]} />
                        </View>
                        <Text style={styles.rowPct}>{rowPct}%</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Matches `progressLinkCard` in app/(tabs)/home.tsx exactly - same inset,
  // radius, surface, hairline and shadow. They are neighbours in the feed.
  card: {
    marginHorizontal: responsivePadding.horizontal,
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  // Circular, like every other icon bubble in the feed. It was a rounded
  // square with a gold outline - the only one of its shape on the screen.
  trophyBubble: {
    width: scale(38), height: scale(38), borderRadius: scale(19),
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: '#F8FAFC', fontSize: fontScale(15), fontWeight: '700' },
  sub: { color: '#94A3B8', fontSize: fontScale(11.5), marginTop: scale(1), fontWeight: '500' },

  claimChip: {
    flexDirection: 'row', alignItems: 'center', gap: scale(3),
    paddingHorizontal: scale(7), paddingVertical: scale(3),
    borderRadius: scale(999),
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.32)',
  },
  claimChipText: {
    color: '#FBBF24', fontSize: fontScale(10.5), fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  body: { flexDirection: 'row', alignItems: 'center', gap: scale(14), marginTop: scale(13) },
  ringNum: { color: '#F8FAFC', fontSize: fontScale(14), fontWeight: '800', lineHeight: fontScale(16) },
  ringOf: { color: '#94A3B8', fontSize: fontScale(9), fontWeight: '600' },

  list: { flex: 1, gap: scale(10) },
  empty: { color: '#94A3B8', fontSize: fontScale(11), fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(9) },
  rowIcon: {
    width: scale(24), height: scale(24), borderRadius: scale(12),
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  rowIconClaim: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.32)' },
  rowIconProgress: { backgroundColor: 'rgba(129,140,248,0.15)', borderColor: 'rgba(129,140,248,0.32)' },
  rowMid: { flex: 1, minWidth: 0, gap: scale(4) },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  rowTitle: { flex: 1, color: '#E2E8F0', fontSize: fontScale(12), fontWeight: '700' },
  rowClaim: { color: '#FBBF24', fontSize: fontScale(10), fontWeight: '700' },
  rowBarRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  rowBar: { flex: 1, height: scale(4), borderRadius: scale(2), backgroundColor: '#334155', overflow: 'hidden' },
  rowBarFill: { height: '100%', borderRadius: scale(2), backgroundColor: '#818CF8' },
  rowPct: {
    color: '#94A3B8', fontSize: fontScale(9.5), fontWeight: '700',
    fontVariant: ['tabular-nums'], minWidth: scale(24), textAlign: 'right',
  },
  reward: { flexDirection: 'row', alignItems: 'center', gap: scale(3) },
  rewardText: { color: '#818CF8', fontSize: fontScale(11), fontWeight: '800', fontVariant: ['tabular-nums'] },
});
