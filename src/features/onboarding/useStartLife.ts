/**
 * useStartLife - the one implementation of "turn the onboarding draft into a
 * live save and enter the game".
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * This ceremony (validate → build → carry-over → backup → force-save → load →
 * validate entry → clear draft → navigate) used to live inside the Perks
 * screen as `runStart`, and MainMenu's "Play" quick-start routed THROUGH that
 * screen purely to reach it. A comment there defended the routing: duplicating
 * the ceremony "would put a second, less-tested path into the code that can
 * overwrite a save". That reasoning was right, and it is exactly why this is an
 * EXTRACTION rather than a copy - there is still one implementation, and both
 * callers run the same lines.
 *
 * What the routing cost was a real UX defect: a player who tapped "Play" - the
 * fast door - landed on "step 4 of 4", a grid of 21 perks with 20 of them
 * achievement-locked on a first run, whose own copy tells them to skip it
 * (2026-09-01 UI audit §2 item 7).
 *
 * ── One behaviour change, deliberate ───────────────────────────────────────
 *
 * Permanent perks are loaded HERE, awaited, rather than read from a `useState`
 * an effect fills on screen mount. The old shape had a race: a player who
 * tapped "Start Your Life" before `IAPService.loadPermanentPerks()` resolved
 * built their life with `permanentPerks: []` and silently lost perks they had
 * paid for. Awaiting the load inside the ceremony closes that.
 */
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { applyPendingNewLifeCarryOver } from '@/utils/newLifeCarryOver';
import type { MindsetId } from '@/lib/mindset/config';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import {
  validateOnboardingInputs,
  initializeAndSaveGame,
} from '@/src/features/onboarding/gameInitializer';
import { resolveNewLifeSlot } from '@/src/features/onboarding/slotSafety';
import { snapshotOutgoingSave, createBackupFromState } from '@/utils/saveBackup';
import { logOnboardingValidationError } from '@/src/features/onboarding/onboardingAnalytics';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { validateOnboardingState, applySafeDefaults } from '@/utils/onboardingValidation';
import { validateGameEntry } from '@/utils/gameEntryValidation';
import { forceSave } from '@/utils/saveQueue';
import { isSaveSigningConfigError } from '@/utils/saveValidation';
import { IAPService } from '@/services/IAPService';
import { gameAlert } from '@/utils/gameAlert';

const log = logger.scope('startLife');

export interface StartLifeSelections {
  /** Perks the player chose. Empty for the quick-start door. */
  selectedPerks: string[];
  /** The optional mindset trait. Null for the quick-start door. */
  selectedMindset: MindsetId | null;
  /** Which screen is starting the life, for the validation-error funnel. */
  origin: 'Perks' | 'MainMenu';
}

export function useStartLife() {
  const router = useRouter();
  const { state, clearDraft } = useOnboarding();
  const { loadGame } = useGameActions();

  // Double-tap guard. `isStarting` drives the spinner; the ref is the
  // synchronous half, because two taps in one frame both read the old state.
  const startInFlightRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);

  const runStart = useCallback(
    async ({ selectedPerks, selectedMindset, origin }: StartLifeSelections) => {
      let navigating = false;
      try {
        haptic.heavy();
        log.info('Start life', {
          origin,
          selectedPerks: selectedPerks.length,
          selectedMindset,
          scenarioId: state.scenario?.id,
        });

        const inputCheck = validateOnboardingInputs({
          scenario: state.scenario,
          firstName: state.firstName,
          lastName: state.lastName,
          sex: state.sex,
          sexuality: state.sexuality,
        });
        if (!inputCheck.valid) {
          haptic.error();
          log.error(inputCheck.errorTitle!, { state });
          logOnboardingValidationError(origin, inputCheck.errorTitle || 'input_invalid', {
            message: inputCheck.errorMessage,
          });
          gameAlert(inputCheck.errorTitle!, inputCheck.errorMessage!, [{ text: 'OK' }]);
          return;
        }

        // Awaited, not read off mount state - see the header note. A failure
        // here must not block the start: an unreachable store is not a reason
        // to refuse a new game, it is a reason to start without the extras.
        let permanentPerks: string[] = [];
        try {
          permanentPerks = await IAPService.loadPermanentPerks();
          if (permanentPerks.length > 0) log.info('Loaded permanent perks', { permanentPerks });
        } catch (error) {
          log.error('Error loading permanent perks:', error);
        }

        const newState = buildNewGameState({
          initialGameState,
          stateVersion: STATE_VERSION,
          firstName: state.firstName,
          lastName: state.lastName,
          sex: state.sex,
          sexuality: state.sexuality,
          avatarId: state.avatarId,
          // The face the player actually built. Omitting this dropped the whole
          // creator on the floor: `buildNewGameState` left `userProfile.avatar`
          // undefined, `resolveAvatar` fell back to deriving a face from the
          // name, and the character who walked into the game was a different
          // person from the one on the creation screen.
          avatar: state.avatar,
          scenario: {
            id: state.scenario!.id,
            start: state.scenario!.start,
          },
          challengeScenarioId: state.challengeScenarioId,
          selectedPerks,
          permanentPerks,
          selectedMindset,
          ambitionId: state.ambitionId,
        });

        // Hand the new life whatever the previous one was owed: gems and IAP
        // entitlements banked by a fresh start (death screen "Start New Life",
        // Settings -> Restart Game). `buildNewGameState` spreads
        // `initialGameState`, so without this the purchases the player made are
        // rebuilt as the template's defaults. One-shot: the record is deleted as
        // it is read, so it cannot mint a second copy of the same gem balance
        // into a later life. A no-op (returns the state untouched) for an
        // ordinary new game, which is the common case.
        await applyPendingNewLifeCarryOver(newState);

        // Pass the chosen slot through UNCHANGED. The old `state.slot || 1` is
        // what let a flow that never picked a slot - the death screen, a deep
        // link, a rehydrated draft - land on slot 1 and overwrite a real save.
        // `initializeAndSaveGame` re-reads the slot and refuses if it is not ours.
        const slotToUse = state.slot;
        const createBackupForOnboarding = async (
          slot: number,
          stateToSave: any,
          tag: string
        ): Promise<void> => {
          await createBackupFromState(slot, stateToSave, tag);
        };
        const forceSaveForOnboarding = async (
          slot: number,
          stateToSave: any
        ): Promise<void> => {
          await forceSave(slot, stateToSave);
        };

        const result = await initializeAndSaveGame(newState, slotToUse, {
          validateOnboardingState,
          applySafeDefaults,
          createBackupFromState: createBackupForOnboarding,
          forceSave: forceSaveForOnboarding,
          loadGame,
          validateGameEntry,
          isSaveSigningConfigError,
          resolveNewLifeSlot,
          snapshotOutgoingSave,
        });

        if (!result.success) {
          haptic.error();
          if (result.slotProblem) {
            // Don't dead-end them on an alert four screens deep - the fix is a
            // slot choice, so take them to where that choice is made. Their
            // scenario, name, perks and mindset stay in the draft, so coming
            // back is a couple of taps, not a restart.
            gameAlert(result.errorTitle!, result.errorMessage!, [
              {
                text: 'Choose Slot',
                onPress: () => router.replace('/(onboarding)/SaveSlots'),
              },
            ]);
            return;
          }
          gameAlert(result.errorTitle!, result.errorMessage!, [{ text: 'OK' }]);
          return;
        }

        haptic.success();
        // R3-B: drop the persisted onboarding draft once the player has actually
        // started the life - clearDraft() also resets the in-memory onboarding
        // state so the next "New Life" entry starts clean (no leaked name/perks).
        void clearDraft();
        navigating = true;
        setTimeout(() => {
          router.replace('/(tabs)/home');
        }, 100);
      } finally {
        // Always release the synchronous guard. On the failure/return paths also
        // re-enable the button so the player can retry; on success keep it disabled
        // because we're navigating away (avoids a setState-after-unmount warning).
        startInFlightRef.current = false;
        if (!navigating) setIsStarting(false);
      }
    },
    [state, clearDraft, loadGame, router]
  );

  /**
   * Start the life. Safe to call from a press handler: guarded against a
   * double tap, and the heavy synchronous build is deferred one frame so the
   * spinner paints before the JS thread blocks.
   */
  const startLife = useCallback(
    (selections: StartLifeSelections) => {
      if (startInFlightRef.current) return;
      startInFlightRef.current = true;
      setIsStarting(true);
      requestAnimationFrame(() => {
        void runStart(selections);
      });
    },
    [runStart]
  );

  return { startLife, isStarting };
}
