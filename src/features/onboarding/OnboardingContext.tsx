import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Scenario } from './scenarioData';
import { safeAsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';
import { NEW_LIFE_SLOT_UNSET } from './slotSafety';

interface OnboardingState {
  /**
   * Target save slot, 1-3. `NEW_LIFE_SLOT_UNSET` (0) means the player has not
   * chosen one - which is NOT a licence to pick one for them. This used to
   * default to 1, and every route that reached onboarding without visiting the
   * slot picker quietly inherited it and overwrote slot 1. See `slotSafety.ts`.
   */
  slot: number;
  scenario?: Scenario;
  challengeScenarioId?: string; // CRITICAL FIX: Track challenge scenario ID separately from regular scenario
  firstName: string;
  lastName: string;
  sex: 'male' | 'female' | 'random';
  sexuality: 'straight' | 'gay' | 'bi';
  avatarId?: string; // Legacy starter-face pick (utils/facePool). New lives leave this unset.
  avatar?: string; // Encoded AvatarConfig (lib/avatar/encode) - the customized face.
  perks: string[];
  ambitionId?: string; // Chosen Life Ambition (lib/ambitions catalogue id). Optional - skippable.
}

interface OnboardingContextType {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  /** Clear the persisted draft (call after a successful onboarding completion). */
  clearDraft: () => Promise<void>;
}

const defaultState: OnboardingState = {
  slot: NEW_LIFE_SLOT_UNSET,
  firstName: '',
  lastName: '',
  sex: 'random',
  sexuality: 'straight',
  perks: [],
};

const ONBOARDING_DRAFT_KEY = 'onboarding_draft_v1';
// R3-B: drop the draft after 30 days idle so we don't surprise returning
// players with stale half-filled onboarding data.
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface PersistedDraft {
  state: OnboardingState;
  savedAt: number;
}

/**
 * A draft carrying no real user choices (default sex/sexuality/slot don't
 * count). We never persist a pristine draft - that keeps the debounced writer
 * from resurrecting the key right after clearDraft() resets state on
 * completion, and stops a brand-new session from writing an empty draft.
 */
const isPristineDraft = (s: OnboardingState): boolean =>
  !s.scenario &&
  !s.challengeScenarioId &&
  !s.firstName &&
  !s.lastName &&
  !s.avatarId &&
  !s.avatar &&
  !s.ambitionId &&
  s.perks.length === 0;

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const hasHydratedRef = useRef(false);
  // Set the moment any screen writes to the draft. The hydration below reads
  // AsyncStorage asynchronously and lands with a WHOLE-OBJECT replace; on a
  // cold start with contended storage a player can tap New Game - which picks
  // and writes the target slot - before that read resolves. The hydration then
  // landed second and replaced the deliberately-chosen slot with the draft's
  // stale one. 2026-07-29 audit PIPE-9.
  const hasLiveChoiceRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // R3-B: hydrate any persisted draft on mount. Without this, a player who
  // typed their character name, got a phone call, and let iOS reap the app
  // would come back to a blank Customize screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await safeAsyncStorage.getItem(ONBOARDING_DRAFT_KEY, null);
        if (cancelled) return;
        if (raw && typeof raw === 'object') {
          const persisted = raw as PersistedDraft;
          if (
            persisted.savedAt &&
            Date.now() - persisted.savedAt < DRAFT_TTL_MS &&
            persisted.state &&
            typeof persisted.state === 'object'
          ) {
            // Never clobber a choice the player has already made this session:
            // fill in the blanks the draft knows about, but let live state win.
            setState((prev) =>
              hasLiveChoiceRef.current
                ? { ...defaultState, ...persisted.state, ...prev }
                : { ...defaultState, ...persisted.state },
            );
          } else if (persisted.savedAt) {
            // Stale draft - clean up.
            void safeAsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
          }
        }
      } catch (error) {
        logger.warn('[Onboarding] Failed to hydrate draft', { error });
      } finally {
        hasHydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // R3-B: persist on change with a 500ms debounce so rapid typing in the
  // name fields doesn't flood AsyncStorage.
  useEffect(() => {
    if (!hasHydratedRef.current) return; // don't persist the default before hydration finishes
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    // Never persist a pristine draft. This is what stops the debounced writer
    // from re-creating the key ~500ms after clearDraft() resets state on
    // completion (the provider is app-level and never remounts).
    if (isPristineDraft(state)) {
      persistTimerRef.current = null;
      void safeAsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
      return;
    }
    persistTimerRef.current = setTimeout(() => {
      const payload: PersistedDraft = { state, savedAt: Date.now() };
      void safeAsyncStorage.setItem(ONBOARDING_DRAFT_KEY, payload).then((ok) => {
        if (!ok) logger.warn('[Onboarding] Failed to persist draft');
      });
    }, 500);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [state]);

  const clearDraft = React.useCallback(async () => {
    // Cancel any pending debounced write so it can't resurrect the key, and
    // reset the in-memory draft so the next New Life starts clean rather than
    // silently reusing the finished life's name/scenario/perks.
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    hasLiveChoiceRef.current = false;
    setState(defaultState);
    try {
      await safeAsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch (error) {
      logger.warn('[Onboarding] Failed to clear draft', { error });
    }
  }, []);

  // Wrap setState so any screen writing to the draft marks the session as
  // having a live choice - that is what stops a late hydration overwriting it.
  const setStateTracked = React.useCallback<React.Dispatch<React.SetStateAction<OnboardingState>>>(
    (update) => {
      hasLiveChoiceRef.current = true;
      setState(update);
    },
    [],
  );

  const value = useMemo(
    () => ({ state, setState: setStateTracked, clearDraft }),
    [state, setStateTracked, clearDraft],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
};
