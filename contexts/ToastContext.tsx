import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import ToastNotification from '@/components/ui/ToastNotification';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { emailDiagnosticReport } from '@/utils/diagnosticReport';
import { setToastHandler } from '@/utils/toastBridge';
import { toastText } from '@/utils/notificationText';
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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (
      message: string,
      type: Toast['type'] = 'info',
      duration: number = 3000,
      position?: Toast['position'],
      action?: Toast['action'],
      persistent?: boolean
    ) => {
      // Warnings used to be dropped entirely: they "overlapped the status bar".
      // That silenced the whole rejection channel - a refused job application, a
      // denied promotion, a blocked retirement and a failed street job all
      // buzzed and rendered nothing, so a rejected tap was indistinguishable
      // from a successful one. The overlap was a POSITION problem, not a reason
      // to delete the tier, so warnings now default to the bottom slot (which
      // already offsets by `insets.bottom`) and are shown.
      const resolvedPosition: Toast['position'] =
        position ?? (type === 'warning' ? 'bottom' : 'top');

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

      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message: text,
        type,
        duration,
        position: resolvedPosition,
        // Errors get a one-tap Report that emails the debug info to the dev,
        // unless the caller already supplied its own action.
        action: action ?? (type === 'error' ? { label: 'Report', onPress: () => reportErrorToast(message) } : undefined),
        persistent,
      };

      setToasts((prevToasts) => {
        // Limit to 3 toasts at a time
        const updatedToasts = [...prevToasts, newToast];
        if (updatedToasts.length > 3) {
          return updatedToasts.slice(-3);
        }
        return updatedToasts;
      });
    },
    []
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

  // Stacking offsets must be counted WITHIN a position group. The index in the
  // flat array was used before, so a bottom toast sitting behind one top toast
  // was pushed 72pt up off its own anchor for no reason.
  const stackIndexById = useMemo(() => {
    const counters: Record<string, number> = { top: 0, bottom: 0 };
    const map: Record<string, number> = {};
    for (const toast of toasts) {
      const key = toast.position ?? 'top';
      map[toast.id] = counters[key];
      counters[key] += 1;
    }
    return map;
  }, [toasts]);

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
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            id={toast.id}
            message={toast.message}
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
            stackIndex={stackIndexById[toast.id] ?? 0}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
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

