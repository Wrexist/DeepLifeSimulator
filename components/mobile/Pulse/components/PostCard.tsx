/**
 * PostCard — single Pulse post in the feed.
 *
 * Renders a `PulseRecentPost` with author handle, content, optional photo,
 * and an engagement row (like / repost / comment counts). Tap on like or
 * repost calls into `PulseActions` and gives haptic feedback.
 *
 * Viral posts get a 1pt magenta→indigo gradient border treatment.
 *
 * Discriminated-union access (CLAUDE.md hard rule §2): `'photo' in post` etc.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart, MessageCircle, Repeat2, Zap } from 'lucide-react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { likePost, repostPost } from '@/contexts/game/actions/PulseActions';
import { formatPulseNumber } from '../utils/formatPulseNumber';
import { formatRelativeWeek } from '../utils/formatRelativeTime';
import { pulseHaptics } from '../utils/pulseHaptics';
import { PULSE_COLORS, PULSE_GRADIENT } from '../styles/pulseTheme';
import type { PulseRecentPost } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

interface PostCardProps {
  post: PulseRecentPost;
  /** Player's handle (shown as the author). NPC posts can override this prop. */
  authorHandle: string;
  /** Avatar / profile photo URI. Falls back to a tinted placeholder circle. */
  authorPhoto?: string;
  /** Current weeksLived for relative-time rendering. */
  currentWeeksLived: number;
  /** Tap on the comment icon → open PostDetailScreen with this post's id. */
  onOpenDetail?: (postId: string) => void;
  /** Tap on the "Boost" affordance → open the gem-boost modal (player posts only). */
  onBoost?: (postId: string) => void;
  /** True for player's own posts — shows the Boost affordance. */
  isPlayerPost?: boolean;
  /**
   * Optional like handler override. Ambient NPC/trending posts aren't in the
   * player's `recentPosts`, so `likePost` would no-op on them — the parent
   * passes a local toggler instead so their heart still responds.
   */
  onLike?: (postId: string) => void;
  /** Optional repost handler override (same rationale as `onLike`). */
  onRepost?: (postId: string) => void;
}

export default function PostCard({
  post, authorHandle, authorPhoto, currentWeeksLived, onOpenDetail, onBoost, isPlayerPost,
  onLike: onLikeOverride, onRepost: onRepostOverride,
}: PostCardProps) {
  const { setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  const handleLike = useCallback(() => {
    pulseHaptics.light();
    if (onLikeOverride) {
      onLikeOverride(post.id);
      return;
    }
    likePost(setGameState, post.id);
    saveGame?.();
  }, [onLikeOverride, setGameState, saveGame, post.id]);

  const handleRepost = useCallback(() => {
    pulseHaptics.medium();
    if (onRepostOverride) {
      onRepostOverride(post.id);
      return;
    }
    repostPost(setGameState, post.id);
    saveGame?.();
  }, [onRepostOverride, setGameState, saveGame, post.id]);

  const card = (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Author row */}
      <View style={styles.authorRow}>
        {/* R4-B: avatar uses ImageWithFallback so a 404 URI degrades to the
            initial-letter placeholder instead of leaving a transparent gap. */}
        <ImageWithFallback
          uri={authorPhoto}
          fallback={authorHandle}
          style={styles.avatar}
          placeholderColor={PULSE_COLORS.tierCelebrity}
          placeholderTextColor="#FFFFFF"
        />
        <View style={styles.authorMeta}>
          <Text style={[styles.handle, { color: theme.text }]} numberOfLines={1}>
            @{String(authorHandle ?? '').replace(/^@+/, '')}
          </Text>
          <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>
            {formatRelativeWeek(post.gameWeek, currentWeeksLived)}
          </Text>
        </View>
        {post.isViral ? (
          <View style={[styles.viralPill, { backgroundColor: PULSE_COLORS.tierCelebrity }]}>
            <Text style={styles.viralPillText}>VIRAL</Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <Text style={[styles.content, { color: theme.text }]}>{post.content}</Text>

      {/* Optional photo. R4-B: failure leaves no transparent gap. */}
      {'photo' in post && post.photo ? (
        <ImageWithFallback uri={post.photo} style={styles.photo} />
      ) : null}

      {/* Engagement row */}
      <View style={styles.engagementRow}>
        <EngagementButton
          Icon={Heart}
          count={post.likes}
          active={!!post.isLiked}
          activeColor={PULSE_COLORS.like}
          mutedColor={theme.textSecondary}
          onPress={handleLike}
          label="Like"
        />
        <EngagementButton
          Icon={MessageCircle}
          count={post.comments}
          active={false}
          activeColor={theme.text}
          mutedColor={theme.textSecondary}
          onPress={() => onOpenDetail?.(post.id)}
          label="Comment"
        />
        <EngagementButton
          Icon={Repeat2}
          count={post.reposts ?? 0}
          active={!!post.isReposted}
          activeColor={PULSE_COLORS.repost}
          mutedColor={theme.textSecondary}
          onPress={handleRepost}
          label="Repost"
        />
        {/* Boost — player's own posts only; gem cost shown in the modal */}
        {isPlayerPost && onBoost ? (
          <Pressable
            onPress={() => {
              pulseHaptics.light();
              onBoost(post.id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Boost this post"
            hitSlop={8}
            style={styles.engagementBtn}
          >
            <Zap size={fontScale(16)} color={PULSE_GRADIENT[0]} strokeWidth={2.2} />
            <Text style={[styles.engagementCount, { color: PULSE_GRADIENT[0] }]}>Boost</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  // Viral border: wrap the card in a gradient frame with a one-time shimmer
  // sweep on mount (1200ms per plan §2.5). Respects Reduce Motion.
  if (post.isViral) {
    return (
      <LinearGradient
        colors={PULSE_GRADIENT as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.viralFrame}
      >
        <ViralShimmer />
        {card}
      </LinearGradient>
    );
  }

  return card;
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface EngagementButtonProps {
  Icon: typeof Heart;
  count: number;
  active: boolean;
  activeColor: string;
  mutedColor: string;
  onPress: () => void;
  label: string;
}

function EngagementButton({ Icon, count, active, activeColor, mutedColor, onPress, label }: EngagementButtonProps) {
  // Micro-interactions per plan §2.5:
  //   - Like (Heart):  1.0 → 1.3 → 1.0 scale spring on press (~200ms total)
  //   - Repost:        360° spin in 250ms
  //   - Comment:       no animation (opens detail screen instead)
  // Honors Reduce Motion: when enabled, taps still fire but no animation runs.
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  const isLikeBtn = Icon === Heart;
  const isRepostBtn = Icon === Repeat2;

  const reduced = useReducedMotion();
  const animatedPress = useCallback(() => {
    onPress();
    if (reduced) return;
    if (isLikeBtn) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(scaleAnim, { toValue: 1.0, useNativeDriver: true, speed: 30, bounciness: 8 }),
      ]).start();
    } else if (isRepostBtn) {
      spinAnim.setValue(0);
      Animated.timing(spinAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [onPress, isLikeBtn, isRepostBtn, scaleAnim, spinAnim, reduced]);

  const transform: any[] = [{ scale: scaleAnim }];
  if (isRepostBtn) {
    transform.push({
      rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    });
  }

  return (
    <Pressable
      onPress={animatedPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} (${count})`}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={styles.engagementBtn}
    >
      <Animated.View style={{ transform }}>
        <Icon
          size={fontScale(16)}
          color={active ? activeColor : mutedColor}
          strokeWidth={active ? 2.4 : 2}
          fill={active && isLikeBtn ? activeColor : 'transparent'}
        />
      </Animated.View>
      <Text style={[styles.engagementCount, { color: active ? activeColor : mutedColor }]}>
        {formatPulseNumber(count)}
      </Text>
    </Pressable>
  );
}

// Viral-card shimmer: one-time diagonal highlight sweep across the gradient
// frame. ~1200ms total. Honors Reduce Motion (snap-to-end, no animation).
function ViralShimmer() {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();
    return () => {
      progress.stopAnimation();
    };
  }, [progress, reduced]);

  // Slide a 30%-wide highlight band from −30% to +130% of card width.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30%', '130%'],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.55, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shimmerBand, { transform: [{ translateX }], opacity }]}
    />
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  viralFrame: {
    borderRadius: scale(14),
    padding: scale(1.5),
    marginHorizontal: responsiveSpacing.md,
    marginVertical: responsiveSpacing.xs,
    overflow: 'hidden', // contain the shimmer band
  },
  shimmerBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '30%',
    backgroundColor: '#FFFFFF',
  },
  card: {
    borderRadius: scale(13),
    borderWidth: StyleSheet.hairlineWidth,
    padding: responsiveSpacing.md,
    marginHorizontal: responsiveSpacing.md,
    marginVertical: responsiveSpacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  avatar: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  authorMeta: {
    flex: 1,
  },
  handle: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: fontScale(11),
    marginTop: 1,
  },
  viralPill: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  viralPillText: {
    color: '#FFFFFF',
    fontSize: fontScale(9),
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  content: {
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    marginTop: responsiveSpacing.sm,
  },
  photo: {
    width: '100%',
    height: scale(180),
    borderRadius: scale(10),
    marginTop: responsiveSpacing.sm,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: responsiveSpacing.md,
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },
  engagementCount: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
});
