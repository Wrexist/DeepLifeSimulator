/**
 * ProfileScreen - player's own Pulse profile.
 *
 * Hero cover + avatar + a three-number StatStrip + InfluenceMeter + bio +
 * a compact SegmentedControl (Posts / Replies / Media / Bookmarks). Tap the
 * verified badge (when unverified) to open the Pulse Pro upsell.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SegmentedControl from '@/components/ui/SegmentedControl';
import StatStrip from '@/components/ui/StatStrip';
import Chip from '@/components/ui/Chip';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { BarChart3, Calendar, Link2, MapPin } from 'lucide-react-native';
import PostCard from '../components/PostCard';
import CommentItem from '../components/CommentItem';
import InfluenceMeter from '../components/InfluenceMeter';
import VerifiedBadge from '../components/VerifiedBadge';
import EmptyState from '../components/EmptyState';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import ImageScrim from '@/components/ui/ImageScrim';
import { formatPulseNumber } from '../utils/formatPulseNumber';
import { PULSE_COLORS } from '../styles/pulseTheme';
import type { PulseRecentPost, PulseComment } from '@/contexts/game/types';

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';

// 'likes' is the historical key; we now surface bookmark-style behavior
// because `isLiked` toggles on the player's own posts (not posts liked by
// others). Keep the key for save/state compat; show "Bookmarks" in the UI.
const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'replies', label: 'Replies' },
  { key: 'media', label: 'Media' },
  { key: 'likes', label: 'Bookmarks' },
];

interface ProfileScreenProps {
  onUpgradePro: () => void;
  /** Tap a post → open PostDetailScreen overlay (owned by PulseApp). */
  onOpenPostDetail?: (postId: string) => void;
  /** Tap the Boost button on a post → open BoostPostModal (owned by PulseApp). */
  onBoostPost?: (postId: string) => void;
  /** Tap "Edit profile" → open ProfileEditModal (owned by PulseApp). */
  onEditProfile?: () => void;
  /** Tap "Creator Studio" → open the Insights overlay (owned by PulseApp). */
  onOpenInsights?: () => void;
}

export default function ProfileScreen({ onUpgradePro, onOpenPostDetail, onBoostPost, onEditProfile, onOpenInsights }: ProfileScreenProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const sm = gameState.socialMedia;
  const profile = gameState.userProfile ?? {};
  const followers = sm?.followers ?? 0;
  // BUG FIX: "Following" read the stale `profile.following` scalar (never
  // written by the follow/unfollow flow), so it was frozen. Derive it from the
  // authoritative follow graph the tick actually maintains; fall back to the old
  // field only if the graph is absent.
  const following = sm?.followGraph?.followingNpcIds?.length ?? profile.following ?? 0;
  const totalPosts = sm?.totalPosts ?? 0;
  const recentPosts: PulseRecentPost[] = sm?.recentPosts ?? [];
  const isVerified = !!profile.verified;

  const displayName =
    profile.displayName || profile.name || profile.handle || 'You';
  const handle = profile.handle || profile.username || 'you';
  const bio = profile.bio || 'No bio yet - tap edit profile to add one.';
  const location = profile.location;
  const website = profile.website;
  const joinedDate = profile.joinedDate;

  const filteredPosts = useCallback(() => {
    switch (activeTab) {
      case 'media':
        return recentPosts.filter((p) => !!p.photo || p.contentType === 'photo' || p.contentType === 'video');
      case 'replies':
        return []; // replies render via playerReplies below, not as PostCards
      case 'likes':
        // Bookmark-style: prefer the explicit `isBookmarked` flag when present;
        // fall back to `isLiked` so existing player saves still surface posts
        // they previously hearted.
        return recentPosts.filter((p) => p.isBookmarked || p.isLiked);
      case 'posts':
      default:
        return recentPosts;
    }
  }, [activeTab, recentPosts]);

  const posts = filteredPosts();

  // Player-authored comments across all post threads, newest first. Drives
  // the "Replies" tab.
  const playerReplies: PulseComment[] = useMemo(() => {
    const threads = sm?.commentThreads ?? {};
    const out: PulseComment[] = [];
    for (const list of Object.values(threads)) {
      for (const c of list) {
        if (c.isPlayerComment) out.push(c);
      }
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }, [sm?.commentThreads]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      {/* Cover photo */}
      <View style={styles.cover}>
        {profile.headerPhoto ? (
          <ImageWithFallback
            uri={profile.headerPhoto}
            fallback={displayName}
            style={styles.coverImg}
          />
        ) : (
          <View style={[styles.coverImg, { backgroundColor: PULSE_COLORS.accent }]} />
        )}
        <ImageScrim height={0.5} strength={0.7} />
      </View>

      {/* Avatar + identity */}
      <View style={styles.identityWrap}>
        <View style={[styles.avatarRing, isVerified ? styles.avatarRingPro : { borderColor: theme.border }]}>
          {profile.profilePhoto ? (
            <ImageWithFallback
              uri={profile.profilePhoto}
              fallback={displayName}
              face={{
                seed: profile.name ?? displayName,
                sex: profile.sex,
                age: gameState.date?.age,
                size: scale(72),
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: PULSE_COLORS.accent }]}>
              <Text style={styles.avatarInitial}>{displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <VerifiedBadge
            verified={isVerified}
            size={fontScale(18)}
            showUpsellOnTapIfUnverified
            onUpsell={onUpgradePro}
          />
        </View>
        <Text style={[styles.handle, { color: theme.textSecondary }]}>@{String(handle ?? '').replace(/^@+/, '')}</Text>

        <Text style={[styles.bio, { color: theme.text }]}>{bio}</Text>

        <View style={styles.metaRow}>
          {location ? (
            <View style={styles.metaItem}>
              <MapPin size={responsiveIconSize.sm} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>{location}</Text>
            </View>
          ) : null}
          {website ? (
            <View style={styles.metaItem}>
              <Link2 size={responsiveIconSize.sm} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: PULSE_COLORS.accent }]} numberOfLines={1}>
                {website}
              </Text>
            </View>
          ) : null}
          {joinedDate ? (
            <View style={styles.metaItem}>
              <Calendar size={responsiveIconSize.sm} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>Joined {joinedDate}</Text>
            </View>
          ) : null}
        </View>

        {/* Edit profile + Creator Studio entries */}
        <View style={styles.actionRow}>
          {onEditProfile ? (
            <Pressable
              onPress={onEditProfile}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              style={[styles.editBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.editBtnText, { color: theme.text }]}>Edit profile</Text>
            </Pressable>
          ) : null}
          {onOpenInsights ? (
            <Pressable
              onPress={onOpenInsights}
              accessibilityRole="button"
              accessibilityLabel="Open Creator Studio insights"
              style={[styles.editBtn, styles.studioBtn, { borderColor: theme.border }]}
            >
              <BarChart3 size={fontScale(14)} color={PULSE_COLORS.accent} />
              <Text style={[styles.editBtnText, { color: theme.text }]}>Creator Studio</Text>
            </Pressable>
          ) : null}
        </View>

        {/* The three numbers the player reads their profile by. */}
        <StatStrip
          style={[styles.statsRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}
          items={[
            { label: 'Followers', value: formatPulseNumber(followers) },
            { label: 'Following', value: formatPulseNumber(following) },
            { label: 'Posts', value: formatPulseNumber(totalPosts) },
          ]}
        />

        {/* Influence meter */}
        <View style={styles.influenceWrap}>
          <InfluenceMeter
            followers={followers}
            tier={sm?.influenceLevel ?? 'novice'}
          />
        </View>

        {/* Pulse Pro upsell strip when not subscribed */}
        {!isVerified ? (
          <View style={styles.proStrip}>
            <Chip
              label="Upgrade to Verified Pro"
              tint={PULSE_COLORS.accent}
              size="md"
              onPress={onUpgradePro}
              accessibilityLabel="Upgrade to Pulse Verified Pro: +25% engagement, blue check, longer posts"
            />
          </View>
        ) : null}
      </View>

      {/* Profile sub-tabs - one shared control, no gradient underline. */}
      <SegmentedControl
        compact
        style={styles.tabs}
        segments={PROFILE_TABS}
        value={activeTab}
        onChange={setActiveTab}
        activeColor={PULSE_COLORS.accent}
      />

      {/* Posts list */}
      <View style={styles.postsWrap}>
        {activeTab === 'replies' ? (
          playerReplies.length === 0 ? (
            <EmptyState
              observation="No replies yet."
              nudge="Open any post and add a comment to see it here."
            />
          ) : (
            playerReplies.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => onOpenPostDetail?.(c.postId)}
                accessibilityRole="button"
                accessibilityLabel="Open post"
              >
                <CommentItem comment={c} currentWeeksLived={gameState.weeksLived ?? 0} />
              </Pressable>
            ))
          )
        ) : posts.length === 0 ? (
          <EmptyState
            observation={
              activeTab === 'posts'
                ? 'No posts yet.'
                : activeTab === 'media'
                ? 'No media posts yet.'
                : 'No bookmarks yet.'
            }
            nudge="Compose a post or interact with the feed to see content here."
          />
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              authorHandle={handle}
              authorPhoto={profile.profilePhoto}
              currentWeeksLived={gameState.weeksLived ?? 0}
              onOpenDetail={onOpenPostDetail}
              onBoost={onBoostPost}
              // Profile only renders the player's own posts (filtered from recentPosts)
              isPlayerPost
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const COVER_HEIGHT = scale(160);
const AVATAR_SIZE = scale(88);

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: scale(140),
  },
  cover: {
    width: '100%',
    height: COVER_HEIGHT,
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: COVER_HEIGHT,
  },
  // (the flat `coverScrim` half-cover band is gone - see ImageScrim above)
  identityWrap: {
    paddingHorizontal: responsiveSpacing.lg,
    marginTop: -AVATAR_SIZE / 2,
  },
  avatarRing: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatarRingPro: {
    borderColor: PULSE_COLORS.accent,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: fontScale(36),
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    marginTop: responsiveSpacing.sm,
  },
  displayName: {
    fontSize: fontScale(22),
    fontWeight: '700',
  },  // the one headline on this screen
  handle: {
    fontSize: fontScale(13),
    marginTop: 2,
  },
  bio: {
    fontSize: fontScale(14),
    marginTop: responsiveSpacing.sm,
    lineHeight: fontScale(20),
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontScale(12),
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
  },
  editBtn: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  studioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtnText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  statsRow: {
    paddingVertical: responsiveSpacing.sm,
    marginTop: responsiveSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  influenceWrap: {
    marginTop: responsiveSpacing.md,
  },
  proStrip: {
    flexDirection: 'row',
    marginTop: responsiveSpacing.md,
  },
  tabs: {
    marginTop: responsiveSpacing.md,
    marginHorizontal: responsiveSpacing.md,
  },
  postsWrap: {
    paddingTop: responsiveSpacing.sm,
  },
});
