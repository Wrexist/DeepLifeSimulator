/**
 * DashboardScreen - multi-company overview.
 *
 * The landing surface is ONE headline (what the empire actually pays into the
 * weekly paycheck), one sentence explaining the drag between what it earns and
 * what it banks, the revenue-by-company bars, and a three-tile strip. It used
 * to print ~10 numbers before the first company row: the headline, a sub line,
 * the drag sentence, the chart AND four KPI cards that each carried their own
 * mini chart. The four cards are the strip now, without the sparklines - the
 * same data, read in one pass.
 *
 * Founding a company is a once-per-life action, so it is a chip on the
 * "Your companies" heading rather than a floating gradient FAB parked over the
 * list; the empty state's CTA already covers the first one.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import {
  AlertTriangle, Award, Briefcase, Building2, DollarSign, Megaphone, Plus,
  Rocket, UserMinus, UserPlus,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import SectionTitle from '@/components/ui/SectionTitle';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip, { StatTile } from '@/components/ui/StatStrip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import {
  calcCompanyWeeklyIncome,
  companyIncomePaidWeekly,
  companyWeeklyIncomeFor,
  managementLevels,
  passiveIncomeEfficiency,
} from '@/lib/economy/passiveIncome';
import { netWorth } from '@/lib/progress/achievements';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import CompanyTile from '../components/CompanyTile';
import { HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

interface DashboardScreenProps {
  onOpenCompany: (companyId: string) => void;
  onCreateCompany: () => void;
}

type DashTab = 'portfolio' | 'milestones';

/** Hero revenue-by-company bars (real per-company weekly income). */
function HeroRevenueBars({ data, color }: { data: number[]; color: string }) {
  const vals = data.filter((v) => Number.isFinite(v) && v >= 0);
  if (vals.length === 0) return null;
  const max = Math.max(...vals, 1);
  const n = Math.min(vals.length, 12);
  const shown = vals.slice(0, n);
  const gap = 4;
  const bw = (100 - gap * (n - 1)) / n;
  return (
    <Svg width="100%" height={scale(38)} viewBox="0 0 100 40" preserveAspectRatio="none">
      {shown.map((v, i) => {
        const ratio = v / max;
        const h = Math.max(3, ratio * 40);
        return (
          <Rect key={i} x={i * (bw + gap)} y={40 - h} width={bw} height={h} fill={color} opacity={0.45 + 0.55 * ratio} />
        );
      })}
    </Svg>
  );
}

export default function DashboardScreen({ onOpenCompany, onCreateCompany }: DashboardScreenProps) {
  const { gameState } = useGame();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<DashTab>('portfolio');

  const companies = gameState.companies ?? [];
  const overlays = gameState.hustleApp?.companies ?? {};
  const lifetime = gameState.hustleApp?.lifetimeStats;

  // The bars must plot the same figure the tiles print - the stored
  // `weeklyIncome` is only the FIRST step of the payout chain. The per-company
  // employee/share/brand series the four KPI sparklines used are gone with them.
  const revenueSeries = useMemo(
    () => companies.map((c) => companyWeeklyIncomeFor(gameState, c, 1)),
    [companies, gameState],
  );

  const totals = useMemo(() => {
    let employees = 0;
    let brandSum = 0;
    let shareSum = 0;
    let campaigns = 0;
    let scandals = 0;
    for (const c of companies) {
      // c.employees is the canonical headcount and already INCLUDES named
      // hires (hireCandidate/fireNamedHire keep it in sync) - never add
      // overlay.hiringPipeline.namedHires.length on top of this.
      employees += c.employees ?? 0;
      const o = overlays[c.id];
      if (o) {
        brandSum += o.brand?.score ?? 50;
        shareSum += o.marketSharePercent ?? 5;
        campaigns += o.activeCampaigns?.filter((x) => x.active).length ?? 0;
        if (o.activeScandal) scandals += 1;
      } else {
        brandSum += 50;
        shareSum += 5;
      }
    }
    return {
      employees,
      campaigns,
      scandals,
      brand: companies.length > 0 ? Math.round(brandSum / companies.length) : 0,
      share: companies.length > 0 ? +(shareSum / companies.length).toFixed(1) : 0,
    };
  }, [companies, overlays]);

  /**
   * What the empire actually pays into the weekly paycheck.
   *
   * The headline used to be `sum(company.weeklyIncome)`, which is the stored
   * base before EVERY step of the payout chain: the family-brand and legacy
   * multipliers, the political business perk, government contracts, the Hustle
   * overlay multiplier, the portfolio-size management penalty, the $200K/wk
   * ceiling and the net-worth soft cap. A tycoon whose companies stored
   * $360K/wk read "$360,000 / wk" here and banked a fraction of it, with
   * nothing on screen accounting for the difference. Both drags are named
   * below the number now.
   */
  const empire = useMemo(() => {
    const company = calcCompanyWeeklyIncome(gameState);
    const softCap = passiveIncomeEfficiency(netWorth(gameState), managementLevels(gameState.companies));
    const paid = companyIncomePaidWeekly(gameState);
    return {
      gross: company.afterBonuses,
      paid,
      lost: Math.max(0, company.afterBonuses - paid),
      overCap: company.afterEfficiency > company.cap,
      cap: company.cap,
      managementDrag: company.efficiency < 1,
      softCap,
    };
  }, [gameState]);

  const maxWeekly = useMemo(() => Math.max(...revenueSeries, 1), [revenueSeries]);

  const handleTilePress = useCallback((id: string) => {
    hustleHaptics.tap();
    onOpenCompany(id);
  }, [onOpenCompany]);

  const handleCreatePress = useCallback(() => {
    hustleHaptics.commit();
    onCreateCompany();
  }, [onCreateCompany]);

  if (companies.length === 0) {
    return (
      <View style={styles.emptyRoot}>
        <EmptyState
          icon={<Building2 size={fontScale(26)} color={HUSTLE_COLORS.accent} />}
          observation="You don't run any companies yet."
          nudge="Found your first one to start building an empire."
          ctaLabel="Found a company"
          onCtaPress={handleCreatePress}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {/* Hero - the ONE number, one sentence about it, and the bars. */}
        <View
          style={[
            getGlassCard(isDark, 12),
            styles.hero,
            {
              backgroundColor: theme.surface,
              borderColor: isDark ? theme.glassBorder : theme.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.heroInner}>
            <StatTile
              hero
              align="left"
              label="Take-home per week"
              value={`$${empire.paid.toLocaleString()}`}
              sub={
                empire.lost > 0
                  ? `$${empire.gross.toLocaleString()} earned · $${empire.lost.toLocaleString()} to ${[
                      empire.managementDrag ? 'management overhead' : null,
                      empire.overCap ? `the $${(empire.cap / 1000).toFixed(0)}K/wk ceiling` : null,
                      empire.softCap < 1 ? `net-worth overhead (${Math.round(empire.softCap * 100)}%)` : null,
                    ].filter(Boolean).join(' + ')}`
                  : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'}${
                      totals.campaigns > 0 ? ` · ${totals.campaigns} campaign${totals.campaigns === 1 ? '' : 's'}` : ''
                    }${totals.scandals > 0 ? ` · ${totals.scandals} scandal${totals.scandals === 1 ? '' : 's'}` : ''}`
              }
            />
            {companies.length > 1 ? (
              <View style={styles.heroChart} pointerEvents="none">
                <HeroRevenueBars data={revenueSeries} color={HUSTLE_COLORS.accent} />
                <Text style={[styles.heroChartCaption, { color: theme.textMuted }]}>Weekly revenue by company</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* The three numbers you steer on. The weekly figure is the hero above;
            the per-tile sparklines are the bar chart, once. */}
        <StatStrip
          items={[
            { label: 'Employees', value: totals.employees },
            { label: 'Market share', value: `${totals.share}%`, tint: HUSTLE_COLORS.accentSecondary },
            { label: 'Brand', value: totals.brand, sub: lifetime ? `peak ${lifetime.peakBrandScore}` : undefined },
          ]}
          style={styles.strip}
        />

        <SegmentedControl<DashTab>
          segments={[
            { key: 'portfolio', label: 'Portfolio' },
            { key: 'milestones', label: 'Milestones' },
          ]}
          value={tab}
          onChange={(t) => { hustleHaptics.tap(); setTab(t); }}
          activeColor={HUSTLE_COLORS.accent}
          style={styles.segment}
        />

        {tab === 'portfolio' ? (
          <>
            <SectionTitle
              title="Your companies"
              right={
                <Chip
                  label="Found a company"
                  icon={<Plus size={fontScale(12)} color={HUSTLE_COLORS.accent} />}
                  tint={HUSTLE_COLORS.accent}
                  selected
                  size="md"
                  onPress={handleCreatePress}
                />
              }
            />
            {companies.map((c) => (
              <CompanyTile key={c.id} company={c} overlay={overlays[c.id]} onPress={() => handleTilePress(c.id)} maxWeekly={maxWeekly} weekly={companyWeeklyIncomeFor(gameState, c, 1)} />
            ))}
          </>
        ) : (
          <MilestonesView theme={theme} isDark={isDark} lifetime={lifetime} />
        )}
      </ScrollView>
    </View>
  );
}

/** Lifetime records - surfaces hustleApp.lifetimeStats (unused by the old UI). */
function MilestonesView({ theme, isDark, lifetime }: { theme: any; isDark: boolean; lifetime: any }) {
  const stats: { icon: any; label: string; value: number; color: string }[] = [
    { icon: Building2, label: 'Founded', value: lifetime?.totalCompaniesFounded ?? 0, color: HUSTLE_COLORS.accent },
    { icon: DollarSign, label: 'Sold', value: lifetime?.totalCompaniesSold ?? 0, color: HUSTLE_COLORS.success },
    { icon: Rocket, label: 'IPOs', value: lifetime?.totalIPOsLaunched ?? 0, color: HUSTLE_COLORS.accentSecondary },
    { icon: Briefcase, label: 'Acquisitions', value: lifetime?.totalAcquisitionsCompleted ?? 0, color: HUSTLE_COLORS.factory },
    { icon: AlertTriangle, label: 'Scandals survived', value: lifetime?.totalScandalsSurvived ?? 0, color: HUSTLE_COLORS.warning },
    { icon: Megaphone, label: 'Campaigns run', value: lifetime?.totalCampaignsRun ?? 0, color: HUSTLE_COLORS.accentSecondary },
    { icon: UserPlus, label: 'Key hires', value: lifetime?.totalNamedHires ?? 0, color: HUSTLE_COLORS.accent },
    { icon: UserMinus, label: 'Fires', value: lifetime?.totalFires ?? 0, color: HUSTLE_COLORS.danger },
  ];
  const records: { label: string; value: string }[] = [
    { label: 'Peak brand', value: String(lifetime?.peakBrandScore ?? 0) },
    { label: 'Peak market share', value: `${(lifetime?.peakMarketShare ?? 0).toFixed(1)}%` },
    { label: 'Peak share price', value: `$${(lifetime?.peakSharePrice ?? 0).toFixed(2)}` },
  ];
  return (
    <>
      <SectionTitle title="Lifetime totals" />
      <View style={styles.milestoneGrid}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <View
              key={s.label}
              style={[getGlassCard(isDark, 6), styles.milestoneCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            >
              <View style={styles.milestoneIconRow}>
                <View style={[styles.milestoneBubble, { backgroundColor: withAlpha(s.color, 0.15), borderColor: withAlpha(s.color, 0.3) }]}>
                  <Icon size={fontScale(14)} color={s.color} strokeWidth={2.4} />
                </View>
                <Text style={[styles.milestoneLabel, { color: theme.textSecondary }]} numberOfLines={2}>{s.label}</Text>
              </View>
              <Text style={[styles.milestoneValue, { color: theme.text }]}>{s.value.toLocaleString()}</Text>
            </View>
          );
        })}
      </View>

      <SectionTitle title="Records" />
      <View style={[getGlassCard(isDark, 6), styles.recordsCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
        {records.map((r, i) => (
          <View key={r.label} style={[styles.recordRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.recordMedal, { backgroundColor: withAlpha(HUSTLE_COLORS.warning, 0.15), borderColor: withAlpha(HUSTLE_COLORS.warning, 0.3) }]}>
              <Award size={fontScale(14)} color={HUSTLE_COLORS.warning} strokeWidth={2.4} />
            </View>
            <Text style={[styles.recordLabel, { color: theme.text }]}>{r.label}</Text>
            <Text style={[styles.recordValue, { color: theme.text }]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  emptyRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: scale(120),
  },
  hero: {
    borderRadius: responsiveBorderRadius['2xl'],
    marginBottom: responsiveSpacing.sm,
  },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroChart: {
    marginTop: responsiveSpacing.sm,
  },
  heroChartCaption: {
    fontSize: fontScale(10),
    marginTop: 3,
  },
  strip: {
    marginBottom: responsiveSpacing.sm,
  },
  segment: {
    marginBottom: responsiveSpacing.sm,
  },
  milestoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  milestoneCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: scale(72),
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    gap: 6,
  },
  milestoneIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneBubble: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(7),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneLabel: {
    flex: 1,
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  milestoneValue: {
    fontSize: fontScale(22),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  recordsCard: {
    borderRadius: responsiveBorderRadius.xl,
    paddingHorizontal: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  recordMedal: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: {
    flex: 1,
    fontSize: fontScale(13),
    fontWeight: '500',
  },
  recordValue: {
    fontSize: fontScale(15),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
