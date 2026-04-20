import { useCallback, useEffect } from 'react';
// CRITICAL: Lazy-load expo-haptics to prevent TurboModule crash at module load
// import * as Haptics from 'expo-haptics'; // REMOVED - lazy load instead
import { useGame } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';
import { setHapticsEnabled } from '@/utils/haptics';

// Lazy-loaded Haptics module
let Haptics: any = null;
let hapticsLoadAttempted = false;

function loadHapticsModule(): boolean {
  if (hapticsLoadAttempted) {
    return Haptics !== null;
  }
  
  hapticsLoadAttempted = true;
  
  try {
    Haptics = require('expo-haptics');
    return true;
  } catch (error) {
    // Module not available - will skip haptics
    return false;
  }
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export function useHapticFeedback() {
  const { gameState } = useGame();
  
  // Keep standalone haptic utility in sync with settings
  useEffect(() => {
    setHapticsEnabled(gameState.settings.hapticFeedback);
  }, [gameState.settings.hapticFeedback]);

  const triggerHaptic = useCallback((type: HapticType) => {
    // Check if haptic feedback is enabled in settings
    if (!gameState.settings.hapticFeedback) {
      return;
    }
    
    // Try to load haptics module if not already attempted
    if (!loadHapticsModule()) {
      // Module not available - skip haptics
      return;
    }
    
    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      // Haptics not available on this device - fail silently
      if (__DEV__) {
        logger.debug('Haptic feedback not available:', { error: String(error) });
      }
    }
  }, [gameState.settings.hapticFeedback]);
  
  // Convenience methods for common actions
  const light = useCallback(() => triggerHaptic('light'), [triggerHaptic]);
  const medium = useCallback(() => triggerHaptic('medium'), [triggerHaptic]);
  const heavy = useCallback(() => triggerHaptic('heavy'), [triggerHaptic]);
  const success = useCallback(() => triggerHaptic('success'), [triggerHaptic]);
  const error = useCallback(() => triggerHaptic('error'), [triggerHaptic]);

  const triggerButtonPress = useCallback(() => {
    triggerHaptic('light');
  }, [triggerHaptic]);

  const triggerSuccess = useCallback(() => {
    triggerHaptic('success');
  }, [triggerHaptic]);

  const triggerError = useCallback(() => {
    triggerHaptic('error');
  }, [triggerHaptic]);

  const triggerWarning = useCallback(() => {
    triggerHaptic('warning');
  }, [triggerHaptic]);

  const triggerSelection = useCallback(() => {
    triggerHaptic('selection');
  }, [triggerHaptic]);

  return {
    triggerHaptic,
    triggerButtonPress,
    triggerSuccess,
    triggerError,
    triggerWarning,
    triggerSelection,
    // Convenience methods
    light,
    medium,
    heavy,
    success,
    error,
  };
}
