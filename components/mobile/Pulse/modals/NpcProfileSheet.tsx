/**
 * NpcProfileSheet — minimal bottom sheet for an NPC tapped from the StoriesRail.
 *
 * Shows the tapped NPC's avatar + name + derived @handle and a single
 * Follow / Following toggle wired straight into `PulseActions.followNpc` /
 * `unfollowNpc`. This is the ONLY UI entry point into the follow graph, so it's
 * what finally makes ProfileScreen's "Following" count move. Deliberately not a
 * full profile page — just the follow affordance.
 */
import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, UserPlus, Check } from 'lucide-react-native';
import Gradient from '@/components/ui/Gradient';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { useGame } from '@/contexts/GameContext';
import { useTheme } from '@/hooks/useTheme';
import { scale, fontScale, responsiveSpacing, touchTargets } from '@/utils/scaling';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { followNpc, unfollowNpc } from '@/contexts/game/actions/PulseActions';
import { PULSE_GRADIENT, PULSE_COLORS } from '../styles/pulseTheme';
import { pulseHaptics } from '../utils/pulseHaptics';

const LinearGradient = Gradient;

/**
 * Minimal NPC identity the sheet needs — threaded through StoriesRail's
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
  // mutate state — no need to reopen the sheet.
  const isFollowing = !!(
    npc && gameState.socialMedia?.followGraph?.followingNpcIds?.includes(npc.id)
  );

  const handleToggle = useCallback(() => {
    if (!npc) return;
    if (isFollowing) {
      unfollowNpc(setGameState, npc.id);
      pulseHaptics.light();
    } else {
      const result = followNpc(setGameState, npc.id);
      if (result.mutualFollow) pulseHaptics.success();
      else pulseHaptics.light();
    }
    saveGame?.();
  }, [npc, isFollowing, setGameState, saveGame]);

  if (!visible || !npc) return null;

  const name = npc.name;
  const handle = handleFor(name);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={fontScale(22)} color={theme.text} />
            </Pressable>
          </View>

          <ImageWithFallback
            uri={npc.profilePicture}
            fallback={name}
            face={{ seed: npc.id, size: scale(74) }}
            style={styles.avatar}
            placeholderColor={PULSE_COLORS.tierCelebrity}
            placeholderTextColor="#FFFFFF"
          />

          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.handle, { color: theme.textSecondary }]} numberOfLines={1}>
            {handle}
          </Text>

          <Pressable
            onPress={handleToggle}
            accessibilityRole="button"
            accessibilityLabel={isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
            accessibilityState={{ selected: isFollowing }}
            style={styles.ctaWrap}
          >
            {isFollowing ? (
              <View style={[styles.followingBtn, { borderColor: theme.border }]}>
                <Check size={fontScale(16)} color={theme.text} strokeWidth={2.4} />
                <Text style={[styles.followingText, { color: theme.text }]}>Following</Text>
              </View>
            ) : (
              <LinearGradient
                colors={PULSE_GRADIENT as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.followBtn}
              >
                <UserPlus size={fontScale(16)} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.followText}>Follow</Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: Z_INDEX.MODAL,
  },
  sheet: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.xl,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  closeBtn: {
    width: touchTargets.minimum,
    height: touchTargets.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: scale(76),
    height: scale(76),
    borderRadius: scale(38),
    marginBottom: responsiveSpacing.md,
  },
  name: {
    fontSize: fontScale(20),
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: '90%',
  },
  handle: {
    fontSize: fontScale(13),
    marginTop: 2,
    marginBottom: responsiveSpacing.lg,
    textAlign: 'center',
    maxWidth: '90%',
  },
  ctaWrap: {
    alignSelf: 'stretch',
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: responsiveSpacing.md,
  },
  followText: {
    color: '#FFFFFF',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  followingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: responsiveSpacing.md,
    borderRadius: scale(14),
    borderWidth: 1.5,
  },
  followingText: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
