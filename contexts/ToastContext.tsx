import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import ToastNotification from '@/components/ui/ToastNotification';

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
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
        position,
        action,
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
      showToast(message, 'error', duration);
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

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
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
            hapticEnabled={true}
            action={toast.action}
            persistent={toast.persistent}
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
    zIndex: 9999,
  },
});

