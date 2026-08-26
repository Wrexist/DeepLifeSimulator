/**
 * ChatScreen - single-match conversation, driven by CHOICES rather than typing.
 *
 * Top: partner header with avatar, name, a rapport bar, and the befriend /
 *      start-dating / view-profile buttons.
 * Middle: message thread (player right-aligned rose tint, NPC left glass).
 * Bottom: the option panel - wrapping chips, each showing its cost and, when
 *         locked, the reason. A visible gate is a goal.
 *
 * TWO OWNER REPORTS, one screen (2026-08-17):
 *
 *  (a) "The keyboard covers the composer - I cannot see what I typed, send it,
 *      or close it." There is no keyboard here any more: the free-text
 *      TextInput is gone, so nothing on this screen is focusable and no
 *      software keyboard can be raised over the action area. That is the fix,
 *      and it is why this file carries no `KeyboardAvoidingView` - one would be
 *      dead weight wrapping a view with no text input in it. What replaces it
 *      is the structural half of the guarantee: the option panel is a sibling
 *      of the thread (not inside it), pinned above `getAppScreenBottomPadding`,
 *      so it always sits clear of the home indicator, and the panel scrolls
 *      internally rather than growing into the thread on a short screen.
 *
 *  (b) "I want options instead - ask out for a date or compliment the person
 *      and so on." Every chip resolves through `lib/spark/conversation.ts`,
 *      which owns rapport, the gates, the cooldowns and the outcome roll. The
 *      commit is one atomic updater in `playConversationOption`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  CalendarHeart,
  Coffee,
  Flame,
  Heart,
  Laugh,
  MessageCircle,
  Mountain,
  Sparkles,
  Star,
  User,
  UserPlus,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Gradient from '@/components/ui/Gradient';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets, getAppScreenBottomPadding } from '@/utils/scaling';
import { getPlatformShadows } from '@/utils/glassmorphismStyles';
import {
  markMatchRead,
  playConversationOption,
  promoteMatchToFriend,
  getSparkConversationView,
} from '@/contexts/game/actions/SparkActions';
import {
  listDateVenues,
  rapportBand,
  type SparkConversationOptionId,
  type SparkDateVenueId,
} from '@/lib/spark/conversation';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import { SPARK_GRADIENT, SPARK_COLORS } from '../styles/sparkTheme';
import { sparkHaptics } from '../utils/sparkHaptics';
import EmptyState from '../components/EmptyState';
import type { SparkMessage } from '@/contexts/game/types';
import { gameAlert } from '@/utils/gameAlert';

const LinearGradient = Gradient;

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Icon-name → component. The catalog in `lib/spark/conversation.ts` names its
 * icon as a string because `lib/` may not import from `components/` - this map
 * is the resolution step, and the `Sparkles` fallback keeps a typo from
 * rendering nothing at all.
 */
const OPTION_ICONS: Record<string, IconComponent> = {
  Sparkles,
  MessageCircle,
  Star,
  Laugh,
  Flame,
  CalendarHeart,
  Heart,
  Coffee,
  UtensilsCrossed,
  Mountain,
};

interface ChatScreenProps {
  matchId: string;
  onBack: () => void;
  onOpenPartnerProfile: (relationshipId: string) => void;
}

export default function ChatScreen({ matchId, onBack, onOpenPartnerProfile }: ChatScreenProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  /** The date sub-choice is open. Replaces the option row while pending. */
  const [venuePending, setVenuePending] = useState(false);
  const listRef = useRef<FlatList<SparkMessage>>(null);

  const sp = gameState.sparkApp;
  const match = sp?.matches?.find((m) => m.id === matchId);
  const profile = match ? DATING_PROFILES.find((p) => p.id === match.profileId) : undefined;
  const messages: SparkMessage[] = sp?.messages?.[matchId] ?? [];
  const isPromoted = match?.promoted;
  // WHAT it was promoted into is read off the relationship, not off the match -
  // `SparkMatch.promoted` is a plain boolean and stays one, so adding friends
  // needed no save-format change. A promoted match shares its id with the
  // relationship it created.
  const promotedRel = isPromoted
    ? gameState.relationships?.find((r) => r?.id === matchId)
    : undefined;
  const isFriend = promotedRel?.type === 'friend';

  // The gate state the chips render from - produced by the SAME call the action
  // re-checks against `prev`, so a chip can never offer a move the action would
  // then refuse for a different reason.
  const view = useMemo(
    () => getSparkConversationView(gameState, matchId),
    [gameState, matchId],
  );
  const venues = useMemo(
    () =>
      listDateVenues({
        energy: gameState.stats?.energy ?? 0,
        money: gameState.stats?.money ?? 0,
      }),
    [gameState.stats?.energy, gameState.stats?.money],
  );

  // Mark match as read when the screen opens.
  useEffect(() => {
    if (match?.unreadByPlayer && match.unreadByPlayer > 0) {
      markMatchRead(setGameState, matchId);
    }
  }, [match?.unreadByPlayer, matchId, setGameState]);

  const play = useCallback(
    (optionId: SparkConversationOptionId, venueId?: SparkDateVenueId) => {
      const result = playConversationOption(setGameState, gameState, matchId, optionId, venueId);
      if (result.success) {
        if (result.outcome === 'success') sparkHaptics.match();
        else sparkHaptics.tap();
        setError(null);
        setVenuePending(false);
        saveGame?.();
        if (result.relationshipId) {
          onOpenPartnerProfile(result.relationshipId);
        }
      } else {
        sparkHaptics.error();
        setError(result.message);
      }
    },
    [setGameState, gameState, matchId, saveGame, onOpenPartnerProfile],
  );

  const handleOptionPress = useCallback(
    (optionId: SparkConversationOptionId, requiresVenue: boolean) => {
      setError(null);
      if (requiresVenue) {
        setVenuePending(true);
        return;
      }
      play(optionId);
    },
    [play],
  );

  /** The `go_steady` row of the SAME gate the chips render from. */
  const goSteady = useMemo(
    () => view?.options.find((o) => o.option.id === 'go_steady'),
    [view],
  );

  /**
   * The header heart IS the `go_steady` chip.
   *
   * It used to call `promoteMatchToRelationship` directly, which knows only the
   * anti-bigamy rule - so a free, instant, un-refusable promotion sat 40px from
   * a chip that costs 5 energy, needs 75 rapport and can be turned down. Every
   * player would take the heart, and the whole rapport economy below it was
   * decoration. It now resolves through the same availability row and dispatches
   * through the same handler, so the two cannot diverge: whatever the chip would
   * do, the heart does, including the refusal copy.
   */
  const handlePromote = useCallback(() => {
    setError(null);
    if (!goSteady) return;
    if (!goSteady.available) {
      sparkHaptics.error();
      setError(goSteady.reason ?? 'Not right now');
      return;
    }
    handleOptionPress('go_steady', Boolean(goSteady.option.requiresVenue));
  }, [goSteady, handleOptionPress]);

  /**
   * The other destination for a match.
   *
   * Without this, `resolveMatchPromotion`'s anti-bigamy guard meant every match
   * after the first had nowhere to go - the player could keep matching and none
   * of them became a contact. Friendship costs nothing and is not exclusive, so
   * this button never refuses on "already with someone".
   */
  const confirmBefriend = useCallback(() => {
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

  /**
   * Befriending is a ONE-WAY DOOR and the button never said so.
   *
   * `promoteMatchToFriend` sets the same `promoted` flag the partner path does,
   * which is what hides `go_steady` - so a tap meant as "keep in touch" quietly
   * ended the romance for this match, with no warning and no way back. A
   * confirmation is the minimum: the cost is one extra tap on a rare action, and
   * the thing it protects is unrecoverable.
   */
  const handleBefriend = useCallback(() => {
    setError(null);
    const who = profile?.name.split(' ')[0] ?? 'them';
    gameAlert(
      `Add ${who} as a friend?`,
      `Friends stay in your contacts for good - but this ends the romance with ${who}. You will not be able to ask them to go steady afterwards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add friend', onPress: confirmBefriend },
      ],
    );
  }, [profile?.name, confirmBefriend]);

  if (!match || !profile || !view) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Header theme={theme} title="Chat" onBack={onBack} />
        <EmptyState observation="Conversation not found." nudge="Open a different match." />
      </View>
    );
  }

  const firstName = profile.name.split(' ')[0];

  return (
    // Full-screen: keep the option panel (and error line) just above the home
    // indicator. Nothing here is focusable, so no keyboard can cover it.
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
            {isPromoted ? (isFriend ? 'Friend' : 'Dating') : rapportBand(view.rapport)} · {view.rapport}
          </Text>
          {/* Rapport bar: progress the player can watch move. A fill, not a
              side accent bar - Hard Rule #7. */}
          <View
            style={[styles.rapportTrack, { backgroundColor: theme.border }]}
            accessibilityRole="progressbar"
            accessibilityLabel={`Rapport with ${firstName}: ${view.rapport} of 100`}
          >
            <LinearGradient
              colors={SPARK_GRADIENT as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.rapportFill, { width: `${Math.max(2, Math.min(100, view.rapport))}%` }]}
            />
          </View>
        </View>
        {/* Two destinations for an un-promoted match, not one. Befriending is
            offered first because it never refuses - dating is exclusive AND
            gated on rapport, so on a second match (or an early one) the heart
            reports why it cannot happen yet and the person-plus is the only
            thing that can actually do something. */}
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
          accessibilityLabel={
            isPromoted
              ? 'View profile'
              : goSteady && !goSteady.available
                ? `Ask to go steady. Locked: ${goSteady.reason ?? 'not right now'}`
                : 'Ask to go steady'
          }
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
            observation={`You matched with ${firstName}!`}
            nudge="Pick an opener below - every move changes how well this is going."
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesContent}
          renderItem={({ item }) => <Bubble msg={item} theme={theme} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {error ? <Text style={[styles.errorText, { color: SPARK_COLORS.danger }]}>{error}</Text> : null}

      <View style={[styles.panel, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {venuePending ? (
          <>
            <View style={styles.panelHeadRow}>
              <Text style={[styles.panelTitle, { color: theme.textSecondary }]}>
                Where are you taking {firstName}?
              </Text>
              <Pressable
                onPress={() => setVenuePending(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel date plan"
                hitSlop={8}
                style={styles.cancelBtn}
              >
                <X size={fontScale(16)} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.chipScroll} contentContainerStyle={styles.chipWrap}>
              {venues.map(({ venue, available, reason, energyCost, cashCost }) => (
                <Chip
                  key={venue.id}
                  theme={theme}
                  icon={OPTION_ICONS[venue.icon] ?? Sparkles}
                  label={venue.label}
                  cost={`$${cashCost.toLocaleString()} · ${energyCost} energy`}
                  reason={available ? undefined : reason}
                  disabled={!available}
                  onPress={() => play('ask_date', venue.id)}
                />
              ))}
            </ScrollView>
          </>
        ) : (
          <ScrollView style={styles.chipScroll} contentContainerStyle={styles.chipWrap}>
            {view.options
              .filter((o) => o.visible)
              .map(({ option, available, reason, energyCost, cashCost }) => (
                <Chip
                  key={option.id}
                  theme={theme}
                  icon={OPTION_ICONS[option.icon] ?? Sparkles}
                  label={option.label}
                  cost={
                    cashCost > 0
                      ? `from $${cashCost.toLocaleString()} · ${energyCost} energy`
                      : `${energyCost} energy`
                  }
                  reason={available ? undefined : reason}
                  disabled={!available}
                  onPress={() => handleOptionPress(option.id, Boolean(option.requiresVenue))}
                />
              ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function Chip({
  theme,
  icon: Icon,
  label,
  cost,
  reason,
  disabled,
  onPress,
}: {
  theme: any;
  icon: IconComponent;
  label: string;
  cost: string;
  reason?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={reason ? `${label}. Locked: ${reason}` : `${label}. Costs ${cost}`}
      accessibilityState={{ disabled }}
      // Full border on all four sides - never a one-sided accent (Hard Rule #7).
      style={[
        styles.chip,
        {
          backgroundColor: disabled ? 'transparent' : theme.background,
          borderColor: disabled ? theme.border : SPARK_COLORS.accent,
        },
        disabled && styles.chipDisabled,
      ]}
    >
      <Icon size={fontScale(14)} color={disabled ? theme.textSecondary : SPARK_COLORS.accent} strokeWidth={2.2} />
      <View style={styles.chipText}>
        <Text style={[styles.chipLabel, { color: disabled ? theme.textSecondary : theme.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.chipCost, { color: theme.textSecondary }]} numberOfLines={1}>
          {reason ?? cost}
        </Text>
      </View>
    </Pressable>
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
  rapportTrack: {
    height: scale(3),
    borderRadius: scale(2),
    marginTop: scale(4),
    overflow: 'hidden',
  },
  rapportFill: {
    height: '100%',
    borderRadius: scale(2),
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
  panel: {
    paddingHorizontal: responsiveSpacing.md,
    paddingTop: responsiveSpacing.sm,
    paddingBottom: responsiveSpacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panelHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing.xs,
  },
  panelTitle: {
    fontSize: fontScale(11),
    fontWeight: '600',
    flex: 1,
  },
  cancelBtn: {
    width: scale(28),
    height: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Capped height so a long option list can never push the thread off-screen
  // on a small device; the panel scrolls internally instead.
  chipScroll: {
    maxHeight: scale(168),
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsiveSpacing.xs,
    paddingBottom: responsiveSpacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    borderRadius: scale(14),
    borderWidth: 1,
    minHeight: touchTargets.minimum,
    maxWidth: '100%',
  },
  chipDisabled: { opacity: 0.55 },
  chipText: { flexShrink: 1 },
  chipLabel: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  chipCost: {
    fontSize: fontScale(9),
    marginTop: 1,
  },
  errorText: {
    fontSize: fontScale(11),
    paddingHorizontal: responsiveSpacing.md,
    paddingBottom: responsiveSpacing.xs,
  },
});
