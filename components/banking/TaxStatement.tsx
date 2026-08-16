/**
 * TaxStatement — the one tax surface, rendered by both bank apps.
 *
 * ## Why it is shared
 *
 * The Tax tab shipped in `AdvancedBankApp` only. That app is registered in the
 * DESKTOP category, so the entire tax system was behind a $5,000 computer —
 * the same trap renting was in until last week, and the same one the weekly
 * audit keeps finding: the surface a player needs EARLY sitting behind a
 * late-game purchase.
 *
 * A player's first bracket crossing happens around week 10. So the phone bank
 * carries it too, as a tappable card → detail page (the list→detail routing it
 * already uses for accounts and the credit report). Both hosts render THIS
 * component, so the desktop and phone answers cannot drift.
 *
 * ## Read-only by design
 *
 * This is a statement, not a mechanic. Every number comes from state the week
 * loop already writes: `banking.taxDueThisYear` (the year-to-date ledger),
 * `banking.budgetSpend` (last week's actual withholding), and the pure bracket
 * math in `lib/economy/taxLedger.ts` — the same module the tick charges from,
 * so a rate quoted here is a rate actually charged.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Percent,
  Receipt,
  TrendingDown,
  FileText,
  Coins,
  LineChart,
  Building2,
  Landmark,
  Sparkles,
} from 'lucide-react-native';
import type { BankingState } from '@/contexts/game/types';
import { getThemeColors, accent } from '@/lib/config/theme';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import {
  CAPITAL_GAINS_TAX_RATE,
  PROPERTY_GAINS_TAX_RATE,
  TAX_YEAR_WEEKS,
  bracketBreakdown,
  effectiveTaxRate,
  marginalRate,
  taxYearOf,
  weekOfTaxYear,
} from '@/lib/economy/taxLedger';

import { formatMoney } from '@/utils/moneyFormatting';

type Theme = ReturnType<typeof getThemeColors>;

interface TaxStatementProps {
  banking: BankingState;
  /** Absolute week (`weeksLived`) — never the 1–4 display week. */
  weeksLived: number;
  /** Weekly earned income, for the band illustration. */
  weeklyIncome: number;
  /** `lifeSkillMods.taxMult`, already clamped by the caller. */
  taxMult: number;
  darkMode: boolean;
  /**
   * Compact hosts (the phone detail page) drop the two prose cards and keep the
   * numbers. The desktop tab has room for the explanation; a phone sub-page
   * that opens on three paragraphs does not read as premium.
   */
  compact?: boolean;
}

/**
 * The year-to-date figure, last week's actual withholding, and the effective
 * rate. Deliberately three cells, matching every other summary strip in the two
 * bank apps — a surface that invents its own metric layout reads as bolted on.
 */
function SummaryCell({
  theme,
  icon: Icon,
  label,
  value,
  tint,
}: {
  theme: Theme;
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View style={[styles.cell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cellHead}>
        <Icon size={scale(12)} color={tint} />
        <Text style={[styles.cellLabel, { color: theme.textMuted }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text
        style={[styles.cellValue, { color: theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );
}

function CardTitle({ theme, icon: Icon, children }: { theme: Theme; icon?: React.ComponentType<{ size: number; color: string }>; children: React.ReactNode }) {
  return (
    <View style={styles.titleLine}>
      {Icon && <Icon size={scale(14)} color={accent.info} />}
      <Text style={[styles.title, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

export default function TaxStatement({
  banking,
  weeksLived,
  weeklyIncome,
  taxMult,
  darkMode,
  compact = false,
}: TaxStatementProps) {
  const theme = getThemeColors(darkMode);

  const lastBucket = [...(banking.budgetSpend ?? [])]
    .sort((a, b) => a.weeksLived - b.weeksLived)
    .slice(-1)[0];
  const lastWeekTax = lastBucket?.byCategory?.taxes ?? 0;

  const bands = bracketBreakdown(weeklyIncome);
  const marginal = marginalRate(weeklyIncome);
  // One derivation, always. Mixing "last week's real bill / income" with a
  // computed estimate made this number jump between the two whenever the
  // budget ring buffer happened to be empty.
  const effective = effectiveTaxRate(weeklyIncome, taxMult);
  const discountPct = Math.round((1 - taxMult) * 100);

  // Widest band amount drives the progressivity bars, so they read as one
  // chart rather than five unrelated fills.
  const widestBand = bands.reduce((m, b) => Math.max(m, b.taxedAmount), 0);

  const cardStyle = [
    getGlassCard(darkMode, 6),
    {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: responsiveBorderRadius.xl,
    },
  ];

  const otherTaxes: {
    icon: React.ComponentType<{ size: number; color: string }>;
    tint: string;
    tintRGB: string;
    label: string;
    when: string;
    value: string;
  }[] = [
    { icon: LineChart, tint: '#a855f7', tintRGB: '168, 85, 247', label: 'Stock gains + dividends', when: 'at each sale', value: `${Math.round(CAPITAL_GAINS_TAX_RATE * taxMult * 100)}%` },
    { icon: Coins, tint: accent.warning, tintRGB: '245, 158, 11', label: 'Crypto gains', when: 'every 52nd week', value: `${Math.round(CAPITAL_GAINS_TAX_RATE * taxMult * 100)}%` },
    { icon: Building2, tint: '#06b6d4', tintRGB: '6, 182, 212', label: 'Property gains', when: 'when you sell', value: `${Math.round(PROPERTY_GAINS_TAX_RATE * 100)}%` },
    { icon: Landmark, tint: '#06b6d4', tintRGB: '6, 182, 212', label: 'Property tax', when: 'in weekly carrying costs', value: '~1.2%/yr' },
  ];

  return (
    <View style={{ gap: responsiveSpacing.md }}>
      <View style={styles.strip}>
        <SummaryCell theme={theme} icon={Percent} label="Paid this yr" value={formatMoney(banking.taxDueThisYear ?? 0)} tint={accent.warning} />
        <SummaryCell theme={theme} icon={Receipt} label="Last week" value={formatMoney(lastWeekTax)} tint={accent.warning} />
        <SummaryCell theme={theme} icon={TrendingDown} label="Effective" value={`${(effective * 100).toFixed(1)}%`} tint={accent.info} />
      </View>

      {/* The answer to "how do I pay tax each year?". Stated outright, because
          the mechanic IS the absence of one — that cannot be inferred from a
          number going down. */}
      {!compact && (
        <View style={[...cardStyle, styles.prose]}>
          <CardTitle theme={theme} icon={FileText}>Nothing to file</CardTitle>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            Tax is withheld automatically every week, before the money reaches you — there is no return
            to file and no deadline to miss. You are in week {weekOfTaxYear(weeksLived)} of{' '}
            {TAX_YEAR_WEEKS} of tax year {taxYearOf(weeksLived)}.
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            If a week&apos;s bills come to more than you have, the shortfall — tax included — becomes
            overdue debt, paid off the top of next week&apos;s income and dragging your credit score
            while it stands.
          </Text>
        </View>
      )}

      {/* Progressive bands.
          The bar is the point: a table of five numbers does not communicate
          that only income ABOVE each threshold is taxed at that rate, which is
          the single most misread thing about a bracket system. The fill shows
          how much of THIS player's income sits in each band. */}
      <View style={[...cardStyle, { overflow: 'hidden' }]}>
        <View style={[styles.bandHead, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headLabel, { color: theme.text }]}>Income tax bands</Text>
          <Text style={[styles.headMeta, { color: theme.textMuted }]} numberOfLines={1}>
            {formatMoney(weeklyIncome)}/wk · top {Math.round(marginal * 100)}%
          </Text>
        </View>
        {bands.map((band, i) => {
          const fill = widestBand > 0 ? Math.max(0, band.taxedAmount / widestBand) : 0;
          const inPlay = band.taxedAmount > 0;
          return (
            <View
              key={band.from}
              style={[
                styles.bandRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                band.isCurrent && {
                  backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.10)' : 'rgba(59, 130, 246, 0.06)',
                },
              ]}
            >
              <Text style={[styles.bandRate, { color: inPlay ? theme.text : theme.textMuted }]}>
                {Math.round(band.rate * 100)}%
              </Text>

              <View style={styles.bandMid}>
                <Text style={[styles.bandRange, { color: inPlay ? theme.textSecondary : theme.textMuted }]} numberOfLines={1}>
                  {band.to == null
                    ? `${formatMoney(band.from)} and above`
                    : band.from === 0
                      ? `first ${formatMoney(band.to)}`
                      : `${formatMoney(band.from)} – ${formatMoney(band.to)}`}
                </Text>
                <View style={[styles.bandTrack, { backgroundColor: theme.surfaceElevated }]}>
                  <View
                    style={[
                      styles.bandFill,
                      {
                        width: `${Math.round(fill * 100)}%`,
                        backgroundColor: band.isCurrent ? accent.info : inPlay ? accent.warning : 'transparent',
                        opacity: band.isCurrent ? 1 : 0.55,
                      },
                    ]}
                  />
                </View>
              </View>

              <Text
                style={[styles.bandAmount, { color: band.tax > 0 ? accent.warning : theme.textMuted }]}
                numberOfLines={1}
              >
                {inPlay ? `-${formatMoney(band.tax)}` : '—'}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.footnote, { color: theme.textMuted }]}>
        Rent collected and luxury-asset yields count as income too. Crime and dark-web earnings do
        not — nobody is reporting those.
      </Text>

      {/* The four taxes that are NOT the weekly withholding. Every one of them
          was previously discoverable only by watching your cash drop. */}
      <View style={[...cardStyle, { overflow: 'hidden' }]}>
        <View style={[styles.bandHead, { borderBottomColor: theme.border }]}>
          <Text style={[styles.headLabel, { color: theme.text }]}>Other taxes</Text>
        </View>
        {otherTaxes.map((row, i) => (
          <View
            key={row.label}
            style={[
              styles.otherRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: `rgba(${row.tintRGB}, 0.14)` }]}>
              <row.icon size={scale(12)} color={row.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.otherLabel, { color: theme.text }]} numberOfLines={1}>{row.label}</Text>
              <Text style={[styles.otherWhen, { color: theme.textMuted }]} numberOfLines={1}>{row.when}</Text>
            </View>
            <Text style={[styles.bandAmount, { color: theme.text }]} numberOfLines={1}>{row.value}</Text>
          </View>
        ))}
      </View>

      {!compact && (
        <View style={[...cardStyle, styles.prose]}>
          <CardTitle theme={theme} icon={Sparkles}>Tax Strategy</CardTitle>
          <Text style={[styles.body, { color: discountPct > 0 ? accent.success : theme.textSecondary }]}>
            {discountPct > 0
              ? `Active — every tax on this page is cut by ${discountPct}%, income and capital gains alike.`
              : 'Not learned yet. It cuts every tax on this page by 10% — income tax and capital gains alike.'}
          </Text>
          <Text style={[styles.body, { color: theme.textMuted }]}>
            Buy it under Financial Acumen in the Life Skills tree.
          </Text>
        </View>
      )}
    </View>
  );
}

// Rows are separated by hairline DIVIDERS — a structural exception under Hard
// Rule #7. No decorative one-sided colour stripe anywhere; the current band is
// marked with a tinted background and a filled bar instead.
const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: responsiveSpacing.sm,
  },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.lg,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    gap: scale(3),
  },
  cellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  cellLabel: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cellValue: {
    fontSize: responsiveFontSize.md,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  prose: {
    padding: responsiveSpacing.md,
    gap: scale(6),
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  title: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  body: {
    fontSize: responsiveFontSize.sm,
    lineHeight: responsiveFontSize.sm * 1.45,
  },
  footnote: {
    fontSize: responsiveFontSize.xs,
    lineHeight: responsiveFontSize.xs * 1.45,
    paddingHorizontal: responsiveSpacing.xs,
  },

  bandHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headMeta: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '500',
    flexShrink: 1,
  },

  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    minHeight: scale(44),
  },
  bandRate: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '800',
    width: scale(34),
    fontVariant: ['tabular-nums'],
  },
  bandMid: {
    flex: 1,
    gap: scale(4),
  },
  bandRange: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '500',
  },
  bandTrack: {
    height: scale(4),
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  bandFill: {
    height: '100%',
    borderRadius: scale(2),
  },
  bandAmount: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    minHeight: scale(44),
  },
  rowIcon: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherLabel: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  otherWhen: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '500',
  },
});
