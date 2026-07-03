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
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Heart, Send, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets, getTabBarSafePadding } from '@/utils/scaling';
import {
  sendSparkMessage,
  generateNpcReply,
  markMatchRead,
  promoteMatchToRelationship,
} from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES, getDatingProfileImage } from '@/lib/dating/datingProfiles';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';
import EmptyState from '../components/EmptyState';
import { useTimerManager } from '@/hooks/useTimerManager';
import type { SparkMessage } from '@/contexts/game/types';

const LinearGradient = LinearGradientFallback;

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
  const match = sp?.matches.find((m: any) => m.id === matchId);
  const profile = match ? DATING_PROFILES.find((p) => p.id === match.profileId) : undefined;
  const messages: SparkMessage[] = sp?.messages?.[matchId] ?? [];
  const isPromoted = match?.promoted;

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
    }
  }, [setGameState, gameState, matchId, onOpenPartnerProfile, saveGame]);

  if (!match || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Header theme={theme} title="Chat" onBack={onBack} />
        <EmptyState observation="Conversation not found." nudge="Open a different match." />
      </View>
    );
  }

  return (
    // Bottom padding keeps the composer (and error line) above the floating phone tab bar.
    <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: getTabBarSafePadding(insets.bottom) }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.headerBtn}>
          <ArrowLeft size={fontScale(22)} color={theme.text} />
        </Pressable>
        <Image source={getDatingProfileImage(profile.gender)} style={styles.headerAvatar} />
        <View style={styles.headerText}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {isPromoted ? 'Dating' : 'New match'} · {profile.age}
          </Text>
        </View>
        <Pressable
          onPress={isPromoted ? () => onOpenPartnerProfile(matchId) : handlePromote}
          accessibilityRole="button"
          accessibilityLabel={isPromoted ? 'View profile' : 'Promote to dating'}
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
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowRight]}>
        <LinearGradient
          colors={SPARK_GRADIENT as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bubble, styles.bubbleRight]}
        >
          <Text style={styles.bubbleTextPlayer}>{msg.text}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
      <View style={[styles.bubble, styles.bubbleLeft, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
  bubbleText: {
    fontSize: fontScale(14),
    lineHeight: fontScale(19),
  },
  bubbleTextPlayer: {
    color: '#FFFFFF',
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
