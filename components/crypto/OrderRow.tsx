import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, X } from 'lucide-react-native';
import { CryptoOrder } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { hitSlopToMinTarget, minTouchTargetStyle } from '@/utils/touchTargets';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  order: CryptoOrder;
  darkMode: boolean;
  /** Show a cancel X. Only renders for open orders. */
  onCancel?: () => void;
}

function formatPrice(n?: number): string {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export default function OrderRow({ order, darkMode, onCancel }: Props) {
  const theme = getThemeColors(darkMode);
  const sideColor = order.side === 'buy' ? accent.success : accent.danger;
  const typeLabel = order.type === 'market' ? 'Market' : order.type === 'limit' ? 'Limit' : 'Stop';

  return (
    // Hard Rule #7: buy/sell used to be a scale(4) bar down the left edge,
    // clipped by borderRadius.lg + overflow:hidden. The colour moves onto the
    // full border; the row's own title already reads "Buy BTC" / "Sell BTC",
    // so the side is stated twice over.
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: sideColor }]}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>
            {order.side === 'buy' ? 'Buy' : 'Sell'} {order.cryptoId.toUpperCase()}
          </Text>
          <View
            style={[
              styles.typeChip,
              { backgroundColor: order.status === 'filled' ? accent.success : theme.surface },
            ]}
          >
            <Text style={[styles.typeText, { color: order.status === 'filled' ? 'white' : theme.textSecondary }]}>
              {typeLabel}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            Amount: {order.side === 'buy' ? formatPrice(order.amount) : `${order.amount.toFixed(4)} ${order.cryptoId.toUpperCase()}`}
          </Text>
          {order.limitPrice != null && (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              Limit: {formatPrice(order.limitPrice)}
            </Text>
          )}
          {order.stopPrice != null && (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              Stop: {formatPrice(order.stopPrice)}
            </Text>
          )}
          {order.filledPrice != null && (
            <Text style={[styles.meta, { color: theme.textSecondary }]}>
              Filled @ {formatPrice(order.filledPrice)}
            </Text>
          )}
        </View>
        <View style={styles.footRow}>
          <Clock size={scale(10)} color={theme.textMuted} />
          <Text style={[styles.foot, { color: theme.textMuted }]}>
            Week {order.placedWeek}
            {order.reason === 'dca' ? ' · DCA' : order.reason === 'stop-loss' ? ' · Stop-loss' : ''}
          </Text>
        </View>
      </View>
      {onCancel && order.status === 'open' && (
        <TouchableOpacity
          onPress={onCancel}
          style={[styles.cancelBtn, minTouchTargetStyle]}
          hitSlop={hitSlopToMinTarget(scale(16))}
          accessibilityRole="button"
          accessibilityLabel="Cancel this open order"
        >
          <X size={scale(16)} color={accent.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  typeChip: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  typeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
  },
  meta: {
    fontSize: responsiveFontSize.xs,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  foot: {
    fontSize: responsiveFontSize.xs,
  },
  cancelBtn: {
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing.sm,
  },
});
