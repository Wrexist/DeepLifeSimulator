/**
 * KPICard — reusable metric card with icon, label, value, optional trend arrow.
 *
 * Used on the dashboard for at-a-glance company stats: weekly revenue,
 * brand health, market share, employee morale, etc.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { HUSTLE_COLORS, HUSTLE_GRADIENT_SOFT } from '../styles/hustleTheme';

const LinearGradient = LinearGradientFallback;

interface KPICardProps {
  icon: any;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  /** Use the brand gradient backdrop (for hero KPI). */
  heroBackdrop?: boolean;
}

export default function KPICard({ icon: Icon, label, value, trend, trendValue, heroBackdrop }: KPICardProps) {
  const { theme } = useTheme();
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? HUSTLE_COLORS.trendUp : trend === 'down' ? HUSTLE_COLORS.trendDown : HUSTLE_COLORS.trendFlat;

  const inner = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: heroBackdrop ? 'transparent' : theme.surface,
          borderColor: heroBackdrop ? 'rgba(255,255,255,0.18)' : theme.border,
        },
      ]}
    >
      <View style={styles.iconRow}>
        <Icon size={fontScale(14)} color={theme.textSecondary} />
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
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
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
