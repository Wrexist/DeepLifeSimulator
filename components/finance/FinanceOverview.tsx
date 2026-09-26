import { textStyles } from '@/lib/config/hierarchy';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Wallet, ArrowUpRight } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { netWorth } from '@/lib/progress/achievements';
import { useTheme } from '@/hooks/useTheme';
import { financeColors } from '@/lib/config/theme';
import { formatMoney } from '@/utils/moneyFormatting';
import { fontScale, scale } from '@/utils/scaling';
import { Card } from '@/components/ui/Card';
import MotionPressable from '@/components/ui/MotionPressable';
import NetWorthBreakdownModal from '@/components/NetWorthBreakdownModal';

/** Shows recorded valuations, never synthesized day-to-day market movement. */
export default function FinanceOverview() {
  const value = useGameSelector(netWorth);
  const history = useGameSelector(s => s.lifetimeStatistics?.netWorthHistory);
  const { theme } = useTheme();
  const [details, setDetails] = useState(false);
  const samples = useMemo(() => (history ?? []).filter(p => Number.isFinite(p.value) && Number.isFinite(p.week)).slice(-20), [history]);
  const points = useMemo(() => {
    const values = samples.map(p => p.value);
    const min = Math.min(...values), range = Math.max(1, Math.max(...values) - min);
    const start = samples[0]?.week ?? 0, duration = Math.max(1, (samples[samples.length - 1]?.week ?? 0) - start);
    return samples.map(p => `${8 + (p.week - start) / duration * 304},${68 - (p.value - min) / range * 56}`).join(' ');
  }, [samples]);
  return <>
    <Card style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
      <View style={styles.row}><Wallet size={18} color={financeColors.cash} /><Text style={[styles.label, { color: theme.textSecondary }]}>NET WORTH</Text></View>
      <Text style={[styles.amount, { color: theme.text }]}>{formatMoney(value)}</Text>
      {samples.length >= 2 ? <View accessible accessibilityLabel={`Recorded net worth from week ${samples[0].week} to week ${samples[samples.length - 1].week}: ${formatMoney(samples[0].value)} to ${formatMoney(samples[samples.length - 1].value)}`}>
        <Svg viewBox="0 0 320 80" width="100%" height={80} accessibilityElementsHidden><Polyline points={points} fill="none" stroke={financeColors.cash} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /></Svg>
        <Text style={[styles.caption, { color: theme.textSecondary }]}>Recorded every 10 weeks · latest sample week {samples[samples.length - 1].week}</Text>
      </View> : <Text style={[styles.caption, { color: theme.textSecondary }]}>Your wealth history will appear as this life progresses.</Text>}
      <MotionPressable onPress={() => setDetails(true)} accessibilityLabel="View assets and debts" style={[styles.details, { backgroundColor: theme.surfaceInteractive }]}>
        <Text style={[styles.label, { color: theme.text }]}>Assets & debts</Text><ArrowUpRight size={18} color={theme.text} />
      </MotionPressable>
    </Card>
    {details && <NetWorthBreakdownModal visible onClose={() => setDetails(false)} />}
  </>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  label: { fontSize: fontScale(12), fontWeight: '600' },
  amount: textStyles.numericLarge,
  caption: { fontSize: fontScale(12), lineHeight: fontScale(18) },
  details: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: scale(12), borderRadius: scale(12) },
});
