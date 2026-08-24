import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { ChevronRight, Star } from 'lucide-react-native';
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
  /** Render as a hairline-separated row inside a grouped list card (no own card/shadow). */
  grouped?: boolean;
  /** Suppress the bottom hairline when this is the last row of a group. */
  isLast?: boolean;
  /** Whether this symbol is on the player's watchlist (drives the star fill). */
  watched?: boolean;
  /** When provided, renders a tappable star toggle (add/remove from watchlist). */
  onToggleWatch?: () => void;
}

/** Sector identity colors - reused by the app's sector board + allocation bar. */
export const SECTOR_COLOR: Record<Sector, string> = {
  tech: accent.info,
  finance: accent.success,
  healthcare: accent.purple,
  consumer: accent.warning,
  industrial: '#94a3b8',
  energy: '#fbbf24',
};

export const SECTOR_LABEL: Record<Sector, string> = {
  tech: 'Tech',
  finance: 'Finance',
  healthcare: 'Health',
  consumer: 'Consumer',
  industrial: 'Industrial',
  energy: 'Energy',
};

const STATE_SUFFIX: Record<string, string> = {
  strong: '↑ Strong',
  weak: '↓ Weak',
  neutral: '',
};

/**
 * Per-share PRICE, not a money amount: cents matter below $1k, so this is
 * deliberately not `formatMoney` (which floors and abbreviates). Same shape as
 * `formatPrice` in components/mobile/StocksApp.tsx.
 */
function formatPrice(n: number): string {
  if (!isFinite(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Tiny honest trend line. The engine only persists the current quote and last
 * week's close, so this draws the real 2-point week-over-week segment (prev →
 * current) scaled by the size of the move - never a fabricated history array.
 */
export function Sparkline({
  changePct,
  color,
  width = scale(44),
  height = scale(26),
  strokeWidth = 2,
}: {
  changePct?: number;
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  const mid = height / 2;
  const maxOff = Math.max(2, height / 2 - scale(3));
  const has = changePct != null && isFinite(changePct);
  const raw = has ? (changePct as number) * 10 * (height / 2) : 0;
  const off = Math.max(-maxOff, Math.min(maxOff, raw));
  const y1 = mid + off; // previous close
  const y2 = mid - off; // current price
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Line x1={0} y1={mid} x2={width} y2={mid} stroke={color} strokeOpacity={0.16} strokeWidth={1} strokeDasharray="2 3" />
      {has ? (
        <Polyline
          points={`0,${y1} ${width},${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Line x1={0} y1={mid} x2={width} y2={mid} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      )}
    </Svg>
  );
}

/** Apple-style signed change pill: filled green/red with white text. */
export function ChangeChip({ changePct, darkMode, size = 'sm' }: { changePct?: number; darkMode: boolean; size?: 'sm' | 'md' }) {
  const theme = getThemeColors(darkMode);
  const has = changePct != null && isFinite(changePct);
  const up = (changePct ?? 0) > 0;
  const down = (changePct ?? 0) < 0;
  const bg = !has ? theme.surfaceElevated : up ? accent.success : down ? accent.danger : theme.surfaceElevated;
  const fg = has && (up || down) ? '#FFFFFF' : theme.textMuted;
  const label = has ? `${up ? '+' : ''}${((changePct as number) * 100).toFixed(2)}%` : '-';
  return (
    <View style={[size === 'md' ? styles.changeChipMd : styles.changeChipSm, { backgroundColor: bg }]}>
      <Text style={[size === 'md' ? styles.changeTextMd : styles.changeTextSm, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
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
  grouped,
  isLast,
  watched,
  onToggleWatch,
}: Props) {
  const theme = getThemeColors(darkMode);
  const sector = sectorForSymbol(symbol);
  const sectorColor = SECTOR_COLOR[sector];
  const owned = (shares ?? 0) > 0;
  const up = (changePct ?? 0) > 0;
  const down = (changePct ?? 0) < 0;
  const sparkColor = up ? accent.success : down ? accent.danger : theme.textMuted;
  const pnlPct = owned && (averagePrice ?? 0) > 0 ? (price - (averagePrice as number)) / (averagePrice as number) : null;
  const prevClose = changePct != null && isFinite(changePct) && changePct > -1 ? price / (1 + changePct) : null;
  const stateSuffix = sectorState && sectorState !== 'neutral' ? ` · ${STATE_SUFFIX[sectorState]}` : '';

  const a11yLabel =
    `${symbol}, ${formatPrice(price)}` +
    (changePct != null && isFinite(changePct)
      ? `, ${up ? 'up' : down ? 'down' : 'flat'} ${(Math.abs(changePct) * 100).toFixed(2)} percent this week`
      : '') +
    (owned ? `, you own ${shares?.toFixed(2)} shares` : '');

  const content = (
    <View style={styles.rowContent}>
      <View style={styles.leftCol}>
        <View style={styles.symbolRow}>
          {owned && <View style={styles.ownedDot} />}
          <Text style={[styles.symbol, { color: theme.text }]} numberOfLines={1}>
            {symbol}
          </Text>
          <View style={[styles.sectorChip, { backgroundColor: `${sectorColor}26` }]}>
            <Text style={[styles.sectorText, { color: sectorColor }]} numberOfLines={1}>
              {SECTOR_LABEL[sector]}
              {stateSuffix}
            </Text>
          </View>
        </View>
        {owned ? (
          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
              {shares?.toFixed(2)} sh · avg {formatPrice(averagePrice ?? 0)}
            </Text>
            {pnlPct != null && (
              <Text style={[styles.metaPnl, { color: pnlPct >= 0 ? accent.success : accent.danger }]} numberOfLines={1}>
                {' '}· P/L {pnlPct >= 0 ? '+' : ''}
                {(pnlPct * 100).toFixed(1)}%
              </Text>
            )}
          </View>
        ) : (
          <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
            {dividendYield
              ? `${(dividendYield * 100).toFixed(2)}% yield`
              : prevClose != null
                ? `Prev ${formatPrice(prevClose)}`
                : SECTOR_LABEL[sector]}
          </Text>
        )}
      </View>

      <Sparkline changePct={changePct} color={sparkColor} width={scale(44)} height={scale(26)} />

      <View style={styles.rightCol}>
        <Text style={[styles.price, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {formatPrice(price)}
        </Text>
        <ChangeChip changePct={changePct} darkMode={darkMode} />
      </View>

      {onToggleWatch && (
        <TouchableOpacity
          onPress={onToggleWatch}
          hitSlop={8}
          style={styles.starBtn}
          accessibilityRole="button"
          accessibilityState={{ selected: !!watched }}
          accessibilityLabel={watched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        >
          <Star size={scale(16)} color={watched ? accent.warning : theme.textMuted} fill={watched ? accent.warning : 'transparent'} />
        </TouchableOpacity>
      )}

      {onPress && <ChevronRight size={scale(15)} color={theme.textMuted} />}
    </View>
  );

  if (grouped) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={a11yLabel}
        // Hard Rule #7: this row carried the sector as a scale(3) bar down its
        // left edge - a side accent bar, which the rule bans by name even
        // though it is a View rather than a border.
        //
        // The colour moves onto a faint row tint. Deliberately much weaker than
        // the sector chip's `26` (~15%): the chip inside this row ALREADY names
        // the sector in that colour, so the tint is a scan aid, not the signal.
        // At chip strength a list of these reads as stripes of solid colour.
        //
        // The borderBottom below stays - a neutral `theme.border` hairline row
        // divider is one of the rule's explicit structural exceptions.
        style={[
          styles.groupRow,
          { backgroundColor: `${sectorColor}0F` },
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        ]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11yLabel}
      // Hard Rule #7: the standalone card carried the sector as a scale(3) bar
      // down its left edge, clipped by borderRadius.xl + overflow:hidden. The
      // colour moves onto the full border. The sector chip inside the row is
      // already tinted with the same colour, so nothing is lost.
      style={[getGlassCard(darkMode, 6), styles.cardOuter, { backgroundColor: theme.surface, borderColor: sectorColor }]}
    >
      <View style={styles.cardInner}>
        {content}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Grouped list-group row: no card, hairline separators handled by the caller/isLast.
  groupRow: { flexDirection: 'row', alignItems: 'stretch' },
  // Standalone card anatomy: outer carries shadow + radius + border; inner clips the stripe.
  cardOuter: { borderRadius: responsiveBorderRadius.xl, borderWidth: 1 },
  cardInner: { flexDirection: 'row', alignItems: 'stretch', borderRadius: responsiveBorderRadius.xl, overflow: 'hidden' },
  // (The scale(3) `stripe` that lived here is gone - Hard Rule #7. The
  // standalone card carries the sector on its full border, the grouped row on a
  // faint background tint.)
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  leftCol: { flex: 1, gap: scale(2) },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  ownedDot: { width: scale(6), height: scale(6), borderRadius: scale(3), backgroundColor: accent.purple },
  symbol: { fontSize: responsiveFontSize.md, fontWeight: '700', flexShrink: 0 },
  sectorChip: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
    flexShrink: 1,
  },
  sectorText: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { fontSize: responsiveFontSize.xs },
  metaPnl: { fontSize: responsiveFontSize.xs, fontWeight: '700' },
  rightCol: { alignItems: 'flex-end', gap: scale(3), minWidth: scale(56) },
  starBtn: { width: scale(32), height: scale(32), alignItems: 'center', justifyContent: 'center' },
  price: { fontSize: responsiveFontSize.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  changeChipSm: {
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
    minWidth: scale(52),
    alignItems: 'center',
  },
  changeTextSm: { fontSize: responsiveFontSize.xs, fontWeight: '800', fontVariant: ['tabular-nums'] },
  changeChipMd: {
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: scale(4),
    borderRadius: responsiveBorderRadius.md,
    alignItems: 'center',
  },
  changeTextMd: { fontSize: responsiveFontSize.sm, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
