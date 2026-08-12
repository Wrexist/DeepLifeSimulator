/**
 * ChatScreen — single-match conversation.
 *
 * Top: partner header with avatar + name + tap-to-view-profile / promote.
 * Middle: message thread (player right-aligned gradient, NPC left glass).
 * Bottom: composer with send button.
 *
 * When the player sends a message, an NPC reply is generated ~2s later
 * via `generateNpcReply` to keep the conversation flowing.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Heart, Send, User, UserPlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import {
  sendSparkMessage,
  generateNpcReply,
  markMatchRead,
  promoteMatchToRelationship,
  promoteMatchToFriend,
} from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';
import EmptyState from '../components/EmptyState';
import { useTimerManager } from '@/hooks/useTimerManager';
import type { SparkMessage } from '@/contexts/game/types';

const LinearGradient = Gradient;

interface ChatScreenProps {
  matchId: string;
  onBack: () => void;
  onOpenPartnerProfile: (relationshipId: string) => void;
}

export default function ChatScreen({ matchId, onBack, onOpenPartnerProfile }: ChatScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<SparkMessage>>(null);
  // Auto-cleaned timers so the delayed NPC reply can't run after the chat closes.
  const timers = useTimerManager();

  const sp = gameState.sparkApp;
  const match = sp?.matches?.find((m: any) => m.id === matchId);
  const profile = match ? DATING_PROFILES.find((p) => p.id === match.profileId) : undefined;
  const messages: SparkMessage[] = sp?.messages?.[matchId] ?? [];
  const isPromoted = match?.promoted;
  // WHAT it was promoted into is read off the relationship, not off the match —
  // `SparkMatch.promoted` is a plain boolean and stays one, so adding friends
  // needed no save-format change. A promoted match shares its id with the
  // relationship it created.
  const promotedRel = isPromoted
    ? gameState.relationships?.find((r) => r?.id === matchId)
    : undefined;
  const isFriend = promotedRel?.type === 'friend';

  // Mark match as read when the screen opens.
  useEffect(() => {
    if (match?.unreadByPlayer && match.unreadByPlayer > 0) {
      markMatchRead(setGameState, matchId);
    }
  }, [match?.unreadByPlayer, matchId, setGameState]);

  const handleSend = useCallback(() => {
    if (!draft.trim()) return;
    const result = sendSparkMessage(setGameState, gameState, matchId, draft);
    if (result.success) {
      sparkHaptics.tap();
      setDraft('');
      setError(null);
      saveGame?.();
      // NPC writes back after a brief pause to feel natural.
      timers.setTimeout(() => generateNpcReply(setGameState, gameState, matchId), 1800);
    } else {
      sparkHaptics.error();
      setError(result.message);
    }
  }, [draft, setGameState, gameState, matchId, saveGame]);

  const handlePromote = useCallback(() => {
    const result = promoteMatchToRelationship(setGameState, gameState, matchId);
    if (result.success && result.relationshipId) {
      sparkHaptics.match();
      onOpenPartnerProfile(result.relationshipId);
      saveGame?.();
    } else {
      sparkHaptics.error();
      // Surface WHY (e.g. already dating someone) — a silent haptic made the
      // header heart read as a dead button.
      setError(result.message);
    }
  }, [setGameState, gameState, matchId, onOpenPartnerProfile, saveGame]);

  /**
   * The other destination for a match.
   *
   * Without this, `promoteMatchToRelationship`'s anti-bigamy guard meant every
   * match after the first had nowhere to go — the player could keep matching and
   * none of them became a contact. Friendship costs nothing and is not
   * exclusive, so this button never refuses on "already with someone".
   */
  const handleBefriend = useCallback(() => {
    const result = promoteMatchToFriend(setGameState, gameState, matchId);
    if (result.success) {
      sparkHaptics.tap();
      setError(null);
      saveGame?.();
    } else {
      sparkHaptics.error();
      setError(result.message);
    }
  }, [setGameState, gameState, matchId, saveGame]);

  if (!match || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Header theme={theme} title="Chat" onBack={onBack} />
        <EmptyState observation="Conversation not found." nudge="Open a different match." />
      </View>
    );
  }

  return (
    // Full-screen: keep the composer (and error line) just above the home indicator.
    <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: getAppScreenBottomPadding(insets.bottom) }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
          <ArrowLeft size={fontScale(22)} color={theme.text} />
        </Pressable>
        <View style={[styles.headerAvatar, { borderColor: theme.glassBorder }]}>
          <CharacterAvatar seed={profile.id} sex={profile.gender} age={profile.age} size={scale(34)} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {isPromoted ? (isFriend ? 'Friend' : 'Dating') : 'New match'} · {profile.age}
          </Text>
        </View>
        {/* Two destinations for an un-promoted match, not one. Befriending is
            offered first because it never refuses — dating is exclusive, so on
            a second match the heart bounces off the anti-bigamy guard and the
            person-plus is the only thing that can actually do something. */}
        {!isPromoted && (
          <Pressable
            onPress={handleBefriend}
            accessibilityRole="button"
            accessibilityLabel={`Add ${profile.name} as a friend`}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <UserPlus size={fontScale(20)} color={theme.textSecondary} />
          </Pressable>
        )}
        <Pressable
          onPress={isPromoted ? () => onOpenPartnerProfile(matchId) : handlePromote}
          accessibilityRole="button"
          accessibilityLabel={isPromoted ? 'View profile' : 'Start dating'}
          hitSlop={8}
          style={styles.headerBtn}
        >
          {isPromoted ? (
            <User size={fontScale(20)} color={theme.text} />
          ) : (
            <Heart size={fontScale(20)} color={SPARK_GRADIENT[0]} fill={SPARK_GRADIENT[0]} />
          )}
        </Pressable>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyMsgs}>
          <EmptyState
            observation={`You matched with ${profile.name.split(' ')[0]}!`}
            nudge="Send the first message — break the ice."
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesContent}
          renderItem={({ item }) => <Bubble msg={item} theme={theme} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={[styles.composer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (error) setError(null);
          }}
          placeholder={`Message ${profile.name.split(' ')[0]}...`}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
        >
          <LinearGradient
            colors={
              draft.trim()
                ? (SPARK_GRADIENT as unknown as string[])
                : [theme.border, theme.border]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendBtnFill}
          >
            <Send size={fontScale(16)} color="#FFFFFF" strokeWidth={2.4} />
          </LinearGradient>
        </Pressable>
      </View>
      {error ? <Text style={[styles.errorText, { color: SPARK_COLORS.danger }]}>{error}</Text> : null}
    </View>
  );
}

function Bubble({ msg, theme }: { msg: SparkMessage; theme: any }) {
  const isPlayer = msg.from === 'player';
  if (isPlayer) {
    // Own messages: soft rose tint (not a loud solid fill) with adaptive text.
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowRight]}>
        <View style={[styles.bubble, styles.bubbleRight, styles.bubbleOwn]}>
          <Text style={[styles.bubbleText, { color: theme.text }]}>{msg.text}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
      <View
        style={[
          styles.bubble,
          styles.bubbleLeft,
          getPlatformShadows(4, 0.12, 1, 6),
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.bubbleText, { color: theme.text }]}>{msg.text}</Text>
      </View>
    </View>
  );
}

function Header({ theme, title, onBack }: { theme: any; title: string; onBack: () => void }) {
  return (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
        <ArrowLeft size={fontScale(22)} color={theme.text} />
      </Pressable>
      <Text style={[styles.headerName, { color: theme.text, flex: 1 }]}>{title}</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: responsiveSpacing.sm,
  },
  headerBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    borderWidth: 1,
  },
  headerText: { flex: 1 },
  headerName: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  headerSub: {
    fontSize: fontScale(11),
    marginTop: 2,
  },
  emptyMsgs: {
    flex: 1,
    justifyContent: 'center',
  },
  messagesContent: {
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.md,
    gap: responsiveSpacing.xs,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bubbleRowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(18),
  },
  bubbleLeft: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: scale(6),
  },
  bubbleRight: {
    borderBottomRightRadius: scale(6),
  },
  bubbleOwn: {
    backgroundColor: 'rgba(244,63,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.30)',
  },
  bubbleText: {
    fontSize: fontScale(14),
    lineHeight: fontScale(19),
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: fontScale(14),
    maxHeight: scale(100),
    minHeight: scale(36),
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.sm,
  },
  sendBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontScale(11),
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.xs,
  },
});
