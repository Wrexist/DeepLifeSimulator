import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TutorialStep } from '@/types/tutorial';
import { EnhancedTutorialStep, getEnhancedTutorialSteps } from '@/utils/enhancedTutorialData';
import { logger } from '@/utils/logger';

interface LoadingState {
  id: string;
  message: string;
  variant?: 'default' | 'overlay' | 'inline';
}

interface ErrorState {
  id: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  onRetry?: () => void;
  autoDismiss?: boolean;
}

interface UIUXState {
  loadingStates: LoadingState[];
  errorStates: ErrorState[];
  showTutorial: boolean;
  tutorialSteps: TutorialStep[];
  currentTutorialStep: number;
  hasCompletedTutorial: boolean;
}

interface UIUXContextType extends UIUXState {
  // Loading management
  showLoading: (id: string, message?: string, variant?: LoadingState['variant']) => void;
  hideLoading: (id: string) => void;
  isLoading: (id: string) => boolean;
  
  // Error management
  showError: (id: string, message: string, severity?: ErrorState['severity'], title?: string, onRetry?: () => void) => void;
  hideError: (id: string) => void;
  showInfo: (id: string, message: string, title?: string) => void;
  showWarning: (id: string, message: string, title?: string) => void;
  
  // Tutorial management
  startTutorial: (steps: TutorialStep[] | EnhancedTutorialStep[], context?: 'game' | 'onboarding' | 'advanced') => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  setTutorialStep: (step: number) => void;
  resetTutorial: () => void;
  startEnhancedTutorial: (context?: 'game' | 'onboarding' | 'advanced') => void;
}

const UIUXContext = createContext<UIUXContextType | undefined>(undefined);

const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';

export function UIUXProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UIUXState>({
    loadingStates: [],
    errorStates: [],
    showTutorial: false,
    tutorialSteps: [],
    currentTutorialStep: 0,
    hasCompletedTutorial: false,
  });

  // Check if tutorial was completed on mount
  React.useEffect(() => {
    checkTutorialStatus();
  }, []);

  const checkTutorialStatus = async () => {
    try {
      const completed = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
      if (completed === 'true') {
        setState(prev => ({ ...prev, hasCompletedTutorial: true }));
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Error checking tutorial status:', error);
      }
    }
  };

  // Loading management
  const showLoading = useCallback((id: string, message = 'Loading...', variant: LoadingState['variant'] = 'default') => {
    setState(prev => ({
      ...prev,
      loadingStates: [...prev.loadingStates.filter(loading => loading.id !== id), { id, message, variant }],
    }));
  }, []);

  const hideLoading = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      loadingStates: prev.loadingStates.filter(loading => loading.id !== id),
    }));
  }, []);

  const isLoading = useCallback((id: string) => {
    return state.loadingStates.some(loading => loading.id === id);
  }, [state.loadingStates]);

  // Error management
  const showError = useCallback((
    id: string,
    message: string,
    severity: ErrorState['severity'] = 'error',
    title?: string,
    onRetry?: () => void
  ) => {
    setState(prev => ({
      ...prev,
      errorStates: [...prev.errorStates.filter(error => error.id !== id), {
        id,
        message,
        severity,
        title,
        onRetry,
        autoDismiss: severity === 'info',
      }],
    }));
  }, []);

  const hideError = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      errorStates: prev.errorStates.filter(error => error.id !== id),
    }));
  }, []);

  const showInfo = useCallback((id: string, message: string, title?: string) => {
    showError(id, message, 'info', title);
  }, [showError]);

  const showWarning = useCallback((id: string, message: string, title?: string) => {
    showError(id, message, 'warning', title);
  }, [showError]);

  // Tutorial management
  const startTutorial = useCallback((steps: TutorialStep[] | EnhancedTutorialStep[], context?: 'game' | 'onboarding' | 'advanced') => {
    if (__DEV__) {
      logger.debug('[UIUXContext] startTutorial called with', { stepsCount: steps.length, firstStep: steps[0] });
    }
    setState(prev => {
      const newState = {
        ...prev,
        showTutorial: true,
        tutorialSteps: steps as TutorialStep[],
        currentTutorialStep: 0,
      };
      if (__DEV__) {
        logger.debug('[UIUXContext] New state:', { showTutorial: newState.showTutorial, stepsCount: newState.tutorialSteps.length });
      }
      return newState;
    });
  }, []);

  const startEnhancedTutorial = useCallback((context: 'game' | 'onboarding' | 'advanced' = 'game') => {
    const enhancedSteps = getEnhancedTutorialSteps(context);
    startTutorial(enhancedSteps, context);
  }, [startTutorial]);

  const completeTutorial = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setState(prev => ({
        ...prev,
        showTutorial: false,
        hasCompletedTutorial: true,
      }));
    } catch (error) {
      if (__DEV__) {
        logger.error('Error saving tutorial completion:', error);
      }
    }
  }, []);

  const skipTutorial = useCallback(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setState(prev => ({
        ...prev,
        showTutorial: false,
        hasCompletedTutorial: true,
      }));
    } catch (error) {
      if (__DEV__) {
        logger.error('Error saving tutorial completion:', error);
      }
    }
  }, []);

  const setTutorialStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentTutorialStep: step,
    }));
  }, []);

  const resetTutorial = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
      setState(prev => ({
        ...prev,
        hasCompletedTutorial: false,
        showTutorial: false,
        currentTutorialStep: 0,
      }));
    } catch (error) {
      if (__DEV__) {
        logger.error('Error resetting tutorial:', error);
      }
    }
  }, []);

  const value: UIUXContextType = useMemo(() => ({
    ...state,
    showLoading,
    hideLoading,
    isLoading,
    showError,
    hideError,
    showInfo,
    showWarning,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  }), [
    state,
    showLoading,
    hideLoading,
    isLoading,
    showError,
    hideError,
    showInfo,
    showWarning,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  ]);

  return (
    <UIUXContext.Provider value={value}>
      {children}
    </UIUXContext.Provider>
  );
}

export function useUIUX() {
  const context = useContext(UIUXContext);
  if (context === undefined) {
    throw new Error('useUIUX must be used within a UIUXProvider');
  }
  return context;
}

// Convenience hooks for common operations
export function useLoading() {
  const { showLoading, hideLoading, isLoading } = useUIUX();
  return { showLoading, hideLoading, isLoading };
}

export function useError() {
  const { showError, hideError, showInfo, showWarning } = useUIUX();
  return { showError, hideError, showInfo, showWarning };
}

export function useTutorial() {
  const {
    showTutorial,
    tutorialSteps,
    currentTutorialStep,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  } = useUIUX();
  
  return {
    showTutorial,
    tutorialSteps,
    currentTutorialStep,
    hasCompletedTutorial,
    startTutorial,
    completeTutorial,
    skipTutorial,
    setTutorialStep,
    resetTutorial,
    startEnhancedTutorial,
  };
}
