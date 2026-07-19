/**
 * AdRewardOrb — a small "watch ad → reward" orb that drifts in from the LEFT
 * edge of the screen at random during play. Each appearance randomly offers one
 * of two rewards:
 *
 *   • cash     — a cash bonus scaled to the player's wealth (net worth / cash),
 *                floored/capped so it's meaningful early and never game-breaking.
 *   • vitality — a full refill of Health, Happiness and Energy (+100 each).
 *
 * Tapping the orb opens a clean rewarded-ad sheet; watching the ad grants the
 * reward. When the player owns the Remove Ads IAP (or DeepLife+), the orb never
 * appears at all — see `areAdsRemoved`.
 *
 * Self-contained: owns its own appear/hide scheduling, animations, reward math,
 * and the ad sheet. Mount once (e.g. on the home screen).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, Gift, DollarSign, Heart, Smile, Zap, Sparkles } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { adsAvailable, areAdsRemoved, runRewardedAd, isGranted, isNoFillGrant } from '@/lib/ads/rewardedAd';
import { calculateNetWorth } from '@/lib/statistics/statisticsTracker';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { formatMoney } from '@/utils/moneyFormatting';
import { haptic } from '@/utils/haptics';
import type { GameState } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;
const MONEY_GRADIENT = ['#34D399', '#059669'] as const;
const VITALITY_GRADIENT = ['#FB7185', '#E11D48'] as const;

// Reward kinds offered by the orb, one picked at random per appearance.
type RewardKind = 'cash' | 'vitality';
const VITALITY_BOOST = 100; // +100 Health / Happiness / Energy (caps them at 100)

// ── Tuning ──────────────────────────────────────────────────────────────────
// Cash reward = a small % of net worth, floored/capped so it's meaningful early
// and never game-breaking late. The cap must stay proportional to late-game
// wealth: at $15k a $19M player was offered ~0.08% of their worth per ad and
// (correctly) never tapped it. $500k keeps the full 1.5% meaningful through
// ~$33M net worth and still caps ad income for whales.
const REWARD_PCT = 0.015;
// $1k floor (owner request): a fresh Age-18 character starts with ~$200, so the
// early-game offer must be worth a 30s ad — $50 read as an insult and was never
// tapped. Whales stay bounded by REWARD_MAX exactly as before.
const REWARD_MIN = 1_000;
const REWARD_MAX = 500_000;
// Appearance cadence (ms). Randomised within each range.
const FIRST_DELAY: [number, number] = [22000, 48000];
const REPEAT_DELAY: [number, number] = [110000, 210000];
const VISIBLE_MS = 22000; // orb auto-hides if ignored

function rand([lo, hi]: [number, number]) {
  return lo + Math.random() * (hi - lo);
}

function pickKind(): RewardKind {
  return Math.random() < 0.5 ? 'cash' : 'vitality';
}

// Session-scoped courtesy limit for no-fill grants. When ads are ON for this
// build but there is no inventory to serve (common on TestFlight and brand-new
// ad units), the orb still honours ONE reward per app session via grantOnNoFill.
// Without this cap a whale could farm the capped reward on every respawn with NO
// ad ever shown (~$10M/hr). Module-level so it survives remounts and resets only
// on app restart; a later real-ad grant clears it (inventory has returned).
// Ads-removed players are unaffected — their direct grant is a paid perk.
let noFillGrantedThisSession = false;

// The three stats a vitality reward refills, with their icon + accent.
const VITALITY_ROWS = [
  { key: 'health', label: 'Health', icon: Heart, color: '#FB7185' },
  { key: 'happiness', label: 'Happiness', icon: Smile, color: '#FBBF24' },
  { key: 'energy', label: 'Energy', icon: Zap, color: '#38BDF8' },
] as const;

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

  // 'watching' = the sheet has been dismissed and a fullscreen ad is (about to
  // be) on screen. The component stays mounted so the Modal can animate out and
  // report its native dismissal, but nothing of ours is visible or tappable.
  const [phase, setPhase] = useState<'hidden' | 'orb' | 'ad' | 'watching'>('hidden');
  const [kind, setKind] = useState<RewardKind>('cash');
  const [reward, setReward] = useState(0); // cash amount (unused for vitality)
  const [granted, setGranted] = useState(false);

  // Hard off-switch: a player who paid to remove ads never sees the orb.
  const adsRemoved = areAdsRemoved(gameState);

  const slideX = useRef(new Animated.Value(-160)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  // Re-entrancy guard: blocks a rapid second tap from granting twice before the
  // sheet flips to the "granted" state (the direct-grant path is synchronous).
  const busyRef = useRef(false);
  // Resolves once the sheet Modal has finished its NATIVE dismissal (iOS fires
  // Modal.onDismiss; Android has no such callback), with a timer fallback so a
  // missed callback can never strand the flow mid-watch. Declared here (above the
  // adsRemoved effect) so that effect can resolve a pending waiter if Remove-Ads
  // lands mid-watch.
  const sheetDismissResolver = useRef<(() => void) | null>(null);
  // Latest game state, so a timer that fires later computes the reward off the
  // player's CURRENT wealth (not the value captured when it was scheduled).
  const gsRef = useRef(gameState);
  useEffect(() => { gsRef.current = gameState; });

  // Don't intrude during blocking moments — death/wedding/jail popups, or an
  // auto-mounted LifeMomentModal (a real RN Modal raised whenever the weekly tick
  // sets lifeMoments.pendingMoment). The orb must not slide in over any of them.
  const blocked = !!(
    gameState?.showDeathPopup ||
    gameState?.showWeddingPopup ||
    (gameState?.jailWeeks ?? 0) > 0 ||
    gameState?.lifeMoments?.pendingMoment
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
  // Picks a fresh reward kind each time so cash and vitality alternate randomly.
  const scheduleNext = useCallback((delay: number) => {
    clearTimers();
    addTimer(() => {
      // Courtesy no-fill limit: once an ads-on player has taken their one no-ad
      // courtesy grant this session, stop spawning orbs until a real ad fills
      // again (which clears the flag) — otherwise the capped reward could be
      // farmed with no ad ever shown. Ads-removed players are exempt: their
      // direct grant is a paid perk, not a no-fill fallback.
      if (noFillGrantedThisSession && adsAvailable(areAdsRemoved(gsRef.current))) {
        return;
      }
      const nextKind = pickKind();
      setKind(nextKind);
      setReward(nextKind === 'cash' ? computeReward(gsRef.current) : 0);
      setGranted(false);
      setPhase('orb');
    }, delay);
  }, []);

  // First appearance after mount — but never once the player has removed ads.
  useEffect(() => {
    if (adsRemoved) { clearTimers(); return; }
    scheduleNext(rand(FIRST_DELAY));
    return clearTimers;
  }, [scheduleNext, adsRemoved]);

  // If the Remove Ads entitlement lands mid-session, retract immediately.
  useEffect(() => {
    if (!adsRemoved) return;
    clearTimers();
    // Remove-Ads may have landed DURING an in-flight watch (while awaiting
    // waitForSheetDismissal). clearTimers just cancelled that dismissal fallback,
    // so resolve any pending waiter here or the flow strands with busyRef stuck.
    // Once resolved it continues into runRewardedAd, which re-reads the fresh
    // entitlement and direct-grants (no ad). Only in THIS effect — never in the
    // unmount cleanup, where resolving could fire continuations on a dead
    // component (and a true-unmount orphan is harmless).
    sheetDismissResolver.current?.();
    pulseLoop.current?.stop();
    if (phase !== 'hidden') {
      setPhase('hidden');
      slideX.setValue(-160);
    }
  }, [adsRemoved, phase, slideX]);

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
    if (kind === 'cash') {
      updateMoney(setGameState, reward, 'Rewarded ad bonus');
    } else {
      // +100 to each caps Health/Happiness/Energy at 100 — a full vitality refill.
      updateStats(setGameState, {
        health: VITALITY_BOOST,
        happiness: VITALITY_BOOST,
        energy: VITALITY_BOOST,
      });
    }
    setGranted(true);
    haptic.success();
  }, [kind, reward, setGameState]);

  // (sheetDismissResolver is declared above, near the other refs, so the
  // adsRemoved effect can resolve a pending waiter.)
  const handleSheetDismissed = useCallback(() => {
    sheetDismissResolver.current?.();
    sheetDismissResolver.current = null;
  }, []);
  const waitForSheetDismissal = useCallback(() => {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        sheetDismissResolver.current = null;
        resolve();
      };
      sheetDismissResolver.current = finish;
      // Tracked (not raw) timer: clearTimers on unmount cancels it, so a
      // dismissal fallback can never continue into runRewardedAd after the
      // component is gone. 600ms covers the slide-down animation with margin.
      addTimer(finish, 600);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWatch = useCallback(async () => {
    if (busyRef.current) return; // ignore rapid re-taps while a grant is in flight
    busyRef.current = true;
    try {
      if (adsAvailable(adsRemoved)) {
        // A real fullscreen ad is about to present. Presenting it over our open
        // RN Modal is unsupported by the ad SDK: on iOS the ad's view controller
        // fights the Modal's — when the ad closes, the sheet vanishes natively
        // while an invisible modal window keeps eating every touch (app reads as
        // frozen) and the reward callback is lost. Dismiss the sheet FIRST and
        // let the native dismissal finish before showing the ad.
        setPhase('watching');
        await waitForSheetDismissal();
      }
      // Re-read the entitlement: Remove-Ads may have completed during the
      // dismissal wait. Using the fresh value guarantees a player who just paid
      // to remove ads gets a direct grant here, never a surprise ad.
      const adsRemovedNow = areAdsRemoved(gsRef.current);
      // grantOnNoFill: the orb is rate-limited (appears at most every few
      // minutes), so if there's no ad inventory to serve we still honour the
      // promised reward instead of leaving the player with nothing after tapping
      // "Watch ad". Real ads still play + earn when they fill.
      const outcome = await runRewardedAd(grant, { adsRemoved: adsRemovedNow, grantOnNoFill: true });
      // Courtesy no-fill limit: remember a no-ad courtesy grant so the spawn
      // scheduler stops offering more this session; a real-ad grant means
      // inventory returned, so lift the limit again.
      if (isNoFillGrant(outcome)) {
        noFillGrantedThisSession = true;
      } else if (outcome === 'granted-ad') {
        noFillGrantedThisSession = false;
      }
      if (isGranted(outcome)) {
        // Reopen the sheet in its "Reward added!" state — a fresh present is
        // safe now that the ad's view controller is gone; the short beat lets
        // its window teardown settle before we animate back in. Tracked timer:
        // unmount clears it, so no post-unmount UI work can be scheduled.
        await new Promise<void>((resolve) => { addTimer(resolve, 350); });
        setPhase('ad');
        finishAfterClaim();
      } else {
        // no-fill / error — reward NOT granted. The sheet is already gone;
        // retract fully and let the orb reschedule.
        haptic.error();
        setPhase('hidden');
        slideX.setValue(-160);
        scheduleNext(rand(REPEAT_DELAY));
      }
    } finally {
      busyRef.current = false;
    }
  }, [grant, finishAfterClaim, adsRemoved, waitForSheetDismissal, scheduleNext, slideX]);

  const dismissAd = useCallback(() => {
    setPhase('hidden');
    slideX.setValue(-160);
    scheduleNext(rand(REPEAT_DELAY));
  }, [scheduleNext, slideX]);

  if (adsRemoved || phase === 'hidden') return null;

  // ── Per-kind presentation ──────────────────────────────────────────────────
  const isCash = kind === 'cash';
  const gradient = (isCash ? MONEY_GRADIENT : VITALITY_GRADIENT) as unknown as string[];
  const OrbIcon = isCash ? Gift : Sparkles;
  const orbAmount = isCash ? `+${formatMoney(reward)}` : 'Full refill';
  const orbA11y = isCash
    ? `Watch an ad to earn ${formatMoney(reward)}`
    : 'Watch an ad to refill health, happiness and energy';
  const sheetTitle = granted ? 'Reward added!' : isCash ? 'Watch ad → cash' : 'Watch ad → vitality';
  const sheetSubtitle = granted
    ? isCash
      ? `${formatMoney(reward)} was added to your wallet.`
      : 'Health, Happiness and Energy topped up to full.'
    : isCash
      ? 'Watch a short video ad to collect a cash bonus.'
      : 'Watch a short video ad to refill Health, Happiness and Energy.';
  const GrantedIcon = isCash ? DollarSign : Sparkles;

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
              accessibilityLabel={orbA11y}
              style={[styles.orb, isCash ? styles.orbCash : styles.orbVitality]}
            >
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orbCircle}>
                <OrbIcon size={scale(20)} color="#FFFFFF" strokeWidth={2.3} />
              </LinearGradient>
              <View style={styles.orbLabel}>
                <Text style={styles.orbAmount} numberOfLines={1}>{orbAmount}</Text>
                <Text style={styles.orbSub} numberOfLines={1}>Watch ad</Text>
              </View>
              <Pressable onPress={dismissOrb} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.orbClose}>
                <X size={scale(12)} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </Pressable>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* ── The rewarded-ad sheet (cash / vitality variants) ── */}
      <Modal
        visible={phase === 'ad'}
        transparent
        animationType="slide"
        onRequestClose={dismissAd}
        onDismiss={handleSheetDismissed}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: responsiveSpacing.xl + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={dismissAd} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.closeBtn}>
                <X size={fontScale(22)} color={theme.text} />
              </Pressable>
            </View>

            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBadge}>
              {granted ? <GrantedIcon size={scale(34)} color="#FFFFFF" strokeWidth={2.6} /> : <Play size={scale(34)} color="#FFFFFF" strokeWidth={2.4} fill="#FFFFFF" />}
            </LinearGradient>

            <Text style={[styles.title, { color: theme.text }]}>{sheetTitle}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{sheetSubtitle}</Text>

            <View style={[styles.rewardCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              {isCash ? (
                <>
                  <View style={styles.rewardRow}>
                    <DollarSign size={fontScale(20)} color={MONEY_GRADIENT[0]} />
                    <Text style={[styles.rewardValue, { color: theme.text }]}>+{formatMoney(reward)}</Text>
                    <Text style={[styles.rewardLabel, { color: theme.textSecondary }]}>cash</Text>
                  </View>
                  <Text style={[styles.note, { color: theme.textSecondary }]}>
                    Scaled to your wealth · appears now and then.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.vitalityRows}>
                    {VITALITY_ROWS.map(({ key, label, icon: RowIcon, color }) => (
                      <View key={key} style={styles.vitalityRow}>
                        <RowIcon size={fontScale(18)} color={color} />
                        <Text style={[styles.vitalityLabel, { color: theme.text }]}>{label}</Text>
                        <Text style={[styles.vitalityValue, { color: theme.text }]}>+{VITALITY_BOOST}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.note, { color: theme.textSecondary }]}>
                    Tops each stat up to full · appears now and then.
                  </Text>
                </>
              )}
            </View>

            {!granted ? (
              <Pressable onPress={handleWatch} accessibilityRole="button" accessibilityLabel="Watch ad" style={styles.cta}>
                <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
                  <Text style={styles.ctaText}>Watch ad ▶</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={dismissAd} accessibilityRole="button" accessibilityLabel="Done" style={styles.cta}>
                <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
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
    borderWidth: 1,
    ...getPlatformShadows(8, 0.4, 6, 14),
    elevation: 8,
  },
  orbCash: {
    backgroundColor: 'rgba(6, 78, 59, 0.92)',
    borderColor: 'rgba(52, 211, 153, 0.5)',
  },
  orbVitality: {
    backgroundColor: 'rgba(76, 5, 25, 0.92)',
    borderColor: 'rgba(251, 113, 133, 0.5)',
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
  vitalityRows: {
    alignSelf: 'stretch',
    gap: responsiveSpacing.xs,
  },
  vitalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  vitalityLabel: {
    flex: 1,
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  vitalityValue: {
    fontSize: fontScale(17),
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
