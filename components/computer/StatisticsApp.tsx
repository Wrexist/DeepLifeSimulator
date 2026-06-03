/**
 * StatisticsApp — full rewrite (Remake 14).
 *
 * Previous app was 1,623 LOC that read only `lifetimeStatistics`,
 * `achievements`, and `previousLives`, and had ~4 dead tabs (Systems /
 * Interconnections / Discovery / Trends that rendered nothing). It ignored
 * the rich state every other remake created.
 *
 * The remake collapses 11 tabs to 4 focused ones and exposes cross-system
 * data through pure libs:
 *   - lib/statistics/crossSystemSummary.ts → banking / crypto / stocks / etc.
 *   - lib/statistics/milestones.ts          → derived life events
 *   - lib/statistics/trends.ts              → net-worth / earnings direction
 *   - lib/statistics/fireTracker.ts         → existing FIRE math (kept)
 *   - lib/statistics/lifeExpectancy.ts      → existing (kept)
 *   - lib/statistics/retirementCalculator.ts→ existing (kept)
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ArrowLeft,
  Activity,
  Trophy,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  PieChart,
  AlertTriangle,
} from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { calculateLifeExpectancy } from '@/lib/statistics/lifeExpectancy';
import { calculateFIRETracker } from '@/lib/statistics/fireTracker';
import { calculateRetirementPlanning } from '@/lib/statistics/retirementCalculator';
import { buildCrossSystemSummary, SystemCard } from '@/lib/statistics/crossSystemSummary';
import { buildMilestones } from '@/lib/statistics/milestones';
import { trendOf } from '@/lib/statistics/trends';
import { aggregateContacts, contactCountsByKind } from '@/lib/contacts/aggregator';
import { getThemeColors, accent } from '@/lib/config/theme';
import {
  responsiveFontSize as fs,
  responsiveSpacing as sp,
  responsiveBorderRadius as br,
  scale,
} from '@/utils/scaling';

type TabType = 'overview' | 'systems' | 'milestones' | 'planning';

interface Props {
  onBack: () => void;
}

export default function StatisticsApp({ onBack }: Props) {
  const { gameState } = useGame();
  const darkMode = !!gameState.settings?.darkMode;
  const theme = getThemeColors(darkMode);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const lifetime = gameState.lifetimeStatistics ?? {};
  const week = gameState.weeksLived || 0;

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
  const netWorthTrend = useMemo(
    () => trendOf((lifetime as any).netWorthHistory),
    [lifetime]
  );
  const earningsTrend = useMemo(
    () => trendOf((lifetime as any).weeklyEarningsHistory),
    [lifetime]
  );

  const lifeExp = useMemo(() => calculateLifeExpectancy(gameState), [gameState]);
  const fire = useMemo(() => calculateFIRETracker(gameState), [gameState]);
  const retirement = useMemo(() => calculateRetirementPlanning(gameState, 65), [gameState]);
  const retirementOnTrack = retirement.savingsGap <= 0;

  const renderOverview = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>Net worth</Text>
        <Text style={[styles.heroValue, { color: theme.text }]}>
          ${Math.round(netWorth).toLocaleString()}
        </Text>
        <View style={styles.trendRow}>
          <TrendBadge trend={netWorthTrend} theme={theme} label="vs prior weeks" />
        </View>
        <View style={styles.peakRow}>
          <Text style={[styles.peakLabel, { color: theme.textSecondary }]}>Peak</Text>
          <Text style={[styles.peakValue, { color: accent.gold }]}>
            ${Math.round(((lifetime as any).peakNetWorth ?? netWorth)).toLocaleString()}
          </Text>
          {((lifetime as any).peakNetWorthWeek) ? (
            <Text style={[styles.peakLabel, { color: theme.textSecondary }]}>
              week {(lifetime as any).peakNetWorthWeek}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Lifetime money</Text>
        <View style={styles.statsRow}>
          <MoneyStat label="Earned" value={`$${Math.round(((lifetime as any).totalMoneyEarned ?? 0)).toLocaleString()}`} color={accent.success} theme={theme} />
          <MoneyStat label="Spent" value={`$${Math.round(((lifetime as any).totalMoneySpent ?? 0)).toLocaleString()}`} color={accent.danger} theme={theme} />
          <MoneyStat
            label="Top salary"
            value={`$${Math.round(((lifetime as any).highestSalary ?? 0)).toLocaleString()}`}
            color={accent.info}
            theme={theme}
          />
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Income velocity</Text>
        <TrendBadge trend={earningsTrend} theme={theme} label="weekly earnings" />
        <View style={styles.statsRow}>
          <MoneyStat
            label="Recent avg"
            value={`$${earningsTrend.recentAverage.toLocaleString()}/wk`}
            color={accent.success}
            theme={theme}
          />
          <MoneyStat
            label="Sample"
            value={`${earningsTrend.sampleSize}wk`}
            color={accent.info}
            theme={theme}
          />
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Life snapshot</Text>
        <View style={styles.gridRow}>
          <Counter label="Companies" value={(lifetime as any).totalCompaniesOwned ?? 0} theme={theme} />
          <Counter label="Properties" value={(lifetime as any).totalPropertiesOwned ?? 0} theme={theme} />
          <Counter label="Relationships" value={(lifetime as any).totalRelationships ?? 0} theme={theme} />
        </View>
        <View style={styles.gridRow}>
          <Counter label="Children" value={(lifetime as any).totalChildren ?? 0} theme={theme} />
          <Counter label="Destinations" value={(lifetime as any).totalTravelDestinations ?? 0} theme={theme} />
          <Counter label="Posts" value={(lifetime as any).totalPostsMade ?? 0} theme={theme} />
        </View>
      </View>

      {summary.netFavorMoney !== 0 ? (
        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: theme.surface,
              borderColor: summary.netFavorMoney >= 0 ? accent.success : accent.danger,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Open IOUs</Text>
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

  const renderSystems = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      {summary.cards.length === 0 ? (
        <View style={styles.empty}>
          <Layers size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No system data yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Play through the other apps and metrics will populate here.
          </Text>
        </View>
      ) : (
        summary.cards.map((card) => <SystemCardView key={card.id} card={card} theme={theme} />)
      )}
    </ScrollView>
  );

  const renderMilestones = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      {milestones.length === 0 ? (
        <View style={styles.empty}>
          <Trophy size={scale(48)} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No milestones yet</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            Cross thresholds and they'll appear here.
          </Text>
        </View>
      ) : (
        milestones.map((m) => (
          <View
            key={m.id}
            style={[styles.milestoneCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.milestoneIcon, { backgroundColor: categoryColor(m.category) }]}>
              <Sparkles size={scale(14)} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: theme.text }]}>{m.label}</Text>
              {m.context ? (
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{m.context}</Text>
              ) : null}
            </View>
            <View style={[styles.tag, { borderColor: categoryColor(m.category) }]}>
              <Text style={[styles.tagText, { color: categoryColor(m.category) }]}>{m.category}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderPlanning = () => (
    <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollPad}>
      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Life expectancy</Text>
        <View style={styles.statsRow}>
          <MoneyStat label="Total" value={`${Math.round(lifeExp.totalLifeExpectancy)}y`} color={accent.info} theme={theme} />
          <MoneyStat label="Remaining" value={`${Math.round(lifeExp.yearsRemaining)}y`} color={accent.success} theme={theme} />
        </View>
        {lifeExp.recommendations.slice(0, 3).map((r, i) => (
          <Text key={i} style={[styles.recItem, { color: theme.textSecondary }]}>• {r}</Text>
        ))}
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>FIRE tracker</Text>
        <View style={styles.statsRow}>
          <MoneyStat label="Number" value={`$${Math.round(fire.fireNumber).toLocaleString()}`} color={accent.gold} theme={theme} />
          <MoneyStat label="Progress" value={`${Math.round(fire.progressToFIRE)}%`} color={accent.success} theme={theme} />
          <MoneyStat
            label="Years"
            value={isFinite(fire.yearsToFIRE) ? `${Math.max(0, Math.round(fire.yearsToFIRE))}y` : '—'}
            color={accent.info}
            theme={theme}
          />
        </View>
        <View style={[styles.fireBar, { backgroundColor: theme.surfaceElevated }]}>
          <View
            style={[
              styles.fireFill,
              { width: `${Math.min(100, fire.progressToFIRE)}%`, backgroundColor: accent.success },
            ]}
          />
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Retirement plan (age 65)</Text>
        <View style={styles.statsRow}>
          <MoneyStat
            label="Required"
            value={`$${Math.round(retirement.requiredNetWorth).toLocaleString()}`}
            color={accent.purple}
            theme={theme}
          />
          <MoneyStat
            label="Gap"
            value={`$${Math.round(Math.abs(retirement.savingsGap)).toLocaleString()}`}
            color={retirementOnTrack ? accent.success : accent.warning}
            theme={theme}
          />
          <MoneyStat
            label="Status"
            value={retirementOnTrack ? 'On track' : 'Behind'}
            color={retirementOnTrack ? accent.success : accent.warning}
            theme={theme}
          />
        </View>
        <Text style={[styles.recItem, { color: theme.textSecondary }]}>
          • Save ${Math.round(retirement.monthlySavingsNeeded).toLocaleString()}/mo to close the gap
        </Text>
        <Text style={[styles.recItem, { color: theme.textSecondary }]}>
          • Assumes {retirement.assumptions.expectedReturnRate}% returns, {retirement.assumptions.inflationRate}% inflation
        </Text>
      </View>

      {(gameState as any).previousLives?.length ? (
        <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Past lives</Text>
          {(gameState as any).previousLives.slice(0, 5).map((pl: any, idx: number) => (
            <View key={idx} style={styles.pastLifeRow}>
              <Text style={[styles.cardName, { color: theme.text }]}>Life {idx + 1}</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Net worth ${Math.round(pl.peakNetWorth ?? 0).toLocaleString()} · {pl.totalRelationships ?? 0} relationships
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <ArrowLeft size={scale(18)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Statistics</Text>
        <Text style={[styles.headerCash, { color: theme.textSecondary }]}>Wk {week}</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {[
          { id: 'overview' as TabType, label: 'Overview', Icon: Activity },
          { id: 'systems' as TabType, label: 'Systems', Icon: Layers },
          { id: 'milestones' as TabType, label: 'Milestones', Icon: Trophy },
          { id: 'planning' as TabType, label: 'Planning', Icon: PieChart },
        ].map(({ id, label, Icon }) => (
          <TouchableOpacity
            key={id}
            onPress={() => setActiveTab(id)}
            style={[
              styles.tabBtn,
              activeTab === id && { borderBottomColor: accent.info, borderBottomWidth: 2 },
            ]}
          >
            <Icon size={scale(14)} color={activeTab === id ? accent.info : theme.textSecondary} />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === id ? accent.info : theme.textSecondary },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'systems' && renderSystems()}
      {activeTab === 'milestones' && renderMilestones()}
      {activeTab === 'planning' && renderPlanning()}
    </View>
  );
}

function TrendBadge({
  trend,
  theme,
  label,
}: {
  trend: ReturnType<typeof trendOf>;
  theme: ReturnType<typeof getThemeColors>;
  label: string;
}) {
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color =
    trend.direction === 'up' ? accent.success : trend.direction === 'down' ? accent.danger : accent.muted;
  const sign = trend.pctChange > 0 ? '+' : '';
  return (
    <View style={styles.trendBadgeRow}>
      <Icon size={scale(14)} color={color} />
      <Text style={[styles.trendText, { color }]}>
        {sign}{trend.pctChange}%
      </Text>
      <Text style={[styles.trendLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function SystemCardView({
  card,
  theme,
}: {
  card: SystemCard;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View
      style={[
        styles.systemCard,
        {
          backgroundColor: theme.surface,
          borderColor: card.warning ? accent.warning : theme.border,
        },
      ]}
    >
      <View style={styles.systemHeader}>
        <Text style={[styles.systemLabel, { color: theme.text }]}>{card.label}</Text>
        {card.warning ? (
          <View style={styles.warnRow}>
            <AlertTriangle size={scale(12)} color={accent.warning} />
            <Text style={[styles.warnText, { color: accent.warning }]}>{card.warning}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.systemLead, { color: theme.text }]}>{card.lead.value}</Text>
      <Text style={[styles.systemLeadLabel, { color: theme.textSecondary }]}>{card.lead.label}</Text>
      <View style={styles.systemDetails}>
        {card.details.map((d) => (
          <View key={d.label} style={styles.systemDetailRow}>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{d.label}</Text>
            <Text style={[styles.cardSub, { color: theme.text, fontWeight: '700' }]}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MoneyStat({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.moneyStat}>
      <Text
        style={[styles.moneyValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
      <Text style={[styles.moneyLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

function Counter({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.counterLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
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
  flex1: { flex: 1 },
  scrollPad: { padding: sp.md, gap: sp.md, paddingBottom: sp['3xl'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fs.xl, fontWeight: '800' },
  headerCash: { fontSize: fs.sm, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: sp.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: sp.xs },
  tabText: { fontSize: fs.sm, fontWeight: '700' },
  heroCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.xs },
  heroLabel: { fontSize: fs.xs },
  heroValue: { fontSize: fs['3xl'], fontWeight: '800' },
  trendRow: { marginTop: sp.xs },
  trendBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  trendText: { fontSize: fs.sm, fontWeight: '800' },
  trendLabel: { fontSize: fs.xs },
  peakRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, marginTop: sp.sm },
  peakLabel: { fontSize: fs.xs },
  peakValue: { fontSize: fs.md, fontWeight: '800' },
  statsCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.sm },
  sectionTitle: { fontSize: fs.sm, fontWeight: '800', textTransform: 'uppercase' },
  // Wrap so 3-up money rows can drop to 2-per-row when long $ values would
  // truncate at ~115pt. flexBasis 32% keeps 3-up when content is short.
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: sp.xs },
  moneyStat: { alignItems: 'center', flexBasis: '30%', flexGrow: 1, minWidth: scale(96) },
  moneyValue: { fontSize: fs.lg, fontWeight: '800' },
  moneyLabel: { fontSize: fs.xs, marginTop: 2 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: sp.xs },
  counter: { alignItems: 'center', flex: 1 },
  counterValue: { fontSize: fs.lg, fontWeight: '800' },
  counterLabel: { fontSize: fs.xs, marginTop: 2 },
  systemCard: { padding: sp.md, borderRadius: br.lg, borderWidth: 1, gap: sp.xs },
  systemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  systemLabel: { fontSize: fs.sm, fontWeight: '800', textTransform: 'uppercase' },
  systemLead: { fontSize: fs['2xl'], fontWeight: '800' },
  systemLeadLabel: { fontSize: fs.xs },
  systemDetails: { marginTop: sp.xs, gap: sp.xs },
  systemDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  warnText: { fontSize: fs.xs, fontWeight: '700' },
  cardName: { fontSize: fs.sm, fontWeight: '800' },
  cardSub: { fontSize: fs.xs },
  milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.md, borderRadius: br.lg, borderWidth: 1 },
  milestoneIcon: { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: sp.xs, paddingVertical: 2, borderRadius: br.full, borderWidth: 1 },
  tagText: { fontSize: fs.xs, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sp.lg, gap: sp.sm },
  emptyTitle: { fontSize: fs.lg, fontWeight: '800' },
  emptySub: { fontSize: fs.sm, textAlign: 'center' },
  recItem: { fontSize: fs.xs, marginTop: sp.xs },
  fireBar: { height: scale(8), borderRadius: br.full, overflow: 'hidden', marginTop: sp.xs },
  fireFill: { height: '100%', borderRadius: br.full },
  pastLifeRow: { paddingVertical: sp.xs },
});
