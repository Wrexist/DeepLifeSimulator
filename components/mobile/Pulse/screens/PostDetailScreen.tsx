/**
 * PostDetailScreen - full view of a single post + its comment thread.
 *
 * Layout (top → bottom):
 *   [Back header]
 *   [Author row + 18pt body + optional photo + stat-row + action-row]
 *   [CommentThread inline (depth-2)]
 *   [Sticky inline composer (KeyboardAvoidingView)]
 *
 * The composer calls `commentOnPost` from PulseActions; on success, the
 * thread re-renders from the updated `socialMedia.commentThreads`.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Bookmark, Heart, MessageCircle, Repeat2, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '@/components/ui/AppHeader';
import StatStrip from '@/components/ui/StatStrip';
import Chip from '@/components/ui/Chip';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { bookmarkPost, commentOnPost, likePost, repostPost } from '@/contexts/game/actions/PulseActions';
import CommentThread from '../components/CommentThread';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { formatPulseNumber } from '../utils/formatPulseNumber';
import { formatRelativeWeek } from '../utils/formatRelativeTime';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseComment, PulseRecentPost } from '@/contexts/game/types';

interface PostDetailScreenProps {
  postId: string;
  onClose: () => void;
}

export default function PostDetailScreen({ postId, onClose }: PostDetailScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sm = gameState.socialMedia;
  const post: PulseRecentPost | undefined = sm?.recentPosts?.find((p: PulseRecentPost) => p.id === postId);
  const comments: PulseComment[] = useMemo(
    () => sm?.commentThreads?.[postId] ?? [],
    [sm?.commentThreads, postId],
  );

  const handle = gameState.userProfile?.handle
    || gameState.userProfile?.username
    || gameState.userProfile?.name
    || 'you';

  const onLike = useCallback(() => {
    pulseHaptics.light();
    likePost(setGameState, postId);
    saveGame?.();
  }, [setGameState, saveGame, postId]);

  const onRepost = useCallback(() => {
    pulseHaptics.medium();
    repostPost(setGameState, postId);
    saveGame?.();
  }, [setGameState, saveGame, postId]);

  // Bookmark parity with the feed card - the toggle that feeds ProfileScreen's
  // Bookmarks tab. `bookmarkPost` had no caller anywhere before this.
  const onBookmark = useCallback(() => {
    pulseHaptics.light();
    bookmarkPost(setGameState, postId);
    saveGame?.();
  }, [setGameState, saveGame, postId]);

  const onSubmitComment = useCallback(() => {
    const text = draft.trim();
    if (!text) {
      setError('Write something first.');
      pulseHaptics.error();
      return;
    }
    const r = commentOnPost(setGameState, gameState, postId, text);
    if (r.success) {
      pulseHaptics.light();
      setDraft('');
      setError(null);
      saveGame?.();
    } else {
      setError(r.message);
      pulseHaptics.error();
    }
  }, [draft, gameState, setGameState, saveGame, postId]);

  if (!post) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AppHeader title="Post" onBack={onClose} backLabel="Back to feed" />
        <View style={styles.missingWrap}>
          <Text style={[styles.missingText, { color: theme.textSecondary }]}>
            This post is no longer in your feed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    // Full-screen: keep the sticky composer just above the home indicator.
    <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      <AppHeader title="Post" onBack={onClose} backLabel="Back to feed" />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Author row */}
          <View style={styles.authorRow}>
            {/* R5-A */}
            <ImageWithFallback
              uri={gameState.userProfile?.profilePhoto}
              fallback={handle}
              face={{
                seed: gameState.userProfile?.name ?? handle,
                sex: gameState.userProfile?.sex,
                age: gameState.date?.age,
                size: scale(42),
              }}
              style={styles.avatar}
              placeholderColor={PULSE_COLORS.tierCelebrity}
              placeholderTextColor="#FFFFFF"
            />
            <View style={styles.authorMeta}>
              <Text style={[styles.handle, { color: theme.text }]}>@{String(handle ?? '').replace(/^@+/, '')}</Text>
              <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>
                {formatRelativeWeek(post.gameWeek, gameState.weeksLived ?? 0)}
              </Text>
            </View>
            {post.isViral ? <Chip label="Viral" tint={PULSE_COLORS.tierCelebrity} /> : null}
          </View>

          {/* Body (larger 18pt per plan) */}
          <Text style={[styles.content, { color: theme.text }]}>{post.content}</Text>

          {'photo' in post && post.photo ? (
            <ImageWithFallback uri={post.photo} style={styles.photo} />
          ) : null}

          {/* The passive counts. Views rides along as the comment tile's sub
              line rather than a fourth column that appears and disappears. */}
          <StatStrip
            style={[styles.statRow, { borderColor: theme.border }]}
            items={[
              { label: 'Likes', value: formatPulseNumber(post.likes) },
              { label: 'Reposts', value: formatPulseNumber(post.reposts ?? 0) },
              {
                label: 'Comments',
                value: formatPulseNumber(post.comments),
                sub: typeof post.views === 'number' ? `${formatPulseNumber(post.views)} views` : undefined,
              },
            ]}
          />

          {/* Action row */}
          <View style={styles.actionRow}>
            <ActionButton
              Icon={Heart}
              active={!!post.isLiked}
              activeColor={PULSE_COLORS.like}
              mutedColor={theme.textSecondary}
              onPress={onLike}
              label="Like"
            />
            <ActionButton
              Icon={Repeat2}
              active={!!post.isReposted}
              activeColor={PULSE_COLORS.repost}
              mutedColor={theme.textSecondary}
              onPress={onRepost}
              label="Repost"
            />
            <ActionButton
              Icon={Bookmark}
              active={!!post.isBookmarked}
              activeColor={PULSE_COLORS.bookmark}
              mutedColor={theme.textSecondary}
              onPress={onBookmark}
              label="Bookmark"
            />
            <ActionButton
              Icon={MessageCircle}
              active={false}
              activeColor={theme.text}
              mutedColor={theme.textSecondary}
              onPress={() => {/* already on detail screen */}}
              label="Comment"
            />
          </View>

          {/* Comments */}
          <CommentThread comments={comments} currentWeeksLived={gameState.weeksLived ?? 0} />

          <View style={{ height: scale(20) }} />
        </ScrollView>

        {/* Sticky composer */}
        <View style={[styles.composer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TextInput
            value={draft}
            onChangeText={(v) => { setDraft(v); if (error) setError(null); }}
            placeholder="Add a comment…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.composerInput, { color: theme.text, borderColor: theme.border }]}
            multiline
            maxLength={280}
          />
          <Pressable
            onPress={onSubmitComment}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            accessibilityState={{ disabled: !draft.trim() }}
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled, { backgroundColor: PULSE_COLORS.tierCelebrity }]}
            hitSlop={6}
          >
            <Send size={fontScale(16)} color="#FFFFFF" />
          </Pressable>
        </View>
        {error ? (
          <View style={styles.errorBar}>
            <Text style={[styles.errorText, { color: PULSE_COLORS.like }]}>{error}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface ActionButtonProps {
  Icon: typeof Heart;
  active: boolean;
  activeColor: string;
  mutedColor: string;
  onPress: () => void;
  label: string;
}

function ActionButton({ Icon, active, activeColor, mutedColor, onPress, label }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={styles.actionBtn}
    >
      <Icon
        size={fontScale(20)}
        color={active ? activeColor : mutedColor}
        strokeWidth={active ? 2.4 : 2}
        fill={active && (Icon === Heart || Icon === Bookmark) ? activeColor : 'transparent'}
      />
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scale(20),
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
  },
  avatar: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
  },
  authorMeta: {
    flex: 1,
  },
  handle: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  content: {
    fontSize: fontScale(18),
    lineHeight: fontScale(26),
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.md,
  },
  photo: {
    width: '100%',
    height: scale(240),
    marginTop: responsiveSpacing.md,
  },
  statRow: {
    paddingVertical: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.md,
  },
  actionBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: responsiveSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: scale(8),
  },
  composerInput: {
    flex: 1,
    minHeight: scale(36),
    maxHeight: scale(120),
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: scale(6),
    borderRadius: scale(18),
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  errorBar: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: scale(4),
  },
  errorText: {
    fontSize: fontScale(12),
  },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: responsiveSpacing.lg,
  },
  missingText: {
    fontSize: fontScale(14),
  },
});
