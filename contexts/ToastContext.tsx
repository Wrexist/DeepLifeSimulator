import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import ToastNotification from '@/components/ui/ToastNotification';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { emailDiagnosticReport } from '@/utils/diagnosticReport';

/**
 * Turn a raw error into something actionable: one tap on an error toast's
 * "Report" button emails us a COMPREHENSIVE diagnostic (build, live game
 * position, state validation, recent logs) — built via the shared
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
      position: Toast['position'] = 'top',
      action?: Toast['action'],
      persistent?: boolean
    ) => {
      // Players never see raw yellow "warning" toasts — they were noise that
      // overlapped the status bar. Log for diagnostics and render nothing.
      if (type === 'warning') {
        if (__DEV__) console.warn('[toast suppressed]', message);
        return;
      }

      // Drop blank toasts — an empty message renders as a bare icon-only
      // blue pill (a call site passed an optional result?.message that was
      // undefined). Nothing useful to show.
      if (!message?.trim()) {
        if (__DEV__) console.warn('[toast suppressed: empty message]', type);
        return;
      }

      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
        position,
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
        {toasts.map((toast, index) => (
          <ToastNotification
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onDismiss={dismissToast}
            position={toast.position}
            hapticEnabled={true}
            action={toast.action}
            persistent={toast.persistent}
            stackIndex={index}
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

