import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DollarSign, Plus, Send, Bitcoin } from 'lucide-react-native';
import { PACPoolState } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  pac: PACPoolState;
  darkMode: boolean;
  onRaiseClean?: () => void;
  onRaiseDirty?: () => void;
  onSpend?: () => void;
}

function formatMoney(n: number): string {
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function PACCard({ pac, darkMode, onRaiseClean, onRaiseDirty, onSpend }: Props) {
  const theme = getThemeColors(darkMode);
  const total = (pac.cleanUSD ?? 0) + (pac.dirtyUSD ?? 0);
  const dirtyFraction = total > 0 ? (pac.dirtyUSD ?? 0) / total : 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBubble, { backgroundColor: accent.info }]}>
          <DollarSign size={scale(16)} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.textMuted }]}>PAC pool</Text>
          <Text style={[styles.total, { color: theme.text }]}>{formatMoney(total)}</Text>
        </View>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.splitCell}>
          <Text style={[styles.splitLabel, { color: theme.textMuted }]}>Clean</Text>
          <Text style={[styles.splitValue, { color: accent.success }]}>{formatMoney(pac.cleanUSD ?? 0)}</Text>
        </View>
        <View style={styles.splitCell}>
          <Text style={[styles.splitLabel, { color: theme.textMuted }]}>Dirty</Text>
          <Text style={[styles.splitValue, { color: accent.warning }]}>{formatMoney(pac.dirtyUSD ?? 0)}</Text>
        </View>
      </View>

      {dirtyFraction > 0 && (
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.fill, { width: `${(1 - dirtyFraction) * 100}%`, backgroundColor: accent.success }]} />
        </View>
      )}

      {(pac.lifetimeDirtyUSD ?? 0) > 0 && (
        <Text style={[styles.lifetimeText, { color: theme.textMuted }]}>
          Lifetime dirty funneled: {formatMoney(pac.lifetimeDirtyUSD ?? 0)} (raises scandal risk forever)
        </Text>
      )}

      <View style={styles.actionsRow}>
        {onRaiseClean && (
          <TouchableOpacity onPress={onRaiseClean} style={[styles.btn, { backgroundColor: accent.success }]}>
            <Plus size={scale(12)} color="white" />
            <Text style={styles.btnText}>Raise clean</Text>
          </TouchableOpacity>
        )}
        {onRaiseDirty && (
          <TouchableOpacity onPress={onRaiseDirty} style={[styles.btn, { backgroundColor: accent.warning }]}>
            <Bitcoin size={scale(12)} color="white" />
            <Text style={styles.btnText}>Funnel BTC</Text>
          </TouchableOpacity>
        )}
        {onSpend && total > 0 && (
          <TouchableOpacity onPress={onSpend} style={[styles.btn, { backgroundColor: accent.info }]}>
            <Send size={scale(12)} color="white" />
            <Text style={styles.btnText}>Spend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.sm },
  iconBubble: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: responsiveFontSize.xs, fontWeight: '600' },
  total: { fontSize: responsiveFontSize['2xl'], fontWeight: '800' },
  splitRow: { flexDirection: 'row', gap: responsiveSpacing.md },
  splitCell: { flex: 1 },
  splitLabel: { fontSize: responsiveFontSize.xs },
  splitValue: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  track: {
    height: scale(4),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: responsiveBorderRadius.full },
  lifetimeText: { fontSize: responsiveFontSize.xs, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: responsiveSpacing.xs, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: responsiveBorderRadius.full,
  },
  btnText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
});
