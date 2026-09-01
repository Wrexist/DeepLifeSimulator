/**
 * SwipeScreen - main browse surface for Spark.
 *
 * Card stack of dating profiles. Player swipes left to pass, right to like,
 * up to super-like. The bottom action row mirrors those THREE gestures and
 * nothing else; rewind and boost are chips in the status row above the deck,
 * because they are occasional purchases rather than swipe moves.
 *
 * Uses React Native's PanResponder rather than a 3rd-party gesture handler
 * to stay dep-free and consistent with the rest of this codebase.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Heart, Rewind, Star, X, Zap } from 'lucide-react-native';
import Chip from '@/components/ui/Chip';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useToast } from '@/contexts/ToastContext';
import { withAlpha } from '@/lib/config/theme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import {
  swipeOnProfile,
  rewindLastSwipe,
  dismissCatfishSuspicion,
  REWIND_GEM_COST,
} from '@/contexts/game/actions/SparkActions';
import { swipesRemaining, superLikesRemaining, isCatfish } from '@/lib/dating/sparkLogic';
import { DATING_PROFILES, type DatingProfile } from '@/lib/dating/datingProfiles';
import ProfileCard from '../components/ProfileCard';
import EmptyState from '../components/EmptyState';
import { SPARK_ACTION, SPARK_COLORS, SPARK_GRADIENT, SPARK_MOTION } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';
import { useTimerManager } from '@/hooks/useTimerManager';
import { gameAlert } from '@/utils/gameAlert';

const LinearGradient = Gradient;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SUPER_THRESHOLD = -SCREEN_HEIGHT * 0.15;

interface SwipeScreenProps {
  onMatch: (matchId: string, profile: DatingProfile) => void;
  onOpenBoost: () => void;
  onOpenPremium: () => void;
}

export default function SwipeScreen({ onMatch, onOpenBoost, onOpenPremium }: SwipeScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme, isDark } = useTheme();
  const { showInfo } = useToast();
  // Auto-cleaned timers so the post-match callback can't fire after unmount.
  const timers = useTimerManager();
  const reduced = useReducedMotion();

  // Catfish suspicion - the seed MUST match the one `swipeOnProfile` uses
  // (contexts/game/actions/SparkActions.ts), otherwise the warning chip would
  // contradict the swipe result. A profile the player has deliberately proceeded
  // on (recorded in `dismissedCatfishIds`) no longer shows the chip.
  const catfishSeed = gameState.lineageId ?? 'initial';
  const dismissedCatfish = useMemo(
    () => new Set(gameState.sparkApp?.dismissedCatfishIds ?? []),
    [gameState.sparkApp?.dismissedCatfishIds],
  );
  const showCatfishWarning = (p: DatingProfile): boolean =>
    isCatfish(p, catfishSeed) && !dismissedCatfish.has(p.id);

  // The gender the player is seeking. Saves from before this field existed (or
  // an explicit 'any') should NOT empty the deck - only filter when we have a
  // concrete male/female preference to honor.
  const seeking = gameState.userProfile?.seekingGender;
  const genderFilter = seeking === 'male' || seeking === 'female' ? seeking : null;

  // Filter out already-swiped, reported, or promoted profiles, and profiles
  // whose gender doesn't match the player's orientation.
  const queue: DatingProfile[] = useMemo(() => {
    const sp = gameState.sparkApp;
    const byGender = (p: DatingProfile) => genderFilter == null || p.gender === genderFilter;
    if (!sp) return DATING_PROFILES.filter(byGender);
    // Legacy saves can have sparkApp without these arrays - guard each one.
    const swipedIds = new Set((sp.swipes ?? []).map((s: any) => s.profileId));
    const matchedIds = new Set((sp.matches ?? []).map((m: any) => m.profileId));
    const reportedIds = new Set(sp.reportedIds ?? []);
    return DATING_PROFILES.filter(
      (p) => byGender(p) && !swipedIds.has(p.id) && !matchedIds.has(p.id) && !reportedIds.has(p.id),
    );
  }, [gameState.sparkApp, genderFilter]);

  const [cursor, setCursor] = useState(0);
  const top = queue[cursor];
  const next = queue[cursor + 1];

  const remaining = swipesRemaining(gameState);
  const remainingSuper = superLikesRemaining(gameState);
  const hasBoost = !!gameState.sparkApp?.boost?.active;

  // Pan state for the top card.
  const pan = useRef(new Animated.ValueXY()).current;
  // Behind-card promotion (0 = rest behind, 1 = full front). Driven in parallel
  // with the top card's fly-off so the next card rises into place instead of
  // teleporting when the deck advances.
  const promote = useRef(new Animated.Value(0)).current;
  const cardRotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-15deg', '0deg', '15deg'],
  });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const superOpacity = pan.y.interpolate({ inputRange: [SUPER_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  // Behind card's transform interpolates from its rest pose (0) to full front (1).
  const promoteScale = promote.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const promoteTranslateY = promote.interpolate({ inputRange: [0, 1], outputRange: [scale(12), 0] });
  const promoteOpacity = promote.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  const finishSwipe = useCallback(
    (direction: 'left' | 'right' | 'super', profile: DatingProfile) => {
      const result = swipeOnProfile(setGameState, gameState, profile.id, direction);
      if (result.success) {
        sparkHaptics.swipe();
        // 1d: liking / super-liking a suspected catfish means the player chose to
        // proceed despite the warning. Record that choice so the chip won't
        // re-surface for this profile (e.g. if a rewind brings it back).
        if (result.catfishSuspected && direction !== 'left') {
          dismissCatfishSuspicion(setGameState, profile.id);
        }
        if (result.matched) {
          sparkHaptics.match();
          // 1b: the swipe result carries the catfish signal - surface it so the
          // player learns of the risk at the moment they match.
          if (result.catfishSuspected) {
            showInfo('This match seems suspicious - be cautious about sending money or sharing personal details.');
          }
          // P1-5: open the exact match the action just created (its id is returned),
          // instead of guessing the last entry from stale closure state.
          const matchId = result.matchId;
          if (matchId) {
            timers.setTimeout(() => onMatch(matchId, profile), 200);
          }
        }
        saveGame?.();
      } else {
        sparkHaptics.error();
      }
      // Do NOT advance the cursor: the `queue` memo already drops swiped ids, so
      // a successful swipe removes this profile and queue[cursor] becomes the
      // next one. Incrementing here as well skipped every other profile. On a
      // rejected swipe (out of swipes), nothing changes and the card snaps back.
      pan.setValue({ x: 0, y: 0 });
      // Re-seat the now-revealed behind card at its rest pose instantly (the old
      // top card's promotion has already played out during the fly-off).
      promote.setValue(0);
    },
    [setGameState, gameState, onMatch, saveGame, pan, promote, showInfo],
  );

  const animateOff = useCallback(
    (
      direction: 'left' | 'right' | 'super',
      profile: DatingProfile,
      velocity?: { vx: number; vy: number },
    ) => {
      const target =
        direction === 'left'
          ? { x: -SCREEN_WIDTH * 1.5, y: 0 }
          : direction === 'right'
            ? { x: SCREEN_WIDTH * 1.5, y: 0 }
            : { x: 0, y: -SCREEN_HEIGHT * 1.5 };
      if (reduced) {
        // Reduced motion: no fling, no promote tween - commit instantly.
        promote.setValue(1);
        finishSwipe(direction, profile);
        return;
      }
      // Promote the behind card in parallel with the fly-off - a separate node
      // from pan, so it can run on the native driver. Never gates finishSwipe.
      Animated.timing(promote, {
        toValue: 1,
        duration: SPARK_MOTION.cardSnap,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      // Fling carries the release velocity so fast throws fly faster. PanResponder
      // velocity is px/ms; Animated.spring integrates in seconds, so convert to px/s.
      Animated.spring(pan, {
        toValue: target,
        velocity: velocity
          ? { x: velocity.vx * 1000, y: velocity.vy * 1000 }
          : { x: 0, y: 0 },
        overshootClamping: true,
        restDisplacementThreshold: 10,
        restSpeedThreshold: 10,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) finishSwipe(direction, profile);
      });
    },
    [pan, promote, finishSwipe, reduced],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_evt, gesture) => {
          if (!top) return;
          const throwVelocity = { vx: gesture.vx, vy: gesture.vy };
          if (gesture.dy < SUPER_THRESHOLD && remainingSuper > 0) {
            animateOff('super', top, throwVelocity);
          } else if (gesture.dx > SWIPE_THRESHOLD) {
            animateOff('right', top, throwVelocity);
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            animateOff('left', top, throwVelocity);
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
            // If this gesture interrupted an in-flight fling, the behind card may
            // be mid-promotion - retarget it back to its rest pose alongside the
            // snap-back (starting a new timing supersedes any running one).
            Animated.timing(promote, {
              toValue: 0,
              duration: 160,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [pan, promote, top, animateOff, remainingSuper],
  );

  const handleButton = useCallback(
    (direction: 'left' | 'right' | 'super') => {
      if (!top) return;
      if (direction === 'super' && remainingSuper <= 0) {
        sparkHaptics.error();
        return;
      }
      // Pass/Like also cost a daily swipe - block them (not just Super-like)
      // when the player is out, instead of animating the card away for nothing.
      if (direction !== 'super' && remaining <= 0) {
        sparkHaptics.error();
        return;
      }
      sparkHaptics.tap();
      animateOff(direction, top);
    },
    [top, remaining, remainingSuper, animateOff],
  );

  const doRewind = useCallback(() => {
    const r = rewindLastSwipe(setGameState, gameState);
    if (r.success) {
      sparkHaptics.tap();
      setCursor((c) => Math.max(0, c - 1));
      saveGame?.();
    } else {
      sparkHaptics.error();
      showInfo(r.message);
    }
  }, [setGameState, gameState, saveGame, showInfo]);

  const handleRewind = useCallback(() => {
    // Free tier pays 20 gems - confirm before charging (Boost gets a whole
    // confirming modal; a one-tap silent gem drain here was the outlier).
    const isPremium = gameState.sparkApp?.premium?.perks?.rewindLastSwipe ?? false;
    if (isPremium) {
      doRewind();
      return;
    }
    gameAlert('Rewind last swipe', `Undo your last swipe for ${REWIND_GEM_COST} gems?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Rewind (${REWIND_GEM_COST} gems)`, onPress: doRewind },
    ]);
  }, [gameState, doRewind]);

  if (!top) {
    return (
      <View style={styles.empty}>
        <EmptyState
          observation={remaining <= 0 ? 'Out of swipes this week.' : 'No more profiles right now.'}
          nudge={remaining <= 0 ? 'Upgrade to Plus for unlimited swipes.' : 'Check back after the week advances.'}
        >
          {remaining <= 0 ? (
            <Pressable onPress={onOpenPremium} accessibilityRole="button" accessibilityLabel="Open Premium">
              <Text style={[styles.cta, { color: SPARK_COLORS.accent }]}>Get Spark Plus →</Text>
            </Pressable>
          ) : null}
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Card stack - next card sits behind, top card receives gestures */}
      <View style={styles.deck}>
        {next ? (
          <Animated.View
            style={[
              styles.cardSlot,
              {
                transform: [{ scale: promoteScale }, { translateY: promoteTranslateY }],
                opacity: promoteOpacity,
              },
            ]}
          >
            <ProfileCard profile={next} catfishSuspected={showCatfishWarning(next)} />
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            styles.cardSlot,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate: cardRotate },
              ],
            },
          ]}
          {...responder.panHandlers}
        >
          <ProfileCard
            profile={top}
            catfishSuspected={showCatfishWarning(top)}
            likeOpacity={likeOpacity as any as number}
            nopeOpacity={nopeOpacity as any as number}
            superOpacity={superOpacity as any as number}
          />
        </Animated.View>
      </View>

      {/* Status row - it also holds the two occasional actions. Rewind and
          Boost used to sit in the action row, where five buttons made the deck
          read as a control panel and the one move that matters (Like) had four
          equals beside it. Same handlers, same gating, same costs. */}
      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: theme.textSecondary }]}>
          {remaining === Number.POSITIVE_INFINITY ? '∞ swipes' : `${remaining} swipes left`}
          {' · '}
          {remainingSuper} super
        </Text>
        <View style={styles.statusChips}>
          <Chip
            label="Rewind"
            icon={<Rewind size={fontScale(13)} color={SPARK_ACTION.rewind} />}
            tint={SPARK_ACTION.rewind}
            size="md"
            style={styles.actionChip}
            onPress={handleRewind}
            accessibilityLabel="Rewind last swipe"
          />
          <Chip
            label={hasBoost ? 'Boost active' : 'Boost'}
            icon={<Zap size={fontScale(13)} color={SPARK_ACTION.boost} />}
            tint={SPARK_ACTION.boost}
            size="md"
            selected={hasBoost}
            style={styles.actionChip}
            onPress={onOpenBoost}
            accessibilityLabel={hasBoost ? 'Boost active. Open boost' : 'Boost your profile'}
          />
        </View>
      </View>

      {/* Action buttons - the three swipe gestures, nothing else. */}
      <View style={styles.actionRow}>
        <ActionBtn
          icon={X}
          color={SPARK_ACTION.pass}
          size={touchTargets.large}
          onPress={() => handleButton('left')}
          label="Pass"
          darkMode={isDark}
        />
        <ActionBtn
          icon={Heart}
          color={SPARK_ACTION.like}
          size={touchTargets.large}
          onPress={() => handleButton('right')}
          label="Like"
          gradient
          darkMode={isDark}
        />
        <ActionBtn
          icon={Star}
          color={SPARK_ACTION.superLike}
          size={touchTargets.medium}
          onPress={() => handleButton('super')}
          label="Super-like"
          disabled={remainingSuper <= 0}
          darkMode={isDark}
        />
      </View>
    </View>
  );
}

function ActionBtn({
  icon: Icon, color, size, onPress, label, disabled, gradient, darkMode,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  color: string;
  size: number;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  gradient?: boolean;
  darkMode?: boolean;
}) {
  // Primary (Like) keeps the solid rose gradient - the one loud action.
  // Everything else is a Recipe C tinted glass bubble in its own action hue.
  const disabledFill = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
  const disabledRim = darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)';
  const disabledGlyph = darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)';
  const body = gradient ? (
    <LinearGradient
      colors={SPARK_GRADIENT as unknown as string[]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.btnFill, getPlatformShadows(5, 0.3, 2, 8), { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Icon size={fontScale(size * 0.4)} color="#FFFFFF" strokeWidth={2.4} fill="#FFFFFF" />
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.btnFill,
        getPlatformShadows(4, 0.15, 2, 8),
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: disabled ? disabledRim : withAlpha(color, 0.3),
          backgroundColor: disabled ? disabledFill : withAlpha(color, 0.15),
        },
      ]}
    >
      <Icon size={fontScale(size * 0.4)} color={disabled ? disabledGlyph : color} strokeWidth={2.4} />
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.94 }] }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  cta: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  deck: {
    flex: 1,
    position: 'relative',
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.md,
  },
  statusText: {
    fontSize: fontScale(12),
    fontWeight: '500',
  },
  statusChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  // The shared Chip is a 36pt readout; these two are real spends, so they get
  // the full 44pt target.
  actionChip: {
    minHeight: touchTargets.minimum,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xl,
    paddingTop: responsiveSpacing.sm,
  },
  btnFill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
