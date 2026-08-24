/**
 * FeedScreen - home tab of the Pulse app.
 *
 * Renders a single timeline that interleaves the player's own
 * `socialMedia.recentPosts` with ambient content - posts from relationships
 * the player knows plus trending posts from unknown profiles - so the feed
 * feels alive instead of showing one lonely post. Ambient posts regenerate
 * once per game week and their like/repost toggles are optimistic-only.
 *
 * Above the list: a real inline composer (text input + gradient Post button)
 * for quick text posts, with a chevron to escalate to the full ComposeModal
 * for content-type pickers, hashtags, and sponsor selection.
 *
 * Pull-to-refresh is decorative - Pulse posts are weekly so a swipe doesn't
 * actually fetch.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRight, Send } from 'lucide-react-native';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/contexts/ToastContext';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { composePost } from '@/contexts/game/actions/PulseActions';
import { getEnergyCost } from '@/lib/social/socialMedia';
import { generateNpcPostsForFeed } from '@/lib/social/npcPosts';
import { generateRandomProfilePosts } from '@/lib/social/randomProfiles';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import StoriesRail from '../components/StoriesRail';
import type { NpcStoryTarget } from '../modals/NpcProfileSheet';
import { PULSE_COLORS, PULSE_GRADIENT } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';
import type { PulseRecentPost, SocialPost } from '@/contexts/game/types';

/**
 * A single row in the feed - either the player's own post or an ambient
 * NPC/trending post. Both are rendered through `PostCard`; the discriminant
 * `isPlayerPost` decides whether taps route to global game state (player) or
 * to the local optimistic toggler (ambient).
 */
interface FeedEntry {
  key: string;
  post: PulseRecentPost;
  authorHandle: string;
  authorPhoto?: string;
  isPlayerPost: boolean;
}

/** Local like/repost toggles for ambient posts (not persisted - the feed
 *  refreshes every game week anyway). */
type AmbientEngagement = Record<string, { liked?: boolean; reposted?: boolean }>;

/**
 * Map an NPC-authored `SocialPost` onto the `PulseRecentPost` shape `PostCard`
 * renders, folding in the viewer's local like/repost toggle so the counts and
 * filled icons respond to taps.
 */
function ambientToEntry(sp: SocialPost, engagement?: { liked?: boolean; reposted?: boolean }): FeedEntry {
  const liked = engagement?.liked ?? false;
  const reposted = engagement?.reposted ?? false;
  const post: PulseRecentPost = {
    id: sp.id,
    content: sp.content,
    likes: (sp.likes ?? 0) + (liked ? 1 : 0),
    comments: sp.replies ?? 0,
    timestamp: sp.timestamp,
    gameWeek: sp.gameWeek,
    contentType: (sp.contentType as PulseRecentPost['contentType']) ?? 'text',
    photo: sp.photo,
    isViral: sp.isViral,
    isLiked: liked,
    isReposted: reposted,
    reposts: (sp.reposts ?? 0) + (reposted ? 1 : 0),
  };
  return {
    key: sp.id,
    post,
    authorHandle: sp.authorHandle,
    authorPhoto: sp.authorPhoto,
    isPlayerPost: false,
  };
}

const LinearGradient = Gradient;

interface FeedScreenProps {
  /** Open the composer modal (owned by PulseApp). */
  onCompose: () => void;
  /** Open the PostDetailScreen for the given post id (owned by PulseApp). */
  onOpenPostDetail?: (postId: string) => void;
  /** Open the live-stream setup screen (owned by PulseApp). */
  onGoLive?: () => void;
  /** Open the gem-boost modal for a player post (owned by PulseApp). */
  onBoostPost?: (postId: string) => void;
  /** Tap an NPC story bubble → open the NPC follow sheet (owned by PulseApp). */
  onTapNpc?: (npc: NpcStoryTarget) => void;
}

export default function FeedScreen({ onCompose, onOpenPostDetail, onGoLive, onBoostPost, onTapNpc }: FeedScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const { showError } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');

  const handle = gameState.userProfile?.handle
    || gameState.userProfile?.username
    || gameState.userProfile?.name
    || 'you';
  const avatar = gameState.userProfile?.profilePhoto;
  const currentEnergy = Math.max(0, Math.floor(gameState.stats?.energy ?? 0));
  // A text post really costs getEnergyCost('text') (15), not 5 - gating at 5
  // let the button enable at 5-14 energy only for composePost to silently
  // reject. Gate on the true cost so the button reflects what will happen.
  const textPostCost = getEnergyCost('text');
  const canPost = draft.trim().length > 0 && currentEnergy >= textPostCost;

  const handleInlinePost = useCallback(() => {
    if (draft.trim().length === 0) {
      pulseHaptics.error();
      return;
    }
    const r = composePost(setGameState, gameState, { content: draft, contentType: 'text' });
    if (r.success) {
      pulseHaptics.success();
      setDraft('');
      saveGame?.();
    } else {
      // Surface the real failure reason (e.g. "Not enough energy…") instead of
      // just buzzing - previously a 5-14 energy tap did nothing visible.
      pulseHaptics.error();
      showError(r.message);
    }
  }, [draft, gameState, setGameState, saveGame, showError]);

  const escalateToModal = useCallback(() => {
    onCompose();
  }, [onCompose]);

  const weeksLived = gameState.weeksLived ?? 0;
  const playerPhoto = gameState.userProfile?.profilePhoto;

  // Fresh game state for the ambient generators, read through a ref so they
  // refresh on the WEEK boundary rather than on every unrelated state change
  // (which would reshuffle the whole feed on each render).
  const gsRef = useRef(gameState);
  gsRef.current = gameState;

  const playerPosts: PulseRecentPost[] = useMemo(
    () => gameState.socialMedia?.recentPosts ?? [],
    [gameState.socialMedia?.recentPosts],
  );

  // Ambient feed: posts from relationships the player actually knows, plus
  // trending posts from unknown profiles so the timeline feels alive even for
  // a brand-new player with a single post. Regenerated once per game week.
  const ambientRaw: SocialPost[] = useMemo(() => {
    const npc = generateNpcPostsForFeed(gsRef.current, weeksLived, 4);
    const trending = generateRandomProfilePosts(weeksLived, 7);
    return [...npc, ...trending];

  }, [weeksLived]);

  // Local optimistic like/repost toggles for ambient posts - they aren't in
  // the player's persisted `recentPosts`, so the global actions would no-op.
  const [ambientEngagement, setAmbientEngagement] = useState<AmbientEngagement>({});
  const toggleAmbientLike = useCallback((id: string) => {
    setAmbientEngagement((prev) => ({ ...prev, [id]: { ...prev[id], liked: !prev[id]?.liked } }));
  }, []);
  const toggleAmbientRepost = useCallback((id: string) => {
    setAmbientEngagement((prev) => ({ ...prev, [id]: { ...prev[id], reposted: !prev[id]?.reposted } }));
  }, []);

  // Merge player + ambient into one timeline, newest game week first. Player
  // posts win ties so the player always sees their own latest post up top.
  const entries: FeedEntry[] = useMemo(() => {
    const playerEntries: FeedEntry[] = playerPosts.map((p) => ({
      key: p.id,
      post: p,
      authorHandle: handle,
      authorPhoto: playerPhoto,
      isPlayerPost: true,
    }));
    const ambientEntries: FeedEntry[] = ambientRaw.map((sp) => ambientToEntry(sp, ambientEngagement[sp.id]));
    return [...playerEntries, ...ambientEntries].sort((a, b) => {
      const diff = (b.post.gameWeek ?? 0) - (a.post.gameWeek ?? 0);
      if (diff !== 0) return diff;
      if (a.isPlayerPost !== b.isPlayerPost) return a.isPlayerPost ? -1 : 1;
      return 0;
    });
  }, [playerPosts, ambientRaw, ambientEngagement, handle, playerPhoto]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Feed content is driven by the weekly tick. The pull gesture is here
    // for muscle-memory; clear it after a beat so the spinner doesn't hang.
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedEntry }) => (
      <PostCard
        post={item.post}
        authorHandle={item.authorHandle}
        authorPhoto={item.authorPhoto}
        currentWeeksLived={weeksLived}
        // Only the player's own posts route to global state + detail/boost.
        onOpenDetail={item.isPlayerPost ? onOpenPostDetail : undefined}
        onBoost={item.isPlayerPost ? onBoostPost : undefined}
        isPlayerPost={item.isPlayerPost}
        // Ambient posts toggle like/repost locally so their icons still respond.
        onLike={item.isPlayerPost ? undefined : toggleAmbientLike}
        onRepost={item.isPlayerPost ? undefined : toggleAmbientRepost}
      />
    ),
    [weeksLived, onOpenPostDetail, onBoostPost, toggleAmbientLike, toggleAmbientRepost],
  );

  const keyExtractor = useCallback((e: FeedEntry) => e.key, []);

  // Inline composer: a real text input for quick text posts. The chevron at
  // the right escalates to the full ComposeModal for content-type picker,
  // hashtags, sponsor selection, and the 500-char Verified Pro limit.
  const composerEntry = (
    <View style={[styles.composerEntry, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* R5-A: degrade to initial-letter placeholder on load failure. */}
      <ImageWithFallback
        uri={avatar}
        fallback={handle}
        // The player's own face, so composing a post shows who is posting.
        face={{
          seed: gameState.userProfile?.name ?? handle,
          sex: gameState.userProfile?.sex,
          age: gameState.date?.age,
          size: scale(34),
        }}
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
      {onGoLive ? <StoriesRail onGoLive={onGoLive} onTapNpc={onTapNpc} /> : null}
      {composerEntry}
    </>
  );

  if (entries.length === 0) {
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
      data={entries}
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
