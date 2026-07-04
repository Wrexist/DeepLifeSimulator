/**
 * PostDetailScreen — full view of a single post + its comment thread.
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
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, Heart, MessageCircle, Repeat2, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, touchTargets, getTabBarSafePadding } from '@/utils/scaling';
import { commentOnPost, likePost, repostPost } from '@/contexts/game/actions/PulseActions';
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
        <Header onBack={onClose} text={theme.text} border={theme.border} />
        <View style={styles.missingWrap}>
          <Text style={[styles.missingText, { color: theme.textSecondary }]}>
            This post is no longer in your feed.
          </Text>
        </View>
      </View>
    );
  }

  return (
    // Bottom padding keeps the sticky composer above the floating phone tab bar.
    <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      <Header onBack={onClose} text={theme.text} border={theme.border} />

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
              style={styles.avatar}
              placeholderColor={PULSE_COLORS.tierCelebrity}
              placeholderTextColor="#FFFFFF"
            />
            <View style={styles.authorMeta}>
              <Text style={[styles.handle, { color: theme.text }]}>@{handle}</Text>
              <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>
                {formatRelativeWeek(post.gameWeek, gameState.weeksLived ?? 0)}
              </Text>
            </View>
            {post.isViral ? (
              <View style={[styles.viralPill, { backgroundColor: PULSE_COLORS.tierCelebrity }]}>
                <Text style={styles.viralPillText}>VIRAL</Text>
              </View>
            ) : null}
          </View>

          {/* Body (larger 18pt per plan) */}
          <Text style={[styles.content, { color: theme.text }]}>{post.content}</Text>

          {'photo' in post && post.photo ? (
            <ImageWithFallback uri={post.photo} style={styles.photo} />
          ) : null}

          {/* Stat row — passive counts (likes, reposts, comments, views) */}
          <View style={[styles.statRow, { borderColor: theme.border }]}>
            <StatBlock value={post.likes} label="likes" color={theme.text} muted={theme.textSecondary} />
            <StatBlock value={post.reposts ?? 0} label="reposts" color={theme.text} muted={theme.textSecondary} />
            <StatBlock value={post.comments} label="comments" color={theme.text} muted={theme.textSecondary} />
            {typeof post.views === 'number' ? (
              <StatBlock value={post.views} label="views" color={theme.text} muted={theme.textSecondary} />
            ) : null}
          </View>

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

function Header({ onBack, text, border }: { onBack: () => void; text: string; border: string }) {
  return (
    <View style={[styles.header, { borderBottomColor: border }]}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to feed"
        hitSlop={8}
        style={styles.headerBtn}
      >
        <ArrowLeft size={responsiveIconSize.md} color={text} />
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: text }]}>Post</Text>
      </View>
      <View style={styles.headerBtn} />
    </View>
  );
}

function StatBlock({ value, label, color, muted }: { value: number; label: string; color: string; muted: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color }]}>{formatPulseNumber(value)}</Text>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

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
        fill={active && Icon === Heart ? activeColor : 'transparent'}
      />
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
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
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: fontScale(18),
    fontWeight: '700',
  },
  authorMeta: {
    flex: 1,
  },
  handle: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  viralPill: {
    paddingHorizontal: scale(7),
    paddingVertical: scale(3),
    borderRadius: scale(4),
  },
  viralPillText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 0.6,
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
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: responsiveSpacing.md,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statBlock: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  statLabel: {
    fontSize: fontScale(11),
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
