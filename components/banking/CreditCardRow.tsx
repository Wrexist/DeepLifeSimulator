import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CreditCard as CardIcon, Gift } from 'lucide-react-native';
import { CreditCard } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard } from '@/utils/glassmorphismStyles';

interface Props {
  card: CreditCard;
  darkMode: boolean;
  onPress?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
}

const TIER_GRADIENT: Record<string, [string, string]> = {
  starter: ['#64748b', '#94a3b8'],
  standard: [accent.info, '#60a5fa'],
  gold: ['#ca8a04', '#facc15'],
  platinum: ['#0f172a', '#475569'],
};

export default function CreditCardRow({ card, darkMode, onPress }: Props) {
  const theme = getThemeColors(darkMode);
  const [c1, c2] = TIER_GRADIENT[card.tier] ?? TIER_GRADIENT.standard;
  const utilization = card.creditLimit > 0 ? card.balance / card.creditLimit : 0;
  const utilizationPct = Math.max(0, Math.min(1, utilization));

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      // Recipe A depth: shadow + border live on the outer view (no overflow:hidden
      // here or the shadow clips on iOS); the inner view clips the tier stripe.
      style={[getGlassCard(darkMode, 6), { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl }]}
    >
      <View style={styles.inner}>
        <View style={[styles.tierStripe, { backgroundColor: c1 }]}>
          <View style={[styles.tierStripeAccent, { backgroundColor: c2 }]} />
        </View>
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <CardIcon size={scale(16)} color={c1} />
            <Text style={[styles.name, { color: theme.text }]}>{card.name}</Text>
          </View>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {(card.baseAPR * 100).toFixed(2)}% APR · Limit {formatMoney(card.creditLimit)}
          </Text>

          <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
            <View
              style={[
                styles.fill,
                { width: `${utilizationPct * 100}%`, backgroundColor: utilization > 0.7 ? accent.danger : c1 },
              ]}
            />
          </View>

          <View style={styles.footRow}>
            <Text style={[styles.foot, { color: theme.textMuted }]}>
              Balance: {formatMoney(card.balance)} ({Math.round(utilizationPct * 100)}%)
            </Text>
            {card.pendingRewards > 0 && (
              <View style={styles.rewardsChip}>
                <Gift size={scale(10)} color={accent.success} />
                <Text style={styles.rewardsText}>{formatMoney(card.pendingRewards)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.xl,
    overflow: 'hidden',
  },
  tierStripe: {
    width: scale(6),
  },
  tierStripeAccent: {
    width: scale(2),
    height: '50%',
    alignSelf: 'flex-end',
  },
  body: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  sub: {
    fontSize: responsiveFontSize.sm,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginTop: responsiveSpacing.xs,
  },
  fill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foot: {
    fontSize: responsiveFontSize.xs,
    fontVariant: ['tabular-nums'],
  },
  rewardsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 1,
    borderRadius: responsiveBorderRadius.sm,
  },
  rewardsText: {
    fontSize: responsiveFontSize.xs,
    color: accent.success,
    fontWeight: '700',
  },
});
