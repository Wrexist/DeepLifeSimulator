/**
 * CommentItem - single comment row.
 *
 * Renders a `PulseComment` (avatar + handle + text + like count). Player
 * comments get a subtle accent dot on the avatar; hostile-sentiment
 * comments (from haters) get a muted red accent so the player can tell
 * the room temperature at a glance.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { formatRelativeWeek } from '../utils/formatRelativeTime';
import type { PulseComment } from '@/contexts/game/types';

interface CommentItemProps {
  comment: PulseComment;
  currentWeeksLived: number;
  /** Depth in the thread (0 = root, 1 = reply, etc.). Drives left indentation. */
  depth?: number;
}

export default function CommentItem({ comment, currentWeeksLived, depth = 0 }: CommentItemProps) {
  const { theme } = useTheme();

  const accentColor = comment.isPlayerComment
    ? PULSE_COLORS.tierCelebrity
    : comment.isFromHater || comment.sentiment === 'hostile'
      ? PULSE_COLORS.like
      : PULSE_COLORS.tierRising;

  const indent = depth * scale(28);

  return (
    <View style={[styles.row, { marginLeft: indent }]}>
      {/* Avatar (placeholder when missing or load failed). R4-B */}
      <ImageWithFallback
        uri={comment.authorPhoto}
        fallback={comment.authorHandle || '?'}
        face={comment.authorHandle ? { seed: comment.authorHandle, size: scale(26) } : undefined}
        style={styles.avatar}
        placeholderColor={accentColor}
        placeholderTextColor="#FFFFFF"
      />

      {/* Body bubble */}
      <View style={styles.bodyWrap}>
        <View style={[styles.bubble, { backgroundColor: theme.surfaceElevated }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.handle, { color: theme.text }]} numberOfLines={1}>
              @{String(comment.authorHandle ?? '').replace(/^@+/, '')}
            </Text>
            {comment.isPlayerComment ? (
              <View style={[styles.youBadge, { backgroundColor: accentColor }]}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            ) : null}
            <Text style={[styles.timeAgo, { color: theme.textSecondary }]}>
              {formatRelativeWeek(comment.gameWeek, currentWeeksLived)}
            </Text>
          </View>
          <Text style={[styles.content, { color: theme.text }]}>{comment.content}</Text>
        </View>
        {comment.likes > 0 ? (
          <Text style={[styles.likes, { color: theme.textSecondary }]}>
            ♥ {comment.likes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: scale(8),
    paddingVertical: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.md,
  },
  avatar: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
  },
  bodyWrap: {
    flex: 1,
  },
  bubble: {
    padding: responsiveSpacing.sm,
    borderRadius: scale(10),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  handle: {
    fontSize: fontScale(12),
    fontWeight: '600',
    flexShrink: 1,
  },
  youBadge: {
    paddingHorizontal: scale(5),
    paddingVertical: scale(1),
    borderRadius: scale(3),
  },
  youBadgeText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  timeAgo: {
    fontSize: fontScale(10),
    marginLeft: 'auto',
  },
  content: {
    fontSize: fontScale(13),
    lineHeight: fontScale(18),
    marginTop: 2,
  },
  likes: {
    fontSize: fontScale(11),
    marginTop: 2,
    marginLeft: scale(6),
  },});
