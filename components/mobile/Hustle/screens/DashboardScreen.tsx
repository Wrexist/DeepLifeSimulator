/**
 * DashboardScreen — multi-company overview (business-dashboard DNA).
 *
 * Top: hero KPI strip (total weekly revenue) with an SVG revenue-by-company
 * bar chart. Below: a KPI strip whose tiles each carry a mini chart, then a
 * Portfolio / Milestones segmented switch — Portfolio lists CompanyTile cards
 * with revenue bars; Milestones surfaces lifetime records. FAB founds a company.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import {
  AlertTriangle, Award, Briefcase, Building2, DollarSign, Megaphone, Plus,
  Rocket, TrendingUp, UserMinus, UserPlus, Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Gradient from '@/components/ui/Gradient';
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
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getGlassCard, getPlatformShadows } from '@/utils/glassmorphismStyles';
import { Z_INDEX } from '@/utils/zIndexConstants';
import KPICard from '../components/KPICard';
import CompanyTile from '../components/CompanyTile';
import EmptyState from '../components/EmptyState';
import { HUSTLE_GRADIENT, HUSTLE_COLORS } from '../styles/hustleTheme';
import { hustleHaptics } from '../utils/hustleHaptics';

const LinearGradient = Gradient;

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

  const series = useMemo(() => {
    // The bars must plot the same figure the tiles print — the stored
    // `weeklyIncome` is only the FIRST step of the payout chain.
    const revenue = companies.map((c) => companyWeeklyIncomeFor(gameState, c, 1));
    const employees = companies.map((c) => c.employees ?? 0);
    const share = companies.map((c) => overlays[c.id]?.marketSharePercent ?? 5);
    const brand = companies.map((c) => overlays[c.id]?.brand?.score ?? 50);
    return { revenue, employees, share, brand };
  }, [companies, overlays, gameState]);

  const totals = useMemo(() => {
    let employees = 0;
    let brandSum = 0;
    let shareSum = 0;
    let campaigns = 0;
    let scandals = 0;
    for (const c of companies) {
      // c.employees is the canonical headcount and already INCLUDES named
      // hires (hireCandidate/fireNamedHire keep it in sync) — never add
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

  const maxWeekly = useMemo(() => Math.max(...series.revenue, 1), [series.revenue]);

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
          observation="No companies yet."
          nudge="Found your first company to start building an empire."
        >
          <Pressable
            onPress={handleCreatePress}
            accessibilityRole="button"
            accessibilityLabel="Found a company"
          >
            <Text style={[styles.cta, { color: HUSTLE_GRADIENT[0] }]}>Found a company →</Text>
          </Pressable>
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]} showsVerticalScrollIndicator={false}>
        {/* Hero strip — Recipe B (identity indigo) */}
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
            <View pointerEvents="none" style={styles.heroGlow} />
            {isDark && <View pointerEvents="none" style={styles.heroHairline} />}
            <Text style={[styles.heroLabel, { color: theme.textMuted }]}>Empire snapshot</Text>
            <Text style={[styles.heroValue, { color: theme.text }]}>
              ${empire.paid.toLocaleString()}<Text style={[styles.heroSuffix, { color: theme.textSecondary }]}> / wk</Text>
            </Text>
            <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
              {companies.length} {companies.length === 1 ? 'company' : 'companies'} · {totals.employees} employees
              {totals.campaigns > 0 ? ` · ${totals.campaigns} campaign${totals.campaigns === 1 ? '' : 's'}` : ''}
              {totals.scandals > 0 ? ` · ${totals.scandals} scandal${totals.scandals === 1 ? '' : 's'}` : ''}
            </Text>
            {empire.lost > 0 ? (
              <Text style={[styles.heroDrag, { color: theme.textMuted }]}>
                Take-home. ${empire.gross.toLocaleString()}/wk earned, ${empire.lost.toLocaleString()} to{' '}
                {[
                  empire.managementDrag ? 'management overhead' : null,
                  empire.overCap ? `the $${(empire.cap / 1000).toFixed(0)}K/wk ceiling` : null,
                  empire.softCap < 1 ? `net-worth overhead (${Math.round(empire.softCap * 100)}% efficiency)` : null,
                ].filter(Boolean).join(' + ')}.
              </Text>
            ) : null}
            {companies.length > 1 ? (
              <View style={styles.heroChart} pointerEvents="none">
                <HeroRevenueBars data={series.revenue} color={HUSTLE_COLORS.accent} />
                <Text style={[styles.heroChartCaption, { color: theme.textMuted }]}>Weekly revenue by company</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* KPI grid — each tile carries a mini chart from real per-company data */}
        <View style={styles.kpiGrid}>
          <KPICard icon={DollarSign} label="Weekly" value={`$${(empire.paid / 1000).toFixed(1)}K`} accentColor={HUSTLE_COLORS.success} chart={series.revenue} caption={`${companies.length} co${companies.length === 1 ? '' : 's'}`} />
          <KPICard icon={Users} label="Employees" value={String(totals.employees)} chart={series.employees} />
          <KPICard icon={TrendingUp} label="Market" value={`${totals.share}%`} accentColor={HUSTLE_COLORS.accentSecondary} chart={series.share} />
          <KPICard icon={Briefcase} label="Brand" value={String(totals.brand)} chart={series.brand} caption={lifetime ? `peak ${lifetime.peakBrandScore}` : undefined} />
        </View>

        {/* Portfolio / Milestones switch */}
        <View style={[styles.segment, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(['portfolio', 'milestones'] as DashTab[]).map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => { hustleHaptics.tap(); setTab(t); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t === 'portfolio' ? 'Portfolio' : 'Milestones'}
                style={[styles.segmentBtn, active && { backgroundColor: HUSTLE_COLORS.accent + '29' }]}
              >
                <Text style={[styles.segmentText, { color: active ? HUSTLE_COLORS.accent : theme.textMuted }]}>
                  {t === 'portfolio' ? 'Portfolio' : 'Milestones'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'portfolio' ? (
          <>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>Your companies</Text>
            {companies.map((c) => (
              <CompanyTile key={c.id} company={c} overlay={overlays[c.id]} onPress={() => handleTilePress(c.id)} maxWeekly={maxWeekly} weekly={companyWeeklyIncomeFor(gameState, c, 1)} />
            ))}
          </>
        ) : (
          <MilestonesView theme={theme} isDark={isDark} lifetime={lifetime} />
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={handleCreatePress}
        accessibilityRole="button"
        accessibilityLabel="Create new company"
        hitSlop={8}
        style={({ pressed }) => [
          styles.fabTouch,
          // Lift the FAB above the floating phone tab bar (was hidden under it).
          { bottom: getAppScreenBottomPadding(insets.bottom) },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <LinearGradient
          colors={HUSTLE_GRADIENT as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Plus size={fontScale(24)} color="#FFFFFF" strokeWidth={2.6} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

/** Lifetime records — surfaces hustleApp.lifetimeStats (unused by the old UI). */
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
      <Text style={[styles.sectionLabel, { color: theme.text }]}>Lifetime totals</Text>
      <View style={styles.kpiGrid}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <View
              key={s.label}
              style={[getGlassCard(isDark, 6), styles.milestoneCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
            >
              <View style={styles.milestoneIconRow}>
                <View style={[styles.milestoneBubble, { backgroundColor: s.color + '26', borderColor: s.color + '4D' }]}>
                  <Icon size={fontScale(14)} color={s.color} strokeWidth={2.4} />
                </View>
                <Text style={[styles.milestoneLabel, { color: theme.textSecondary }]} numberOfLines={2}>{s.label}</Text>
              </View>
              <Text style={[styles.milestoneValue, { color: theme.text }]}>{s.value.toLocaleString()}</Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text }]}>Records</Text>
      <View style={[getGlassCard(isDark, 6), styles.recordsCard, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
        {records.map((r, i) => (
          <View key={r.label} style={[styles.recordRow, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.recordMedal, { backgroundColor: HUSTLE_COLORS.warning + '26', borderColor: HUSTLE_COLORS.warning + '4D' }]}>
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
  cta: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
    paddingBottom: scale(120),
  },
  hero: {
    borderRadius: responsiveBorderRadius['2xl'],
    marginBottom: responsiveSpacing.md,
  },
  heroInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    padding: responsiveSpacing.lg,
  },
  heroGlow: {
    position: 'absolute',
    top: -scale(48),
    right: -scale(36),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(99, 102, 241, 0.10)',
  },
  heroHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: fontScale(36),
    fontWeight: '800',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroSuffix: {
    fontSize: fontScale(18),
    fontWeight: '500',
  },
  heroSub: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  heroDrag: {
    fontSize: fontScale(11),
    marginTop: 6,
    lineHeight: fontScale(15),
  },
  heroChart: {
    marginTop: responsiveSpacing.sm,
  },
  heroChartCaption: {
    fontSize: fontScale(10),
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.full,
    borderWidth: 1,
    padding: 3,
    marginBottom: responsiveSpacing.md,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsiveSpacing.sm,
    borderRadius: responsiveBorderRadius.full,
    minHeight: scale(38),
  },
  segmentText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionLabel: {
    fontSize: fontScale(15),
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: responsiveSpacing.sm,
    marginTop: responsiveSpacing.sm,
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
    fontSize: fontScale(10),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  milestoneValue: {
    fontSize: fontScale(22),
    fontWeight: '800',
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
    fontWeight: '600',
  },
  recordValue: {
    fontSize: fontScale(15),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  fabTouch: {
    position: 'absolute',
    bottom: scale(20),
    right: scale(20),
    width: touchTargets.large,
    height: touchTargets.large,
    borderRadius: touchTargets.large / 2,
    zIndex: Z_INDEX.DROPDOWN,
    ...getPlatformShadows(5, 0.3, 2, 8),
  },
  fab: {
    flex: 1,
    borderRadius: touchTargets.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
