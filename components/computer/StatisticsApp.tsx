/**
 * StatisticsApp - Apple Health DNA pass (on top of Slate Glass).
 *
 * Previous remake unified tokens but read as the generic "eyebrow hero +
 * uniform rows" template. This pass gives Statistics its own body - an Apple
 * Health / Fitness silhouette - while keeping the Slate Glass token language,
 * crash-safety, and (critically) ZERO removal of existing data:
 *
 *   - Vitals activity-ring cluster (Health / Mood / Fitness) - NEW surfacing of
 *     stats.health/happiness/fitness the old dashboard ignored.
 *   - Per-metric TREND CARDS with real SVG sparklines drawn from the statistics
 *     tracker's history arrays (netWorthHistory / weeklyEarningsHistory).
 *   - Records ("bests") as tappable medal chips (peak NW, top salary, best week,
 *     longest role, achievements…), backed by getCareerSummary /
 *     getAchievementProgress that the old UI never called.
 *   - Milestones rendered as a filterable life TIMELINE (dots + rail).
 *   - Systems / Planning keep every readout, now tappable into detail pages.
 *
 * Sub-view routing is local useState (list -> detail); no new game mechanics,
 * no economy changes - presentation of existing state only.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Polyline, Polygon, Line, Circle } from 'react-native-svg';
import {
  Activity,
  Trophy,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  PieChart,
  AlertTriangle,
  ChevronRight,
  Heart,
  Smile,
  Dumbbell,
  Award,
  Medal,
  Briefcase,
  Flame,
  Crown,
  Gem,
  Zap,
  Star,
  Clock,
  Skull,
  Landmark,
  Bitcoin,
  Building2,
  Radio,
  Vote,
  Plane,
  PawPrint,
  Car,
  Users,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProgressRing from '@/components/ui/ProgressRing';
import {
  calculateNetWorth,
  getCareerSummary,
  getAchievementProgress,
  getDefaultStatistics,
  formatStatMoney,
} from '@/lib/statistics/statisticsTracker';
import { calculateLifeExpectancy } from '@/lib/statistics/lifeExpectancy';
import { calculateFIRETracker } from '@/lib/statistics/fireTracker';
import { calculateRetirementPlanning } from '@/lib/statistics/retirementCalculator';
import { buildCrossSystemSummary, SystemCard } from '@/lib/statistics/crossSystemSummary';
import {
  buildMilestones,
  Milestone,
  milestoneGemReward,
  getClaimedMilestoneRewards,
  claimMilestoneReward,
} from '@/lib/statistics/milestones';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { haptic } from '@/utils/haptics';
import { trendOf } from '@/lib/statistics/trends';
import type { LifetimeStatistics } from '@/contexts/game/types';
import { aggregateContacts, contactCountsByKind } from '@/lib/contacts/aggregator';
import { getThemeColors, accent, withAlpha } from '@/lib/config/theme';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
import { getGlassCard, getGlassIconContainer } from '@/utils/glassmorphismStyles';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
  getAppScreenBottomPadding,
} from '@/utils/scaling';
import AppHeader, { HeaderChip } from '@/components/ui/AppHeader';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import SectionTitle from '@/components/ui/SectionTitle';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';

type TabType = 'overview' | 'systems' | 'milestones' | 'planning';

const TABS: { key: TabType; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'systems', label: 'Systems', icon: Layers },
  { key: 'milestones', label: 'Milestones', icon: Trophy },
  { key: 'planning', label: 'Planning', icon: PieChart },
];

/** Local list -> detail routing. Every target presents EXISTING state only. */
type DetailView =
  | { kind: 'vitals' }
  | { kind: 'records' }
  | { kind: 'career' }
  | { kind: 'metric'; id: 'networth' | 'earnings' }
  | { kind: 'system'; id: string }
  | { kind: 'life'; index: number };

type IconType = React.ComponentType<{ size?: number; color?: string }>;
type Theme = ReturnType<typeof getThemeColors>;

interface Props {
  onBack: () => void;
}

/** Per-system glyph + category color (Recipe C tinted bubbles keep the hue). */
const SYSTEM_META: Record<string, { Icon: IconType; color: string }> = {
  banking: { Icon: Landmark, color: accent.info },
  crypto: { Icon: Bitcoin, color: accent.gold },
  stocks: { Icon: TrendingUp, color: accent.purple },
  realEstate: { Icon: Building2, color: accent.success },
  darkweb: { Icon: Skull, color: accent.danger },
  politics: { Icon: Vote, color: accent.info },
  content: { Icon: Radio, color: accent.purple },
  travel: { Icon: Plane, color: accent.info },
  pets: { Icon: PawPrint, color: accent.gold },
  vehicles: { Icon: Car, color: accent.amber },
  contacts: { Icon: Users, color: accent.amber },
};

export default function StatisticsApp({ onBack }: Props) {
  const { gameState } = useGame();
  const setGameState = useSetGameState();
  const insets = useSafeAreaInsets();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [milestoneCat, setMilestoneCat] = useState<string>('all');

  const week = gameState.weeksLived || 0;
  const stats = gameState.stats;

  /** Full-shape stats so getCareerSummary / record math never read undefined. */
  const s = useMemo<LifetimeStatistics>(
    () => ({ ...getDefaultStatistics(), ...(gameState.lifetimeStatistics ?? {}) }),
    [gameState.lifetimeStatistics]
  );

  const netWorth = useMemo(() => calculateNetWorth(gameState), [gameState]);
  const contactsByKind = useMemo(
    () => contactCountsByKind(aggregateContacts(gameState)),
    [gameState]
  );
  const summary = useMemo(
    () => buildCrossSystemSummary(gameState, contactsByKind),
    [gameState, contactsByKind]
  );
  const milestones = useMemo(() => buildMilestones(gameState), [gameState]);
  // One-time gem reward per milestone: `claimedMilestoneRewards` is the additive
  // claimed set; the chip grants via the canonical clamped gems path.
  const claimedMilestones = useMemo(
    () => new Set(getClaimedMilestoneRewards(gameState)),
    [gameState],
  );
  const onClaimMilestone = useCallback(
    (id: string) => {
      haptic.success();
      setGameState((prev) => claimMilestoneReward(prev, id).state);
    },
    [setGameState],
  );

  // netWorthHistory / weeklyEarningsHistory are NetWorthSnapshot[] ({week,value}).
  const netWorthSeries = useMemo(() => s.netWorthHistory.map((x) => x.value), [s]);
  const earningsSeries = useMemo(() => s.weeklyEarningsHistory.map((x) => x.value), [s]);
  const netWorthTrend = useMemo(() => trendOf(netWorthSeries), [netWorthSeries]);
  const earningsTrend = useMemo(() => trendOf(earningsSeries), [earningsSeries]);

  const careerSummary = useMemo(() => getCareerSummary(s), [s]);
  const achProgress = useMemo(() => getAchievementProgress(gameState), [gameState]);

  const lifeExp = useMemo(() => calculateLifeExpectancy(gameState), [gameState]);
  const fire = useMemo(() => calculateFIRETracker(gameState), [gameState]);
  const retirement = useMemo(() => calculateRetirementPlanning(gameState, 65), [gameState]);
  const retirementOnTrack = retirement.savingsGap <= 0;

  // ---- Vitals (activity rings) -----------------------------------------
  const vitals = useMemo(
    () => [
      // Identity colours from statIdentity, and the stat's own name: 'Mood'
      // in gold here was 'Happiness' in amber everywhere else, and fitness
      // wore money's green.
      { key: 'health', label: 'Health', value: safeNum(stats?.health), color: STAT_IDENTITY.health.color, Icon: Heart as IconType },
      { key: 'happiness', label: 'Happiness', value: safeNum(stats?.happiness), color: STAT_IDENTITY.happiness.color, Icon: Smile as IconType },
      { key: 'fitness', label: 'Fitness', value: safeNum(stats?.fitness), color: STAT_IDENTITY.fitness.color, Icon: Dumbbell as IconType },
    ],
    [stats]
  );

  // ---- Records ("bests") ------------------------------------------------
  const records = useMemo(() => {
    const list: RecordItem[] = [];
    if (s.peakNetWorth > 0) {
      list.push({
        id: 'peak', Icon: Crown, color: accent.gold, label: 'Peak net worth',
        value: formatStatMoney(s.peakNetWorth),
        sub: s.peakNetWorthWeek ? `Week ${s.peakNetWorthWeek}` : undefined,
      });
    }
    if (s.highestSalary > 0) {
      list.push({ id: 'salary', Icon: Briefcase, color: accent.info, label: 'Top salary', value: formatStatMoney(s.highestSalary), sub: 'annual' });
    }
    const bestWeek = s.weeklyEarningsHistory.reduce<{ week: number; value: number } | null>(
      (m, x) => (m === null || x.value > m.value ? x : m),
      null
    );
    if (bestWeek && bestWeek.value > 0) {
      list.push({ id: 'bestweek', Icon: Flame, color: accent.success, label: 'Best week', value: formatStatMoney(bestWeek.value), sub: `Week ${bestWeek.week}` });
    }
    if (s.totalMoneyEarned > 0) {
      list.push({ id: 'earned', Icon: TrendingUp, color: accent.success, label: 'Lifetime earned', value: formatStatMoney(s.totalMoneyEarned) });
    }
    if (careerSummary.longestJob) {
      list.push({ id: 'longest', Icon: Clock, color: accent.purple, label: 'Longest role', value: `${careerSummary.longestJob.weeks}w`, sub: prettyJob(careerSummary.longestJob.job) });
    }
    if (careerSummary.highestPaying && careerSummary.highestPaying.earnings > 0) {
      list.push({ id: 'topearner', Icon: Medal, color: accent.gold, label: 'Top earner role', value: formatStatMoney(careerSummary.highestPaying.earnings), sub: prettyJob(careerSummary.highestPaying.job) });
    }
    if (s.totalRelationships > 0) {
      list.push({ id: 'rel', Icon: Heart, color: accent.danger, label: 'Relationships', value: String(s.totalRelationships) });
    }
    if (achProgress.total > 0) {
      list.push({ id: 'ach', Icon: Award, color: accent.gold, label: 'Achievements', value: `${achProgress.unlocked}/${achProgress.total}`, sub: `${achProgress.percentage}%` });
    }
    return list;
  }, [s, careerSummary, achProgress]);

  const handleBack = () => {
    if (detail) setDetail(null);
    else onBack();
  };

  const headerTitle = (() => {
    if (!detail) return 'Statistics';
    switch (detail.kind) {
      case 'vitals': return 'Vitals';
      case 'records': return 'Records';
      case 'career': return 'Career history';
      case 'metric': return detail.id === 'networth' ? 'Net worth' : 'Weekly earnings';
      case 'system': return summary.cards.find((c) => c.id === detail.id)?.label ?? 'System';
      case 'life': return `Life ${detail.index + 1}`;
    }
  })();

  const trackColor = darkMode ? 'rgba(148, 163, 184, 0.20)' : 'rgba(15, 23, 42, 0.08)';

  // =====================================================================
  // OVERVIEW (Apple Health "Summary")
  // =====================================================================
  const renderOverview = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* Net worth HERO - the ONE headline number, so it comes FIRST. It used to
          sit under a cluster of four rings that outranked it by area (Program 4). */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setDetail({ kind: 'metric', id: 'networth' })}
        accessibilityRole="button"
        accessibilityLabel="Net worth detail"
        style={[getGlassCard(darkMode, 12), { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] }]}
      >
        <View style={styles.heroInner}>
          <Text style={[styles.heroLabel, { color: theme.textMuted }]}>NET WORTH</Text>
          <Text style={[styles.heroValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            ${Math.round(netWorth).toLocaleString()}
          </Text>
          <View style={styles.trendRow}>
            <TrendChip trend={netWorthTrend} label="vs prior weeks" />
          </View>
          {netWorthSeries.length >= 2 ? (
            <View style={styles.heroSpark} pointerEvents="none">
              <Sparkline data={netWorthSeries} color={accent.info} width={scale(300)} height={scale(38)} />
            </View>
          ) : null}
          <View style={styles.peakRow}>
            <Text style={[styles.peakLabel, { color: theme.textMuted }]}>Peak</Text>
            <Text style={[styles.peakValue, { color: accent.gold }]}>${Math.round(s.peakNetWorth || netWorth).toLocaleString()}</Text>
            {s.peakNetWorthWeek ? <Text style={[styles.peakLabel, { color: theme.textMuted }]}>week {s.peakNetWorthWeek}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* Vitals ring cluster - the signature silhouette, second to the number. */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setDetail({ kind: 'vitals' })}
        accessibilityRole="button"
        accessibilityLabel="Vitals detail"
        style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <SectionTitle title="Vitals" right={<ChevronRight size={scale(18)} color={theme.textMuted} />} />
        <View style={styles.vitalsRow}>
          {vitals.map((v) => (
            <View key={v.key} style={styles.vitalItem}>
              <ProgressRing
                value={clampPct(v.value)}
                size={64}
                strokeWidth={6}
                ambient={false}
                showPill={false}
                accentColor={v.color}
                trackColor={trackColor}
                label={`${v.label} ${Math.round(v.value)} percent`}
              >
                <Text style={[styles.vitalValue, { color: theme.text }]}>{Math.round(v.value)}</Text>
              </ProgressRing>
              <View style={styles.vitalLabelRow}>
                <v.Icon size={scale(12)} color={v.color} />
                <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>{v.label}</Text>
              </View>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Records - one nav row; the bests themselves live on the Records page. */}
      {records.length > 0 ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setDetail({ kind: 'records' })}
          accessibilityRole="button"
          accessibilityLabel={`Records, ${records.length} personal bests`}
          style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <SectionTitle
            title="Records"
            subtitle={`${records.length} personal best${records.length === 1 ? '' : 's'}`}
            right={<ChevronRight size={scale(18)} color={theme.textMuted} />}
          />
        </TouchableOpacity>
      ) : null}

      {/* Weekly earnings trend (net worth already has the hero above). */}
      <MetricTrendCard
        title="Weekly earnings"
        Icon={Zap}
        color={accent.success}
        series={earningsSeries}
        current={`$${earningsTrend.recentAverage.toLocaleString()}/wk`}
        trend={earningsTrend}
        footer={[
          { label: 'Recent avg', value: `$${earningsTrend.recentAverage.toLocaleString()}` },
          { label: 'Sample', value: `${earningsTrend.sampleSize}wk` },
          { label: 'Baseline', value: `$${earningsTrend.baselineAverage.toLocaleString()}` },
        ]}
        theme={theme}
        darkMode={darkMode}
        onPress={() => setDetail({ kind: 'metric', id: 'earnings' })}
      />

      {/* Career summary -> detail */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setDetail({ kind: 'career' })}
        accessibilityRole="button"
        accessibilityLabel="Career history detail"
        style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <SectionTitle title="Career" right={<ChevronRight size={scale(18)} color={theme.textMuted} />} />
        <StatStrip
          items={[
            { label: 'Roles', value: careerSummary.totalJobs, tint: accent.info },
            { label: 'Weeks worked', value: careerSummary.totalWeeks, tint: accent.success },
            { label: 'Career $', value: formatStatMoney(careerSummary.totalEarnings), tint: accent.gold },
          ]}
        />
      </TouchableOpacity>

      {/* Lifetime money (kept) */}
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SectionTitle title="Lifetime money" />
        <StatStrip
          items={[
            { label: 'Earned', value: `$${Math.round(s.totalMoneyEarned).toLocaleString()}`, tint: accent.success },
            { label: 'Spent', value: `$${Math.round(s.totalMoneySpent).toLocaleString()}`, tint: accent.danger },
            { label: 'Top salary', value: `$${Math.round(s.highestSalary).toLocaleString()}`, tint: accent.info },
          ]}
        />
      </View>

      {/* Life snapshot - the three the player builds toward, the rest as rows. */}
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SectionTitle title="Life snapshot" />
        <StatStrip
          items={[
            { label: 'Companies', value: s.totalCompaniesOwned },
            { label: 'Properties', value: s.totalPropertiesOwned },
            { label: 'Relationships', value: s.totalRelationships },
          ]}
        />
        <View style={styles.detailRows}>
          <DetailRow label="Children" value={String(s.totalChildren)} theme={theme} />
          <DetailRow label="Destinations" value={String(s.totalTravelDestinations)} theme={theme} />
          <DetailRow label="Posts" value={String(s.totalPostsMade)} theme={theme} />
        </View>
      </View>

      {/* Open IOUs (kept, conditional) */}
      {summary.netFavorMoney !== 0 ? (
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Open IOUs" />
          <Text style={[styles.heroValue, { color: summary.netFavorMoney >= 0 ? accent.success : accent.danger }]}>
            {summary.netFavorMoney >= 0 ? '+' : '−'}${Math.abs(summary.netFavorMoney).toLocaleString()}
          </Text>
          <Text style={[styles.peakLabel, { color: theme.textSecondary }]}>
            {summary.netFavorMoney >= 0 ? 'net owed to you' : 'net you owe'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );

  // =====================================================================
  // SYSTEMS
  // =====================================================================
  const renderSystems = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {summary.cards.length === 0 ? (
        <EmptyState
          icon={<Layers size={scale(26)} color={accent.info} />}
          observation="No system data yet."
          nudge="Play through the other apps and their metrics land here."
        />
      ) : (
        <>
          <View style={[getGlassCard(darkMode, 6), styles.summaryStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[getGlassIconContainer(darkMode, 36), styles.tintBubble, { backgroundColor: withAlpha(accent.info, 0.15), borderColor: withAlpha(accent.info, 0.3) }]}>
              <Layers size={scale(18)} color={accent.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryStripValue, { color: theme.text }]}>{summary.cards.length} systems tracked</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                {summary.cards.filter((c) => c.warning).length} with warnings · tap a card for detail
              </Text>
            </View>
          </View>
          {summary.cards.map((card) => (
            <SystemRow key={card.id} card={card} theme={theme} darkMode={darkMode} onPress={() => setDetail({ kind: 'system', id: card.id })} />
          ))}
        </>
      )}
    </ScrollView>
  );

  // =====================================================================
  // MILESTONES (life timeline)
  // =====================================================================
  const renderMilestones = () => {
    const cats = Array.from(new Set(milestones.map((m) => m.category)));
    const filtered = milestoneCat === 'all' ? milestones : milestones.filter((m) => m.category === milestoneCat);
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {milestones.length === 0 ? (
          <EmptyState
            icon={<Trophy size={scale(26)} color={accent.info} />}
            observation="No milestones yet."
            nudge="Cross a wealth, career or family threshold and it is recorded here."
          />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <Chip
                label={`All ${milestones.length}`}
                tint={accent.info}
                size="md"
                selected={milestoneCat === 'all'}
                onPress={() => setMilestoneCat('all')}
              />
              {cats.map((c) => (
                <Chip
                  key={c}
                  label={c.charAt(0).toUpperCase() + c.slice(1)}
                  tint={categoryColor(c)}
                  size="md"
                  selected={milestoneCat === c}
                  onPress={() => setMilestoneCat(c)}
                />
              ))}
            </ScrollView>
            <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {filtered.map((m, i) => (
                <TimelineItem
                  key={m.id}
                  milestone={m}
                  isFirst={i === 0}
                  isLast={i === filtered.length - 1}
                  theme={theme}
                  reward={milestoneGemReward(m)}
                  claimed={claimedMilestones.has(m.id)}
                  onClaim={() => onClaimMilestone(m.id)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  // =====================================================================
  // PLANNING (kept in full + enriched)
  // =====================================================================
  const renderPlanning = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* The three calculators fold: each header carries its headline number, so a
          collapsed one still answers the question it exists to answer. */}
      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <CollapsibleSection
          id="statistics-life-expectancy"
          title="Life expectancy"
          compact
          defaultCollapsed
          summary={`${Math.round(lifeExp.totalLifeExpectancy)}y`}
        >
          <View style={styles.sectionBody}>
            <StatStrip
              items={[
                { label: 'Total', value: `${Math.round(lifeExp.totalLifeExpectancy)}y`, tint: accent.info },
                { label: 'Remaining', value: `${Math.round(lifeExp.yearsRemaining)}y`, tint: accent.success },
                { label: 'Base', value: `${Math.round(lifeExp.baseAge)}y` },
              ]}
            />
            <View style={styles.detailRows}>
              <DetailRow label="Health" value={signedYears(lifeExp.healthModifier)} theme={theme} />
              <DetailRow label="Mood" value={signedYears(lifeExp.happinessModifier)} theme={theme} />
              <DetailRow label="Lifestyle" value={signedYears(lifeExp.lifestyleModifier)} theme={theme} />
            </View>
            {lifeExp.recommendations.slice(0, 3).map((r, i) => (
              <Text key={i} style={[styles.recItem, { color: theme.textSecondary }]}>• {r}</Text>
            ))}
            <View style={styles.chipRow}>
              <Chip label="Vitals" tint={accent.info} size="md" onPress={() => setDetail({ kind: 'vitals' })} />
            </View>
          </View>
        </CollapsibleSection>
      </View>

      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <CollapsibleSection
          id="statistics-fire"
          title="FIRE tracker"
          compact
          summary={`${Math.round(fire.progressToFIRE)}%`}
        >
          <View style={styles.sectionBody}>
            <View style={styles.fireBody}>
              <ProgressRing
                value={clampPct(fire.progressToFIRE)}
                size={96}
                strokeWidth={9}
                ambient={false}
                accentColor={accent.success}
                positiveColor={accent.success}
                state={fire.milestones.achieved ? 'done' : 'active'}
                trackColor={trackColor}
                surfaceColor={theme.surface}
                inkColor={theme.text}
                borderColor={theme.border}
                label={`FIRE progress ${Math.round(fire.progressToFIRE)} percent`}
              >
                <Flame size={scale(24)} color={accent.success} />
              </ProgressRing>
              <StatStrip
                style={styles.fireStats}
                items={[
                  { label: 'FIRE number', value: formatStatMoney(fire.fireNumber) },
                  { label: 'Years to FIRE', value: fire.yearsToFIRE >= 999 ? '-' : `${Math.max(0, fire.yearsToFIRE)}y` },
                  { label: 'Savings rate', value: `${Math.round(fire.savingsRate)}%` },
                ]}
              />
            </View>
            <StatStrip
              items={[
                { label: 'Lean', value: formatStatMoney(fire.milestones.leanFIRE) },
                { label: 'Regular', value: formatStatMoney(fire.milestones.regularFIRE) },
                { label: 'Fat', value: formatStatMoney(fire.milestones.fatFIRE) },
                { label: 'Coast', value: `${Math.round(fire.coastFIREProgress)}%` },
              ]}
            />
          </View>
        </CollapsibleSection>
      </View>

      <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <CollapsibleSection
          id="statistics-retirement"
          title="Retirement plan (age 65)"
          compact
          defaultCollapsed
          summary={retirementOnTrack ? 'On track' : 'Behind'}
        >
          <View style={styles.sectionBody}>
            <StatStrip
              items={[
                { label: 'Required', value: formatStatMoney(retirement.requiredNetWorth), tint: accent.purple },
                { label: 'Gap', value: formatStatMoney(Math.abs(retirement.savingsGap)), tint: retirementOnTrack ? accent.success : accent.warning },
                { label: 'Status', value: retirementOnTrack ? 'On track' : 'Behind', tint: retirementOnTrack ? accent.success : accent.warning },
              ]}
            />
            <View style={styles.detailRows}>
              <DetailRow label="Current age" value={`${retirement.currentAge}`} theme={theme} />
              <DetailRow label="Years to retirement" value={`${retirement.yearsToRetirement}y`} theme={theme} />
              <DetailRow label="Projected year" value={`${retirement.projectedRetirementDate}`} theme={theme} />
            </View>
            <Text style={[styles.recItem, { color: theme.textSecondary }]}>
              • Save ${Math.round(retirement.monthlySavingsNeeded).toLocaleString()}/mo to close the gap
            </Text>
            <Text style={[styles.recItem, { color: theme.textSecondary }]}>
              • Assumes {retirement.assumptions.expectedReturnRate}% returns, {retirement.assumptions.inflationRate}% inflation
            </Text>
          </View>
        </CollapsibleSection>
      </View>

      {/* Past lives */}
      {gameState.previousLives?.length ? (
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Past lives" />
          {gameState.previousLives.slice(0, 8).map((pl, idx: number) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => setDetail({ kind: 'life', index: idx })}
              accessibilityRole="button"
              accessibilityLabel={`Life ${idx + 1} detail`}
              style={[styles.pastLifeRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>Life {idx + 1}{typeof pl.generation === 'number' ? ` · Gen ${pl.generation}` : ''}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  Net worth ${Math.round(safeNum(pl.netWorth ?? pl.peakNetWorth)).toLocaleString()}
                  {typeof pl.ageAtDeath === 'number' ? ` · died at ${pl.ageAtDeath}` : ''}
                </Text>
              </View>
              <ChevronRight size={scale(16)} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );

  // =====================================================================
  // DETAIL PAGES
  // =====================================================================
  const renderDetail = () => {
    if (!detail) return null;
    switch (detail.kind) {
      case 'vitals': return renderVitalsDetail();
      case 'records': return renderRecordsDetail();
      case 'career': return renderCareerDetail();
      case 'metric': return renderMetricDetail(detail.id);
      case 'system': return renderSystemDetail(detail.id);
      case 'life': return renderLifeDetail(detail.index);
    }
  };

  const renderVitalsDetail = () => {
    const secondary = [
      { label: 'Energy', value: safeNum(stats?.energy), color: STAT_IDENTITY.energy.color, Icon: Zap as IconType },
      { label: 'Reputation', value: safeNum(stats?.reputation), color: STAT_IDENTITY.reputation.color, Icon: Star as IconType },
    ];
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Vitals" />
          <View style={styles.vitalsRow}>
            {vitals.map((v) => (
              <View key={v.key} style={styles.vitalItem}>
                <ProgressRing value={clampPct(v.value)} size={84} strokeWidth={8} ambient={false} showPill={false} accentColor={v.color} trackColor={trackColor} label={`${v.label} ${Math.round(v.value)} percent`}>
                  <Text style={[styles.vitalValueLg, { color: theme.text }]}>{Math.round(v.value)}</Text>
                </ProgressRing>
                <View style={styles.vitalLabelRow}>
                  <v.Icon size={scale(13)} color={v.color} />
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>{v.label}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.chipWrapRow}>
            {secondary.map((sc) => (
              <View key={sc.label} style={[styles.statChip, { borderColor: withAlpha(sc.color, 0.3), backgroundColor: withAlpha(sc.color, 0.1) }]}>
                <sc.Icon size={scale(13)} color={sc.color} />
                <Text style={[styles.statChipValue, { color: theme.text }]}>{Math.round(sc.value)}</Text>
                <Text style={[styles.statChipLabel, { color: theme.textSecondary }]}>{sc.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Longevity breakdown" />
          <StatStrip
            items={[
              { label: 'Life expectancy', value: `${Math.round(lifeExp.totalLifeExpectancy)}y`, tint: accent.info },
              { label: 'Years left', value: `${Math.round(lifeExp.yearsRemaining)}y`, tint: accent.success },
              { label: 'Base', value: `${Math.round(lifeExp.baseAge)}y` },
            ]}
          />
          <View style={styles.detailRows}>
            <DetailRow label="Health modifier" value={signedYears(lifeExp.healthModifier)} theme={theme} />
            <DetailRow label="Mood modifier" value={signedYears(lifeExp.happinessModifier)} theme={theme} />
            <DetailRow label="Lifestyle modifier" value={signedYears(lifeExp.lifestyleModifier)} theme={theme} />
          </View>
          {lifeExp.recommendations.map((r, i) => (
            <Text key={i} style={[styles.recItem, { color: theme.textSecondary }]}>• {r}</Text>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderRecordsDetail = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {records.length === 0 ? (
        <EmptyState
          icon={<Medal size={scale(26)} color={accent.info} />}
          observation="No records yet."
          nudge="Every personal best you set is kept here."
        />
      ) : (
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {records.map((r, i) => (
            <View key={r.id} style={[styles.recordRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={[getGlassIconContainer(darkMode, 40), styles.tintBubble, { backgroundColor: withAlpha(r.color, 0.15), borderColor: withAlpha(r.color, 0.3) }]}>
                <r.Icon size={scale(18)} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: theme.text }]}>{r.label}</Text>
                {r.sub ? <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{r.sub}</Text> : null}
              </View>
              <Text style={[styles.recordRowValue, { color: r.color }]}>{r.value}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderCareerDetail = () => {
    const history = [...s.careerHistory].reverse();
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle title="Career summary" />
          <StatStrip
            items={[
              { label: 'Roles', value: careerSummary.totalJobs, tint: accent.info },
              { label: 'Weeks', value: careerSummary.totalWeeks, tint: accent.success },
              { label: 'Earned', value: formatStatMoney(careerSummary.totalEarnings), tint: accent.gold },
            ]}
          />
        </View>
        {history.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={scale(26)} color={accent.info} />}
            observation="No roles tracked."
            nudge="Take a job and your career history builds here."
          />
        ) : (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="History" />
            {history.map((h, i) => {
              const ongoing = !h.endWeek;
              return (
                <View key={`${h.job}-${h.startWeek}-${i}`} style={[styles.careerRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{prettyJob(h.job)}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                      Wk {h.startWeek}{ongoing ? ' · current' : `–${h.endWeek}`} · {h.weeks}w
                    </Text>
                  </View>
                  {ongoing ? (
                    <View style={[styles.tag, { backgroundColor: withAlpha(accent.success, 0.16) }]}>
                      <Text style={[styles.tagText, { color: accent.success }]}>Active</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.recordRowValue, { color: theme.text }]}>{formatStatMoney(h.earnings)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderMetricDetail = (id: 'networth' | 'earnings') => {
    const isNW = id === 'networth';
    const snaps = isNW ? s.netWorthHistory : s.weeklyEarningsHistory;
    const series = isNW ? netWorthSeries : earningsSeries;
    const trend = isNW ? netWorthTrend : earningsTrend;
    const color = isNW ? accent.info : accent.success;
    const rows = snaps
      .map((snap, i) => ({ ...snap, delta: i > 0 ? snap.value - snaps[i - 1].value : 0, isFirst: i === 0 }))
      .reverse();
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        {/* Big chart hero (Recipe B) */}
        <View style={[getGlassCard(darkMode, 12), { backgroundColor: theme.surface, borderColor: darkMode ? theme.glassBorder : theme.border, borderWidth: 1, borderRadius: br['2xl'] }]}>
          <View style={styles.heroInner}>
            <Text style={[styles.heroLabel, { color: theme.textMuted }]}>{isNW ? 'NET WORTH' : 'WEEKLY EARNINGS'}</Text>
            <Text style={[styles.heroValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {isNW ? `$${Math.round(netWorth).toLocaleString()}` : `$${earningsTrend.recentAverage.toLocaleString()}/wk`}
            </Text>
            <View style={styles.trendRow}>
              <TrendChip trend={trend} label={isNW ? 'vs prior weeks' : 'weekly earnings'} />
            </View>
            {series.length >= 2 ? (
              <View style={styles.detailSpark} pointerEvents="none">
                <Sparkline data={series} color={color} width={scale(300)} height={scale(90)} strokeWidth={2.5} />
              </View>
            ) : (
              <Text style={[styles.cardSub, { color: theme.textSecondary, marginTop: sp.sm }]}>Not enough history sampled yet.</Text>
            )}
          </View>
        </View>

        {/* Stats strip */}
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatStrip
            items={[
              ...metricRange(series).map((f) => ({ label: f.label, value: f.value, tint: color })),
              { label: 'Samples', value: series.length },
            ]}
          />
        </View>

        {/* Snapshot log */}
        {rows.length > 0 ? (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="Snapshots" />
            {rows.map((r, i) => (
              <View key={`${r.week}-${i}`} style={[styles.snapRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <Text style={[styles.snapWeek, { color: theme.textSecondary }]}>Week {r.week}</Text>
                <Text style={[styles.snapValue, { color: theme.text }]}>${Math.round(r.value).toLocaleString()}</Text>
                <DeltaChip delta={r.delta} isFirst={r.isFirst} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const renderSystemDetail = (id: string) => {
    const card = summary.cards.find((c) => c.id === id);
    if (!card) return renderOverview();
    const meta = SYSTEM_META[id] ?? { Icon: Layers as IconType, color: accent.info };
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.systemDetailHead}>
            <View style={[getGlassIconContainer(darkMode, 48), styles.tintBubble, { backgroundColor: withAlpha(meta.color, 0.15), borderColor: withAlpha(meta.color, 0.3) }]}>
              <meta.Icon size={scale(22)} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.systemLabel, { color: theme.text }]}>{card.label}</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{card.lead.label}</Text>
            </View>
          </View>
          <Text style={[styles.systemBigLead, { color: meta.color }]}>{card.lead.value}</Text>
          {card.warning ? (
            <View style={[styles.warnBanner, { backgroundColor: withAlpha(accent.warning, 0.12), borderColor: withAlpha(accent.warning, 0.3) }]}>
              <AlertTriangle size={scale(14)} color={accent.warning} />
              <Text style={[styles.warnBannerText, { color: accent.warning }]}>{card.warning}</Text>
            </View>
          ) : null}
        </View>
        {card.details.length > 0 ? (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="Breakdown" />
            <View style={styles.detailRows}>
              {card.details.map((d) => (
                <DetailRow key={d.label} label={d.label} value={d.value} theme={theme} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  const renderLifeDetail = (index: number) => {
    const pl = gameState.previousLives?.[index];
    if (!pl) return renderPlanning();
    const ach: string[] = Array.isArray(pl.summaryAchievements) ? pl.summaryAchievements : [];
    return (
      <ScrollView style={styles.flex1} contentContainerStyle={[styles.scrollPad, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
        <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.systemDetailHead}>
            <View style={[getGlassIconContainer(darkMode, 48), styles.tintBubble, { backgroundColor: withAlpha(accent.muted, 0.18), borderColor: withAlpha(accent.muted, 0.3) }]}>
              <Skull size={scale(22)} color={accent.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.systemLabel, { color: theme.text }]}>Life {index + 1}</Text>
              {typeof pl.generation === 'number' ? <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Generation {pl.generation}</Text> : null}
            </View>
          </View>
          <StatStrip
            items={[
              { label: 'Net worth', value: formatStatMoney(safeNum(pl.netWorth ?? pl.peakNetWorth)), tint: accent.gold },
              ...(typeof pl.ageAtDeath === 'number' ? [{ label: 'Age at death', value: pl.ageAtDeath, tint: accent.info }] : []),
              ...(typeof pl.totalRelationships === 'number' ? [{ label: 'Relationships', value: pl.totalRelationships, tint: accent.danger }] : []),
            ]}
          />
          {pl.deathReason ? (
            <View style={styles.detailRows}>
              <DetailRow label="Cause of death" value={String(pl.deathReason)} theme={theme} />
            </View>
          ) : null}
        </View>
        {ach.length > 0 ? (
          <View style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionTitle title="Achievements carried" />
            {ach.map((a, i) => (
              <Text key={i} style={[styles.recItem, { color: theme.textSecondary }]}>• {a}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AppHeader
        title={headerTitle}
        onBack={handleBack}
        backLabel={detail ? 'Back to statistics' : 'Back'}
        right={<HeaderChip label="Week" value={`Wk ${week}`} tint={accent.info} />}
      />

      {detail ? (
        renderDetail()
      ) : (
        <>
          <SegmentedControl
            segments={TABS}
            value={activeTab}
            onChange={setActiveTab}
            activeColor={accent.info}
            style={styles.tabs}
          />

          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'systems' && renderSystems()}
          {activeTab === 'milestones' && renderMilestones()}
          {activeTab === 'planning' && renderPlanning()}
        </>
      )}
    </View>
  );
}

// =======================================================================
// Presentational subcomponents
// =======================================================================

interface RecordItem {
  id: string;
  Icon: IconType;
  color: string;
  label: string;
  value: string;
  sub?: string;
}

/**
 * Honest multi-point sparkline built from a real numeric series (never a
 * fabricated history array). Area fill + line + trailing dot. Falls back to a
 * flat baseline when <2 points exist.
 */
function Sparkline({
  data,
  color,
  width,
  height,
  strokeWidth = 2,
  fillOpacity = 0.14,
}: {
  data: number[];
  color: string;
  width: number;
  height: number;
  strokeWidth?: number;
  fillOpacity?: number;
}) {
  const clean = (data ?? []).filter((v) => typeof v === 'number' && isFinite(v));
  const pad = strokeWidth + scale(3);
  if (clean.length < 2) {
    const midY = height / 2;
    return (
      <Svg width={width} height={height} pointerEvents="none">
        <Line x1={pad} y1={midY} x2={width - pad} y2={midY} stroke={color} strokeOpacity={0.45} strokeWidth={strokeWidth} strokeLinecap="round" />
      </Svg>
    );
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const n = clean.length;
  const xAt = (i: number) => pad + (i / (n - 1)) * (width - pad * 2);
  const yAt = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const linePts = clean.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  const areaPts = `${pad.toFixed(1)},${(height - pad).toFixed(1)} ${linePts} ${(width - pad).toFixed(1)},${(height - pad).toFixed(1)}`;
  const lastX = xAt(n - 1);
  const lastY = yAt(clean[n - 1]);
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Polygon points={areaPts} fill={color} fillOpacity={fillOpacity} />
      <Polyline points={linePts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastX} cy={lastY} r={strokeWidth + scale(1)} fill={color} />
    </Svg>
  );
}

function MetricTrendCard({
  title,
  Icon,
  color,
  series,
  current,
  trend,
  footer,
  theme,
  darkMode,
  onPress,
}: {
  title: string;
  Icon: IconType;
  color: string;
  series: number[];
  current: string;
  trend: ReturnType<typeof trendOf>;
  footer: { label: string; value: string }[];
  theme: Theme;
  darkMode: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} detail`}
      style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.metricHead}>
        <View style={[getGlassIconContainer(darkMode, 34), styles.tintBubble, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.3) }]}>
          <Icon size={scale(16)} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.metricTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.metricCurrent, { color: theme.text }]} numberOfLines={1}>{current}</Text>
        </View>
        <TrendChip trend={trend} />
        <ChevronRight size={scale(16)} color={theme.textMuted} />
      </View>
      <View style={styles.metricSpark} pointerEvents="none">
        <Sparkline data={series} color={color} width={scale(300)} height={scale(48)} />
      </View>
      <StatStrip items={footer.map((f) => ({ label: f.label, value: f.value }))} />
    </TouchableOpacity>
  );
}

/** The trend readout as a Chip: direction glyph + signed percentage. */
function TrendChip({ trend, label }: { trend: ReturnType<typeof trendOf>; label?: string }) {
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color = trend.direction === 'up' ? accent.success : trend.direction === 'down' ? accent.danger : accent.muted;
  const sign = trend.pctChange > 0 ? '+' : '';
  const text = `${sign}${trend.pctChange}%${label ? ` ${label}` : ''}`;
  return <Chip label={text} tint={color} selected icon={<Icon size={scale(14)} color={color} />} />;
}

/** Week-over-week change on a snapshot row, as a Chip. */
function DeltaChip({ delta, isFirst }: { delta: number; isFirst: boolean }) {
  if (isFirst) return <Chip label="start" style={styles.deltaChip} />;
  const up = delta > 0;
  const flat = delta === 0;
  const color = flat ? accent.muted : up ? accent.success : accent.danger;
  const text = `${up ? '+' : flat ? '' : '−'}$${Math.abs(Math.round(delta)).toLocaleString()}`;
  return <Chip label={text} tint={color} selected style={styles.deltaChip} />;
}

function SystemRow({ card, theme, darkMode, onPress }: { card: SystemCard; theme: Theme; darkMode: boolean; onPress: () => void }) {
  const meta = SYSTEM_META[card.id] ?? { Icon: Layers as IconType, color: accent.info };
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.label} detail`}
      style={[getGlassCard(darkMode, 6), styles.systemRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[getGlassIconContainer(darkMode, 42), styles.tintBubble, { backgroundColor: withAlpha(meta.color, 0.15), borderColor: withAlpha(meta.color, 0.3) }]}>
        <meta.Icon size={scale(20)} color={meta.color} />
      </View>
      <View style={styles.systemMid}>
        <View style={styles.systemTopRow}>
          <Text style={[styles.systemLabel, { color: theme.text }]} numberOfLines={1}>{card.label}</Text>
          {card.warning ? (
            <View style={styles.warnRow}>
              <AlertTriangle size={scale(11)} color={accent.warning} />
              <Text style={[styles.warnText, { color: accent.warning }]} numberOfLines={1}>{card.warning}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
          {card.lead.label} · {card.details.map((d) => `${d.label} ${d.value}`).slice(0, 2).join(' · ')}
        </Text>
      </View>
      <View style={styles.systemRight}>
        <Text style={[styles.systemLeadValue, { color: meta.color }]} numberOfLines={1}>{card.lead.value}</Text>
      </View>
      <ChevronRight size={scale(16)} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

function TimelineItem({
  milestone,
  isFirst,
  isLast,
  theme,
  reward,
  claimed,
  onClaim,
}: {
  milestone: Milestone;
  isFirst: boolean;
  isLast: boolean;
  theme: Theme;
  reward: number;
  claimed: boolean;
  onClaim: () => void;
}) {
  const cc = categoryColor(milestone.category);
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineLine, { backgroundColor: isFirst ? 'transparent' : theme.border, top: 0, height: scale(18) }]} />
        <View style={[styles.timelineDot, { backgroundColor: withAlpha(cc, 0.18), borderColor: cc }]}>
          <Sparkles size={scale(11)} color={cc} />
        </View>
        <View style={[styles.timelineLine, { backgroundColor: isLast ? 'transparent' : theme.border, top: scale(36), bottom: 0 }]} />
      </View>
      <View style={styles.timelineCard}>
        <Text style={[styles.cardName, { color: theme.text }]}>{milestone.label}</Text>
        <View style={styles.timelineMeta}>
          {milestone.context ? <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{milestone.context}</Text> : null}
          <View style={[styles.tag, { backgroundColor: withAlpha(cc, 0.14) }]}>
            <Text style={[styles.tagText, { color: cc }]}>{milestone.category}</Text>
          </View>
          {claimed ? (
            <View style={[styles.tag, styles.claimTagRow, { backgroundColor: withAlpha(accent.success, 0.14) }]}>
              <Text style={[styles.tagText, { color: accent.success }]}>Claimed +{reward}</Text>
              <Gem size={scale(10)} color={accent.success} />
            </View>
          ) : (
            <TouchableOpacity
              onPress={onClaim}
              accessibilityRole="button"
              accessibilityLabel={`Claim ${reward} gems for ${milestone.label}`}
              style={[styles.claimChip, styles.claimTagRow, { backgroundColor: withAlpha(accent.gold, 0.16), borderColor: withAlpha(accent.gold, 0.5) }]}
            >
              <Text style={[styles.claimChipText, { color: accent.gold }]}>Claim +{reward}</Text>
              <Gem size={scale(11)} color={accent.gold} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.systemDetailRow}>
      <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.cardSub, { color: theme.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

// =======================================================================
// Pure helpers
// =======================================================================

function safeNum(n: unknown, fb = 0): number {
  return typeof n === 'number' && isFinite(n) ? n : fb;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, isFinite(n) ? n : 0));
}

function signedYears(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${v > 0 ? '+' : ''}${v}y`;
}

/** Turn a raw job id ("software-engineer" / "softwareEngineer") into a title. */
function prettyJob(id: string): string {
  if (!id) return 'Role';
  return id
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Low / Avg / High footer for a metric sparkline. */
function metricRange(series: number[]): { label: string; value: string }[] {
  const clean = series.filter((v) => typeof v === 'number' && isFinite(v));
  if (clean.length === 0) return [{ label: 'Low', value: '-' }, { label: 'Avg', value: '-' }, { label: 'High', value: '-' }];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const avg = clean.reduce((a, b) => a + b, 0) / clean.length;
  return [
    { label: 'Low', value: `$${Math.round(min).toLocaleString()}` },
    { label: 'Avg', value: `$${Math.round(avg).toLocaleString()}` },
    { label: 'High', value: `$${Math.round(max).toLocaleString()}` },
  ];
}

function categoryColor(category: string): string {
  switch (category) {
    case 'wealth': return accent.gold;
    case 'career': return accent.info;
    case 'social': return accent.purple;
    case 'creative': return accent.success;
    case 'risk': return accent.danger;
    case 'family': return accent.warning;
    default: return accent.muted;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { marginHorizontal: sp.md, marginBottom: sp.sm },
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },

  // Generic card + section header
  card: { padding: sp.md, borderRadius: br.xl, borderWidth: 1, gap: sp.sm },
  sectionBody: { gap: sp.sm, paddingTop: sp.xs },
  chipRow: { flexDirection: 'row', gap: sp.sm, flexWrap: 'wrap' },
  tintBubble: { borderWidth: 1 },

  // Hero
  heroInner: { borderRadius: br['2xl'], overflow: 'hidden', padding: sp.lg, gap: sp.xs },
  heroLabel: { fontSize: fs.xs, fontWeight: '600', letterSpacing: 0.8 },
  heroValue: { fontSize: fs['3xl'], fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroSpark: { marginTop: sp.sm, marginHorizontal: -scale(4) },
  detailSpark: { marginTop: sp.md, alignItems: 'center' },
  trendRow: { marginTop: sp.xs, flexDirection: 'row' },
  peakRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.sm },
  peakLabel: { fontSize: fs.xs },
  peakValue: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Vitals rings
  vitalsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingVertical: sp.xs },
  vitalItem: { alignItems: 'center', gap: sp.sm },
  vitalValue: { fontSize: fs.lg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  vitalValueLg: { fontSize: fs['2xl'], fontWeight: '600', fontVariant: ['tabular-nums'] },
  vitalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vitalLabel: { fontSize: fs.xs, fontWeight: '600' },

  // Records
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, paddingVertical: sp.sm },
  recordRowValue: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Metric trend card
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  metricTitle: { fontSize: fs.sm, fontWeight: '600' },
  metricCurrent: { fontSize: fs.lg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  metricSpark: { marginHorizontal: -scale(2), alignItems: 'center' },

  // Nav / filter chips
  filterRow: { gap: sp.sm, paddingRight: sp.md, paddingVertical: 2 },

  // Money / counters

  // Systems
  summaryStrip: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  summaryStripValue: { fontSize: fs.lg, fontWeight: '600' },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, padding: sp.md, borderRadius: br.xl, borderWidth: 1 },
  systemMid: { flex: 1, gap: 2 },
  systemTopRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, flexWrap: 'wrap' },
  systemRight: { alignItems: 'flex-end', maxWidth: scale(96) },
  systemLabel: { fontSize: fs.md, fontWeight: '600', letterSpacing: 0.2 },
  systemLeadValue: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
  systemBigLead: { fontSize: fs['3xl'], fontWeight: '700', fontVariant: ['tabular-nums'] },
  systemDetailHead: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  systemDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailRows: { gap: sp.xs, marginTop: sp.xs },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  warnText: { fontSize: fs.xs, fontWeight: '600' },
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, padding: sp.sm, borderRadius: br.md, borderWidth: 1, marginTop: sp.xs },
  warnBannerText: { fontSize: fs.sm, fontWeight: '600', flex: 1 },

  // Snapshots
  snapRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingVertical: sp.sm },
  snapWeek: { fontSize: fs.sm, width: scale(72) },
  snapValue: { fontSize: fs.md, fontWeight: '600', fontVariant: ['tabular-nums'], flex: 1 },
  deltaChip: { minWidth: scale(76), justifyContent: 'center' },

  // Vitals / stat chips
  chipWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, marginTop: sp.xs },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: sp.sm, paddingVertical: scale(6), borderRadius: br.full, borderWidth: 1 },
  statChipValue: { fontSize: fs.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statChipLabel: { fontSize: fs.xs },

  // FIRE
  fireBody: { flexDirection: 'row', alignItems: 'center', gap: sp.lg },
  fireStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },

  // Life expectancy modifiers

  // Timeline
  timelineItem: { flexDirection: 'row', gap: sp.sm },
  timelineRail: { width: scale(28), alignItems: 'center' },
  timelineLine: { position: 'absolute', width: 2 },
  timelineDot: { width: scale(26), height: scale(26), borderRadius: scale(13), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: scale(10) },
  timelineCard: { flex: 1, paddingVertical: sp.sm, gap: 2 },
  timelineMeta: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, flexWrap: 'wrap' },

  // Career
  careerRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingVertical: sp.sm },

  // Misc
  cardName: { fontSize: fs.md, fontWeight: '600' },
  cardSub: { fontSize: fs.xs },
  tag: { paddingHorizontal: sp.sm, paddingVertical: 3, borderRadius: br.full },
  tagText: { fontSize: fs.xs, fontWeight: '600', textTransform: 'capitalize' },
  claimChip: { paddingHorizontal: sp.sm, paddingVertical: 3, borderRadius: br.full, borderWidth: 1 },
  claimChipText: { fontSize: fs.xs, fontWeight: '600' },
  // Icon+text layout for the Claim/Claimed chips (lucide Gem instead of 💎).
  claimTagRow: { flexDirection: 'row', alignItems: 'center', gap: scale(3) },
  recItem: { fontSize: fs.xs, marginTop: sp.xs },
  pastLifeRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingVertical: sp.sm },

  // Empty
});
