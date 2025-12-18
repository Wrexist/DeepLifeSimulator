import { useCallback } from 'react';
// CRITICAL: Lazy-load expo-haptics to prevent TurboModule crash at module load
// import * as Haptics from 'expo-haptics'; // REMOVED - lazy load instead
import { useGame } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';

// Lazy-loaded Haptics module
let Haptics: any = null;
let hapticsLoadAttempted = false;

function loadHapticsModule(): boolean {
  if (hapticsLoadAttempted) {
    return Haptics !== null;
  }
  
  hapticsLoadAttempted = true;
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hooks/useHapticFeedback.ts:18',message:'Before expo-haptics require',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    Haptics = require('expo-haptics');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hooks/useHapticFeedback.ts:22',message:'After expo-haptics require success',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return true;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'hooks/useHapticFeedback.ts:27',message:'expo-haptics require failed',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    // Module not available - will skip haptics
    return false;
  }
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export function useHapticFeedback() {
  const { gameState } = useGame();
  
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
        logger.debug('Haptic feedback not available:', error);
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
