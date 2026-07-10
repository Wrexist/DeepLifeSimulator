/**
 * AdRewardOrb — a small "watch ad → cash" reward that drifts in from the LEFT
 * edge of the screen at random during play. Tapping it opens the same clean
 * rewarded-ad sheet the Pulse app uses; watching the ad grants a cash reward
 * scaled to the player's wealth (net worth / cash / bank) so it feels rewarding
 * without being game-breaking.
 *
 * Self-contained: owns its own appear/hide scheduling, animations, reward math,
 * and the ad sheet. Mount once (e.g. on the home screen).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, Gift, DollarSign } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { isFeatureEnabled } from '@/lib/config/featureFlags';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { formatMoney } from '@/utils/moneyFormatting';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import type { GameState } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;
const MONEY_GRADIENT = ['#34D399', '#059669'] as const;

// ── Tuning ──────────────────────────────────────────────────────────────────
// Reward = a small % of net worth, floored/capped so it's meaningful early and
// never game-breaking late.
const REWARD_PCT = 0.015;
const REWARD_MIN = 50;
const REWARD_MAX = 15000;
// Appearance cadence (ms). Randomised within each range.
const FIRST_DELAY: [number, number] = [22000, 48000];
const REPEAT_DELAY: [number, number] = [110000, 210000];
const VISIBLE_MS = 22000; // orb auto-hides if ignored

function rand([lo, hi]: [number, number]) {
  return lo + Math.random() * (hi - lo);
}

function computeReward(state: GameState): number {
  let base = 0;
  try {
    base = calculateNetWorth(state);
  } catch {
    base = 0;
  }
  const cash = state?.stats?.money ?? 0;
  base = Math.max(base || 0, cash, 0);
  const raw = base * REWARD_PCT;
  const clamped = Math.max(REWARD_MIN, Math.min(REWARD_MAX, raw));
  // Round to a clean number ($10 steps).
  return Math.max(REWARD_MIN, Math.round(clamped / 10) * 10);
}

export default function AdRewardOrb() {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'hidden' | 'orb' | 'ad'>('hidden');
  const [reward, setReward] = useState(0);
  const [granted, setGranted] = useState(false);

  const slideX = useRef(new Animated.Value(-160)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  // Latest game state, so a timer that fires later computes the reward off the
  // player's CURRENT wealth (not the value captured when it was scheduled).
  const gsRef = useRef(gameState);
  useEffect(() => { gsRef.current = gameState; });

  // Don't intrude during blocking moments.
  const blocked = !!(
    gameState?.showDeathPopup ||
    gameState?.showWeddingPopup ||
    (gameState?.jailWeeks ?? 0) > 0
  );

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  const hideOrb = useCallback(() => {
    Animated.timing(slideX, { toValue: -160, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setPhase('hidden');
    });
    pulseLoop.current?.stop();
  }, [slideX]);

  // Schedule the next appearance. Stable identity — reads fresh wealth via gsRef.
  const scheduleNext = useCallback((delay: number) => {
    clearTimers();
    addTimer(() => {
      setReward(computeReward(gsRef.current));
      setGranted(false);
      setPhase('orb');
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First appearance after mount.
  useEffect(() => {
    scheduleNext(rand(FIRST_DELAY));
    return clearTimers;
  }, [scheduleNext]);

  // When the orb becomes visible, animate it in + start the auto-hide timer.
  useEffect(() => {
    if (phase !== 'orb') return;
    if (blocked) {
      // Try again a little later without burning the slot.
      setPhase('hidden');
      scheduleNext(30000);
      return;
    }
    haptic.light();
    slideX.setValue(-160);
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 140 }).start();
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulseLoop.current.start();
    addTimer(() => {
      // Auto-hide if ignored, then schedule the next one.
      hideOrb();
      scheduleNext(rand(REPEAT_DELAY));
    }, VISIBLE_MS);
    return () => { pulseLoop.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Continuously guard: if a blocking popup/jail starts while the orb is
  // already visible, retract it instead of leaving it tappable on top.
  useEffect(() => {
    if (phase === 'orb' && blocked) {
      hideOrb();
      scheduleNext(30000);
    }
  }, [phase, blocked, hideOrb, scheduleNext]);

  const openAd = useCallback(() => {
    if (blocked) return; // never open the ad sheet over a blocking moment
    clearTimers();
    pulseLoop.current?.stop();
    haptic.medium();
    setPhase('ad');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  const dismissOrb = useCallback(() => {
    hideOrb();
    scheduleNext(rand(REPEAT_DELAY));
  }, [hideOrb, scheduleNext]);

  const finishAfterClaim = useCallback(() => {
    saveGame?.();
    addTimer(() => {
      setPhase('hidden');
      slideX.setValue(-160);
      scheduleNext(rand(REPEAT_DELAY));
    }, 1400);
  }, [saveGame, scheduleNext, slideX]);

  const grant = useCallback(() => {
    updateMoney(setGameState, reward, 'Rewarded ad bonus');
    setGranted(true);
    haptic.success();
  }, [reward, setGameState]);

  const handleWatch = useCallback(async () => {
    const adsOn = isFeatureEnabled('adMob') && Platform.OS !== 'web';
    if (adsOn) {
      try {
        const { adMobService } = await import('@/services/AdMobService');
        const shown = await adMobService.showRewardedAd(grant);
        if (shown) {
          finishAfterClaim();
        } else {
          haptic.error();
        }
      } catch (err) {
        logger.warn('[AdRewardOrb] rewarded ad failed', { error: err instanceof Error ? err.message : String(err) });
        haptic.error();
      }
      return;
    }
    // Ads disabled (dev / no-ads build) — grant directly.
    grant();
    finishAfterClaim();
  }, [grant, finishAfterClaim]);

  const dismissAd = useCallback(() => {
    setPhase('hidden');
    slideX.setValue(-160);
    scheduleNext(rand(REPEAT_DELAY));
  }, [scheduleNext, slideX]);

  if (phase === 'hidden') return null;

  return (
    <>
      {/* ── The left-edge orb ─────────────────────────────────── */}
      {phase === 'orb' ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.orbWrap, { top: '42%', transform: [{ translateX: slideX }] }]}
        >
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Pressable
              onPress={openAd}
              accessibilityRole="button"
              accessibilityLabel={`Watch an ad to earn ${formatMoney(reward)}`}
              style={styles.orb}
            >
              <LinearGradient colors={MONEY_GRADIENT as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orbCircle}>
                <Gift size={scale(20)} color="#FFFFFF" strokeWidth={2.3} />
              </LinearGradient>
              <View style={styles.orbLabel}>
                <Text style={styles.orbAmount} numberOfLines={1}>+{formatMoney(reward)}</Text>
                <Text style={styles.orbSub} numberOfLines={1}>Watch ad</Text>
              </View>
              <Pressable onPress={dismissOrb} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.orbClose}>
                <X size={scale(12)} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* ── The rewarded-ad sheet (money variant of the Pulse flow) ── */}
      <Modal visible={phase === 'ad'} transparent animationType="slide" onRequestClose={dismissAd}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: responsiveSpacing.xl + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={dismissAd} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
                <X size={fontScale(22)} color={theme.text} />
              </Pressable>
            </View>

            <LinearGradient colors={MONEY_GRADIENT as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBadge}>
              {granted ? <DollarSign size={scale(34)} color="#FFFFFF" strokeWidth={2.6} /> : <Play size={scale(34)} color="#FFFFFF" strokeWidth={2.4} fill="#FFFFFF" />}
            </LinearGradient>

            <Text style={[styles.title, { color: theme.text }]}>
              {granted ? 'Reward added!' : 'Watch ad → cash'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {granted
                ? `${formatMoney(reward)} was added to your wallet.`
                : 'Watch a short video ad to collect a cash bonus.'}
            </Text>

            <View style={[styles.rewardCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <View style={styles.rewardRow}>
                <DollarSign size={fontScale(20)} color={MONEY_GRADIENT[0]} />
                <Text style={[styles.rewardValue, { color: theme.text }]}>+{formatMoney(reward)}</Text>
                <Text style={[styles.rewardLabel, { color: theme.textSecondary }]}>cash</Text>
              </View>
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                Scaled to your wealth · appears now and then.
              </Text>
            </View>

            {!granted ? (
              <Pressable onPress={handleWatch} accessibilityRole="button" accessibilityLabel="Watch ad" style={styles.cta}>
                <LinearGradient colors={MONEY_GRADIENT as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
                  <Text style={styles.ctaText}>Watch ad ▶</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={dismissAd} accessibilityRole="button" accessibilityLabel="Done" style={styles.cta}>
                <LinearGradient colors={MONEY_GRADIENT as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
                  <Text style={styles.ctaText}>Nice!</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  orbWrap: {
    position: 'absolute',
    left: scale(10),
    zIndex: Z_INDEX.TOAST,
  },
  orb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingRight: scale(12),
    paddingLeft: scale(4),
    paddingVertical: scale(4),
    borderRadius: scale(26),
    backgroundColor: 'rgba(6, 78, 59, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.5)',
    ...getPlatformShadows(8, 0.4, 6, 14),
    elevation: 8,
  },
  orbCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLabel: {
    justifyContent: 'center',
  },
  orbAmount: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  orbSub: {
    color: 'rgba(209, 250, 229, 0.85)',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  orbClose: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    marginLeft: scale(2),
  },
  // ── sheet ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    alignSelf: 'center',
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    textAlign: 'center',
    fontSize: fontScale(22),
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontScale(13),
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.lg,
  },
  rewardCard: {
    borderRadius: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    alignItems: 'center',
    marginBottom: responsiveSpacing.lg,
    gap: 4,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rewardValue: {
    fontSize: fontScale(28),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rewardLabel: {
    fontSize: fontScale(13),
  },
  note: {
    fontSize: fontScale(11),
    marginTop: 4,
    textAlign: 'center',
  },
  cta: {
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  ctaFill: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '800',
  },
});
