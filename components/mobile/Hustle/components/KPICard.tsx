/**
 * KPICard — reusable metric card with icon, label, value, optional trend arrow.
 *
 * Business-dashboard DNA: a KPI tile can now carry a mini SVG bar/line chart
 * (drawn from REAL per-company / earnings data — never fabricated history) so
 * the dashboard reads as an analytics strip, not a row of bare numbers.
 *
 * Used on the dashboard for at-a-glance company stats: weekly revenue,
 * brand health, market share, employee morale, etc.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import Svg, { Rect, Polyline } from 'react-native-svg';
import Gradient from '@/components/ui/Gradient';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { HUSTLE_COLORS, HUSTLE_GRADIENT_SOFT } from '../styles/hustleTheme';

const LinearGradient = Gradient;

interface KPICardProps {
  icon: any;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  /** Use the brand gradient backdrop (for hero KPI). */
  heroBackdrop?: boolean;
  /** Per-card accent (icon + chart). Defaults to the Hustle indigo. */
  accentColor?: string;
  /** Real numeric series → mini chart at the card foot. */
  chart?: number[];
  /** Chart style. Bars for cross-sectional data, line for a time series. */
  chartKind?: 'bar' | 'line';
  /** Small caption under the value (e.g. "peak 88", "avg of 3"). */
  caption?: string;
}

/** Mini bar chart — normalises to the series max; taller bar = brighter. */
function MiniBars({ data, color }: { data: number[]; color: string }) {
  const vals = data.filter((v) => Number.isFinite(v) && v >= 0);
  if (vals.length === 0) return null;
  const max = Math.max(...vals, 1);
  const n = Math.min(vals.length, 8);
  const shown = vals.slice(0, n);
  const gap = n > 1 ? 3 : 0;
  const bw = (100 - gap * (n - 1)) / n;
  return (
    <Svg width="100%" height={scale(20)} viewBox="0 0 100 24" preserveAspectRatio="none">
      {shown.map((v, i) => {
        const ratio = v / max;
        const h = Math.max(2, ratio * 24);
        return (
          <Rect
            key={i}
            x={i * (bw + gap)}
            y={24 - h}
            width={bw}
            height={h}
            fill={color}
            opacity={0.4 + 0.6 * ratio}
          />
        );
      })}
    </Svg>
  );
}

/** Mini line chart — needs ≥2 real points (a 2-point trend segment is fine). */
function MiniLine({ data, color }: { data: number[]; color: string }) {
  const vals = data.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return null;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const n = vals.length;
  const pts = vals
    .map((v, i) => {
      const x = (i / (n - 1)) * 100;
      const y = 23 - ((v - min) / span) * 21;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width="100%" height={scale(20)} viewBox="0 0 100 24" preserveAspectRatio="none">
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export default function KPICard({
  icon: Icon, label, value, trend, trendValue, heroBackdrop, accentColor, chart, chartKind = 'bar', caption,
}: KPICardProps) {
  const { theme, isDark } = useTheme();
  const accent = accentColor ?? HUSTLE_COLORS.accent;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? HUSTLE_COLORS.trendUp : trend === 'down' ? HUSTLE_COLORS.trendDown : HUSTLE_COLORS.trendFlat;
  const hasChart = Array.isArray(chart) && chart.length > 0;

  const inner = (
    <View
      style={[
        !heroBackdrop && getGlassCard(isDark, 6),
        styles.card,
        {
          backgroundColor: heroBackdrop ? 'transparent' : theme.surface,
          borderColor: heroBackdrop ? 'rgba(255,255,255,0.18)' : theme.border,
          borderWidth: heroBackdrop ? StyleSheet.hairlineWidth : 1,
        },
      ]}
    >
      <View style={styles.iconRow}>
        <Icon size={fontScale(14)} color={accent} />
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      <Text
        style={[styles.value, { color: theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
      {caption ? (
        <Text style={[styles.caption, { color: theme.textMuted }]} numberOfLines={1}>{caption}</Text>
      ) : null}
      {hasChart ? (
        <View style={styles.chartWrap} pointerEvents="none">
          {chartKind === 'line' ? <MiniLine data={chart!} color={accent} /> : <MiniBars data={chart!} color={accent} />}
        </View>
      ) : null}
      {trend && trendValue ? (
        <View style={styles.trendRow}>
          <TrendIcon size={fontScale(11)} color={trendColor} strokeWidth={2.6} />
          <Text style={[styles.trendText, { color: trendColor }]}>{trendValue}</Text>
        </View>
      ) : null}
    </View>
  );

  if (heroBackdrop) {
    return (
      <LinearGradient
        colors={HUSTLE_GRADIENT_SOFT as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroWrap}
      >
        {inner}
      </LinearGradient>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  heroWrap: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  card: {
    // 2-per-row layout: 48% basis + grow lets cards flex up to fill leftover
    // space when an odd count leaves one alone on the last row. Was `flex: 1`
    // which crammed all 4 cards into a single ~83px-wide row → "BRAND" wrapped
    // to "BRAN/D", "EMPLOYEES" wrapped, and "$2.5K" got truncated.
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: scale(78),
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    gap: 4,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: fontScale(11),
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: fontScale(20),
    fontWeight: '800',
    // Let large currency values shrink rather than truncate to "$..."
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: fontScale(10),
    fontWeight: '600',
  },
  chartWrap: {
    marginTop: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
});
