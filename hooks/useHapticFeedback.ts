import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useGame } from '@/contexts/GameContext';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export function useHapticFeedback() {
  const { gameState } = useGame();
  
  const triggerHaptic = useCallback((type: HapticType) => {
    // Check if haptic feedback is enabled in settings
    if (!gameState.settings.hapticFeedback) {
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
      // Haptics not available on this device
      console.log('Haptic feedback not available:', error);
    }
  }, [gameState.settings.hapticFeedback]);

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
  };
}
