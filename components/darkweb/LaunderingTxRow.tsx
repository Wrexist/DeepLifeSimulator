import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Droplets, Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { DarkWebLaunderingTx } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  tx: DarkWebLaunderingTx;
  currentWeek: number;
  darkMode: boolean;
}

const TIER_COLOR: Record<string, string> = {
  cheap: accent.warning,
  standard: accent.info,
  premium: '#a855f7',
};

const STATUS_META: Record<string, { color: string; icon: React.ComponentType<{ size: number; color: string }> }> = {
  pending:   { color: '#94a3b8', icon: Clock },
  completed: { color: accent.success, icon: CheckCircle2 },
  failed:    { color: accent.danger, icon: XCircle },
};

export default function LaunderingTxRow({ tx, currentWeek, darkMode }: Props) {
  const theme = getThemeColors(darkMode);
  const statusMeta = STATUS_META[tx.status];
  const StatusIcon = statusMeta.icon;
  const weeksLeft = Math.max(0, tx.readyWeek - currentWeek);

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={[styles.tierStripe, { backgroundColor: TIER_COLOR[tx.tier] }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Droplets size={scale(14)} color={TIER_COLOR[tx.tier]} />
          <Text style={[styles.title, { color: theme.text }]}>
            {tx.tier.charAt(0).toUpperCase() + tx.tier.slice(1)} mixer
          </Text>
          <View style={[styles.statusChip, { backgroundColor: statusMeta.color }]}>
            <StatusIcon size={scale(10)} color="white" />
            <Text style={styles.statusText}>{tx.status}</Text>
          </View>
        </View>
        <View style={styles.amounts}>
          <Text style={[styles.label, { color: theme.textMuted }]}>In</Text>
          <Text style={[styles.amount, { color: theme.text }]}>{tx.dirtyAmountBtc.toFixed(4)} â‚¿</Text>
          <Text style={[styles.arrow, { color: theme.textMuted }]}>â†’</Text>
          <Text style={[styles.label, { color: theme.textMuted }]}>Out</Text>
          <Text style={[styles.amount, { color: tx.status === 'failed' ? accent.danger : theme.text }]}>
            {tx.status === 'failed' ? '0.0000' : tx.netAmountBtc.toFixed(4)} â‚¿
          </Text>
        </View>
        {tx.status === 'pending' && (
          <Text style={[styles.foot, { color: theme.textMuted }]}>
            Ready in {weeksLeft} week{weeksLeft === 1 ? '' : 's'}
          </Text>
        )}
      </View>
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
  tierStripe: { width: scale(4) },
  body: {
    flex: 1,
    padding: responsiveSpacing.md,
    gap: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  title: { flex: 1, fontSize: responsiveFontSize.md, fontWeight: '700' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: responsiveSpacing.xs,
    paddingVertical: 2,
    borderRadius: responsiveBorderRadius.sm,
  },
  statusText: { color: 'white', fontSize: responsiveFontSize.xs, fontWeight: '700' },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: responsiveSpacing.xs },
  label: { fontSize: responsiveFontSize.xs },
  amount: { fontSize: responsiveFontSize.sm, fontWeight: '700' },
  arrow: { fontSize: responsiveFontSize.sm },
  foot: { fontSize: responsiveFontSize.xs },
});
