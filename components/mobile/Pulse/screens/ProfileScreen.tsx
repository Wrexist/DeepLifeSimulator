/**
 * ProfileScreen — player's own Pulse profile.
 *
 * Hero cover + avatar + stats row + InfluenceMeter + bio + tabs (Posts /
 * Replies / Media / Likes). Tap the verified badge (when unverified) to
 * open the Pulse Pro upsell.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, getAppScreenBottomPadding } from '@/utils/scaling';
import { Calendar, Link2, MapPin } from 'lucide-react-native';
import PostCard from '../components/PostCard';
import CommentItem from '../components/CommentItem';
import InfluenceMeter from '../components/InfluenceMeter';
import VerifiedBadge from '../components/VerifiedBadge';
import EmptyState from '../components/EmptyState';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { formatPulseNumber } from '../utils/formatPulseNumber';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import type { PulseRecentPost, PulseComment } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';

// 'likes' is the historical key; we now surface bookmark-style behavior
// because `isLiked` toggles on the player's own posts (not posts liked by
// others). Keep the key for save/state compat; show "Bookmarks" in the UI.
const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
  posts: 'Posts',
  replies: 'Replies',
  media: 'Media',
  likes: 'Bookmarks',
};

interface ProfileScreenProps {
  onUpgradePro: () => void;
  /** Tap a post → open PostDetailScreen overlay (owned by PulseApp). */
  onOpenPostDetail?: (postId: string) => void;
  /** Tap the Boost button on a post → open BoostPostModal (owned by PulseApp). */
  onBoostPost?: (postId: string) => void;
  /** Tap "Edit profile" → open ProfileEditModal (owned by PulseApp). */
  onEditProfile?: () => void;
}

export default function ProfileScreen({ onUpgradePro, onOpenPostDetail, onBoostPost, onEditProfile }: ProfileScreenProps) {
  const { gameState } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const sm = gameState.socialMedia;
  const profile = gameState.userProfile ?? {};
  const followers = sm?.followers ?? 0;
  const following = profile.following ?? 0;
  const totalPosts = sm?.totalPosts ?? 0;
  const recentPosts: PulseRecentPost[] = sm?.recentPosts ?? [];
  const isVerified = !!profile.verified;

  const displayName =
    profile.displayName || profile.name || profile.handle || 'You';
  const handle = profile.handle || profile.username || 'you';
  const bio = profile.bio || 'No bio yet — tap edit profile to add one.';
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
          <LinearGradient
            colors={PULSE_GRADIENT as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.coverImg}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(15, 23, 42, 0.85)'] as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Avatar + identity */}
      <View style={styles.identityWrap}>
        <View style={[styles.avatarRing, isVerified ? styles.avatarRingPro : { borderColor: theme.border }]}>
          {profile.profilePhoto ? (
            <ImageWithFallback
              uri={profile.profilePhoto}
              fallback={displayName}
              style={styles.avatar}
            />
          ) : (
            <LinearGradient
              colors={PULSE_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, styles.avatarFallback]}
            >
              <Text style={styles.avatarInitial}>{displayName.slice(0, 1).toUpperCase()}</Text>
            </LinearGradient>
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
              <Text style={[styles.metaText, { color: PULSE_GRADIENT[0] }]} numberOfLines={1}>
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

        {/* Edit profile entry */}
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

        {/* Stats row */}
        <View style={[styles.statsRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          <Stat label="Followers" value={formatPulseNumber(followers)} theme={theme} />
          <View style={[styles.statSep, { backgroundColor: theme.border }]} />
          <Stat label="Following" value={formatPulseNumber(following)} theme={theme} />
          <View style={[styles.statSep, { backgroundColor: theme.border }]} />
          <Stat label="Posts" value={formatPulseNumber(totalPosts)} theme={theme} />
        </View>

        {/* Influence meter */}
        <View style={styles.influenceWrap}>
          <InfluenceMeter
            followers={followers}
            tier={sm?.influenceLevel ?? 'novice'}
          />
        </View>

        {/* Pulse Pro upsell strip when not subscribed */}
        {!isVerified ? (
          <Pressable
            onPress={onUpgradePro}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pulse Verified Pro"
            style={({ pressed }) => [styles.proStrip, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={PULSE_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.proStripFill}
            >
              <Text style={styles.proStripText}>
                ✦ Upgrade to Verified Pro — +25% engagement, blue check, longer posts
              </Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>

      {/* Profile sub-tabs */}
      <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
        {(['posts', 'replies', 'media', 'likes'] as ProfileTab[]).map((t) => {
          const active = activeTab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setActiveTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={PROFILE_TAB_LABELS[t]}
              style={styles.tabBtn}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? theme.text : theme.textSecondary, fontWeight: active ? '700' : '500' },
                ]}
              >
                {PROFILE_TAB_LABELS[t]}
              </Text>
              {active ? (
                <LinearGradient
                  colors={PULSE_GRADIENT as unknown as string[]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabIndicator}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

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

function Stat({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
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
    borderColor: PULSE_GRADIENT[0],
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
    fontWeight: '700',
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
  },
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
  editBtn: {
    alignSelf: 'flex-start',
    marginTop: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: responsiveSpacing.md,
    marginTop: responsiveSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontScale(20),
    fontWeight: '700',
  },
  statLabel: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  statSep: {
    width: 1,
    height: scale(28),
  },
  influenceWrap: {
    marginTop: responsiveSpacing.md,
  },
  proStrip: {
    marginTop: responsiveSpacing.md,
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  proStripFill: {
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  proStripText: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '600',
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: responsiveSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: fontScale(13),
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 999,
  },
  postsWrap: {
    paddingTop: responsiveSpacing.sm,
  },
});
