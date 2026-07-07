/**
 * PremiumPassPromo — an occasional, animated upsell popup for the Legacy Pass
 * premium track. Surfaces the value the player is ALREADY leaving on the table
 * (premium rewards earned but unclaimable without a subscription) so the offer
 * is concrete, not a generic "buy premium" nag.
 *
 * Noise discipline (this is the opposite of the earlier fewer-popups work, so
 * it's deliberately restrained): fires ONLY when
 *   - the player is not subscribed,
 *   - they have >= MIN_LOCKED premium rewards already earned and waiting,
 *   - it hasn't shown in the last COOLDOWN_WEEKS,
 *   - at most once per session,
 * and always after the week-advance beats have landed. One tap deep-links into
 * the pass; "Maybe later" backs off for a while.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Sparkles, X, ChevronRight } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFeedback } from '@/utils/feedbackSystem';
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { scale, fontScale } from '@/utils/scaling';
import {
  ensureCurrentSeason,
  getTierForXp,
  getLegacyPassReward,
  MAX_TIER,
} from '@/lib/legacyPass/legacyPass';

const MIN_LOCKED = 3;
const COOLDOWN_WEEKS = 8;
const LAST_WEEK_KEY = 'premium_promo_last_week';

export default function PremiumPassPromo() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { haptic } = useFeedback();
  const legacyPassRaw = useGameSelector((s) => s.legacyPass);
  const weeksLived = useGameSelector((s) => s.weeksLived) ?? 0;
  const hapticEnabled = useGameSelector((s) => s.settings?.hapticFeedback) ?? false;

  const [visible, setVisible] = useState(false);
  const shownThisSession = useRef(false);
  const prevWeek = useRef<number | null>(null);

  const pass = useMemo(() => ensureCurrentSeason(legacyPassRaw), [legacyPassRaw]);
  const currentTier = getTierForXp(pass.xp);

  const stats = useMemo(() => {
    let locked = 0, gems = 0, headline = '';
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      const r = getLegacyPassReward('premium', tier);
      if (!r || currentTier < tier) continue;
      locked += 1;
      if (r.kind === 'gems') gems += r.amount ?? 0;
      if (r.kind !== 'gems') headline = r.label;
    }
    return { locked, gems, headline: headline || 'exclusive cosmetics' };
  }, [currentTier]);

  // Animations.
  const pop = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) { pop.setValue(1); return; }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    const sh = Animated.loop(Animated.timing(shimmer, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }));
    sh.start();
    return () => sh.stop();
  }, [visible, reducedMotion, pop, shimmer]);

  // Trigger on week advance.
  useEffect(() => {
    if (prevWeek.current === null) { prevWeek.current = weeksLived; return; }
    if (weeksLived <= prevWeek.current) { prevWeek.current = weeksLived; return; }
    prevWeek.current = weeksLived;
    if (shownThisSession.current || pass.premiumOwned || stats.locked < MIN_LOCKED) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const last = parseInt((await safeGetItem(LAST_WEEK_KEY)) || '0', 10) || 0;
        if (weeksLived - last < COOLDOWN_WEEKS) return;
        if (cancelled) return;
        shownThisSession.current = true;
        setVisible(true);
        if (hapticEnabled) haptic('success');
        void safeSetItem(LAST_WEEK_KEY, String(weeksLived));
      } catch { /* never break the loop */ }
    }, 1800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [weeksLived, pass.premiumOwned, stats.locked, hapticEnabled, haptic]);

  if (!visible) return null;

  const close = () => setVisible(false);
  const goToPass = () => { setVisible(false); router.push('/(tabs)/progression?openPass=1' as never); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: pop }]}>
          <LinearGradientFallback colors={['#B8860B', '#F5C542', '#FBBF24', '#B8860B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inner}>
            <Animated.View pointerEvents="none" style={[styles.shimmer, { transform: [{ translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-scale(160), scale(320)] }) }, { rotate: '18deg' }] }]} />
            <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Dismiss premium offer" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={scale(18)} color="#3B2F00" />
            </TouchableOpacity>

            <View style={styles.crownWrap}><Crown size={scale(34)} color="#3B2F00" fill="#3B2F00" /></View>
            <Text style={styles.title}>Your rewards are piling up</Text>
            <Text style={styles.body}>
              You've already earned <Text style={styles.bold}>{stats.locked} premium reward{stats.locked === 1 ? '' : 's'}</Text>
              {stats.gems > 0 ? <Text> — including <Text style={styles.bold}>{stats.gems} gems</Text></Text> : null}
              {' '}and <Text style={styles.bold}>{stats.headline}</Text>. Go Premium to claim them all now.
            </Text>

            <View style={styles.valuePill}>
              <Sparkles size={scale(12)} color="#3B2F00" />
              <Text style={styles.valuePillText}>{stats.locked} rewards waiting</Text>
            </View>

            <TouchableOpacity onPress={goToPass} style={styles.ctaPrimary} accessibilityRole="button" accessibilityLabel="Unlock premium rewards">
              <Text style={styles.ctaPrimaryText}>Unlock Premium</Text>
              <ChevronRight size={scale(16)} color="#2A2000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={close} style={styles.ctaSecondary} accessibilityRole="button" accessibilityLabel="Maybe later">
              <Text style={styles.ctaSecondaryText}>Maybe later</Text>
            </TouchableOpacity>
          </LinearGradientFallback>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: scale(24) },
  card: { width: '100%', maxWidth: scale(360), borderRadius: scale(22), overflow: 'hidden', shadowColor: '#F5C542', shadowOpacity: 0.6, shadowRadius: scale(20), shadowOffset: { width: 0, height: scale(6) }, elevation: 10 },
  inner: { padding: scale(20), alignItems: 'center', overflow: 'hidden' },
  shimmer: { position: 'absolute', top: -scale(40), bottom: -scale(40), width: scale(70), backgroundColor: 'rgba(255,255,255,0.35)' },
  closeBtn: { position: 'absolute', top: scale(10), right: scale(10), width: scale(30), height: scale(30), borderRadius: scale(15), backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  crownWrap: { width: scale(60), height: scale(60), borderRadius: scale(30), backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: scale(12) },
  title: { fontSize: fontScale(19), fontWeight: '900', color: '#2A2000', textAlign: 'center', marginBottom: scale(8) },
  body: { fontSize: fontScale(13), fontWeight: '600', color: '#3B2F00', textAlign: 'center', lineHeight: fontScale(19), opacity: 0.95 },
  bold: { fontWeight: '900', color: '#2A2000' },
  valuePill: { flexDirection: 'row', alignItems: 'center', gap: scale(5), backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: scale(999), paddingHorizontal: scale(12), paddingVertical: scale(5), marginTop: scale(14) },
  valuePillText: { fontSize: fontScale(11), fontWeight: '900', color: '#3B2F00', letterSpacing: 0.3 },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(4), backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: scale(999), paddingVertical: scale(12), paddingHorizontal: scale(28), marginTop: scale(16), alignSelf: 'stretch' },
  ctaPrimaryText: { fontSize: fontScale(15), fontWeight: '900', color: '#2A2000' },
  ctaSecondary: { paddingVertical: scale(10), marginTop: scale(4) },
  ctaSecondaryText: { fontSize: fontScale(12.5), fontWeight: '700', color: '#3B2F00', opacity: 0.8 },
});
