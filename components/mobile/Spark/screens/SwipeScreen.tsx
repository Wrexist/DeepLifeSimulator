/**
 * SwipeScreen — main browse surface for Spark.
 *
 * Card stack of dating profiles. Player swipes left to pass, right to like,
 * up to super-like. The bottom action row mirrors the same three gestures
 * with buttons (X / ⭐ / ❤️) plus boost + rewind for accessibility.
 *
 * Uses React Native's PanResponder rather than a 3rd-party gesture handler
 * to stay dep-free and consistent with the rest of this codebase.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Heart, Rewind, Star, X, Zap } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import {
  swipeOnProfile,
  rewindLastSwipe,
} from '@/contexts/game/actions/SparkActions';
import { swipesRemaining, superLikesRemaining } from '@/lib/dating/sparkLogic';
import { DATING_PROFILES, type DatingProfile } from '@/lib/dating/datingProfiles';
import ProfileCard from '../components/ProfileCard';
import EmptyState from '../components/EmptyState';
import { SPARK_ACTION, SPARK_GRADIENT, SPARK_COLORS, SPARK_MOTION } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';

const LinearGradient = LinearGradientFallback;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SUPER_THRESHOLD = -SCREEN_HEIGHT * 0.15;

interface SwipeScreenProps {
  onMatch: (matchId: string, profile: DatingProfile) => void;
  onOpenBoost: () => void;
  onOpenPremium: () => void;
}

export default function SwipeScreen({ onMatch, onOpenBoost, onOpenPremium }: SwipeScreenProps) {
  const { gameState, setGameState, saveGame } = useGame() as any;
  const { theme } = useTheme();

  // Filter out already-swiped, reported, or promoted profiles.
  const queue: DatingProfile[] = useMemo(() => {
    const sp = gameState.sparkApp;
    if (!sp) return DATING_PROFILES;
    const swipedIds = new Set(sp.swipes.map((s: any) => s.profileId));
    const matchedIds = new Set(sp.matches.map((m: any) => m.profileId));
    const reportedIds = new Set(sp.reportedIds);
    return DATING_PROFILES.filter(
      (p) => !swipedIds.has(p.id) && !matchedIds.has(p.id) && !reportedIds.has(p.id),
    );
  }, [gameState.sparkApp]);

  const [cursor, setCursor] = useState(0);
  const top = queue[cursor];
  const next = queue[cursor + 1];

  const remaining = swipesRemaining(gameState);
  const remainingSuper = superLikesRemaining(gameState);
  const hasBoost = !!gameState.sparkApp?.boost?.active;

  // Pan state for the top card.
  const pan = useRef(new Animated.ValueXY()).current;
  const cardRotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-15deg', '0deg', '15deg'],
  });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const superOpacity = pan.y.interpolate({ inputRange: [SUPER_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const finishSwipe = useCallback(
    (direction: 'left' | 'right' | 'super', profile: DatingProfile) => {
      const result = swipeOnProfile(setGameState, gameState, profile.id, direction);
      if (result.success) {
        sparkHaptics.swipe();
        if (result.matched) {
          sparkHaptics.match();
          // P1-5: open the exact match the action just created (its id is returned),
          // instead of guessing the last entry from stale closure state.
          const matchId = result.matchId;
          if (matchId) {
            setTimeout(() => onMatch(matchId, profile), 200);
          }
        }
        saveGame?.();
      } else {
        sparkHaptics.error();
      }
      setCursor((c) => c + 1);
      pan.setValue({ x: 0, y: 0 });
    },
    [setGameState, gameState, onMatch, saveGame, pan],
  );

  const animateOff = useCallback(
    (direction: 'left' | 'right' | 'super', profile: DatingProfile) => {
      const target =
        direction === 'left'
          ? { x: -SCREEN_WIDTH * 1.5, y: 0 }
          : direction === 'right'
            ? { x: SCREEN_WIDTH * 1.5, y: 0 }
            : { x: 0, y: -SCREEN_HEIGHT * 1.5 };
      Animated.timing(pan, {
        toValue: target,
        duration: SPARK_MOTION.cardSwipeOut,
        useNativeDriver: false,
      }).start(() => finishSwipe(direction, profile));
    },
    [pan, finishSwipe],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_evt, gesture) => {
          if (!top) return;
          if (gesture.dy < SUPER_THRESHOLD && remainingSuper > 0) {
            animateOff('super', top);
          } else if (gesture.dx > SWIPE_THRESHOLD) {
            animateOff('right', top);
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            animateOff('left', top);
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
          }
        },
      }),
    [pan, top, animateOff, remainingSuper],
  );

  const handleButton = useCallback(
    (direction: 'left' | 'right' | 'super') => {
      if (!top) return;
      if (direction === 'super' && remainingSuper <= 0) {
        sparkHaptics.error();
        return;
      }
      sparkHaptics.tap();
      animateOff(direction, top);
    },
    [top, remainingSuper, animateOff],
  );

  const handleRewind = useCallback(() => {
    const r = rewindLastSwipe(setGameState, gameState);
    if (r.success) {
      sparkHaptics.tap();
      setCursor((c) => Math.max(0, c - 1));
      saveGame?.();
    } else {
      sparkHaptics.error();
    }
  }, [setGameState, gameState, saveGame]);

  if (!top) {
    return (
      <View style={styles.empty}>
        <EmptyState
          observation={remaining <= 0 ? 'Out of swipes this week.' : 'No more profiles right now.'}
          nudge={remaining <= 0 ? 'Upgrade to Plus for unlimited swipes.' : 'Check back after the week advances.'}
        >
          {remaining <= 0 ? (
            <Pressable onPress={onOpenPremium} accessibilityRole="button" accessibilityLabel="Open Premium">
              <Text style={[styles.cta, { color: SPARK_GRADIENT[0] }]}>Get Spark Plus →</Text>
            </Pressable>
          ) : null}
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Card stack — next card sits behind, top card receives gestures */}
      <View style={styles.deck}>
        {next ? (
          <View style={[styles.cardSlot, styles.cardBehind]}>
            <ProfileCard profile={next} />
          </View>
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
            likeOpacity={likeOpacity as any as number}
            nopeOpacity={nopeOpacity as any as number}
            superOpacity={superOpacity as any as number}
          />
        </Animated.View>
      </View>

      {/* Status row */}
      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: theme.textSecondary }]}>
          {remaining === Number.POSITIVE_INFINITY ? '∞ swipes' : `${remaining} swipes left`}
          {' · '}
          {remainingSuper} super
        </Text>
        {hasBoost ? (
          <View style={styles.boostChip}>
            <Zap size={fontScale(10)} color="#FFFFFF" strokeWidth={2.8} />
            <Text style={styles.boostChipText}>Boost active</Text>
          </View>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <ActionBtn
          icon={Rewind}
          color={SPARK_ACTION.rewind}
          size={touchTargets.medium}
          onPress={handleRewind}
          label="Rewind last swipe"
        />
        <ActionBtn
          icon={X}
          color={SPARK_ACTION.pass}
          size={touchTargets.large}
          onPress={() => handleButton('left')}
          label="Pass"
        />
        <ActionBtn
          icon={Star}
          color={SPARK_ACTION.superLike}
          size={touchTargets.medium}
          onPress={() => handleButton('super')}
          label="Super-like"
          disabled={remainingSuper <= 0}
        />
        <ActionBtn
          icon={Heart}
          color={SPARK_ACTION.like}
          size={touchTargets.large}
          onPress={() => handleButton('right')}
          label="Like"
          gradient
        />
        <ActionBtn
          icon={Zap}
          color={SPARK_ACTION.boost}
          size={touchTargets.medium}
          onPress={onOpenBoost}
          label="Boost"
        />
      </View>
    </View>
  );
}

function ActionBtn({
  icon: Icon, color, size, onPress, label, disabled, gradient,
}: {
  icon: any;
  color: string;
  size: number;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  gradient?: boolean;
}) {
  const body = gradient ? (
    <LinearGradient
      colors={SPARK_GRADIENT as unknown as string[]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.btnFill, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Icon size={fontScale(size * 0.4)} color="#FFFFFF" strokeWidth={2.4} fill="#FFFFFF" />
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.btnFill,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: disabled ? 'rgba(255,255,255,0.2)' : color,
          backgroundColor: 'rgba(15,23,42,0.6)',
        },
      ]}
    >
      <Icon size={fontScale(size * 0.4)} color={disabled ? 'rgba(255,255,255,0.3)' : color} strokeWidth={2.4} />
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
    fontWeight: '700',
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
  cardBehind: {
    transform: [{ scale: 0.94 }],
    opacity: 0.85,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  statusText: {
    fontSize: fontScale(12),
    fontWeight: '500',
  },
  boostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: SPARK_COLORS.accent,
  },
  boostChipText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: responsiveSpacing.sm,
  },
  btnFill: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
});
