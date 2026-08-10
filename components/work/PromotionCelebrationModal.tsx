/**
 * PromotionCelebrationModal — the payoff moment for a career promotion.
 *
 * A promotion is the single biggest recurring beat in the career loop: it is
 * the thing every week of grinding progress was FOR. It used to resolve into a
 * one-line success toast, which spent that entire build-up in about 1.5s of
 * grey text. This is the celebration instead.
 *
 * The sequence is deliberately staged rather than shown all at once, because
 * a reveal that lands in beats reads as an event while everything-at-once reads
 * as a dialog:
 *
 *   0ms    backdrop + rays bloom, crest springs in, success haptic
 *   250ms  "PROMOTED" kicker fades up
 *   450ms  old title strikes through, new title slides in
 *   700ms  salary counts UP from the old number to the new one, ticking
 *          haptics as it climbs — the number the player actually cares about
 *          is watched moving, not just read
 *   1500ms rank pips light up one by one; top rank gets its own reveal
 *
 * Everything honours `useReducedMotion`: with it on, the same content appears
 * immediately with no confetti, no rays, no counting, no shine.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Crown, TrendingUp } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptic } from '@/utils/haptics';
import { playSound } from '@/utils/soundManager';
import { formatMoney } from '@/utils/moneyFormatting';
import { fontScale, scale } from '@/utils/scaling';
import { beginCelebration, endCelebration } from '@/utils/celebrationGate';
import type { PromotionDetails } from '@/contexts/game/types';

const LinearGradient = Gradient;
const { width: SCREEN_W } = Dimensions.get('window');

/** Gold leaf → deep amber. The "premium" read comes from this ramp + the hairline border. */
const GOLD_LIGHT = '#FDE9B0';
const GOLD = '#E8C15C';
const GOLD_DEEP = '#B8862F';
const INK = '#0B0D14';

const COUNT_UP_MS = 1100;
const CONFETTI_COUNT = 22;
const CONFETTI_COLORS = [GOLD, GOLD_LIGHT, '#7DD3A0', '#8AB4F8', '#F0F4FF'];

export interface PromotionCelebrationModalProps {
  visible: boolean;
  promotion: PromotionDetails | null;
  onClose: () => void;
}

export default function PromotionCelebrationModal({
  visible,
  promotion,
  onClose,
}: PromotionCelebrationModalProps) {
  const reducedMotion = useReducedMotion();
  const animate = visible && !reducedMotion;

  const backdrop = useRef(new Animated.Value(0)).current;
  const crest = useRef(new Animated.Value(0)).current;
  const rayspin = useRef(new Animated.Value(0)).current;
  const kicker = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const salaryBlock = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const counter = useRef(new Animated.Value(0)).current;

  const [displaySalary, setDisplaySalary] = useState(0);
  const [pipsLit, setPipsLit] = useState(0);

  const fromSalary = promotion?.fromSalary ?? 0;
  const toSalary = promotion?.toSalary ?? 0;
  const raisePct = fromSalary > 0 ? Math.round(((toSalary - fromSalary) / fromSalary) * 100) : 0;

  // Ladder pips. Capped so a 20-rung career doesn't render a barcode.
  const pips = useMemo(() => {
    const total = Math.max(1, (promotion?.topLevel ?? 0) + 1);
    return Array.from({ length: Math.min(total, 8) }, (_, i) => i);
  }, [promotion?.topLevel]);
  const reachedPips = useMemo(() => {
    const total = Math.max(1, (promotion?.topLevel ?? 0) + 1);
    const level = (promotion?.level ?? 0) + 1;
    return Math.max(1, Math.round((level / total) * pips.length));
  }, [promotion?.level, promotion?.topLevel, pips.length]);

  const handleClose = useCallback(() => {
    if (reducedMotion) {
      onClose();
      return;
    }
    Animated.timing(backdrop, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [backdrop, onClose, reducedMotion]);

  // Keep the review prompt out of the way. Without this the "afterglow" timer
  // would elapse while this modal is still on screen and the store sheet would
  // slam up on top of the celebration — the exact interruption that timing
  // work exists to prevent.
  useEffect(() => {
    if (!visible) return;
    beginCelebration();
    return () => endCelebration();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      backdrop.setValue(0);
      crest.setValue(0);
      kicker.setValue(0);
      title.setValue(0);
      salaryBlock.setValue(0);
      shine.setValue(0);
      counter.setValue(0);
      setDisplaySalary(0);
      setPipsLit(0);
      return;
    }

    haptic.success();
    void playSound('level_up');

    if (reducedMotion) {
      backdrop.setValue(1);
      crest.setValue(1);
      kicker.setValue(1);
      title.setValue(1);
      salaryBlock.setValue(1);
      setDisplaySalary(toSalary);
      setPipsLit(reachedPips);
      return;
    }

    setDisplaySalary(fromSalary);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(crest, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      ]),
      Animated.timing(kicker, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(title, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(salaryBlock, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();

    // Slow continuous ray rotation behind the crest — the "something is
    // happening" bed the staged text lands on top of.
    const rays = Animated.loop(
      Animated.timing(rayspin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rays.start();

    // Shine sweep across the card, twice, then rest.
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shine, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      { iterations: 2 }
    );
    sweep.start();

    // The salary count-up. Driven off a JS listener rather than an interpolated
    // <Animated.Text> because the value has to be money-formatted every frame.
    const countTimer = setTimeout(() => {
      counter.setValue(0);
      Animated.timing(counter, {
        toValue: 1,
        duration: COUNT_UP_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 700);

    let lastTickBucket = -1;
    const sub = counter.addListener(({ value }) => {
      setDisplaySalary(Math.round(fromSalary + (toSalary - fromSalary) * value));
      // Ticking haptics as the number climbs — 6 evenly spaced taps, so the
      // raise is FELT accelerating rather than just observed.
      const bucket = Math.floor(value * 6);
      if (bucket !== lastTickBucket && value < 1) {
        lastTickBucket = bucket;
        haptic.light();
      }
    });

    const pipTimers = pips.map((_, i) =>
      setTimeout(
        () => {
          setPipsLit((n) => Math.max(n, Math.min(i + 1, reachedPips)));
          if (i + 1 <= reachedPips) haptic.light();
        },
        1500 + i * 110
      )
    );

    const topRankTimer = promotion?.isTopRank
      ? setTimeout(() => haptic.heavy(), 1500 + pips.length * 110 + 150)
      : null;

    return () => {
      rays.stop();
      sweep.stop();
      clearTimeout(countTimer);
      counter.removeListener(sub);
      pipTimers.forEach(clearTimeout);
      if (topRankTimer) clearTimeout(topRankTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per open
  }, [visible, reducedMotion]);

  if (!visible || !promotion) return null;

  const cardWidth = Math.min(SCREEN_W - scale(28), scale(330));

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.backdrop, { opacity: reducedMotion ? 1 : backdrop }]}>
        {animate
          ? <ConfettiBurst play count={CONFETTI_COUNT} colors={CONFETTI_COLORS} />
          : null}

        <Animated.View
          testID="promotion-card"
          style={[
            styles.card,
            {
              width: cardWidth,
              opacity: reducedMotion ? 1 : backdrop,
              transform: reducedMotion
                ? []
                : [
                    { scale: crest.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    {
                      translateY: crest.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
                    },
                  ],
            },
          ]}
        >
          <LinearGradient
            colors={['#151A2B', '#0C0F1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Shine sweep — a skewed translucent bar crossing the card face. */}
          {animate ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shine,
                {
                  opacity: shine.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 0.5, 0.5, 0],
                  }),
                  transform: [
                    { rotate: '18deg' },
                    {
                      translateX: shine.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-cardWidth, cardWidth * 1.4],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}

          {/* Crest: rotating rays behind a gold medallion. */}
          <View style={styles.crestWrap}>
            {animate ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.rays,
                  {
                    transform: [
                      {
                        rotate: rayspin.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.ray,
                      { transform: [{ rotate: `${i * 30}deg` }], opacity: i % 2 === 0 ? 0.13 : 0.06 },
                    ]}
                  />
                ))}
              </Animated.View>
            ) : null}

            <Animated.View
              style={[
                styles.medallion,
                {
                  transform: reducedMotion
                    ? []
                    : [{ scale: crest.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                },
              ]}
            >
              <LinearGradient
                colors={[GOLD_LIGHT, GOLD, GOLD_DEEP]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.medallionFill}
              >
                <Crown size={scale(30)} color={INK} strokeWidth={2.4} />
              </LinearGradient>
            </Animated.View>
          </View>

          <Animated.Text
            style={[styles.kicker, { opacity: reducedMotion ? 1 : kicker }]}
            accessibilityRole="header"
          >
            {promotion.isTopRank ? 'TOP OF THE LADDER' : 'PROMOTED'}
          </Animated.Text>

          <Animated.View
            style={{
              opacity: reducedMotion ? 1 : title,
              transform: reducedMotion
                ? []
                : [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            }}
          >
            <Text style={styles.fromTitle} numberOfLines={1}>
              {promotion.fromTitle}
            </Text>
            <Text style={styles.toTitle} numberOfLines={2}>
              {promotion.toTitle}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.salaryBlock, { opacity: reducedMotion ? 1 : salaryBlock }]}>
            <Text style={styles.salaryLabel}>NEW WEEKLY PAY</Text>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryValue} testID="promotion-salary">
                {formatMoney(displaySalary)}
              </Text>
              {raisePct > 0 ? (
                <View style={styles.raiseChip}>
                  <TrendingUp size={scale(12)} color="#7DD3A0" strokeWidth={2.6} />
                  <Text style={styles.raiseChipText}>+{raisePct}%</Text>
                </View>
              ) : null}
            </View>
            {fromSalary > 0 ? (
              // Naming the old number makes the jump concrete — "+59%" is
              // abstract, "was $1,450" is the thing they lived with for weeks.
              <Text style={styles.wasLine}>was {formatMoney(fromSalary)}/wk</Text>
            ) : null}
          </Animated.View>

          <View style={styles.pipRow}>
            {pips.map((i) => (
              <View key={i} style={[styles.pip, i < pipsLit && styles.pipLit]} />
            ))}
          </View>
          <Text style={styles.rankLine}>
            {promotion.isTopRank
              ? 'Nobody outranks you here.'
              : `Rank ${promotion.level + 1} of ${promotion.topLevel + 1}`}
          </Text>

          <TouchableOpacity
            style={styles.cta}
            onPress={handleClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <LinearGradient
              colors={[GOLD_LIGHT, GOLD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaFill}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 12, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  card: {
    borderRadius: scale(26),
    paddingTop: scale(28),
    paddingBottom: scale(22),
    paddingHorizontal: scale(22),
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    // The hairline gold edge is what sells "premium" more than any glow.
    borderColor: 'rgba(232, 193, 92, 0.42)',
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOpacity: 0.28,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  shine: {
    position: 'absolute',
    top: -scale(60),
    bottom: -scale(60),
    width: scale(70),
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  crestWrap: {
    width: scale(112),
    height: scale(112),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(4),
  },
  rays: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: scale(1.5),
    height: scale(132),
    backgroundColor: GOLD,
  },
  medallion: {
    width: scale(66),
    height: scale(66),
    borderRadius: scale(33),
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: GOLD, shadowOpacity: 0.85, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
      android: { elevation: 12 },
      default: { boxShadow: `0 0 ${scale(34)}px rgba(232, 193, 92, 0.55)` } as object,
    }),
  },
  medallionFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    color: GOLD,
    fontSize: fontScale(12),
    fontWeight: '800',
    letterSpacing: scale(3),
    marginBottom: scale(10),
    textAlign: 'center',
  },
  fromTitle: {
    color: 'rgba(226, 232, 240, 0.45)',
    fontSize: fontScale(13),
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'line-through',
    marginBottom: scale(4),
  },
  toTitle: {
    color: '#FFFFFF',
    fontSize: fontScale(21),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: scale(0.2),
  },
  salaryBlock: {
    marginTop: scale(18),
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: scale(14),
    borderRadius: scale(16),
    backgroundColor: 'rgba(232, 193, 92, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 193, 92, 0.2)',
  },
  salaryLabel: {
    color: 'rgba(232, 193, 92, 0.75)',
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: scale(1.6),
    marginBottom: scale(4),
  },
  salaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  salaryValue: {
    color: GOLD_LIGHT,
    fontSize: fontScale(27),
    fontWeight: '900',
    letterSpacing: scale(-0.5),
  },
  wasLine: {
    color: 'rgba(226, 232, 240, 0.42)',
    fontSize: fontScale(11),
    fontWeight: '600',
    marginTop: scale(3),
  },
  raiseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: scale(7),
    paddingVertical: scale(3),
    borderRadius: scale(999),
    backgroundColor: 'rgba(125, 211, 160, 0.14)',
  },
  raiseChipText: {
    color: '#7DD3A0',
    fontSize: fontScale(12),
    fontWeight: '800',
  },
  pipRow: {
    flexDirection: 'row',
    gap: scale(6),
    marginTop: scale(18),
  },
  pip: {
    width: scale(22),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
  },
  pipLit: {
    backgroundColor: GOLD,
  },
  rankLine: {
    color: 'rgba(226, 232, 240, 0.6)',
    fontSize: fontScale(12),
    fontWeight: '600',
    marginTop: scale(8),
  },
  cta: {
    marginTop: scale(20),
    alignSelf: 'stretch',
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  ctaFill: {
    paddingVertical: scale(13),
    alignItems: 'center',
  },
  ctaText: {
    color: INK,
    fontSize: fontScale(15),
    fontWeight: '800',
    letterSpacing: scale(0.3),
  },
});
