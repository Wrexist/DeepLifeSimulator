import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef } from 'react';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { TutorialStep, EnhancedTutorialStep } from '@/types/tutorial';
import { getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { track } from '@/lib/analytics';
import { logger } from '@/utils/logger';
import { stripEmoji } from '@/utils/notificationText';

interface LoadingState {
  id: string;
  message: string;
  variant?: 'default' | 'overlay' | 'inline';
}

interface ErrorState {
  id: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  onRetry?: () => void;
  autoDismiss?: boolean;
}

interface UIUXState {
  loadingStates: LoadingState[];
  errorStates: ErrorState[];
  showTutorial: boolean;
  tutorialSteps: TutorialStep[];
  currentTutorialStep: number;
  hasCompletedTutorial: boolean;
}

interface UIUXContextType extends UIUXState {
  // Loading management
  showLoading: (id: string, message?: string, variant?: LoadingState['variant']) => void;
  hideLoading: (id: string) => void;
  isLoading: (id: string) => boolean;
  
  // Error management
  showError: (id: string, message: string, severity?: ErrorState['severity'], title?: string, onRetry?: () => void) => void;
  hideError: (id: string) => void;
  // Named `showInfoBanner` (not `showInfo`) on purpose: ToastContext exposes a
  // `showInfo(message, duration)` with an incompatible signature, and call sites
  // that grabbed the wrong hook silently passed the message as the banner id.
  showInfoBanner: (id: string, message: string, title?: string) => void;
  showWarning: (id: string, message: string, title?: string) => void;
  
  // Tutorial management
  startTutorial: (steps: TutorialStep[] | EnhancedTutorialStep[], context?: 'game' | 'onboarding' | 'advanced') => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  setTutorialStep: (step: number) => void;
  resetTutorial: () => void;
  startEnhancedTutorial: (context?: 'game' | 'onboarding' | 'advanced') => void;
}

const UIUXContext = createContext<UIUXContextType | undefined>(undefined);

const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';

/**
 * Cap on simultaneously-visible banners (mirrors the Toast system's limit of 3).
 * Without it, a burst of week-advance notifications - each with a unique,
 * week-numbered id, so they don't collapse by id - stacked unbounded and flooded
 * the screen (every banner is offset `stackIndex * 96px`) before the ~5s
 * auto-dismiss could clear them. Spamming "Next Week" reproduced this reliably.
 */
const MAX_VISIBLE_BANNERS = 2;

function isRealError(error: ErrorState): boolean {
  return error.severity === 'error' || error.severity === 'critical';
}

/**
 * A notification with no visible text renders as a bare icon-only banner
 * (the "empty blue banner" bug) - drop it at the source instead.
 * Exported for unit testing.
 */
export function isBlankNotification(message?: string, title?: string): boolean {
  return !message?.trim() && !title?.trim();
}

/**
 * Bound the banner stack so a burst of notifications can't flood the screen.
 * Never drops a real error/critical; once those are kept, the remaining slots
 * go to the most recent info/warning advisories (arrival order preserved).
 * Exported for unit testing.
 */
export function capErrorBanners(errorStates: ErrorState[], max: number = MAX_VISIBLE_BANNERS): ErrorState[] {
  if (errorStates.length <= max) return errorStates;
  const realErrors = errorStates.filter(isRealError);
  const advisorySlots = Math.max(0, max - realErrors.length);
  // NB: slice(-0) === slice(0) returns the WHOLE array, so guard the zero case.
  const advisories = errorStates.filter(error => !isRealError(error));
  const keptAdvisories = advisorySlots > 0 ? advisories.slice(-advisorySlots) : [];
  const keep = new Set<ErrorState>([...realErrors, ...keptAdvisories]);
  return errorStates.filter(error => keep.has(error));
}

export function UIUXProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UIUXState>({
    loadingStates: [],
    errorStates: [],
    showTutorial: false,
    tutorialSteps: [],
    currentTutorialStep: 0,
    hasCompletedTutorial: false,
  });

  /**
   * Mirrors the tutorial's position for analytics only.
   *
   * `completeTutorial` and `skipTutorial` are `useCallback([])`, so the only
   * in-callback route to the current step is the `setState` updater - and
   * emitting from inside an updater is the double-fire bug this codebase keeps
   * relearning (§4.4): React may invoke it more than once per commit, so one
   * abandonment would report as two. A ref reads the same value from outside.
   *
   * The step number is the whole point: "they quit the tutorial" is not
   * actionable, "62% of them quit on step 3" names the screen to rewrite.
   */
  const tutorialProgress = useRef({ step: 0, total: 0 });

  // Check if tutorial was completed on mount
  React.useEffect(() => {
    checkTutorialStatus();
  }, []);

  const checkTutorialStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
      if (completed === 'true') {
        setState(prev => ({ ...prev, hasCompletedTutorial: true }));
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Error checking tutorial status:', error);
      }
    }
  };

  // Loading management
  const showLoading = useCallback((id: string, message = 'Loading...', variant: LoadingState['variant'] = 'default') => {
    setState(prev => ({
      ...prev,
      loadingStates: [...prev.loadingStates.filter(loading => loading.id !== id), { id, message, variant }],
    }));
  }, []);

  const hideLoading = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      loadingStates: prev.loadingStates.filter(loading => loading.id !== id),
    }));
  }, []);

  const isLoading = useCallback((id: string) => {
    return state.loadingStates.some(loading => loading.id === id);
  }, [state.loadingStates]);

  // Error management
  const showError = useCallback((
    id: string,
    message: string,
    severity: ErrorState['severity'] = 'error',
    title?: string,
    onRetry?: () => void
  ) => {
    // Drop blank notifications: a missing/empty message (e.g. a call site
    // passing an optional result?.message, or the Toast-style showInfo
    // signature by mistake) rendered as a bare icon-only banner.
    if (isBlankNotification(message, title)) {
      logger.warn(`[UIUX] dropped empty ${severity} banner (id: ${id})`);
      return;
    }
    // Same rule as the toast channel: emoji are stripped at the channel, not at
    // the call site, because banner copy is assembled upstream (subsystem
    // notifications carry titles like "🏠 Property Alert"). Length is NOT
    // capped here - a banner is the taller surface and owns the multi-line
    // weekly summary, so truncating it would lose real content.
    const cleanMessage = stripEmoji(message);
    const cleanTitle = title === undefined ? undefined : stripEmoji(title);
    if (isBlankNotification(cleanMessage, cleanTitle)) {
      logger.warn(`[UIUX] dropped ${severity} banner with no text after sanitising (id: ${id})`);
      return;
    }

    setState(prev => {
      const next: ErrorState = {
        id,
        message: cleanMessage,
        severity,
        title: cleanTitle,
        onRetry,
        autoDismiss: severity === 'info',
      };
      // Replace any existing banner with the same id, then append the new one,
      // and bound the stack so a burst of advisories (e.g. spamming "Next Week")
      // can't flood the screen.
      const deduped = [...prev.errorStates.filter(error => error.id !== id), next];
      return { ...prev, errorStates: capErrorBanners(deduped) };
    });
  }, []);

  const hideError = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      errorStates: prev.errorStates.filter(error => error.id !== id),
    }));
  }, []);

  const showInfoBanner = useCallback((id: string, message: string, title?: string) => {
    showError(id, message, 'info', title);
  }, [showError]);

  const showWarning = useCallback((id: string, message: string, title?: string) => {
    showError(id, message, 'warning', title);
  }, [showError]);

  // Tutorial management
  const startTutorial = useCallback((steps: TutorialStep[] | EnhancedTutorialStep[], context?: 'game' | 'onboarding' | 'advanced') => {
    if (__DEV__) {
      logger.debug('[UIUXContext] startTutorial called with', { stepsCount: steps.length, firstStep: steps[0] });
    }
    tutorialProgress.current = { step: 0, total: steps.length };
    track('tutorial_step', { action: 'start', step: 0, total: steps.length, context: context ?? 'game' });
    setState(prev => {
      const newState = {
        ...prev,
        showTutorial: true,
        tutorialSteps: steps as TutorialStep[],
        currentTutorialStep: 0,
      };
      if (__DEV__) {
        logger.debug('[UIUXContext] New state:', { showTutorial: newState.showTutorial, stepsCount: newState.tutorialSteps.length });
      }
      return newState;
    });
  }, []);

  const startEnhancedTutorial = useCallback((context: 'game' | 'onboarding' | 'advanced' = 'game') => {
    const enhancedSteps = getEnhancedTutorialSteps(context);
    startTutorial(enhancedSteps, context);
  }, [startTutorial]);

  const completeTutorial = useCallback(async () => {
    // Emitted before the await: the write can throw, and a player who reached
    // the end of the tutorial did so whether or not the flag persisted.
    track('tutorial_step', {
      action: 'complete',
      step: tutorialProgress.current.step,
      total: tutorialProgress.current.total,
    });
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setState(prev => ({
        ...prev,
        showTutorial: false,
        hasCompletedTutorial: true,
      }));
    } catch (error) {
      if (__DEV__) {
        logger.error('Error saving tutorial completion:', error);
      }
    }
  }, []);

  const skipTutorial = useCallback(async () => {
    track('tutorial_step', {
      action: 'skip',
      step: tutorialProgress.current.step,
      total: tutorialProgress.current.total,
    });
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setState(prev => ({
        ...prev,
        showTutorial: false,
        hasCompletedTutorial: true,
      }));
    } catch (error) {
      if (__DEV__) {
        logger.error('Error saving tutorial completion:', error);
      }
    }
  }, []);

  const setTutorialStep = useCallback((step: number) => {
    tutorialProgress.current = { ...tutorialProgress.current, step };
    track('tutorial_step', { action: 'advance', step, total: tutorialProgress.current.total });
    setState(prev => ({
      ...prev,
      currentTutorialStep: step,
    }));
  }, []);

  const resetTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
      setState(prev => ({
        ...prev,
        hasCompletedTutorial: false,
        showTutorial: false,
        currentTutorialStep: 0,
      }));
    } catch (error) {
      if (__DEV__) {
        logger.error('Error resetting tutorial:', error);
      }
    }
  }, []);

  const value: UIUXContextType = useMemo(() => ({
    ...state,
    showLoading,
    hideLoading,
    isLoading,
    showError,
    hideError,
    showInfoBanner,
    showWarning,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  }), [
    state,
    showLoading,
    hideLoading,
    isLoading,
    showError,
    hideError,
    showInfoBanner,
    showWarning,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  ]);

  return (
    <UIUXContext.Provider value={value}>
      {children}
    </UIUXContext.Provider>
  );
}

export function useUIUX() {
  const context = useContext(UIUXContext);
  if (context === undefined) {
    throw new Error('useUIUX must be used within a UIUXProvider');
  }
  return context;
}

// Convenience hooks for common operations
export function useLoading() {
  const { showLoading, hideLoading, isLoading } = useUIUX();
  return { showLoading, hideLoading, isLoading };
}

export function useError() {
  const { showError, hideError, showInfoBanner, showWarning } = useUIUX();
  return { showError, hideError, showInfoBanner, showWarning };
}

export function useTutorial() {
  const {
    showTutorial,
    tutorialSteps,
    currentTutorialStep,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  } = useUIUX();
  
  return {
    showTutorial,
    tutorialSteps,
    currentTutorialStep,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  };
}
