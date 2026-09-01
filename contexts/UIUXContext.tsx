import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
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
}

// The modal tutorial system that used to live here (startTutorial /
// completeTutorial / hasCompletedTutorial + a device-wide AsyncStorage flag)
// is retired: FirstSessionCoach teaches from live game state instead, and
// every gate that consulted `hasCompletedTutorial` now reads game progress
// (`weeksInThisLife`), which resets per life and cannot be pre-satisfied by a
// previous install.

const UIUXContext = createContext<UIUXContextType | undefined>(undefined);

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
  });

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

  const value: UIUXContextType = useMemo(() => ({
    ...state,
    showLoading,
    hideLoading,
    isLoading,
    showError,
    hideError,
    showInfoBanner,
    showWarning,
  }), [
    state,
    showLoading,
    hideLoading,
    isLoading,
    showError,
    hideError,
    showInfoBanner,
    showWarning,
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
