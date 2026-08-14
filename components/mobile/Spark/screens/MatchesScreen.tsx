/**
 * MatchesScreen — list of all Spark matches.
 *
 * Top row of avatars for fresh / unread matches; below that, a vertical list
 * of conversations with last-message preview + timestamp. Tap a match to
 * open ChatScreen.
 */
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, responsiveBorderRadius } from '@/utils/scaling';
import { getGlassCard } from '@/utils/glassmorphismStyles';
import { Star } from 'lucide-react-native';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import EmptyState from '../components/EmptyState';
import { SPARK_GRADIENT, SPARK_GRADIENT_SOFT, SPARK_COLORS } from '../styles/sparkTheme';
import { formatRelativeRealTime } from '@/components/mobile/Pulse/utils/formatRelativeTime';
import type { SparkMatch } from '@/contexts/game/types';

const LinearGradient = Gradient;

interface MatchesScreenProps {
  onOpenChat: (matchId: string) => void;
  onOpenSwipe: () => void;
}

export default function MatchesScreen({ onOpenChat, onOpenSwipe }: MatchesScreenProps) {
  const { gameState } = useGame();
  const { theme, isDark } = useTheme();

  const sp = gameState.sparkApp;
  const matches = sp?.matches ?? [];

  const sorted = useMemo(() => {
    return [...matches].sort((a, b) => (b.lastMessageTimestamp ?? b.matchedWeek) - (a.lastMessageTimestamp ?? a.matchedWeek));
  }, [matches]);

  const freshMatches = sorted.filter((m) => !(sp?.messages?.[m.id]?.length ?? 0));
  const conversations = sorted.filter((m) => (sp?.messages?.[m.id]?.length ?? 0) > 0);

  const findProfile = useCallback((profileId: string) => DATING_PROFILES.find((p) => p.id === profileId), []);

  if (matches.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          observation="No matches yet."
          nudge="Keep swiping — your next match is one swipe away."
        >
          <Pressable onPress={onOpenSwipe} accessibilityRole="button" accessibilityLabel="Start swiping">
            <Text style={[styles.cta, { color: SPARK_GRADIENT[0] }]}>Start swiping →</Text>
          </Pressable>
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Fresh matches rail — the screen's single rose focal surface (Recipe B). */}
      {freshMatches.length > 0 ? (
        <View
          style={[
            getGlassCard(isDark, 12),
            styles.freshCard,
            { backgroundColor: theme.surface, borderColor: isDark ? theme.glassBorder : theme.border },
          ]}
        >
          <View style={styles.freshInner}>
            <LinearGradient
              pointerEvents="none"
              colors={SPARK_GRADIENT_SOFT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.freshGlow} />
            {isDark ? <View pointerEvents="none" style={styles.freshHairline} /> : null}

            <Text style={[styles.railEyebrow, { color: theme.textMuted }]}>
              NEW MATCHES · {freshMatches.length}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.freshRail}
            >
              {freshMatches.map((match) => {
                const profile = findProfile(match.profileId);
                if (!profile) return null;
                return (
                  <Pressable
                    key={match.id}
                    onPress={() => onOpenChat(match.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat with ${profile.name}`}
                    style={styles.freshItem}
                  >
                    <View style={[styles.avatarRing, { backgroundColor: theme.surface, borderColor: theme.glassBorder }]}>
                      <View style={styles.avatar}>
                        <CharacterAvatar seed={profile.id} sex={profile.gender} age={profile.age} size={FRESH_AVATAR - 4} />
                      </View>
                    </View>
                    {match.superLiked ? (
                      <View style={styles.superBadge}>
                        <Star size={fontScale(10)} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                    ) : null}
                    <Text style={[styles.freshName, { color: theme.text }]} numberOfLines={1}>
                      {profile.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* Conversations */}
      {conversations.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: responsiveSpacing.lg }]}>
            Messages
          </Text>
          {conversations.map((match) => {
            const profile = findProfile(match.profileId);
            if (!profile) return null;
            const thread = sp?.messages?.[match.id] ?? [];
            const last = thread[thread.length - 1];
            const unread = match.unreadByPlayer ?? 0;
            return (
              <Pressable
                key={match.id}
                onPress={() => onOpenChat(match.id)}
                accessibilityRole="button"
                accessibilityLabel={`Conversation with ${profile.name}${unread > 0 ? `, ${unread} unread` : ''}`}
                style={({ pressed }) => [
                  getGlassCard(isDark, 6),
                  styles.convoRow,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.convoAvatar, { borderColor: theme.glassBorder }]}>
                  <CharacterAvatar seed={profile.id} sex={profile.gender} age={profile.age} size={scale(46)} />
                </View>
                <View style={styles.convoBody}>
                  <View style={styles.convoNameRow}>
                    <Text style={[styles.convoName, { color: theme.text }]} numberOfLines={1}>
                      {profile.name}
                    </Text>
                    <Text style={[styles.convoTime, { color: theme.textMuted }]}>
                      {last ? formatRelativeRealTime(last.timestamp) : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.convoPreview,
                      { color: unread > 0 ? theme.text : theme.textSecondary, fontWeight: unread > 0 ? '600' : '400' },
                    ]}
                    numberOfLines={1}
                  >
                    {last?.from === 'player' ? 'You: ' : ''}{last?.text ?? 'Start the conversation'}
                  </Text>
                </View>
                {unread > 0 ? (
                  <View style={[styles.unreadDot, { backgroundColor: SPARK_COLORS.accent }]}>
                    <Text style={styles.unreadDotText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

const FRESH_AVATAR = scale(64);

const styles = StyleSheet.create({
  scroll: {
    paddingTop: responsiveSpacing.sm,
    paddingBottom: scale(120),
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  cta: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.xs,
  },
  freshCard: {
    marginHorizontal: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius['2xl'],
    borderWidth: 1,
  },
  freshInner: {
    borderRadius: responsiveBorderRadius['2xl'],
    overflow: 'hidden',
    paddingVertical: responsiveSpacing.md,
  },
  freshGlow: {
    position: 'absolute',
    top: -scale(40),
    right: -scale(30),
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
    backgroundColor: 'rgba(244,63,94,0.10)',
  },
  freshHairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  railEyebrow: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: responsiveSpacing.md,
    marginBottom: responsiveSpacing.sm,
  },
  freshRail: {
    paddingHorizontal: responsiveSpacing.md,
    gap: responsiveSpacing.md,
  },
  freshItem: {
    width: FRESH_AVATAR + 8,
    alignItems: 'center',
    gap: 4,
  },
  avatarRing: {
    width: FRESH_AVATAR + 4,
    height: FRESH_AVATAR + 4,
    borderRadius: (FRESH_AVATAR + 4) / 2,
    padding: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: FRESH_AVATAR - 4,
    height: FRESH_AVATAR - 4,
    borderRadius: (FRESH_AVATAR - 4) / 2,
  },
  superBadge: {
    position: 'absolute',
    bottom: scale(18),
    right: 0,
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    backgroundColor: SPARK_COLORS.superLike,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  freshName: {
    fontSize: fontScale(11),
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: FRESH_AVATAR + 8,
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.md,
    marginHorizontal: responsiveSpacing.md,
    marginTop: responsiveSpacing.sm,
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
  },
  convoAvatar: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: 1,
  },
  convoBody: {
    flex: 1,
  },
  convoNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  convoName: {
    fontSize: fontScale(15),
    fontWeight: '600',
    flexShrink: 1,
  },
  convoTime: {
    fontSize: fontScale(10),
  },
  convoPreview: {
    fontSize: fontScale(13),
    marginTop: 2,
  },
  unreadDot: {
    minWidth: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDotText: {
    color: '#FFFFFF',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
});
