/**
 * CommentThread — inline comments under a post.
 *
 * Renders up to `inlineLimit` comments by default with a "View N more"
 * affordance for the rest. Depth is rendered visually via CommentItem's
 * `depth` indent + a 1pt left guide line in the glass border tone.
 *
 * Comments live at `gameState.socialMedia.commentThreads[postId]`. The
 * thread is flat in storage (parentCommentId is for depth display only).
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing } from '@/utils/scaling';
import CommentItem from './CommentItem';
import { PULSE_COLORS } from '../styles/pulseTheme';
import type { PulseComment } from '@/contexts/game/types';

interface CommentThreadProps {
  comments: PulseComment[];
  currentWeeksLived: number;
  inlineLimit?: number;
}

const DEFAULT_INLINE_LIMIT = 5;

export default function CommentThread({
  comments,
  currentWeeksLived,
  inlineLimit = DEFAULT_INLINE_LIMIT,
}: CommentThreadProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Group by parentCommentId so replies render under their root, capped at depth 2.
  const ordered = useMemo(() => orderForDisplay(comments), [comments]);

  if (ordered.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          No comments yet. Be the first.
        </Text>
      </View>
    );
  }

  const visible = expanded ? ordered : ordered.slice(0, inlineLimit);
  const hidden = ordered.length - visible.length;

  return (
    <View style={[styles.thread, { borderLeftColor: theme.border }]}>
      {visible.map(({ comment, depth }) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentWeeksLived={currentWeeksLived}
          depth={depth}
        />
      ))}
      {hidden > 0 ? (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={`View ${hidden} more comments`}
          style={styles.moreBtn}
        >
          <Text style={[styles.moreText, { color: PULSE_COLORS.tierCelebrity }]}>
            View {hidden} more {hidden === 1 ? 'reply' : 'replies'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Ordering: roots first (newest → oldest), each immediately followed by its
// direct replies (depth 1). Replies-of-replies are flattened to depth 2 so
// the visual stays readable — matches the plan's "depth-2 inline" rule.
// ──────────────────────────────────────────────────────────────────────────

function orderForDisplay(
  comments: PulseComment[],
): { comment: PulseComment; depth: number }[] {
  const byParent = new Map<string | undefined, PulseComment[]>();
  for (const c of comments) {
    const k = c.parentCommentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }

  // Sort each bucket by timestamp descending (newest first).
  for (const bucket of byParent.values()) {
    bucket.sort((a, b) => b.timestamp - a.timestamp);
  }

  const roots = byParent.get(undefined) ?? [];
  const out: { comment: PulseComment; depth: number }[] = [];

  for (const root of roots) {
    out.push({ comment: root, depth: 0 });
    const replies = byParent.get(root.id) ?? [];
    for (const reply of replies) {
      out.push({ comment: reply, depth: 1 });
      const subReplies = byParent.get(reply.id) ?? [];
      for (const sub of subReplies) {
        out.push({ comment: sub, depth: 2 });
      }
    }
  }
  return out;
}

const styles = StyleSheet.create({
  thread: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    paddingLeft: scale(4),
  },
  emptyWrap: {
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  empty: {
    fontSize: fontScale(13),
  },
  moreBtn: {
    paddingVertical: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
  },
  moreText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
