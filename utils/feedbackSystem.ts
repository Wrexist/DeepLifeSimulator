import { Vibration, Platform, Alert } from 'react-native';
import { Animated, Easing } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { showAchievementToast } from './achievementToast';

// Enhanced Feedback System
export class FeedbackSystem {
  private static instance: FeedbackSystem;
  private hapticEnabled: boolean = false; // Default to false, must be enabled in settings
  private soundEnabled: boolean = true;
  private animationEnabled: boolean = true;

  static getInstance(): FeedbackSystem {
    if (!FeedbackSystem.instance) {
      FeedbackSystem.instance = new FeedbackSystem();
    }
    return FeedbackSystem.instance;
  }

  // Haptic Feedback Types
  static HapticTypes = {
    light: 'light',
    medium: 'medium',
    heavy: 'heavy',
    success: 'success',
    warning: 'warning',
    error: 'error',
    selection: 'selection',
  } as const;

  // Sound Types
  static SoundTypes = {
    success: 'success',
    error: 'error',
    warning: 'warning',
    info: 'info',
    click: 'click',
    notification: 'notification',
  } as const;

  // Animation Types
  static AnimationTypes = {
    bounce: 'bounce',
    shake: 'shake',
    pulse: 'pulse',
    glow: 'glow',
    scale: 'scale',
    fade: 'fade',
  } as const;

  // Configure feedback settings
  configure(options: {
    haptic?: boolean;
    sound?: boolean;
    animation?: boolean;
  }) {
    this.hapticEnabled = options.haptic ?? true;
    this.soundEnabled = options.sound ?? true;
    this.animationEnabled = options.animation ?? true;
  }

  // Haptic Feedback
  triggerHaptic(type: keyof typeof FeedbackSystem.HapticTypes) {
    if (!this.hapticEnabled) return;

    try {
      switch (type) {
        case 'light':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(50);
          } else {
            Vibration.vibrate(100);
          }
          break;
        case 'medium':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(100);
          } else {
            Vibration.vibrate(200);
          }
          break;
        case 'heavy':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(150);
          } else {
            Vibration.vibrate(300);
          }
          break;
        case 'success':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(75);
          } else {
            Vibration.vibrate(150);
          }
          break;
        case 'warning':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(100);
          } else {
            Vibration.vibrate(200);
          }
          break;
        case 'error':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(125);
          } else {
            Vibration.vibrate(250);
          }
          break;
        case 'selection':
          if (Platform.OS === 'ios') {
            Vibration.vibrate(25);
          } else {
            Vibration.vibrate(50);
          }
          break;
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  // Sound Feedback
  triggerSound(type: keyof typeof FeedbackSystem.SoundTypes) {
    if (!this.soundEnabled) return;
    
    // Sound system not implemented - uses haptic feedback instead
    // Fall back to haptic feedback for now
    this.triggerHaptic('light');
  }

  // Animation Feedback
  triggerAnimation(
    animatedValue: Animated.Value,
    type: keyof typeof FeedbackSystem.AnimationTypes,
    options?: {
      duration?: number;
      delay?: number;
      loop?: boolean;
    }
  ) {
    if (!this.animationEnabled) return;

    const duration = options?.duration || 300;
    const delay = options?.delay || 0;
    const loop = options?.loop || false;

    switch (type) {
      case 'bounce':
        this.bounceAnimation(animatedValue, duration, delay, loop);
        break;
      case 'shake':
        this.shakeAnimation(animatedValue, duration, delay, loop);
        break;
      case 'pulse':
        this.pulseAnimation(animatedValue, duration, delay, loop);
        break;
      case 'glow':
        this.glowAnimation(animatedValue, duration, delay, loop);
        break;
      case 'scale':
        this.scaleAnimation(animatedValue, duration, delay, loop);
        break;
      case 'fade':
        this.fadeAnimation(animatedValue, duration, delay, loop);
        break;
    }
  }

  // Animation implementations
  private bounceAnimation(
    animatedValue: Animated.Value,
    duration: number,
    delay: number,
    loop: boolean
  ) {
    const animation = Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1.2,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]);

    if (loop) {
      Animated.loop(animation).start();
    } else {
      animation.start();
    }
  }

  private shakeAnimation(
    animatedValue: Animated.Value,
    duration: number,
    delay: number,
    loop: boolean
  ) {
    const animation = Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 10,
        duration: duration / 4,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: -10,
        duration: duration / 4,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 10,
        duration: duration / 4,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: duration / 4,
        useNativeDriver: true,
      }),
    ]);

    if (loop) {
      Animated.loop(animation).start();
    } else {
      animation.start();
    }
  }

  private pulseAnimation(
    animatedValue: Animated.Value,
    duration: number,
    delay: number,
    loop: boolean
  ) {
    const animation = Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1.1,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
    ]);

    if (loop) {
      Animated.loop(animation).start();
    } else {
      animation.start();
    }
  }

  private glowAnimation(
    animatedValue: Animated.Value,
    duration: number,
    delay: number,
    loop: boolean
  ) {
    const animation = Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: duration / 2,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease),
      }),
    ]);

    if (loop) {
      Animated.loop(animation).start();
    } else {
      animation.start();
    }
  }

  private scaleAnimation(
    animatedValue: Animated.Value,
    duration: number,
    delay: number,
    loop: boolean
  ) {
    const animation = Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 0.9,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }),
    ]);

    if (loop) {
      Animated.loop(animation).start();
    } else {
      animation.start();
    }
  }

  private fadeAnimation(
    animatedValue: Animated.Value,
    duration: number,
    delay: number,
    loop: boolean
  ) {
    const animation = Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
    ]);

    if (loop) {
      Animated.loop(animation).start();
    } else {
      animation.start();
    }
  }

  // Combined feedback methods
  success(message?: string) {
    this.triggerHaptic('success');
    this.triggerSound('success');
    if (message) {
      showAchievementToast(message, 'success');
    }
  }

  error(message?: string) {
    this.triggerHaptic('error');
    this.triggerSound('error');
    if (message) {
      showAchievementToast(message, 'error');
    }
  }

  warning(message?: string) {
    this.triggerHaptic('warning');
    this.triggerSound('warning');
    if (message) {
      showAchievementToast(message, 'warning');
    }
  }

  info(message?: string) {
    this.triggerHaptic('light');
    this.triggerSound('info');
    if (message) {
      showAchievementToast(message, 'info');
    }
  }

  buttonPress() {
    this.triggerHaptic('light');
    this.triggerSound('click');
  }

  selection() {
    this.triggerHaptic('selection');
    this.triggerSound('click');
  }
}

// Hook for easy access with game settings
export const useFeedback = (hapticEnabled?: boolean) => {
  const feedbackSystem = FeedbackSystem.getInstance();
  
  // Configure haptic feedback based on settings
  if (hapticEnabled !== undefined) {
    feedbackSystem.configure({ haptic: hapticEnabled });
  }
  
  return {
    success: (message?: string) => feedbackSystem.success(message),
    error: (message?: string) => feedbackSystem.error(message),
    warning: (message?: string) => feedbackSystem.warning(message),
    info: (message?: string) => feedbackSystem.info(message),
    buttonPress: () => feedbackSystem.buttonPress(),
    selection: () => feedbackSystem.selection(),
    haptic: (type: keyof typeof FeedbackSystem.HapticTypes) => feedbackSystem.triggerHaptic(type),
    sound: (type: keyof typeof FeedbackSystem.SoundTypes) => feedbackSystem.triggerSound(type),
    animation: (
      animatedValue: Animated.Value,
      type: keyof typeof FeedbackSystem.AnimationTypes,
      options?: { duration?: number; delay?: number; loop?: boolean }
    ) => feedbackSystem.triggerAnimation(animatedValue, type, options),
  };
};

// Loading states
export const useLoadingState = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    setError(null);
    setSuccess(null);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, []);

  const setErrorState = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
  }, []);

  const setSuccessState = useCallback((successMessage: string) => {
    setSuccess(successMessage);
    setLoading(false);
  }, []);

  const clearStates = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(null);
  }, []);

  return {
    loading,
    error,
    success,
    startLoading,
    stopLoading,
    setErrorState,
    setSuccessState,
    clearStates,
  };
};

// Progress indicators
export const useProgressIndicator = (total: number) => {
  const [current, setCurrent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const progress = useMemo(() => {
    return total > 0 ? (current / total) * 100 : 0;
  }, [current, total]);

  const increment = useCallback(() => {
    setCurrent(prev => {
      const newValue = prev + 1;
      if (newValue >= total) {
        setIsComplete(true);
      }
      return newValue;
    });
  }, [total]);

  const reset = useCallback(() => {
    setCurrent(0);
    setIsComplete(false);
  }, []);

  return {
    current,
    progress,
    isComplete,
    increment,
    reset,
  };
};

// Toast notifications
export const useToast = () => {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
  }>>([]);

  const addToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration: number = 3000
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
  };
};

export default FeedbackSystem;
