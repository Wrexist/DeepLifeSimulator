import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { responsiveSpacing, scale } from '@/utils/scaling';
import ToastNotification from '@/components/ui/ToastNotification';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { emailDiagnosticReport } from '@/utils/diagnosticReport';
import { setToastHandler } from '@/utils/toastBridge';
import { toastText } from '@/utils/notificationText';
import { shouldShowToast } from '@/utils/toastPolicy';
import { enqueueToast, toastDisplayMessage, MAX_VISIBLE_TOASTS } from '@/utils/toastQueue';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import { logger } from '@/utils/logger';

/**
 * Turn a raw error into something actionable: one tap on an error toast's
 * "Report" button emails us a COMPREHENSIVE diagnostic (build, live game
 * position, state validation, recent logs) - built via the shared
 * diagnosticReport helper, which pulls the live game state from the AI debug
 * getter when no state is passed. Goes to the canonical support inbox.
 */
function reportErrorToast(message: string) {
  void emailDiagnosticReport({
    error: new Error(message),
    source: 'Error toast',
  });
}

interface Toast {
  id: string;
  message: string;
  /**
   * How many times this message has been raised while it was on screen. 1 for
   * an ordinary toast; `toastDisplayMessage` appends a "xN" tally above that.
   * See `utils/toastQueue.ts` for the collapsing rule.
   */
  count: number;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top' | 'bottom';
  action?: {
    label: string;
    onPress: () => void;
  };
  persistent?: boolean; // Don't auto-dismiss
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number, position?: Toast['position']) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * The player's pop-up preference, read WITHOUT subscribing.
   *
   * `useGameStateGetter` would throw outside a GameProvider; this layer wraps
   * most of the app and must never be the thing that crashes it, so the store
   * context is read directly and a missing store degrades to "show
   * everything" (the setting's own default). Reading through the getter at
   * FIRE time rather than via a selector keeps `showToast` identity-stable
   * with `[]` deps - it has ~200 call sites and sits in a memoised context
   * value, so re-creating it on every settings read would re-render the tree.
   */
  const gameStore = useContext(GameStoreContext);
  const notificationsEnabled = useCallback((): boolean | undefined => {
    try {
      return gameStore?.getSnapshot()?.settings?.notificationsEnabled;
    } catch {
      return undefined; // never let a preference read break a toast
    }
  }, [gameStore]);

  const showToast = useCallback(
    (
      message: string,
      type: Toast['type'] = 'info',
      duration: number = 3000,
      position?: Toast['position'],
      action?: Toast['action'],
      persistent?: boolean
    ) => {
      // Routine feedback sits above navigation so the HUD stays readable.
      const resolvedPosition: Toast['position'] =
        position ?? 'bottom';

      // Drop blank toasts - an empty message renders as a bare icon-only
      // blue pill (a call site passed an optional result?.message that was
      // undefined). Nothing useful to show.
      if (!message?.trim()) {
        if (__DEV__) console.warn('[toast suppressed: empty message]', type);
        return;
      }

      // Emoji out, length capped - applied HERE rather than at the ~200 call
      // sites, because most toast copy is assembled by concatenation several
      // modules away from the call (see utils/notificationText.ts). A message
      // that is nothing but emoji sanitises to empty and is dropped like any
      // other blank.
      const text = toastText(message);
      if (!text) {
        if (__DEV__) logger.warn('[toast suppressed: no text after sanitising]', { type });
        return;
      }

      // Player preference (Settings > Pop-up Notifications). Warnings and
      // errors are deliberately exempt - see utils/toastPolicy.ts for why
      // muting the rejection channel would re-ship a documented bug.
      if (!shouldShowToast(type, notificationsEnabled())) {
        if (__DEV__) logger.info('[toast suppressed: notifications off]', { type });
        return;
      }

      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message: text,
        count: 1,
        type,
        duration,
        position: resolvedPosition,
        // Errors get a one-tap Report that emails the debug info to the dev,
        // unless the caller already supplied its own action.
        action: action ?? (type === 'error' ? { label: 'Report', onPress: () => reportErrorToast(message) } : undefined),
        persistent,
      };

      // Collapse a repeat of a message already on screen instead of stacking
      // an identical pill; cap at MAX_VISIBLE_TOASTS. Reasoning and the cases
      // that motivated it live in utils/toastQueue.ts.
      setToasts((prevToasts) => enqueueToast(prevToasts, newToast, MAX_VISIBLE_TOASTS));
    },
    [notificationsEnabled]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'success', duration);
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      // Errors linger a little longer than other toasts so there's time to tap
      // the "Report" button (which emails the debug info to the developer).
      showToast(message, 'error', duration ?? 6000);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'warning', duration);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      showToast(message, 'info', duration);
    },
    [showToast]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  // Expose the real toast channel to non-React callers (feedbackSystem).
  useEffect(() => {
    setToastHandler(showToast);
    return () => setToastHandler(null);
  }, [showToast]);

  // Memoize the context value so consumers of useToast() don't re-render on
  // every ToastProvider render (this provider sits high in the tree).
  const contextValue = useMemo(
    () => ({ showToast, showSuccess, showError, showWarning, showInfo }),
    [showToast, showSuccess, showError, showWarning, showInfo]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {(['top', 'bottom'] as const).map(position => (
          <View key={position} pointerEvents="box-none" style={[
            styles.stack,
            position === 'top' ? { top: insets.top + responsiveSpacing.sm }
              : { bottom: insets.bottom + scale(72) },
          ]}>
        {toasts.filter(toast => toast.position === position).map((toast) => (
          <ToastNotification
            key={toast.id}
            id={toast.id}
            // The tally makes a collapsed repeat legible: three taps read
            // "Ate Instant Ramen. ... x3" on one pill rather than three
            // identical pills covering the HUD.
            message={toastDisplayMessage(toast)}
            type={toast.type}
            duration={toast.duration}
            onDismiss={dismissToast}
            position={toast.position}
            // Only problems buzz. Buzzing on every success/info toast meant a
            // burst of purchases became a burst of vibrations - action handlers
            // already give their own press haptics.
            hapticEnabled={toast.type === 'error' || toast.type === 'warning'}
            action={toast.action}
            persistent={toast.persistent}
            inStack
          />
        ))}
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    width: '94%',
    maxWidth: scale(520),
    alignSelf: 'center',
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Use the project's standard TOAST layer (was a raw 9999, which sat above
    // the LOADING/error-banner layer and inverted the intended stacking).
    zIndex: Z_INDEX.TOAST,
  },
});

