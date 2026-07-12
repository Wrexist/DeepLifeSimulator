/**
 * AchievementsSummaryCard — compact Home summary of achievements.
 *
 * A completion ring plus the next 2-3 claimable / in-progress achievements,
 * tapping through to the full AchievementsProgress list ("View all"). Keeps the
 * heavy full list off the Home tab while preserving one-tap access to it.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Trophy, ChevronRight, Gem, Sparkles, Target } from 'lucide-react-native';
import { useAchievements } from '@/hooks/useAchievements';
import ProgressRing from '@/components/ui/ProgressRing';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';

interface AchievementsSummaryCardProps {
  onViewAll: () => void;
}

export default function AchievementsSummaryCard({ onViewAll }: AchievementsSummaryCardProps) {
  const { achievements } = useAchievements();

  const { total, completed, inProgress, highlights } = useMemo(() => {
    const total = achievements.length;
    const completed = achievements.filter(a => a.claimed || (a.progress ?? 0) >= 1).length;
    const claimable = achievements.filter(a => (a.progress ?? 0) >= 0.9999 && !a.claimed);
    const ongoing = achievements
      .filter(a => !a.claimed && (a.progress ?? 0) < 0.9999)
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    // Claimable first (actionable), then closest-to-done. Cap at 3.
    const highlights = [...claimable, ...ongoing].slice(0, 3);
    return { total, completed, inProgress: ongoing.length, highlights };
  }, [achievements]);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onViewAll}
      accessibilityRole="button"
      accessibilityLabel={`Achievements: ${completed} of ${total} completed. Tap to view all.`}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.trophyBubble}>
          <Trophy size={scale(15)} color="#FBBF24" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Achievements</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {completed} / {total} completed · {inProgress} in progress
          </Text>
        </View>
        <View style={styles.viewAll}>
          <Text style={styles.viewAllText}>View all</Text>
          <ChevronRight size={scale(15)} color="#94A3B8" />
        </View>
      </View>

      <View style={styles.body}>
        <ProgressRing
          value={pct}
          size={58}
          strokeWidth={6}
          ambient={false}
          showPill={false}
          accentColor="#A855F7"
          trackColor="rgba(148,163,184,0.18)"
          label="Achievements completed"
        >
          <Text style={styles.ringNum}>{completed}</Text>
          <Text style={styles.ringOf}>of {total}</Text>
        </ProgressRing>

        <View style={styles.list}>
          {highlights.length === 0 ? (
            <Text style={styles.empty}>All caught up — nothing in progress right now.</Text>
          ) : (
            highlights.map(a => {
              const claimable = (a.progress ?? 0) >= 0.9999 && !a.claimed;
              const rowPct = Math.min(100, Math.round((a.progress ?? 0) * 100));
              return (
                <View key={a.id} style={styles.row}>
                  <View style={[styles.rowIcon, claimable ? styles.rowIconClaim : styles.rowIconProgress]}>
                    {claimable
                      ? <Sparkles size={scale(12)} color="#FBBF24" />
                      : <Target size={scale(12)} color="#818CF8" />}
                  </View>
                  <View style={styles.rowMid}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
                    {claimable ? (
                      <Text style={styles.rowClaim}>Ready to claim</Text>
                    ) : (
                      <View style={styles.rowBar}>
                        <View style={[styles.rowBarFill, { width: `${rowPct}%` }]} />
                      </View>
                    )}
                  </View>
                  <View style={styles.reward}>
                    <Gem size={scale(10)} color="#818CF8" />
                    <Text style={styles.rewardText}>{a.goldReward}</Text>
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
  card: {
    marginHorizontal: responsiveSpacing.md,
    marginBottom: scale(12),
    padding: scale(14),
    borderRadius: responsiveBorderRadius.lg,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...getPlatformShadows(6, 0.25, 4, 14),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  trophyBubble: {
    width: scale(30), height: scale(30), borderRadius: scale(9),
    backgroundColor: 'rgba(251, 191, 36, 0.15)', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.32)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: '#F8FAFC', fontSize: fontScale(15), fontWeight: '800' },
  sub: { color: '#94A3B8', fontSize: fontScale(10.5), marginTop: scale(1) },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: scale(2) },
  viewAllText: { color: '#94A3B8', fontSize: fontScale(11), fontWeight: '700' },

  body: { flexDirection: 'row', alignItems: 'center', gap: scale(14), marginTop: scale(13) },
  ringNum: { color: '#F8FAFC', fontSize: fontScale(16), fontWeight: '800', lineHeight: fontScale(18) },
  ringOf: { color: '#94A3B8', fontSize: fontScale(8), fontWeight: '600' },

  list: { flex: 1, gap: scale(9) },
  empty: { color: '#94A3B8', fontSize: fontScale(11), fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(9) },
  rowIcon: { width: scale(26), height: scale(26), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowIconClaim: { backgroundColor: 'rgba(251,191,36,0.15)', borderColor: 'rgba(251,191,36,0.32)' },
  rowIconProgress: { backgroundColor: 'rgba(129,140,248,0.15)', borderColor: 'rgba(129,140,248,0.32)' },
  rowMid: { flex: 1, minWidth: 0, gap: scale(4) },
  rowTitle: { color: '#E2E8F0', fontSize: fontScale(12), fontWeight: '700' },
  rowClaim: { color: '#FBBF24', fontSize: fontScale(10), fontWeight: '700' },
  rowBar: { height: scale(5), borderRadius: scale(3), backgroundColor: '#334155', overflow: 'hidden' },
  rowBarFill: { height: '100%', borderRadius: scale(3), backgroundColor: '#818CF8' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: scale(3) },
  rewardText: { color: '#818CF8', fontSize: fontScale(11), fontWeight: '800', fontVariant: ['tabular-nums'] },
});
