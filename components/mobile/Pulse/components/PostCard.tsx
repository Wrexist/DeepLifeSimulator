/**
 * PostCard - single Pulse post in the feed.
 *
 * Renders a `PulseRecentPost` with author handle, content, optional photo,
 * and an engagement row (like / repost / comment / bookmark counts). Tap on
 * like, repost or bookmark calls into `PulseActions` and gives haptic feedback.
 *
 * Viral posts get a subtle tinted rim - no gradient frame, no shimmer sweep.
 *
 * Discriminated-union access (CLAUDE.md hard rule §2): `'photo' in post` etc.
 */

import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, Heart, MessageCircle, Repeat2, Zap } from 'lucide-react-native';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useGameActions } from '@/contexts/GameContext';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { bookmarkPost, likePost, repostPost } from '@/contexts/game/actions/PulseActions';
import { formatPulseNumber } from '../utils/formatPulseNumber';
import { formatRelativeWeek } from '../utils/formatRelativeTime';
import { pulseHaptics } from '../utils/pulseHaptics';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { withAlpha } from '@/lib/config/theme';
import type { PulseRecentPost } from '@/contexts/game/types';

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
  /** True for player's own posts - shows the Boost affordance. */
  isPlayerPost?: boolean;
  /**
   * Optional like handler override. Ambient NPC/trending posts aren't in the
   * player's `recentPosts`, so `likePost` would no-op on them - the parent
   * passes a local toggler instead so their heart still responds.
   */
  onLike?: (postId: string) => void;
  /** Optional repost handler override (same rationale as `onLike`). */
  onRepost?: (postId: string) => void;
}

/**
 * A feed row. Rendered ~60 times in the Pulse FlatList (`recentPosts` is capped
 * at 50, plus ~11 ambient posts), so what it subscribes to matters a lot.
 *
 * It used `useGame()`, which composes `useGameState()` - a plain `useContext`
 * on the provider carrying `gameState`. Every mutation anywhere in the game (a
 * like, a week advance, an unrelated background tick) therefore re-rendered
 * EVERY mounted row, each also rebuilding the merged 9-context object in
 * `useGame`'s memo. The component only needs the SETTER and `saveGame`, and
 * `useSetGameState` exists precisely to provide write access with no state
 * subscription. It was also unmemoized, so a parent render re-rendered all of
 * them regardless. CLAUDE.md 4.1 documents this exact regression.
 * 2026-07-30 audit PERF-2.
 */
function PostCard({
  post, authorHandle, authorPhoto, currentWeeksLived, onOpenDetail, onBoost, isPlayerPost,
  onLike: onLikeOverride, onRepost: onRepostOverride,
}: PostCardProps) {
  const setGameState = useSetGameState();
  const { saveGame } = useGameActions();
  const { theme } = useTheme();

  const handleLike = useCallback(() => {
    pulseHaptics.light();
    if (onLikeOverride) {
      onLikeOverride(post.id);
      return;
    }
    likePost(setGameState, post.id);
    // Deferred: `saveGame` reads `gameStateRef.current`, synced in a
    // POST-COMMIT effect, so a synchronous call persists the PRE-like snapshot.
    // Same convention as BrandDealsScreen/DeathPopup.
    setTimeout(() => { void saveGame?.(); }, 0);
  }, [onLikeOverride, setGameState, saveGame, post.id]);

  const handleRepost = useCallback(() => {
    pulseHaptics.medium();
    if (onRepostOverride) {
      onRepostOverride(post.id);
      return;
    }
    repostPost(setGameState, post.id);
    setTimeout(() => { void saveGame?.(); }, 0);
  }, [onRepostOverride, setGameState, saveGame, post.id]);

  /**
   * Bookmarks. `bookmarkPost` shipped with ZERO call sites while
   * `ProfileScreen`'s Bookmarks tab read `p.isBookmarked` - so the tab could
   * only ever say "No bookmarks yet" (tasks/lessons.md: a leaf with green
   * tests, a context that exposes it, and nothing that calls it). Only rendered
   * for the player's own posts: ambient/NPC posts are not in `recentPosts`, so
   * the action would no-op and the profile tab could never show them.
   */
  const handleBookmark = useCallback(() => {
    pulseHaptics.light();
    bookmarkPost(setGameState, post.id);
    // Same post-commit deferral as `handleLike` - `saveGame` reads a ref that
    // is synced in a post-commit effect.
    setTimeout(() => { void saveGame?.(); }, 0);
  }, [setGameState, saveGame, post.id]);

  // A viral post is marked by its rim and its pill, not by a gradient frame
  // with a shimmer sweep animating over it on every mount.
  const card = (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        post.isViral && { borderColor: withAlpha(PULSE_COLORS.accent, 0.35) },
      ]}
    >
      {/* Author row */}
      <View style={styles.authorRow}>
        {/* R4-B: avatar uses ImageWithFallback so a 404 URI degrades to the
            initial-letter placeholder instead of leaving a transparent gap. */}
        <ImageWithFallback
          uri={authorPhoto}
          fallback={authorHandle}
          // Seeded from the handle so the same author keeps one face down the
          // whole feed. Without this the feed is a column of grey letters.
          face={{ seed: authorHandle, size: scale(34) }}
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
          // Ambient/NPC posts have no detail route - render a static, non-tappable
          // count instead of a button that looks pressable but no-ops.
          onPress={onOpenDetail ? () => onOpenDetail(post.id) : undefined}
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
        {isPlayerPost ? (
          <EngagementButton
            Icon={Bookmark}
            count={post.bookmarks ?? 0}
            active={!!post.isBookmarked}
            activeColor={PULSE_COLORS.bookmark}
            mutedColor={theme.textSecondary}
            onPress={handleBookmark}
            label="Bookmark"
          />
        ) : null}
        {/* Boost - player's own posts only; gem cost shown in the modal */}
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
            <Zap size={fontScale(16)} color={PULSE_COLORS.accent} strokeWidth={2.2} />
            <Text style={[styles.engagementCount, { color: PULSE_COLORS.accent }]}>Boost</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return card;
}

export default React.memo(PostCard);

// ── Sub-components ───────────────────────────────────────────────────────────

interface EngagementButtonProps {
  Icon: typeof Heart;
  count: number;
  active: boolean;
  activeColor: string;
  mutedColor: string;
  /** When omitted the control renders as a static, non-interactive count. */
  onPress?: () => void;
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
  const isBookmarkBtn = Icon === Bookmark;

  const reduced = useReducedMotion();
  const animatedPress = useCallback(() => {
    onPress?.();
    if (reduced) return;
    if (isLikeBtn || isBookmarkBtn) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(scaleAnim, { toValue: 1.0, useNativeDriver: true, speed: 30, bounciness: 8 }),
      ]).start();
    } else if (isRepostBtn) {
      spinAnim.setValue(0);
      Animated.timing(spinAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [onPress, isLikeBtn, isRepostBtn, isBookmarkBtn, scaleAnim, spinAnim, reduced]);

  const transform: any[] = [{ scale: scaleAnim }];
  if (isRepostBtn) {
    transform.push({
      rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    });
  }

  const iconAndCount = (
    <>
      <Animated.View style={{ transform }}>
        <Icon
          size={fontScale(16)}
          color={active ? activeColor : mutedColor}
          strokeWidth={active ? 2.4 : 2}
          fill={active && (isLikeBtn || isBookmarkBtn) ? activeColor : 'transparent'}
        />
      </Animated.View>
      <Text style={[styles.engagementCount, { color: active ? activeColor : mutedColor }]}>
        {formatPulseNumber(count)}
      </Text>
    </>
  );

  // Static (non-interactive) rendering when no handler is wired - e.g. the
  // comment count on ambient posts, which have no detail route to open.
  if (!onPress) {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={`${label} (${count})`}
        style={styles.engagementBtn}
      >
        {iconAndCount}
      </View>
    );
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
      {iconAndCount}
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  authorMeta: {
    flex: 1,
  },
  handle: {
    fontSize: fontScale(13),
    fontWeight: '600',
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
    fontWeight: '600',
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
