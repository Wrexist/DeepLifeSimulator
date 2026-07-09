import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus, Briefcase } from 'lucide-react-native';
import { Sector, sectorForSymbol } from '@/lib/stocks/sectors';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard } from '@/utils/glassmorphismStyles';

interface Props {
  symbol: string;
  price: number;
  /** Optional change for the week (decimal, e.g. 0.025 = +2.5%). */
  changePct?: number;
  /** Optional player holding details. */
  shares?: number;
  averagePrice?: number;
  dividendYield?: number;
  sectorState?: 'strong' | 'neutral' | 'weak';
  darkMode: boolean;
  onPress?: () => void;
}

const SECTOR_COLOR: Record<Sector, string> = {
  tech: accent.info,
  finance: accent.success,
  healthcare: accent.purple,
  consumer: accent.warning,
  industrial: '#94a3b8',
  energy: '#fbbf24',
};

const SECTOR_LABEL: Record<Sector, string> = {
  tech: 'Tech',
  finance: 'Finance',
  healthcare: 'Health',
  consumer: 'Consumer',
  industrial: 'Industrial',
  energy: 'Energy',
};

const STATE_LABEL: Record<string, string> = {
  strong: '↑ Strong',
  weak: '↓ Weak',
  neutral: '',
};

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

export default function StockRow({
  symbol,
  price,
  changePct,
  shares,
  averagePrice,
  dividendYield,
  sectorState,
  darkMode,
  onPress,
}: Props) {
  const theme = getThemeColors(darkMode);
  const sector = sectorForSymbol(symbol);
  const sectorColor = SECTOR_COLOR[sector];
  const owned = (shares ?? 0) > 0;
  const changeColor = (changePct ?? 0) > 0 ? accent.success : (changePct ?? 0) < 0 ? accent.danger : theme.textMuted;
  const ChangeIcon = (changePct ?? 0) > 0 ? TrendingUp : (changePct ?? 0) < 0 ? TrendingDown : Minus;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[getGlassCard(darkMode, 6), styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.symbolBubble, { backgroundColor: `${sectorColor}26`, borderColor: `${sectorColor}4D` }]}>
        <Text style={[styles.symbolText, { color: sectorColor }]}>{symbol.slice(0, 4)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <Text style={[styles.symbolHeader, { color: theme.text }]}>{symbol}</Text>
          <View style={[styles.sectorChip, { backgroundColor: `${sectorColor}26` }]}>
            <Text style={[styles.sectorText, { color: sectorColor }]}>
              {SECTOR_LABEL[sector]}{sectorState && sectorState !== 'neutral' ? ` · ${STATE_LABEL[sectorState]}` : ''}
            </Text>
          </View>
        </View>
        {owned ? (
          <Text style={[styles.holdingText, { color: theme.textMuted }]} numberOfLines={1}>
            {shares?.toFixed(2)} sh · avg {formatMoney(averagePrice ?? 0)}
            {dividendYield ? ` · ${(dividendYield * 100).toFixed(2)}% yield` : ''}
          </Text>
        ) : dividendYield ? (
          <Text style={[styles.holdingText, { color: theme.textMuted }]}>
            {(dividendYield * 100).toFixed(2)}% annual dividend
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.price, { color: theme.text }]}>{formatMoney(price)}</Text>
        {changePct != null && (
          <View style={styles.changeRow}>
            <ChangeIcon size={scale(10)} color={changeColor} />
            <Text style={[styles.changeText, { color: changeColor }]}>
              {changePct > 0 ? '+' : ''}{(changePct * 100).toFixed(2)}%
            </Text>
          </View>
        )}
        {owned && (
          <View style={styles.ownedBadge}>
            <Briefcase size={scale(10)} color={accent.purple} />
            <Text style={[styles.ownedText, { color: accent.purple }]}>Owned</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  symbolBubble: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: { fontSize: responsiveFontSize.xs, fontWeight: '800' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  symbolHeader: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  sectorChip: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  sectorText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  holdingText: { fontSize: responsiveFontSize.xs, marginTop: 2 },
  price: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  changeText: { fontSize: responsiveFontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ownedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  ownedText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
});
