import React, { useMemo } from 'react';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PORTRAITS, type PortraitId } from '@/lib/avatar/portraits';
import { PORTRAIT_ASSETS } from '@/components/avatar/portraitAssets';
import MotionPressable from '@/components/ui/MotionPressable';
import { accent, withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveBorderRadius } from '@/utils/scaling';

export default function PortraitPicker({ value, onChange }: { value: PortraitId; onChange: (id: PortraitId) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const index = PORTRAITS.findIndex(p => p.id === value);
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
      {PORTRAITS.map(p => <MotionPressable key={p.id} onPress={() => onChange(p.id)}
        accessibilityLabel={`${p.name}, ${p.description}`} accessibilityState={{ selected: value === p.id }}
        style={[styles.option, { borderColor: value === p.id ? accent.info : theme.border }]}>
        <Image source={PORTRAIT_ASSETS[p.id]} style={styles.image} accessibilityIgnoresInvertColors />
        {value === p.id && <View style={styles.check}><Check color={theme.text} size={14} /></View>}
        <Text style={styles.caption}>{p.name}</Text>
      </MotionPressable>)}
    </ScrollView>
    <Text style={styles.note}>Curated portraits keep their illustrated appearance. Choose Custom for editable features that age with your life.</Text>
  </View>;
}
const createStyles = (theme: ThemeColors) => StyleSheet.create({
  root: { gap: scale(12) }, heading: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  copy: { flex: 1, alignItems: 'center', gap: scale(4) },
  name: { color: theme.text, fontSize: fontScale(16), fontWeight: '600' },
  caption: { color: theme.textSecondary, fontSize: fontScale(12), textAlign: 'center' },
  note: { color: theme.textSecondary, fontSize: fontScale(12), lineHeight: fontScale(18) },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceInteractive, borderRadius: responsiveBorderRadius.lg },
  options: { gap: scale(8), paddingVertical: scale(4) },
  option: { borderWidth: 2, borderRadius: responsiveBorderRadius.xl, padding: scale(4), gap: scale(4), backgroundColor: theme.surface },
  image: { width: scale(72), height: scale(80), borderRadius: responsiveBorderRadius.lg },
  check: { position: 'absolute', right: scale(8), top: scale(8), padding: scale(4), backgroundColor: withAlpha(accent.info, 0.95), borderRadius: responsiveBorderRadius.full },
});
