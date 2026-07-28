/**
 * The way back into the face creator, after onboarding.
 *
 * ## Why this is a component and not three lines in IdentityCard
 *
 * Writing to the save needs `setGameState`, and `useGameState()` re-subscribes
 * its caller to the ENTIRE game state — a documented perf regression in this
 * repo (`tasks/lessons.md`, 2026-06-09). `IdentityCard` re-renders every week
 * and reads a dozen slices through a narrow `useGameSelector` projection
 * specifically to avoid that. Putting the write here keeps the whole-state
 * subscription in a leaf that renders one button.
 *
 * ## Why the creator opens at the studio
 *
 * `startAt='studio'` skips the "photo or manual?" entry screen. That question
 * belongs to the first run — a player re-opening a face they already have is
 * answering it again for no reason, and the selfie route replaces the whole
 * genome rather than editing it, which is not what "edit" should default to.
 * The selfie route is still reachable from onboarding.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Pencil } from 'lucide-react-native';
import FaceCreatorModal from './FaceCreatorModal';
import { useGameState } from '@/contexts/game/GameStateContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { applyFaceEdit } from '@/contexts/game/actions/IdentityActions';
import { normalizeIdentity, type FaceGenome } from '@/lib/identity';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { haptic } from '@/utils/haptics';
import { fontScale, scale } from '@/utils/scaling';

export default function EditFaceButton(): React.JSX.Element | null {
  const { gameState, setGameState } = useGameState();
  const { saveGame } = useGameActions();
  const [open, setOpen] = useState(false);
  // The genome being edited. Held locally while the modal is open so a slider
  // drag does not write to the save sixty times a second — the creator emits
  // continuously, and only Done commits.
  const [draft, setDraft] = useState<FaceGenome | null>(null);

  const identity = gameState?.identity;
  const age = gameState?.date?.age ?? 18;
  const weeksLived = gameState?.weeksLived ?? 0;

  const openCreator = useCallback(() => {
    haptic.light();
    setDraft(normalizeIdentity(identity).face);
    setOpen(true);
  }, [identity]);

  const commit = useCallback(
    (portraitUri: string | null) => {
      const genome = draft;
      if (!genome) return;
      // Charged inside the updater against `prev`, not against the `gameState`
      // this closure captured. A week could have ticked while the modal was
      // open, and writing a stale snapshot back would roll it back.
      setGameState((prev) => applyFaceEdit(prev, genome, portraitUri, prev.weeksLived ?? weeksLived));
      saveGame?.();
    },
    [draft, setGameState, saveGame, weeksLived],
  );

  // Same flag the onboarding creator sits behind. With it off, the character
  // keeps whatever face they have and this affordance does not exist — rather
  // than opening an editor that cannot render a head.
  if (!FEATURE_FLAGS.faceCreator3D) return null;

  return (
    <>
      <TouchableOpacity
        onPress={openCreator}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Edit your face"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Pencil size={scale(11)} color="#DCE4F0" />
        <Text style={styles.label}>Edit</Text>
      </TouchableOpacity>

      {draft ? (
        <FaceCreatorModal
          visible={open}
          genome={draft}
          onChange={setDraft}
          onClose={() => setOpen(false)}
          onDone={commit}
          age={age}
          body={identity?.body}
          sex={gameState?.userProfile?.sex ?? 'random'}
          startAt="studio"
          title="Edit your face"
          doneLabel="Save face"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // A pill under the portrait rather than an icon floating on it: the avatar
  // already carries a cosmetic frame and a glow, and a bare icon on top of both
  // reads as damage.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
    marginTop: scale(6),
    paddingHorizontal: scale(9),
    paddingVertical: scale(3),
    borderRadius: 99,
    backgroundColor: 'rgba(7, 10, 16, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  label: { color: '#DCE4F0', fontSize: fontScale(10), fontWeight: '700' },
});
