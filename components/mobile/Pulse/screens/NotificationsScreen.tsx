/**
 * NotificationsScreen - grouped feed of likes / follows / comments / brand offers / scandals.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Bell, Briefcase, Heart, MessageCircle, Play, Repeat2, UserPlus, AtSign, Crown, Star } from 'lucide-react-native';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveIconSize, touchTargets } from '@/utils/scaling';
import EmptyState from '../components/EmptyState';
import SectionTitle from '@/components/ui/SectionTitle';
import { markAllNotificationsRead, markNotificationRead } from '@/contexts/game/actions/PulseActions';
import { formatRelativeRealTime } from '../utils/formatRelativeTime';
import { PULSE_COLORS } from '../styles/pulseTheme';
import type { PulseNotification, PulseNotificationType } from '@/contexts/game/types';

// Priority-ordered groups for display
const GROUP_ORDER: { key: string; label: string; types: PulseNotificationType[] }[] = [
  { key: 'scandal', label: 'Scandal Alerts', types: ['scandal_update'] },
  { key: 'brand', label: 'Brand Deals', types: ['brand_offer'] },
  { key: 'mentions', label: 'Mentions', types: ['mention'] },
  { key: 'follows', label: 'Follows', types: ['follow'] },
  { key: 'likes', label: 'Likes & Reposts', types: ['like', 'repost'] },
  { key: 'comments', label: 'Comments', types: ['comment'] },
  { key: 'pro', label: 'Pulse Pro', types: ['verified_pro_renewal'] },
  { key: 'milestones', label: 'Milestones', types: ['milestone'] },
  { key: 'system', label: 'System', types: ['system', 'live_invite'] },
];

const ICON_BY_TYPE: Record<PulseNotificationType, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: AtSign,
  repost: Repeat2,
  brand_offer: Briefcase,
  scandal_update: AlertTriangle,
  milestone: Star,
  live_invite: Bell,
  verified_pro_renewal: Crown,
  system: Bell,
};

/**
 * Roll up like/repost notifications by (refPostId, type) so a viral post
 * doesn't fill the alerts tab with 80 identical rows. Each group keeps the
 * newest notification's id (so markRead targets the first item), the count,
 * and the freshest two author handles for the headline.
 */
function collapseLikeReposts(items: PulseNotification[]): PulseNotification[] {
  type Bucket = { newest: PulseNotification; count: number; handles: string[] };
  const buckets = new Map<string, Bucket>();
  const flat: PulseNotification[] = [];
  for (const n of items) {
    // Only collapse when we have a post to anchor on; loose like/repost
    // notifications without refPostId fall through as individual rows.
    if (!n.refPostId || (n.type !== 'like' && n.type !== 'repost')) {
      flat.push(n);
      continue;
    }
    const key = `${n.type}:${n.refPostId}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      if (n.fromHandle && existing.handles.length < 2 && !existing.handles.includes(n.fromHandle)) {
        existing.handles.push(n.fromHandle);
      }
    } else {
      buckets.set(key, {
        newest: n,
        count: 1,
        handles: n.fromHandle ? [n.fromHandle] : [],
      });
    }
  }
  for (const b of buckets.values()) {
    if (b.count === 1) {
      flat.push(b.newest);
    } else {
      const verb = b.newest.type === 'like' ? 'liked' : 'reposted';
      const lead = b.handles[0] ? `@${b.handles[0]}` : 'Someone';
      const others = b.count - 1;
      flat.push({
        ...b.newest,
        text: `${lead} and ${others} ${others === 1 ? 'other' : 'others'} ${verb} your post`,
      });
    }
  }
  // Keep newest-first ordering inside the group.
  flat.sort((a, b) => b.timestamp - a.timestamp);
  return flat;
}

const COLOR_BY_TYPE: Record<PulseNotificationType, string> = {
  like: PULSE_COLORS.like,
  comment: PULSE_COLORS.info,
  follow: PULSE_COLORS.accent,
  mention: PULSE_COLORS.accent,
  repost: PULSE_COLORS.repost,
  brand_offer: PULSE_COLORS.warning,
  scandal_update: PULSE_COLORS.danger,
  milestone: PULSE_COLORS.accent,
  live_invite: PULSE_COLORS.info,
  verified_pro_renewal: PULSE_COLORS.verified,
  system: PULSE_COLORS.info,
};

interface NotificationsScreenProps {
  /** Tap a `brand_offer` notification → open the brand-deals overlay (owned by PulseApp). */
  onOpenBrandDeals?: () => void;
  /** Tap a `comment` / `mention` / `like` / `repost` / `milestone` notification with a postId → open PostDetailScreen. */
  onOpenPostDetail?: (postId: string) => void;
  /** Tap a `scandal_update` notification → open the scandal recovery modal. */
  onOpenScandalRecovery?: () => void;
  /** Empty-state CTA - opens the rewarded-ad modal for a follower boost. */
  onWatchAd?: () => void;
}

export default function NotificationsScreen({
  onOpenBrandDeals,
  onOpenPostDetail,
  onOpenScandalRecovery,
  onWatchAd,
}: NotificationsScreenProps = {}) {
  const { gameState, setGameState } = useGame();
  // Mirror RewardedAdModal's reward math (150 for Verified Pro, 50 otherwise)
  // so the CTA label always matches what the player actually receives.
  const adFollowerReward = gameState.socialMedia?.verifiedPro?.active === true ? 150 : 50;
  const { theme } = useTheme();

  const notifications: PulseNotification[] = useMemo(
    () => gameState.socialMedia?.notifications ?? [],
    [gameState.socialMedia?.notifications],
  );

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((g) => {
      const items = notifications.filter((n) => g.types.includes(n.type));
      // Collapse repeat likes/reposts on the same post into a single rolled-up
      // row ("@a and 4 others liked your post"). Keyed by post + type so
      // separate posts stay distinct. Other groups render flat.
      const rolled = g.key === 'likes' ? collapseLikeReposts(items) : items;
      return { ...g, items: rolled };
    }).filter((g) => g.items.length > 0);
  }, [notifications]);

  const unread = notifications.filter((n) => !n.read).length;

  const handleMarkAll = useCallback(() => {
    markAllNotificationsRead(setGameState);
  }, [setGameState]);

  if (notifications.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          observation="All caught up."
          nudge="Likes, follows, comments, and brand offers will show here."
        >
          {onWatchAd ? (
            <Pressable
              onPress={onWatchAd}
              accessibilityRole="button"
              accessibilityLabel="Watch ad for follower boost"
              style={[styles.adCta, { borderColor: PULSE_COLORS.accent }]}
            >
              <Play size={fontScale(12)} color={PULSE_COLORS.accent} fill={PULSE_COLORS.accent} />
              <Text style={[styles.adCtaText, { color: PULSE_COLORS.accent }]}>
                Watch ad for +{adFollowerReward} followers
              </Text>
            </Pressable>
          ) : null}
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <SectionTitle
        style={styles.section}
        title={unread > 0 ? `${unread} unread` : 'Notifications'}
        right={
          unread > 0 ? (
            <Pressable onPress={handleMarkAll} accessibilityRole="button" accessibilityLabel="Mark all read" hitSlop={8}>
              <Text style={[styles.markAll, { color: theme.textSecondary }]}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Rewarded-ad follower boost - also surfaced here (not just the empty
          state) so the feature stays reachable once notifications exist. */}
      {onWatchAd ? (
        <Pressable
          onPress={onWatchAd}
          accessibilityRole="button"
          accessibilityLabel="Watch ad for follower boost"
          style={[styles.adCtaHeader, { borderColor: PULSE_COLORS.accent }]}
        >
          <Play size={fontScale(12)} color={PULSE_COLORS.accent} fill={PULSE_COLORS.accent} />
          <Text style={[styles.adCtaText, { color: PULSE_COLORS.accent }]}>
            Watch ad for +{adFollowerReward} followers
          </Text>
        </Pressable>
      ) : null}

      {grouped.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{g.label}</Text>
          {g.items.map((n) => {
            const Icon = ICON_BY_TYPE[n.type] ?? Bell;
            const color = COLOR_BY_TYPE[n.type] ?? PULSE_COLORS.info;
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (!n.read) markNotificationRead(setGameState, n.id);
                  // Navigate based on notification type. Falls through to a
                  // simple mark-read if no handler/refId is available.
                  if (n.type === 'brand_offer' && onOpenBrandDeals) {
                    onOpenBrandDeals();
                  } else if (n.type === 'scandal_update' && onOpenScandalRecovery) {
                    onOpenScandalRecovery();
                  } else if (
                    (n.type === 'comment' || n.type === 'mention' || n.type === 'like'
                      || n.type === 'repost' || n.type === 'milestone')
                    && n.refPostId
                    && onOpenPostDetail
                  ) {
                    onOpenPostDetail(n.refPostId);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${n.text}${n.read ? '' : '. Unread.'}`}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {!n.read ? <View style={[styles.unreadDot, { backgroundColor: PULSE_COLORS.accent }]} /> : <View style={styles.unreadSpacer} />}
                <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
                  <Icon size={responsiveIconSize.sm} color={color} strokeWidth={2.2} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.text, { color: theme.text }]}>{n.text}</Text>
                  <Text style={[styles.time, { color: theme.textSecondary }]}>
                    {formatRelativeRealTime(n.timestamp)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  section: {
    marginHorizontal: responsiveSpacing.md,
  },
  markAll: {
    fontSize: fontScale(13),
    fontWeight: '500',
  },
  scroll: {
    paddingBottom: scale(140),
  },
  group: {
    marginTop: responsiveSpacing.sm,
  },
  groupTitle: {
    fontSize: fontScale(11),
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: responsiveSpacing.sm,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: scale(10),
  },
  unreadSpacer: {
    width: 6,
  },
  iconWrap: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  text: {
    fontSize: fontScale(13),
    lineHeight: fontScale(18),
  },
  time: {
    fontSize: fontScale(10),
    marginTop: 2,
  },
  adCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    marginTop: responsiveSpacing.md,
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(999),
    borderWidth: 1.5,
  },
  adCtaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    alignSelf: 'center',
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.xs,
    marginBottom: responsiveSpacing.sm,
    minHeight: touchTargets.minimum,
    paddingHorizontal: responsiveSpacing.lg,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(999),
    borderWidth: 1.5,
  },
  adCtaText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
