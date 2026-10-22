import { uiPalette } from '@/lib/config/theme';
/**
 * RemoveAdsOrb - a small circular OFFER that drifts in from the LEFT edge and
 * sells the Remove Ads IAP. Sibling of `AdRewardOrb`: same footprint and
 * motion, but it opens the shop (where Remove Ads leads the Featured row)
 * instead of playing a rewarded video. It does not open a payment sheet.
 *
 * GATING. It never appears before the banner grace has ended in this life
 * (MON-7: there must be an ad to remove), never once ads are removed (the entitlement can land
 * mid-session), and never in a build where IAP is disabled - offering a product
 * that cannot be bought is a dead tap. It holds back during blocking moments
 * (death/wedding/jail/life moment) exactly like the reward orb.
 *
 * CADENCE. Deliberately slower than the reward orb. That one is a reward the
 * player may want; this is a sales prompt, and a repeated sales prompt is the
 * kind of nag the product brief bans. First appearance after ~2-3 minutes, then
 * no more than once every ~10-15 minutes, and it dismisses for good until the
 * next window.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Ban } from 'lucide-react-native';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { useGemStore } from '@/contexts/GemStoreContext';
import { useInterruptionState } from '@/contexts/InterruptionContext';
import { areAdsRemoved } from '@/lib/ads/rewardedAd';
import { removeAdsOrbUnlocked } from '@/lib/ads/orbGates';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { scale, fontScale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';
import type { GameState } from '@/contexts/game/types';

const FIRST_DELAY: [number, number] = [120000, 180000];
const REPEAT_DELAY: [number, number] = [600000, 900000];
const VISIBLE_MS = 18000;
/** Vertical slot, below the reward orb (42%) so the two never sit on top. */
const ORB_TOP = '56%';

function rand([lo, hi]: [number, number]) {
  return lo + Math.random() * (hi - lo);
}

/**
 * Pure gate: may the offer appear at all? Exported so the decision is tested
 * without mounting the timer-driven component.
 */
export function shouldOfferRemoveAds(
  state: Pick<GameState, 'settings' | 'weeksLived' | 'lifeStartWeek'> | null | undefined,
  iapEnabled: boolean,
): boolean {
  if (!iapEnabled) return false;
  // MON-7: never sell the removal of ads a player has not met yet. Banners
  // start after BANNER_GRACE_WEEKS of this life; this orb waits past that.
  if (!removeAdsOrbUnlocked(state)) return false;
  return !areAdsRemoved(state);
}

export default function RemoveAdsOrb() {
  const { openStore } = useGemStore();

  // Selects one boolean, so this only re-renders when the gate flips.
  const allowed = useGameSelector((s) => shouldOfferRemoveAds(s, FEATURE_FLAGS.iap));
  const blockingMoment = useGameSelector((s) => !!(
    s?.showDeathPopup ||
    s?.showWeddingPopup ||
    (s?.jailWeeks ?? 0) > 0 ||
    s?.lifeMoments?.pendingMoment
  ));
  // Defer to the shared interruption queue: while ANY queued surface holds the
  // slot (the reward orb, a promo, the daily reward, the weekly event) this
  // sales prompt stays out of the way and retries shortly. It reads the queue
  // rather than claiming it, so it never spends the week's interruption budget
  // or pushes a real reward to a later week. (2026-10 audit MON-20)
  const { activeId: queueHolder } = useInterruptionState();
  const blocked = blockingMoment || queueHolder !== null;

  const [visible, setVisible] = useState(false);
  const slideX = useRef(new Animated.Value(-160)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const hide = useCallback(() => {
    Animated.timing(slideX, {
      toValue: -160,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [slideX]);

  const schedule = useCallback((delay: number) => {
    addTimer(() => setVisible(true), delay);
  }, [addTimer]);

  // First appearance after mount, and retract the moment the offer is no longer
  // allowed (entitlement lands, or the build has no IAP).
  useEffect(() => {
    if (!allowed) {
      clearTimers();
      setVisible(false);
      slideX.setValue(-160);
      return;
    }
    clearTimers();
    schedule(rand(FIRST_DELAY));
    return clearTimers;
  }, [allowed, schedule, clearTimers, slideX]);

  // Animate in + auto-hide. Never over a blocking moment; try again shortly.
  useEffect(() => {
    if (!visible) return;
    if (!allowed || blocked) {
      setVisible(false);
      if (allowed) schedule(30000);
      return;
    }
    slideX.setValue(-160);
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 140 }).start();
    addTimer(() => {
      hide();
      schedule(rand(REPEAT_DELAY));
    }, VISIBLE_MS);
    return clearTimers;
  }, [visible, allowed, blocked, slideX, hide, schedule, addTimer, clearTimers]);

  const openOffer = useCallback(() => {
    if (blocked) return;
    clearTimers();
    haptic.medium();
    hide();
    // Open the store on the tab whose Featured row leads with Remove Ads - NOT
    // straight into the purchase sheet. The orb drifts over gameplay, so a tap
    // on it can be accidental; an accidental tap must land on a product card,
    // never on a StoreKit / Play payment sheet. Auto-purchase stays reserved for
    // explicit Buy rows (the death screen's Revival row). (2026-10 audit MON-6)
    openStore('store');
  }, [blocked, clearTimers, hide, openStore]);

  const dismiss = useCallback(() => {
    hide();
    schedule(rand(REPEAT_DELAY));
  }, [hide, schedule]);

  if (!allowed || !visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.orbWrap, { top: ORB_TOP, transform: [{ translateX: slideX }] }]}
    >
      <Pressable
        onPress={openOffer}
        accessibilityRole="button"
        accessibilityLabel="Remove ads offer, opens the shop"
        style={styles.orb}
      >
        <View style={styles.orbCircle}>
          <Ban size={scale(20)} color={uiPalette.white} strokeWidth={2.3} />
        </View>
        <View style={styles.orbLabel}>
          <Text style={styles.orbAmount} numberOfLines={1}>No ads</Text>
          <Text style={styles.orbSub} numberOfLines={1}>Remove ads</Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.orbClose}
        >
          <X size={scale(12)} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orbWrap: { position: 'absolute', left: scale(10), zIndex: 40 },
  orb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(6),
    paddingLeft: scale(4),
    paddingRight: scale(12),
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.92)',
    gap: scale(8),
    maxWidth: scale(210),
  },
  orbCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  orbLabel: { flexShrink: 1 },
  orbAmount: { color: uiPalette.paper, fontSize: fontScale(13), fontWeight: '600', fontVariant: ['tabular-nums'] },
  orbSub: { color: 'rgba(226,232,240,0.72)', fontSize: fontScale(11), fontWeight: '500' },
  orbClose: { marginLeft: scale(4), padding: scale(2) },
});
