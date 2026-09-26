import React, { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PORTRAITS, type PortraitId } from '@/lib/avatar/portraits';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import MotionPressable from '@/components/ui/MotionPressable';
import { accent, withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';

export default function PortraitPicker({ value, onChange }: { value: PortraitId; onChange: (id: PortraitId) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const index = PORTRAITS.findIndex(p => p.id === value);
  const rail = useRef<ScrollView>(null);
  useEffect(() => {
    // Keep the selected portrait visible after arrows, randomize or restoration.
    const stride = scale(72) + scale(4) * 2 + 4 + scale(8);
    rail.current?.scrollTo({ x: Math.max(0, index * stride - scale(8)), animated: false });
  }, [index]);
  const step = (delta: number) => onChange(PORTRAITS[(index + delta + PORTRAITS.length) % PORTRAITS.length].id);
  return <View style={styles.root}>
    <View style={styles.heading}>
      <MotionPressable accessibilityLabel="Previous portrait" onPress={() => step(-1)} style={styles.arrow}>
        <ChevronLeft color={theme.text} size={20} />
      </MotionPressable>
      <View style={styles.copy}>
        <Text style={styles.name}>{PORTRAITS[index].name}</Text>
        <Text style={styles.caption}>{PORTRAITS[index].description}</Text>
      </View>
      <MotionPressable accessibilityLabel="Next portrait" onPress={() => step(1)} style={styles.arrow}>
        <ChevronRight color={theme.text} size={20} />
      </MotionPressable>
    </View>
    <ScrollView ref={rail} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
      {PORTRAITS.map(p => <MotionPressable key={p.id} onPress={() => onChange(p.id)}
        accessibilityLabel={`${p.name}, ${p.description}`} accessibilityState={{ selected: value === p.id }}
        style={[styles.option, { borderColor: value === p.id ? accent.info : theme.border }]}>
        <CharacterAvatar source={{ avatarId: p.id }} size={scale(72)} circular={false} />
        {value === p.id && <View style={styles.check}><Check color={theme.text} size={14} /></View>}
        <Text style={styles.caption}>{p.name}</Text>
      </MotionPressable>)}
    </ScrollView>
    <Text style={styles.note}>Both styles age with your life. Choose Custom to edit individual features. Your saved custom features determine family resemblance.</Text>
  </View>;
}
const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  root: { gap: scale(12) }, heading: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  copy: { flex: 1, alignItems: 'center', gap: scale(4) },
  name: { color: theme.text, fontSize: fontScale(16), fontWeight: '600' },
  caption: { color: theme.textSecondary, fontSize: fontScale(12), textAlign: 'center' },
  note: { color: theme.textSecondary, fontSize: fontScale(12), lineHeight: fontScale(18) },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceInteractive, borderRadius: responsiveBorderRadius.lg },
  options: { gap: scale(8), paddingVertical: scale(4) },
  option: { borderWidth: 2, borderRadius: responsiveBorderRadius.xl, padding: scale(4), gap: scale(4), backgroundColor: theme.surface },
  check: { position: 'absolute', right: scale(8), top: scale(8), padding: scale(4), backgroundColor: withAlpha(accent.info, 0.95), borderRadius: responsiveBorderRadius.full },
});
