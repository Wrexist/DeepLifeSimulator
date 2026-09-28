import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameSelector, shallowEqual } from '@/contexts/game/useGameSelector';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, financeColors } from '@/lib/config/theme';
import { STAT_IDENTITY } from '@/lib/config/statIdentity';
import { formatMoney } from '@/utils/moneyFormatting';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { fontScale, scale } from '@/utils/scaling';

/** Feedback from committed state, never a second weekly simulator or modal. */
export default function WeekChangeToast() {
  const current = useGameSelector(s => ({ week: s.weeksLived, life: `${s.lineageId}:${s.generationNumber}`,
    money: s.stats.money, health: s.stats.health, happiness: s.stats.happiness, energy: s.stats.energy,
    enabled: s.settings.notificationsEnabled !== false, dead: s.showDeathPopup }), shallowEqual);
  const previous = useRef(current);
  const [change, setChange] = useState<{ money: number; health: number; happiness: number; energy: number } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const before = previous.current;
    previous.current = current;
    if (current.life !== before.life || !current.enabled || current.dead) { setChange(null); return; }
    if (current.week !== before.week + 1) return;
    setChange({ money: current.money - before.money, health: current.health - before.health, happiness: current.happiness - before.happiness, energy: current.energy - before.energy });
  }, [current]);
  useEffect(() => {
    if (!change) return;
    fade.setValue(reduced ? 1 : 0);
    const enter = Animated.timing(fade, { toValue: 1, duration: reduced ? 0 : 180, useNativeDriver: true });
    enter.start();
    const timeout = setTimeout(() => setChange(null), 2600);
    return () => { clearTimeout(timeout); enter.stop(); };
  }, [change, fade, reduced]);
  if (!change) return null;
  const money = `${change.money >= 0 ? '+' : '-'}${formatMoney(Math.abs(change.money))}`;
  return <Animated.View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + scale(76), opacity: fade, transform: [{ translateY: reduced ? 0 : fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    accessibilityLiveRegion="polite" accessible accessibilityLabel={`Week advanced. Cash ${money}. Health ${Math.round(change.health)}, happiness ${Math.round(change.happiness)}, energy ${Math.round(change.energy)}.`}>
    <View style={styles.row}><Text style={styles.title}>Week advanced</Text><Text style={[styles.money, { color: change.money >= 0 ? financeColors.cash : financeColors.debt }]}>{money} cash</Text></View>
    <View style={styles.row}>{(['health', 'happiness', 'energy'] as const).map(key => {
      const { Icon, color, label } = STAT_IDENTITY[key];
      const delta = Math.round(change[key]);
      return <View key={key} style={styles.stat}><Icon size={14} color={color} /><Text style={styles.value}>{label} {delta > 0 ? '+' : ''}{delta}</Text></View>;
    })}</View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  toast: { position: 'absolute', left: scale(16), right: scale(16), maxWidth: 560, alignSelf: 'center', borderRadius: scale(16), backgroundColor: colors.dark.surfaceElevated, borderWidth: 1, borderColor: colors.dark.borderStrong, padding: scale(12), gap: scale(8), zIndex: Z_INDEX.CONTENT },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: scale(8) },
  title: { color: colors.dark.text, fontSize: fontScale(14), fontWeight: '600' },
  money: { fontSize: fontScale(14), fontWeight: '600', fontVariant: ['tabular-nums'] },
  stat: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  value: { color: colors.dark.textSecondary, fontSize: fontScale(12), fontVariant: ['tabular-nums'] },
});
