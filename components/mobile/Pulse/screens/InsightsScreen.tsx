/**
 * InsightsScreen — Creator Studio.
 *
 * The real payoff for Verified Pro's "Advanced analytics" perk (previously a
 * deceptive-value no-op: `analyticsUnlocked` was set but read nowhere). Shows:
 *   - A follower-growth sparkline from the capped `followerHistory`.
 *   - An engagement snapshot (rate + tier via InfluenceMeter).
 *   - Top posts by reach.
 *   - A lifetime trophy grid from `lifetimeStats` (never surfaced before).
 *
 * When Verified Pro is inactive the advanced sections dim behind a lock strip
 * with an upsell CTA, finally making the paid perk mean something.
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, TrendingUp, Award, Heart, Zap, ShieldCheck, Star, Repeat2 } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, getAppScreenBottomPadding } from '@/utils/scaling';
import SectionHeader from '../components/SectionHeader';
import InfluenceMeter from '../components/InfluenceMeter';
import EmptyState from '../components/EmptyState';
import { formatPulseNumber } from '../utils/formatPulseNumber';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import type { PulseRecentPost, PulseLifetimeStats } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

interface InsightsScreenProps {
  /** Tap the upsell strip → open the Verified Pro upsell (owned by PulseApp). */
  onUpgradePro: () => void;
}

const TIER_LABELS: Record<string, string> = {
  novice: 'Novice',
  rising: 'Rising',
  popular: 'Popular',
  influencer: 'Influencer',
  celebrity: 'Celebrity',
};

export default function InsightsScreen({ onUpgradePro }: InsightsScreenProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const sm = gameState.socialMedia;
  const followers = sm?.followers ?? 0;
  const engagementRate = sm?.engagementRate ?? 0;
  const tier = sm?.influenceLevel ?? 'novice';

  // Gate: perk is real only while Verified Pro is active and not expired.
  const vp = sm?.verifiedPro;
  const analyticsUnlocked = !!(
    vp?.active &&
    vp?.perksUnlocked?.analyticsUnlocked &&
    (!vp?.expiresTimestamp || vp.expiresTimestamp >= Date.now())
  );

  const history = useMemo(() => sm?.followerHistory ?? [], [sm?.followerHistory]);
  const lifetime: PulseLifetimeStats | undefined = sm?.lifetimeStats;

  const topPosts = useMemo(() => {
    const posts: PulseRecentPost[] = sm?.recentPosts ?? [];
    return [...posts]
      .sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0))
      .slice(0, 3);
  }, [sm?.recentPosts]);

  // Sparkline geometry — scale bar heights to the max sample in the window.
  const spark = useMemo(() => {
    const pts = history.slice(-24);
    const max = pts.reduce((m, p) => Math.max(m, p.followers), 1);
    return { pts, max };
  }, [history]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}
    >
      {/* Hero snapshot — always visible (basic stats aren't gated). */}
      <LinearGradient
        colors={PULSE_GRADIENT as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroLabel}>Followers</Text>
        <Text style={styles.heroValue}>{formatPulseNumber(followers)}</Text>
        <Text style={styles.heroSub}>
          {engagementRate.toFixed(1)}% engagement · {TIER_LABELS[tier] ?? tier}
        </Text>
      </LinearGradient>

      <View style={styles.influenceWrap}>
        <InfluenceMeter followers={followers} tier={tier} />
      </View>

      {!analyticsUnlocked ? (
        <Pressable
          onPress={onUpgradePro}
          accessibilityRole="button"
          accessibilityLabel="Unlock advanced analytics with Verified Pro"
          style={styles.lockStrip}
        >
          <View style={[styles.lockCard, { backgroundColor: theme.surface, borderColor: PULSE_COLORS.accent }]}>
            <Lock size={responsiveIconSize.md} color={PULSE_COLORS.accent} />
            <View style={styles.lockTextWrap}>
              <Text style={[styles.lockTitle, { color: theme.text }]}>Advanced analytics is a Verified Pro perk</Text>
              <Text style={[styles.lockSub, { color: theme.textSecondary }]}>
                Unlock your growth chart, top-post trends, and lifetime records.
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      {/* Advanced sections — dimmed + non-interactive when the perk is inactive. */}
      <View
        style={analyticsUnlocked ? undefined : styles.gatedDim}
        pointerEvents={analyticsUnlocked ? 'auto' : 'none'}
      >
        {/* Follower growth sparkline */}
        <SectionHeader title="Follower growth" />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {spark.pts.length >= 2 ? (
            <>
              <View style={styles.sparkRow}>
                {spark.pts.map((p, i) => {
                  const h = Math.max(2, Math.round((p.followers / spark.max) * scale(72)));
                  return (
                    <View
                      key={`${p.week}-${i}`}
                      style={[styles.sparkBar, { height: h, backgroundColor: PULSE_COLORS.accent }]}
                    />
                  );
                })}
              </View>
              <View style={styles.sparkMetaRow}>
                <TrendingUp size={fontScale(14)} color={theme.textSecondary} />
                <Text style={[styles.sparkMeta, { color: theme.textSecondary }]}>
                  {formatPulseNumber(spark.pts[0].followers)} → {formatPulseNumber(spark.pts[spark.pts.length - 1].followers)} over {spark.pts.length} weeks
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.cardMuted, { color: theme.textSecondary }]}>
              Not enough history yet — keep posting and your weekly growth will chart here.
            </Text>
          )}
        </View>

        {/* Top posts */}
        <SectionHeader title="Top posts" />
        {topPosts.length === 0 ? (
          <EmptyState observation="No posts to rank yet." nudge="Compose a few posts to see your best performers." />
        ) : (
          topPosts.map((p, idx) => (
            <View key={p.id} style={[styles.postCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.postRank, { backgroundColor: PULSE_COLORS.accent }]}>
                <Text style={styles.postRankText}>{idx + 1}</Text>
              </View>
              <View style={styles.postBody}>
                <Text style={[styles.postContent, { color: theme.text }]} numberOfLines={2}>
                  {p.content || '(media post)'}
                </Text>
                <View style={styles.postMetaRow}>
                  <View style={styles.postMetaItem}>
                    <Heart size={fontScale(12)} color={PULSE_COLORS.like} />
                    <Text style={[styles.postMeta, { color: theme.textSecondary }]}>{formatPulseNumber(p.likes)}</Text>
                  </View>
                  <View style={styles.postMetaItem}>
                    <Repeat2 size={fontScale(12)} color={PULSE_COLORS.repost} />
                    <Text style={[styles.postMeta, { color: theme.textSecondary }]}>{formatPulseNumber(p.reposts ?? 0)}</Text>
                  </View>
                  <View style={styles.postMetaItem}>
                    <TrendingUp size={fontScale(12)} color={theme.textSecondary} />
                    <Text style={[styles.postMeta, { color: theme.textSecondary }]}>{formatPulseNumber(p.views ?? 0)} views</Text>
                  </View>
                  {p.isViral ? <Text style={[styles.viralTag, { color: PULSE_COLORS.accent }]}>VIRAL</Text> : null}
                </View>
              </View>
            </View>
          ))
        )}

        {/* Lifetime trophy case */}
        <SectionHeader title="Lifetime records" />
        <View style={styles.trophyGrid}>
          <Trophy Icon={Star} label="Peak followers" value={formatPulseNumber(lifetime?.peakFollowers ?? 0)} theme={theme} />
          <Trophy Icon={Award} label="Peak tier" value={TIER_LABELS[lifetime?.peakInfluenceLevel ?? 'novice'] ?? 'Novice'} theme={theme} />
          <Trophy Icon={ShieldCheck} label="Scandals survived" value={String(lifetime?.totalScandalsSurvived ?? 0)} theme={theme} />
          <Trophy Icon={Award} label="Brand deals done" value={String(lifetime?.totalBrandDealsCompleted ?? 0)} theme={theme} />
          <Trophy Icon={Zap} label="Gem boosts used" value={String(lifetime?.totalGemsBoostsUsed ?? 0)} theme={theme} />
          <Trophy Icon={ShieldCheck} label="Pro weeks" value={String(lifetime?.totalVerifiedProWeeks ?? 0)} theme={theme} />
        </View>
      </View>
    </ScrollView>
  );
}

function Trophy({ Icon, label, value, theme }: { Icon: typeof Star; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.trophy, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Icon size={responsiveIconSize.md} color={PULSE_COLORS.accent} />
      <Text style={[styles.trophyValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.trophyLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: scale(140),
  },
  hero: {
    margin: responsiveSpacing.md,
    borderRadius: scale(16),
    padding: responsiveSpacing.lg,
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: fontScale(34),
    fontWeight: '800',
    marginTop: 2,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontScale(12),
    fontWeight: '600',
    marginTop: 4,
  },
  influenceWrap: {
    paddingHorizontal: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  lockStrip: {
    paddingHorizontal: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: 1,
  },
  lockTextWrap: {
    flex: 1,
  },
  lockTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  lockSub: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  gatedDim: {
    opacity: 0.4,
  },
  card: {
    marginHorizontal: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
  },
  cardMuted: {
    fontSize: fontScale(13),
    lineHeight: fontScale(19),
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: scale(76),
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
  sparkMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: responsiveSpacing.sm,
  },
  sparkMeta: {
    fontSize: fontScale(12),
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
  },
  postRank: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  postRankText: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '800',
  },
  postBody: {
    flex: 1,
  },
  postContent: {
    fontSize: fontScale(13),
    fontWeight: '500',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
    marginTop: 6,
  },
  postMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postMeta: {
    fontSize: fontScale(11),
  },
  viralTag: {
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  trophyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  trophy: {
    width: '31%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: responsiveSpacing.md,
    borderRadius: scale(12),
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  trophyValue: {
    fontSize: fontScale(16),
    fontWeight: '800',
  },
  trophyLabel: {
    fontSize: fontScale(10),
    textAlign: 'center',
  },
});
