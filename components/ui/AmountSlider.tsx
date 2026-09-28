import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Platform, TouchableOpacity, PanResponder, StyleSheet, TextInputProps } from 'react-native';
import { getThemeColors, accent } from '@/lib/config/theme';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';
import { tier1Value } from '@/lib/config/hierarchy';
import { parseAmount } from '@/utils/parseAmount';

interface Props extends Pick<TextInputProps, 'value' | 'onChangeText' | 'accessibilityLabel'> {
  maxAmount?: number;
  initialRange?: number;
  darkMode?: boolean;
  unit?: string;
  precision?: number;
}

/** Local presentation control. The owning action still validates the transaction. */
export default function AmountSlider({ value = '', onChangeText, accessibilityLabel = 'Amount', maxAmount, initialRange = 10000, darkMode = true, unit = '$', precision = 2 }: Props) {
  const theme = getThemeColors(darkMode);
  const amount = parseAmount(value) ?? 0;
  const bounded = maxAmount !== undefined;
  const [range, setRange] = useState(Math.max(initialRange, amount, 1));
  const max = bounded ? (Number.isFinite(maxAmount) ? Math.max(0, maxAmount!) : 0) : Math.max(range, amount);
  const [width, setWidth] = useState(0);
  const current = useRef({ max, width, amount, onChangeText, precision });
  useEffect(() => { current.current = { max, width, amount, onChangeText, precision }; }, [max, width, amount, onChangeText, precision]);
  const start = useRef(0);
  const choose = useCallback((ratio: number) => {
    const c = current.current;
    const fraction = Math.max(0, Math.min(1, ratio));
    // Preserve the exact endpoint, including fractional holdings and small balances.
    const n = fraction === 1 ? c.max : Math.min(c.max, Math.round(fraction * c.max * 10 ** c.precision) / 10 ** c.precision);
    c.onChangeText?.(String(n));
  }, []);
  const chooseX = useCallback((x: number) => choose((x - 11) / Math.max(1, current.current.width - 22)), [choose]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => { start.current = e.nativeEvent.locationX; chooseX(start.current); },
    onPanResponderMove: (_e, gesture) => chooseX(start.current + gesture.dx),
  }), [chooseX]);
  const format = (n: number) => `${unit}${n.toLocaleString('en-US', { maximumFractionDigits: precision })}`;
  const ratio = max > 0 ? Math.max(0, Math.min(1, amount / max)) : 0;
  const adjust = (direction: number) => choose(max > 0 ? (amount + direction * Math.max(max / 100, 10 ** -precision)) / max : 0);
  return <View style={styles.container}>
    <Text style={[styles.value, { color: theme.text }]}>{format(amount)}</Text>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}
      {...(Platform.OS === 'web' ? {
        'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': Math.min(amount, max), 'aria-valuetext': format(amount),
        onKeyDown: (e: { key: string; preventDefault: () => void }) => {
          if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            if (e.key === 'Home' || e.key === 'End') choose(e.key === 'Home' ? 0 : 1);
            else adjust(e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1);
          }
        },
      } : {})}
      style={styles.trackTarget} accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: max <= 0 }} accessibilityValue={{ min: 0, max, now: Math.min(amount, max), text: format(amount) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.border }]} />
      <View pointerEvents="none" style={[styles.track, { backgroundColor: accent.info, width: `${ratio * 100}%` }]} />
      <View pointerEvents="none" style={[styles.thumb, { backgroundColor: theme.text, left: ratio * Math.max(0, width - 22) }]} />
    </View>
    <View style={styles.row}>
      {[.1, .25, .5, 1].map(p => <TouchableOpacity key={p} disabled={max <= 0} onPress={() => choose(p)} accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${p === 1 ? 'Max' : `${p * 100}%`}`} accessibilityState={{ disabled: max <= 0 }}
        style={[styles.choice, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
        <Text style={{ color: theme.text }}>{p === 1 ? 'Max' : `${p * 100}%`}</Text>
      </TouchableOpacity>)}
    </View>
    <View style={styles.row}>
      <TouchableOpacity style={styles.fine} accessibilityRole="button" accessibilityLabel={`Decrease ${accessibilityLabel}`} onPress={() => adjust(-1)}><Text style={{ color: theme.textSecondary }}>-</Text></TouchableOpacity>
      <Text style={[styles.range, { color: theme.textSecondary }]}>0 to {format(max)}</Text>
      <TouchableOpacity style={styles.fine} accessibilityRole="button" accessibilityLabel={`Increase ${accessibilityLabel}`} onPress={() => adjust(1)}><Text style={{ color: theme.textSecondary }}>+</Text></TouchableOpacity>
    </View>
    {!bounded && <View style={styles.row}>
      <TouchableOpacity style={styles.choice} accessibilityRole="button" accessibilityLabel={`Smaller range for ${accessibilityLabel}`} onPress={() => setRange(Math.max(1, range / 10))}><Text style={{ color: accent.info }}>Smaller range</Text></TouchableOpacity>
      <TouchableOpacity style={styles.choice} accessibilityRole="button" accessibilityLabel={`Larger range for ${accessibilityLabel}`} onPress={() => setRange(Math.min(1e15, range * 10))}><Text style={{ color: accent.info }}>Larger range</Text></TouchableOpacity>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, paddingVertical: responsiveSpacing.sm },
  value: { ...tier1Value, fontSize: responsiveFontSize.lg },
  trackTarget: { height: 44, justifyContent: 'center' },
  track: { position: 'absolute', height: 4, borderRadius: responsiveBorderRadius.full, width: '100%' },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  choice: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: responsiveBorderRadius.md },
  fine: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  range: { flex: 1, textAlign: 'center', fontSize: responsiveFontSize.xs },
});
