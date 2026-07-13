import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Scenario } from './scenarioData';
import { safeAsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';

interface OnboardingState {
  slot: number;
  scenario?: Scenario;
  challengeScenarioId?: string; // CRITICAL FIX: Track challenge scenario ID separately from regular scenario
  firstName: string;
  lastName: string;
  sex: 'male' | 'female' | 'random';
  sexuality: 'straight' | 'gay' | 'bi';
  avatarId?: string; // Chosen starter face (utils/facePool listStarterAvatars id)
  perks: string[];
}

interface OnboardingContextType {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  /** Clear the persisted draft (call after a successful onboarding completion). */
  clearDraft: () => Promise<void>;
}

const defaultState: OnboardingState = {
  slot: 1,
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
 * count). We never persist a pristine draft — that keeps the debounced writer
 * from resurrecting the key right after clearDraft() resets state on
 * completion, and stops a brand-new session from writing an empty draft.
 */
const isPristineDraft = (s: OnboardingState): boolean =>
  !s.scenario &&
  !s.challengeScenarioId &&
  !s.firstName &&
  !s.lastName &&
  !s.avatarId &&
  s.perks.length === 0;

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const hasHydratedRef = useRef(false);
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
            setState({ ...defaultState, ...persisted.state });
          } else if (persisted.savedAt) {
            // Stale draft — clean up.
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
    setState(defaultState);
    try {
      await safeAsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch (error) {
      logger.warn('[Onboarding] Failed to clear draft', { error });
    }
  }, []);

  const value = useMemo(() => ({ state, setState, clearDraft }), [state, clearDraft]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
};
