import { useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { saveQueue } from '@/utils/saveQueue';

export function useSaveNotifications() {
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    // Register the toast callback with the save queue
    saveQueue.setToastCallback((message: string, type: 'success' | 'error') => {
      if (type === 'success') {
        showSuccess(message, 2000);
      } else {
        showError(message, 3000);
      }
    });

    return () => {
      // Cleanup: remove callback
      saveQueue.setToastCallback(() => {});
    };
  }, [showSuccess, showError]);
}

