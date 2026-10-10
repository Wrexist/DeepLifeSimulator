import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Briefcase, Check, Heart, Store } from 'lucide-react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useTranslation } from '@/hooks/useTranslation';
import { uiPalette } from '@/lib/config/theme';
import { fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';

const directions = ['career', 'business', 'people'] as const;
const icons = [Briefcase, Store, Heart];
const office = require('@/assets/images/scenes/work-office-modern.webp');
const contacts = require('@/assets/images/scenes/contacts-modern.webp');

/** A read-only introduction. Scenario, slot and all save writes retain their existing owners. */
export default function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { t } = useTranslation();
  const [chapter, setChapter] = useState(0);
  const [direction, setDirection] = useState<typeof directions[number]>('career');
  const [moment, setMoment] = useState(0);
  const [legacy, setLegacy] = useState<'family' | 'future'>('family');
  const scroll = useRef<ScrollView>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const leaving = useRef(false);
  const text = (key: string) => t(`intro.${key}`);
  const heading = text(`chapter${chapter}.title`);
  const art = direction === 'people' ? contacts : office;
  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    router.replace('/(onboarding)/Scenarios');
  };
  const back = () => {
    if (chapter > 0) setChapter(chapter - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/(onboarding)/MainMenu');
  };
  useHardwareBack(() => { back(); return true; });
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(heading);
    opacity.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(opacity, { toValue: 1, duration: reduced ? 0 : 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [chapter, heading, opacity, reduced]);

  return <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={back} style={styles.quiet}><ArrowLeft color={uiPalette.muted} size={23} /></TouchableOpacity>
      <View style={styles.brand} accessible accessibilityLabel="Deep Life Simulator">
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={styles.brandText}>DEEP LIFE</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={finish} style={styles.quiet}><Text style={styles.muted}>{text('skip')}</Text></TouchableOpacity>
    </View>
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={text('progress')} accessibilityValue={{ min: 1, max: 3, now: chapter + 1 }}>
      {[0, 1, 2].map(i => <View key={i} style={[styles.segment, i <= chapter && styles.segmentActive]} />)}
    </View>
    <ScrollView ref={scroll} contentContainerStyle={styles.scroll}>
      <Animated.View style={{ opacity }}>
        <Text style={styles.eyebrow}>{text(`chapter${chapter}.label`)}</Text>
        <Text accessibilityRole="header" style={styles.title}>{heading}</Text>
        <Text style={styles.intro}>{text(`chapter${chapter}.body`)}</Text>
        {chapter === 0 && <>
          <View style={styles.hero}>
            <Image source={art} resizeMode="contain" style={styles.art} accessible={false} />
            <View style={styles.note}><Text style={styles.eyebrow}>{text('nextChapter')}</Text><Text style={styles.noteText}>{text(`${direction}.headline`)}</Text></View>
          </View>
          <Text style={styles.eyebrow}>{text('choose')}</Text>
          <View style={styles.options}>{directions.map((id, i) => {
            const Icon = icons[i]; const selected = direction === id;
            return <TouchableOpacity key={id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setDirection(id); setMoment(0); }} style={[styles.option, selected && styles.selected]}>
              {selected ? <Check size={22} color={'#71E2C4'} /> : <Icon size={22} color={uiPalette.muted} />}
              <Text style={styles.optionText}>{text(`${id}.label`)}</Text>
            </TouchableOpacity>;
          })}</View>
          <Text accessibilityLiveRegion="polite" style={styles.detail}>{text(`${direction}.detail`)}</Text>
        </>}
        {chapter === 1 && <>
          <View style={styles.story}>
            <Text style={styles.eyebrow}>{text('illustrative')}</Text>
            <Image source={art} resizeMode="contain" style={styles.storyArt} accessible={false} />
            <View style={styles.progress}>{[0, 1, 2].map(i => <View key={i} style={[styles.segment, i <= moment && styles.segmentActive]} />)}</View>
            <View accessibilityLiveRegion="polite"><Text style={styles.eventTitle}>{text(`${direction}.moment${moment}`)}</Text><Text style={styles.detail}>{text(`${direction}.body${moment}`)}</Text></View>
            <TouchableOpacity accessibilityRole="button" onPress={() => setMoment((moment + 1) % 3)} style={[styles.secondary, styles.selected]}><Text style={styles.optionText}>{text(moment === 2 ? 'replay' : 'reveal')}</Text></TouchableOpacity>
          </View>
          <Text style={styles.detail}>{text('tradeoffs')}</Text>
        </>}
        {chapter === 2 && <>
          <View style={styles.people}>
            <View style={styles.person}><View style={styles.portraitFrame}><Image source={require('@/assets/images/portraits/river.webp')} style={styles.portrait} accessible={false} /></View><Text style={styles.optionText}>{text('generation')}</Text></View>
            <View style={[styles.person, styles.heir]}><View style={styles.portraitFrame}><Image source={require('@/assets/images/portraits/dawn.webp')} style={styles.portrait} accessible={false} /></View><Text style={styles.optionText}>{text('heir')}</Text></View>
          </View>
          <View style={styles.options}>{(['family', 'future'] as const).map(id => <TouchableOpacity key={id} accessibilityRole="button" accessibilityState={{ selected: legacy === id }} onPress={() => setLegacy(id)} style={[styles.option, legacy === id && styles.selected]}><Text style={styles.optionText}>{legacy === id ? '✓ ' : ''}{text(`${id}Label`)}</Text></TouchableOpacity>)}</View>
          <Text accessibilityLiveRegion="polite" style={styles.detail}>{text(`${legacy}Body`)}</Text>
        </>}
        <TouchableOpacity accessibilityRole="button" onPress={() => chapter === 2 ? finish() : setChapter(chapter + 1)} style={styles.primary}>
          <Text style={styles.primaryText}>{text(`chapter${chapter}.action`)}</Text><ArrowRight size={22} color={uiPalette.navy} />
        </TouchableOpacity>
        <Text style={styles.footnote}>{text('footnote')}</Text>
      </Animated.View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: uiPalette.navy },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: responsiveSpacing.md, alignSelf: 'center', width: '100%', maxWidth: 620 },
  quiet: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  logo: { width: 36, height: 36, borderRadius: 9 },
  brandText: { fontSize: fontScale(13), fontWeight: '600', letterSpacing: 2, color: uiPalette.paper },
  muted: { color: uiPalette.muted, fontSize: fontScale(14) },
  progress: { flexDirection: 'row', gap: 8, marginVertical: 16, marginHorizontal: 24 },
  segment: { flex: 1, height: 3, backgroundColor: uiPalette.raised, borderRadius: 2 },
  segmentActive: { backgroundColor: '#71E2C4' },
  scroll: { padding: responsiveSpacing.lg, paddingTop: 8, paddingBottom: 30, width: '100%', maxWidth: 620, alignSelf: 'center' },
  eyebrow: { fontSize: fontScale(11), letterSpacing: 1.5, fontWeight: '600', color: uiPalette.blue, marginBottom: 10 },
  title: { fontSize: fontScale(32), fontWeight: '600', letterSpacing: -1, color: uiPalette.paper },
  intro: { fontSize: fontScale(16), lineHeight: fontScale(24), color: uiPalette.muted, marginTop: 12 },
  hero: { marginVertical: 18 },
  art: { width: '100%', height: 150 },
  note: { backgroundColor: uiPalette.surface, borderColor: uiPalette.raised, borderWidth: 1, padding: 14, borderRadius: responsiveBorderRadius.lg, marginTop: -15, alignSelf: 'flex-start' },
  noteText: { fontSize: fontScale(15), fontWeight: '600', color: uiPalette.paper },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', padding: 10, gap: 8, borderRadius: responsiveBorderRadius.lg, borderWidth: 1, borderColor: uiPalette.raised, backgroundColor: uiPalette.surface },
  selected: { borderColor: '#71E2C4', backgroundColor: '#12383C' },
  optionText: { fontSize: fontScale(13), fontWeight: '600', color: uiPalette.paper, textAlign: 'center' },
  detail: { fontSize: fontScale(15), lineHeight: fontScale(23), color: uiPalette.muted, marginVertical: 14 },
  story: { backgroundColor: uiPalette.surface, padding: 18, borderRadius: responsiveBorderRadius.lg, borderWidth: 1, borderColor: uiPalette.raised, marginTop: 24 },
  storyArt: { width: '100%', height: 145 },
  eventTitle: { fontSize: fontScale(20), fontWeight: '600', color: uiPalette.paper },
  secondary: { minHeight: 48, padding: 14, borderRadius: responsiveBorderRadius.md, borderWidth: 1, justifyContent: 'center' },
  people: { flexDirection: 'row', gap: 20, alignItems: 'flex-start', marginVertical: 24 },
  person: { flex: 1, backgroundColor: uiPalette.surface, padding: 9, borderRadius: responsiveBorderRadius.lg, borderWidth: 1, borderColor: uiPalette.raised, gap: 12 },
  heir: { marginTop: 32, borderColor: '#71E2C4' },
  portraitFrame: { width: '100%', aspectRatio: 1 },
  portrait: { width: '100%', height: '100%', borderRadius: responsiveBorderRadius.md },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#FAF3DF', borderRadius: responsiveBorderRadius.lg, padding: 18, minHeight: 56, marginTop: 24 },
  primaryText: { flexShrink: 1, fontSize: fontScale(16), fontWeight: '600', color: uiPalette.navy },
  footnote: { fontSize: fontScale(12), lineHeight: fontScale(18), color: uiPalette.muted, textAlign: 'center', marginTop: 12 },
});
