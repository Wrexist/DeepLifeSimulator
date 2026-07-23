/**
 * PremiumCrownButton — a high-visibility golden crown that opens the DeepLife+
 * paywall. Self-contained: it renders the crest, owns the paywall modal state,
 * and hides itself for players who already have premium (no point upselling a
 * member). Drop `<PremiumCrownButton />` anywhere it should appear.
 *
 * The crown gently breathes + glows to draw the eye (static under Reduce
 * Motion), and a small "7-DAY FREE" flag advertises the intro offer to lift taps.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, AppState } from 'react-native';
import { Crown } from 'lucide-react-native';
import { scale, fontScale } from '@/utils/scaling';
import { haptic } from '@/utils/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import SubscriptionModal from '@/components/SubscriptionModal';
import { subscriptionService } from '@/services/SubscriptionService';
import { DEEP_LIFE_PLUS_FREE_TRIAL_DAYS, isDeepLifePlusActive } from '@/lib/subscription/deepLifePlus';

const GOLD = '#FACC15';
const GOLD_SOFT = '#FDE68A';
const GOLD_BORDER = 'rgba(250, 204, 21, 0.45)';

interface Props {
  /** Compact = crown-only circle; full = crown + "DeepLife+" pill (default). */
  variant?: 'full' | 'compact';
  style?: object;
}

export default function PremiumCrownButton({ variant = 'full', style }: Props) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  // Re-checked whenever the paywall closes so the crown disappears right after
  // a successful subscribe.
  const [active, setActive] = useState<boolean>(() => isDeepLifePlusActive());

  // Entitlements (subscription / restored IAP) load ASYNC on cold start, so the
  // initial snapshot above can read `false` for an existing member. Re-check
  // once initialization completes and on every foreground, so we never upsell
  // someone who already owns DeepLife+.
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted) setActive(isDeepLifePlusActive());
    };
    void subscriptionService.waitForInitialization().then(refresh).catch(refresh);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion || active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, active, pulse]);

  const onPress = useCallback(() => {
    haptic.light();
    // Always open the app's own DeepLife+ paywall (SubscriptionModal) — the
    // fully-designed surface — rather than RevenueCat's dashboard template.
    // Purchases still route through RevenueCat/StoreKit via subscriptionService.
    setOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setOpen(false);
    setActive(isDeepLifePlusActive());
  }, []);

  // Don't upsell existing members.
  if (active) return null;

  const glowStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
  };
  const crownScale = { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] };
  const showTrial = DEEP_LIFE_PLUS_FREE_TRIAL_DAYS > 0;

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[variant === 'full' ? styles.pill : styles.circle, style]}
        accessibilityRole="button"
        accessibilityLabel={`Open DeepLife Plus${showTrial ? `, ${DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-day free trial` : ''}`}
      >
        <View style={styles.crownWrap}>
          <Animated.View style={[styles.crownGlow, glowStyle]} pointerEvents="none" />
          <Animated.View style={crownScale}>
            <Crown size={scale(18)} color={GOLD} fill={GOLD} />
          </Animated.View>
        </View>

        {variant === 'full' ? (
          <>
            <Text style={styles.label}>
              DeepLife<Text style={styles.plus}>+</Text>
            </Text>
            {showTrial ? (
              <View style={styles.trialFlag}>
                <Text style={styles.trialFlagText}>{DEEP_LIFE_PLUS_FREE_TRIAL_DAYS}-DAY FREE</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </TouchableOpacity>

      <SubscriptionModal visible={open} onClose={onClose} />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderRadius: scale(22),
    paddingLeft: scale(6),
    paddingRight: scale(10),
    paddingVertical: scale(5),
  },
  circle: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  crownWrap: { width: scale(32), height: scale(32), alignItems: 'center', justifyContent: 'center' },
  crownGlow: {
    position: 'absolute',
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    backgroundColor: 'rgba(250, 204, 21, 0.35)',
  },
  label: { fontSize: fontScale(13.5), fontWeight: '900', color: GOLD_SOFT, letterSpacing: 0.2 },
  plus: { color: GOLD },
  trialFlag: {
    backgroundColor: GOLD,
    borderRadius: scale(8),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  trialFlagText: { color: '#1A1206', fontSize: fontScale(9), fontWeight: '900', letterSpacing: 0.3 },
});
