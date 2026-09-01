/**
 * CompanyTile - dashboard card for a single company.
 *
 * Business-dashboard DNA: a revenue BAR (this company's weekly income vs the
 * portfolio leader) headlines the tile, with a lift chip over its base income,
 * a denser stat strip (brand bar, share, cash, marketing, campaigns) and a
 * visible "Manage" affordance so the whole card reads as tappable. Tap → detail.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Briefcase, Building2, ChevronRight, DollarSign, Factory, Megaphone, Utensils, Landmark } from 'lucide-react-native';
import Chip from '@/components/ui/Chip';
import ProgressBar from '@/components/ui/ProgressBar';
import { useTheme } from '@/hooks/useTheme';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { industryColor, HUSTLE_COLORS } from '../styles/hustleTheme';
import type { Company, HustleCompanyOverlay } from '@/contexts/game/types';
import { companyIncomeFactors } from '@/lib/business/hustleLogic';

const INDUSTRY_ICON: Record<string, any> = {
  factory: Factory,
  ai: Briefcase,           // no Brain icon in lucide-react-native default exports across versions; Briefcase is safe
  restaurant: Utensils,
  realestate: Building2,
  bank: Landmark,
};

interface CompanyTileProps {
  company: Company;
  overlay: HustleCompanyOverlay | undefined;
  onPress: () => void;
  /** Highest weekly income across the portfolio - scales the revenue bar. */
  maxWeekly?: number;
  /**
   * This company's contribution to the paycheck, from the tick's own
   * `companyWeeklyIncomeFor`. Passed in because the full chain needs the whole
   * GameState (family brand, political perks, government contracts) and this
   * tile is presentational. Falls back to the overlay-only figure when absent.
   */
  weekly?: number;
}

export default function CompanyTile({ company, overlay, onPress, maxWeekly, weekly: weeklyProp }: CompanyTileProps) {
  const { theme, isDark } = useTheme();
  const Icon = INDUSTRY_ICON[company.type] ?? Building2;
  const color = industryColor(company.type);
  const brand = overlay?.brand?.score ?? 50;
  const scandal = overlay?.activeScandal;
  const isPublic = overlay?.ipo?.status === 'public';

  // EFFECTIVE weekly income - what the player is actually paid - not the raw
  // stored `weeklyIncome`.
  //
  // Three separate player reports (brand/share do nothing, key hires do
  // nothing, acquisitions change nothing) were all this one line. Those four
  // features feed `companyIncomeFactors`, which `calcWeeklyPassiveIncome`
  // applies at PAYOUT; none of them writes `company.weeklyIncome`. So the card
  // showed a number that could not move no matter what the player did - two
  // restaurants at 10.8% and 32.9% share rendered identically.
  // `companyIncomeFactors` is only ONE step of that chain, though - the family
  // brand and legacy multipliers, the political business perk and government
  // contracts also land at payout. `weeklyProp` carries the tick's own answer
  // (`companyWeeklyIncomeFor`); the local expression is the fallback for callers
  // that have no GameState to hand.
  const stored = company.weeklyIncome ?? 0;
  const base = company.baseWeeklyIncome ?? 0;
  const factors = companyIncomeFactors(overlay);
  const weekly = typeof weeklyProp === 'number' && Number.isFinite(weeklyProp) && weeklyProp >= 0
    ? weeklyProp
    : Math.round(stored * factors.multiplier);
  const lift = Math.max(0, weekly - base);
  const peak = Math.max(maxWeekly ?? weekly, weekly, 1);
  const revPct = Math.max(4, Math.min(100, (weekly / peak) * 100));
  const share = overlay?.marketSharePercent ?? 5;
  const campaigns = overlay?.activeCampaigns?.filter((c) => c.active).length ?? 0;
  // Weekly payroll for the named-hire roster. Replaces the old "Cash" metric,
  // which read `company.money` - a field `createCompany` never sets and nothing
  // ever writes, so every company displayed CASH $0 for its entire life.
  const payroll = (overlay?.hiringPipeline?.namedHires ?? []).reduce(
    (sum, h) => sum + (typeof h.salary === 'number' && isFinite(h.salary) && h.salary > 0 ? h.salary : 0),
    0,
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${company.name}`}
      accessibilityHint={`$${weekly.toLocaleString()} per week, brand ${brand}, ${company.employees} employees`}
      style={({ pressed }) => [
        getGlassCard(isDark, 6),
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconSquare, { backgroundColor: withAlpha(color, 0.15), borderColor: withAlpha(color, 0.3) }]}>
          <Icon size={fontScale(22)} color={color} strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {company.name}
          </Text>
          <Text style={[styles.industry, { color: theme.textSecondary }]} numberOfLines={1}>
            {company.type.charAt(0).toUpperCase() + company.type.slice(1)} · {company.employees} employees
          </Text>
        </View>
        {isPublic ? <Chip label="Public" tint={HUSTLE_COLORS.accent} /> : null}
        <ChevronRight size={fontScale(18)} color={theme.textMuted} />
      </View>

      {/* Revenue bar - weekly income vs the portfolio leader */}
      <View style={styles.revBlock}>
        <View style={styles.revTopRow}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Weekly revenue</Text>
          {lift > 0 ? <Chip label={`+$${lift.toLocaleString()} vs base`} tone="success" /> : null}
        </View>
        <View style={styles.revValueRow}>
          <Text style={[styles.revValue, { color: theme.text }]}>${weekly.toLocaleString()}</Text>
          <Text style={[styles.revSuffix, { color: theme.textMuted }]}>/wk</Text>
        </View>
        <ProgressBar value={revPct / 100} color={color} label="Weekly revenue against the portfolio leader" />
      </View>

      {/* Stat strip */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Brand</Text>
          <View style={styles.brandRow}>
            <Text style={[styles.metricValue, { color: theme.text }]}>{brand}</Text>
            <ProgressBar value={brand / 100} color={HUSTLE_COLORS.accent} height={4} label="Brand" />
          </View>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Share</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{share.toFixed(1)}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Payroll</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {payroll > 0 ? `-$${payroll >= 1000 ? `${Math.round(payroll / 1000)}K` : Math.round(payroll)}` : '-'}
          </Text>
        </View>
      </View>

      {/* Chips - marketing tier + running campaigns (surfaced from overlay) */}
      <View style={styles.chipRow}>
        <Chip
          label={`Mktg Lv ${company.marketingLevel ?? 0}`}
          icon={<DollarSign size={fontScale(10)} color={theme.textSecondary} />}
        />
        {campaigns > 0 ? (
          <Chip
            label={`${campaigns} campaign${campaigns === 1 ? '' : 's'}`}
            icon={<Megaphone size={fontScale(10)} color={HUSTLE_COLORS.accentSecondary} />}
            tint={HUSTLE_COLORS.accentSecondary}
          />
        ) : null}
        {(company.upgrades?.length ?? 0) > 0 ? (
          <Chip label={`${company.upgrades.length} upgrade${company.upgrades.length === 1 ? '' : 's'}`} />
        ) : null}
      </View>

      {scandal ? (
        <View style={[styles.scandalChip, { backgroundColor: withAlpha(HUSTLE_COLORS.danger, 0.13), borderColor: HUSTLE_COLORS.danger }]}>
          <AlertTriangle size={fontScale(11)} color={HUSTLE_COLORS.danger} strokeWidth={2.4} />
          <Text style={[styles.scandalText, { color: HUSTLE_COLORS.danger }]} numberOfLines={1}>
            {scandal.headline}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: responsiveBorderRadius.xl,
    padding: responsiveSpacing.md,
    marginBottom: responsiveSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.sm,
  },
  iconSquare: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  name: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  industry: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  revBlock: {
    marginBottom: responsiveSpacing.sm,
  },
  revTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  revValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 1,
    marginBottom: 5,
  },
  revValue: {
    fontSize: fontScale(19),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  revSuffix: {
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: fontScale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: fontScale(14),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  brandRow: {
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: responsiveSpacing.sm,
  },
  scandalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: responsiveSpacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  scandalText: {
    fontSize: fontScale(11),
    fontWeight: '600',
    flexShrink: 1,
  },
});
