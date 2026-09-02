/**
 * NpcProfileSheet - minimal bottom sheet for an NPC tapped from the StoriesRail.
 *
 * Shows the tapped NPC's avatar + name + derived @handle and a single
 * Follow / Following toggle wired straight into `PulseActions.followNpc` /
 * `unfollowNpc`. This is the ONLY UI entry point into the follow graph, so it's
 * what finally makes ProfileScreen's "Following" count move. Deliberately not a
 * full profile page - just the follow affordance.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserPlus, Check } from 'lucide-react-native';
import BaseModal from '@/components/ui/BaseModal';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { followNpc, unfollowNpc } from '@/contexts/game/actions/PulseActions';
import { PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

/**
 * Minimal NPC identity the sheet needs - threaded through StoriesRail's
 * `onTapNpc` so the sheet doesn't have to re-look-up the relationship.
 */
export interface NpcStoryTarget {
  id: string;
  name: string;
  profilePicture?: string;
}

interface NpcProfileSheetProps {
  visible: boolean;
  npc: NpcStoryTarget | null;
  onDismiss: () => void;
}

/** Derive a Pulse-style @handle from a display name (mirrors followNpc's own). */
function handleFor(name: string): string {
  return `@${name.toLowerCase().replace(/\s+/g, '')}`;
}

export default function NpcProfileSheet({ visible, npc, onDismiss }: NpcProfileSheetProps) {
  const { gameState, setGameState, saveGame } = useGame();
  const { theme } = useTheme();

  // Source of truth for the toggle: the authoritative follow graph. Reading it
  // live via useGame() means the button flips the instant followNpc/unfollowNpc
  // mutate state - no need to reopen the sheet.
  const isFollowing = !!(
    npc && gameState.socialMedia?.followGraph?.followingNpcIds?.includes(npc.id)
  );

  const handleToggle = useCallback(() => {
    if (!npc) return;
    if (isFollowing) {
      unfollowNpc(setGameState, npc.id);
      pulseHaptics.light();
    } else {
      const result = followNpc(gameState, setGameState, npc.id);
      if (result.mutualFollow) pulseHaptics.success();
      else pulseHaptics.light();
    }
    saveGame?.();
  }, [npc, isFollowing, gameState, setGameState, saveGame]);

  if (!visible || !npc) return null;

  const name = npc.name;
  const handle = handleFor(name);

  return (
    <BaseModal visible={visible} onClose={onDismiss} variant="bottom" title={name} subtitle={handle}>
      <View style={styles.body}>
        <ImageWithFallback
          uri={npc.profilePicture}
          fallback={name}
          face={{ seed: npc.id, size: scale(74) }}
          style={styles.avatar}
          placeholderColor={PULSE_COLORS.tierCelebrity}
          placeholderTextColor="#FFFFFF"
        />

        <Pressable
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
          accessibilityState={{ selected: isFollowing }}
          style={[
            styles.followBtn,
            isFollowing
              ? { borderColor: theme.border, borderWidth: 1.5 }
              : { backgroundColor: PULSE_COLORS.accent },
          ]}
        >
          {isFollowing ? (
            <>
              <Check size={fontScale(16)} color={theme.text} strokeWidth={2.4} />
              <Text style={[styles.followText, { color: theme.text }]}>Following</Text>
            </>
          ) : (
            <>
              <UserPlus size={fontScale(16)} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={[styles.followText, styles.followTextOn]}>Follow</Text>
            </>
          )}
        </Pressable>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: responsiveSpacing.md,
  },
  avatar: {
    width: scale(76),
    height: scale(76),
    borderRadius: scale(38),
  },
  followBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: touchTargets.minimum,
    paddingVertical: responsiveSpacing.sm,
    borderRadius: scale(14),
  },
  followText: {
    fontSize: fontScale(15),
    fontWeight: '600',
  },
  followTextOn: {
    color: '#FFFFFF',
  },
});
