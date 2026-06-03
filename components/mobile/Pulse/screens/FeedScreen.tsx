/**
 * FeedScreen — home tab of the Pulse app.
 *
 * Renders the player's `socialMedia.recentPosts` as a FlatList of PostCards.
 * Above the list: a real inline composer (text input + gradient Post button)
 * for quick text posts, with a chevron to escalate to the full ComposeModal
 * for content-type pickers, hashtags, and sponsor selection.
 *
 * Pull-to-refresh is decorative — Pulse posts are weekly so a swipe doesn't
 * actually fetch.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, Send } from 'lucide-react-native';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { composePost } from '@/contexts/game/actions/PulseActions';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import StoriesRail from '../components/StoriesRail';
import { PULSE_COLORS, PULSE_GRADIENT } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseRecentPost } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

interface FeedScreenProps {
  /** Open the composer modal (owned by PulseApp). */
  onCompose: () => void;
  /** Open the PostDetailScreen for the given post id (owned by PulseApp). */
  onOpenPostDetail?: (postId: string) => void;
  /** Open the live-stream setup screen (owned by PulseApp). */
  onGoLive?: () => void;
  /** Open the gem-boost modal for a player post (owned by PulseApp). */
  onBoostPost?: (postId: string) => void;
}

export default function FeedScreen({ onCompose, onOpenPostDetail, onGoLive, onBoostPost }: FeedScreenProps) {
  const { gameState, setGameState, saveGame } = useGame() as any;
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');

  const handle = gameState.userProfile?.handle
    || gameState.userProfile?.username
    || gameState.userProfile?.name
    || 'you';
  const avatar = gameState.userProfile?.profilePhoto;
  const currentEnergy = Math.max(0, Math.floor(gameState.stats?.energy ?? 0));
  const canPost = draft.trim().length > 0 && currentEnergy >= 5;

  const handleInlinePost = useCallback(() => {
    if (!canPost) {
      pulseHaptics.error();
      return;
    }
    const r = composePost(setGameState, gameState, { content: draft, contentType: 'text' });
    if (r.success) {
      pulseHaptics.success();
      setDraft('');
      saveGame?.();
    } else {
      pulseHaptics.error();
    }
  }, [canPost, draft, gameState, setGameState, saveGame]);

  const escalateToModal = useCallback(() => {
    onCompose();
  }, [onCompose]);

  const posts: PulseRecentPost[] = useMemo(
    () => gameState.socialMedia?.recentPosts ?? [],
    [gameState.socialMedia?.recentPosts],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Feed content is driven by the weekly tick. The pull gesture is here
    // for muscle-memory; clear it after a beat so the spinner doesn't hang.
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: PulseRecentPost }) => (
      <PostCard
        post={item}
        authorHandle={handle}
        authorPhoto={gameState.userProfile?.profilePhoto}
        currentWeeksLived={gameState.weeksLived ?? 0}
        onOpenDetail={onOpenPostDetail}
        onBoost={onBoostPost}
        // recentPosts only contains the player's own posts, so isPlayerPost is always true here.
        isPlayerPost
      />
    ),
    [handle, gameState.userProfile?.profilePhoto, gameState.weeksLived, onOpenPostDetail, onBoostPost],
  );

  const keyExtractor = useCallback((p: PulseRecentPost) => p.id, []);

  // Inline composer: a real text input for quick text posts. The chevron at
  // the right escalates to the full ComposeModal for content-type picker,
  // hashtags, sponsor selection, and the 500-char Verified Pro limit.
  const composerEntry = (
    <View style={[styles.composerEntry, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* R5-A: degrade to initial-letter placeholder on load failure. */}
      <ImageWithFallback
        uri={avatar}
        fallback={handle}
        style={styles.composerAvatar}
        placeholderColor={PULSE_COLORS.tierCelebrity}
        placeholderTextColor="#FFFFFF"
      />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="What's on your mind?"
        placeholderTextColor={theme.textSecondary}
        multiline
        maxLength={280}
        style={[styles.composerInput, { color: theme.text }]}
        accessibilityLabel="Quick post"
      />
      {draft.length > 0 ? (
        <Pressable
          onPress={handleInlinePost}
          disabled={!canPost}
          accessibilityRole="button"
          accessibilityLabel="Post"
          accessibilityState={{ disabled: !canPost }}
          hitSlop={6}
          style={[styles.composerSend, !canPost && styles.composerSendDisabled]}
        >
          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.composerSendFill}
          >
            <Send size={fontScale(14)} color="#FFFFFF" strokeWidth={2.4} />
          </LinearGradient>
        </Pressable>
      ) : (
        <Pressable
          onPress={escalateToModal}
          accessibilityRole="button"
          accessibilityLabel="Open full composer"
          hitSlop={8}
          style={styles.composerExpand}
        >
          <ChevronRight size={fontScale(18)} color={theme.textSecondary} />
        </Pressable>
      )}
    </View>
  );

  const header = (
    <>
      {onGoLive ? <StoriesRail onGoLive={onGoLive} /> : null}
      {composerEntry}
    </>
  );

  if (posts.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {header}
        <EmptyState
          observation="Your feed is quiet."
          nudge="Compose a post or follow someone to fill it."
        >
          <Pressable onPress={onCompose} accessibilityRole="button" accessibilityLabel="Compose first post">
            <Text style={[styles.cta, { color: PULSE_GRADIENT[0] }]}>Compose your first post →</Text>
          </Pressable>
        </EmptyState>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={PULSE_GRADIENT[0]}
          colors={[PULSE_GRADIENT[0]]}
        />
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flex: 1,
  },
  listContent: {
    paddingBottom: scale(140),
  },
  composerEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: responsiveSpacing.sm,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(13),
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerAvatar: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    marginTop: scale(2),
  },
  composerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarInitial: {
    color: '#FFFFFF',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  composerInput: {
    flex: 1,
    fontSize: fontScale(14),
    lineHeight: fontScale(20),
    minHeight: scale(32),
    maxHeight: scale(100),
    paddingTop: scale(6),
    paddingBottom: scale(4),
    textAlignVertical: 'top',
  },
  composerSend: {
    borderRadius: scale(16),
    overflow: 'hidden',
    marginTop: scale(2),
  },
  composerSendDisabled: {
    opacity: 0.5,
  },
  composerSendFill: {
    width: scale(32),
    height: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerExpand: {
    width: scale(32),
    height: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(2),
  },
  cta: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
});
