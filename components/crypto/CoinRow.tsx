import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { CoinMarket, Crypto } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import PriceChart from './PriceChart';

interface Props {
  coin: Crypto;
  market?: CoinMarket;
  darkMode: boolean;
  onPress?: () => void;
  /** Show "owned: X" line below. */
  showHoldings?: boolean;
}

const REGIME_TINT: Record<string, string> = {
  stable: accent.info,
  volatile: accent.warning,
  bull: accent.success,
  bear: accent.danger,
};

function formatPrice(n: number): string {
  if (!isFinite(n) || n <= 0) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatCoin(n: number): string {
  if (!isFinite(n)) return '0';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

export default function CoinRow({ coin, market, darkMode, onPress, showHoldings }: Props) {
  const theme = getThemeColors(darkMode);
  const change = coin.changePercent ?? 0;
  const ChangeIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const changeColor = change > 0 ? accent.success : change < 0 ? accent.danger : theme.textMuted;
  const regimeTint = market ? REGIME_TINT[market.regime] : theme.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.symbolBubble, { backgroundColor: regimeTint }]}>
          <Text style={styles.symbolText}>{coin.symbol}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {coin.name}
          </Text>
          {market && (
            <Text style={[styles.regimeText, { color: regimeTint }]}>
              {market.regime.charAt(0).toUpperCase() + market.regime.slice(1)} regime
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.price, { color: theme.text }]}>{formatPrice(coin.price)}</Text>
          <View style={styles.changeRow}>
            <ChangeIcon size={scale(10)} color={changeColor} />
            <Text style={[styles.changeText, { color: changeColor }]}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>

      {market && market.priceHistory.length > 1 && (
        <PriceChart history={market.priceHistory} darkMode={darkMode} height={42} />
      )}

      {showHoldings && coin.owned > 0 && (
        <View style={styles.holdingsRow}>
          <Text style={[styles.holdingsLabel, { color: theme.textMuted }]}>Holdings</Text>
          <Text style={[styles.holdingsValue, { color: theme.text }]}>
            {formatCoin(coin.owned)} {coin.symbol} Â· {formatPrice(coin.owned * coin.price)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
  },
  symbolBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    color: 'white',
    fontSize: responsiveFontSize.xs,
    fontWeight: '800',
  },
  name: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  regimeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  price: {
    fontSize: responsiveFontSize.md,
    fontWeight: '800',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  changeText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '700',
  },
  holdingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: responsiveSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(127,127,127,0.15)',
  },
  holdingsLabel: {
    fontSize: responsiveFontSize.xs,
  },
  holdingsValue: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '700',
  },
});
