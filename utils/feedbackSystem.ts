import { Animated, Easing } from 'react-native';

import { useState, useCallback, useMemo } from 'react';
import { showGlobalToast } from './toastBridge';
import { playSound } from './soundManager';
import { haptic } from './haptics';

// Enhanced Feedback System
export class FeedbackSystem {
  private static instance: FeedbackSystem;
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
    scale: 'scale',
  } as const;

  // Configure feedback settings.
  //
  // Haptics are deliberately NOT configurable here. This singleton used to keep
  // its own `hapticEnabled` flag, reconfigured by `useFeedback()` during render
  // — so whichever component rendered last decided haptics for the whole app,
  // and its implementation was raw `Vibration.vibrate` (a flat buzz) rather
  // than the Taptic Engine. The one haptic authority is `utils/haptics.ts`:
  // its `_enabled` flag is set exactly twice — on save load and by the
  // settings toggle — and every intent routes through expo-haptics.
  configure(options: {
    sound?: boolean;
    animation?: boolean;
  }) {
    this.soundEnabled = options.sound ?? true;
    this.animationEnabled = options.animation ?? true;
  }

  // Haptic Feedback — delegates to the single global haptics utility, which
  // owns the enabled flag and no-ops when the player has haptics off.
  triggerHaptic(type: keyof typeof FeedbackSystem.HapticTypes) {
    haptic[type]();
  }

  // Sound Feedback
  triggerSound(type: keyof typeof FeedbackSystem.SoundTypes) {
    if (!this.soundEnabled) return;
    
    // Map sound types to soundManager sound IDs
    const soundMap: Record<string, string> = {
      success: 'success',
      error: 'error',
      warning: 'notification',
      info: 'notification',
      click: 'button_click',
      notification: 'notification',
    };
    
    const soundId = soundMap[type] || 'button_click';
    // No haptic fallback on failure: the combined methods below already pair a
    // haptic with each sound, so a fallback here double-fired on every press
    // for as long as no audio backend was installed.
    playSound(soundId).catch((error) => {
      if (__DEV__) {
        console.warn('Failed to play sound:', error);
      }
    });
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
      case 'scale':
        this.scaleAnimation(animatedValue, duration, delay, loop);
        break;
    }
  }

  // Animation implementations
  private bounceAnimation(
    animatedValue: Animated.Value,
    duration: number,
    _delay: number,
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
    _delay: number,
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

  private scaleAnimation(
    animatedValue: Animated.Value,
    duration: number,
    _delay: number,
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

  // Combined feedback methods.
  //
  // These route through `showGlobalToast`, NOT `showAchievementToast`. The
  // latter is the branded "ACHIEVEMENT UNLOCKED!" popup and gates on
  // `reward > 0` so that tips and warnings cannot hijack it — and every call
  // here passed a hard-coded 0, so for as long as this code has shipped every
  // message given to `useFeedback()` was silently dropped. The player felt a
  // haptic and saw nothing, which made a REFUSED action ("Already done that
  // this week", "Need $12 to grab a healthy meal") indistinguishable from a
  // successful one. The gate is correct; the channel was wrong.
  success(message?: string) {
    this.triggerHaptic('success');
    this.triggerSound('success');
    if (message) {
      showGlobalToast(message, 'success');
    }
  }

  error(message?: string) {
    this.triggerHaptic('error');
    this.triggerSound('error');
    if (message) {
      showGlobalToast(message, 'error');
    }
  }

  warning(message?: string) {
    this.triggerHaptic('warning');
    this.triggerSound('warning');
    if (message) {
      showGlobalToast(message, 'warning');
    }
  }

  info(message?: string) {
    this.triggerHaptic('light');
    this.triggerSound('info');
    if (message) {
      showGlobalToast(message, 'info');
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

// Hook for easy access with game settings.
//
// The parameter is accepted for call-site compatibility but IGNORED: the haptic
// enabled state lives solely in `utils/haptics.ts` (set on save load and by the
// settings toggle). Passing it here used to mutate the global singleton during
// render, so the last component to render won for the entire app.
export const useFeedback = (_hapticEnabled?: boolean) => {
  const feedbackSystem = FeedbackSystem.getInstance();

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

// NOTE: a second `useToast` used to live here — a local-state duplicate with the
// same name as the real one in `@/contexts/ToastContext`, holding toasts in
// component state that no renderer ever consumed. It had zero importers (every
// call site imports the context version), so it could only ever have served to
// send a future reader to the wrong channel — the same mistake that made
// `feedbackSystem`'s own messages mute. Deleted rather than kept "just in case".

export default FeedbackSystem;
