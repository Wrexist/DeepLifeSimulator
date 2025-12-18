import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions } from 'react-native';
import InteractiveTutorial, { TutorialStep } from '@/components/InteractiveTutorial';
import { scale, verticalScale } from '@/utils/scaling';
import { logger } from '@/utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TutorialContextType {
  showTutorial: (stepId: string) => void;
  completeTutorial: (stepId: string) => void;
  resetTutorials: () => void;
  isTutorialComplete: (stepId: string) => boolean;
  skipAllTutorials: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const TUTORIAL_STORAGE_KEY = 'deeplife_completed_tutorials';

// Define all tutorial steps with interactive highlights
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to DeepLife!',
    message: 'This is a life simulation game where you make decisions, build your career, and live a virtual life. Let\'s take a quick interactive tour!',
    tooltipPosition: 'center',
  },
  {
    id: 'stats',
    title: 'Your Stats',
    message: 'These 3 bars show your Health (❤️), Happiness (😊), and Energy (⚡). Keep them high for a good life!',
    tooltipPosition: 'top',
  },
  {
    id: 'next_week',
    title: 'Time Progression',
    message: 'Tap the green "Next Week" button to advance time. Each week, your stats will change!',
    tooltipPosition: 'top',
  },
  {
    id: 'identity',
    title: 'Your Identity Card',
    message: 'This shows your personal info, age, job, and current status. Track your life progress here!',
    tooltipPosition: 'center',
  },
  {
    id: 'tabs',
    title: 'Navigation Tabs',
    message: 'Use these tabs to navigate between different areas: Home, Work, Market, and more!',
    tooltipPosition: 'top',
  },
  {
    id: 'work',
    title: 'Work Tab',
    message: 'Tap the Work tab (💼 briefcase icon) at the bottom to find jobs and earn money!',
    tooltipPosition: 'top',
  },
  {
    id: 'market',
    title: 'Market Tab',
    message: 'Tap the Market tab (🛒 shopping cart icon) to buy items, food, and train at the gym!',
    tooltipPosition: 'top',
  },
  {
    id: 'gems',
    title: 'Gems & Premium',
    message: 'Tap the shopping cart icon (🛒) at the top left to open the gem shop! Buy premium perks and upgrades.',
    tooltipPosition: 'top',
  },
  {
    id: 'complete',
    title: 'You\'re Ready!',
    message: 'You now know the basics! Explore, make choices, and live your best virtual life. Have fun! 🎉',
    tooltipPosition: 'center',
  },
];

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(new Set());
  const [currentTutorial, setCurrentTutorial] = useState<TutorialStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tutorialQueue, setTutorialQueue] = useState<TutorialStep[]>([]);

  // Load completed tutorials from storage
  useEffect(() => {
    loadCompletedTutorials();
  }, []);

  const loadCompletedTutorials = async () => {
    try {
      const stored = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (stored) {
        const completed = JSON.parse(stored);
        setCompletedTutorials(new Set(completed));
      }
    } catch (error) {
      logger.error('Error loading tutorials:', error);
    }
  };

  const saveCompletedTutorials = async (completed: Set<string>) => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(Array.from(completed)));
    } catch (error) {
      logger.error('Error saving tutorials:', error);
    }
  };

  const showTutorial = useCallback((stepId: string) => {
    // Don't show if already completed
    if (completedTutorials.has(stepId)) return;

    const step = TUTORIAL_STEPS.find(s => s.id === stepId);
    if (step) {
      setCurrentTutorial(step);
      setCurrentStepIndex(TUTORIAL_STEPS.indexOf(step));
    }
  }, [completedTutorials]);

  const completeTutorial = useCallback((stepId: string) => {
    const newCompleted = new Set(completedTutorials);
    newCompleted.add(stepId);
    setCompletedTutorials(newCompleted);
    saveCompletedTutorials(newCompleted);
    setCurrentTutorial(null);
  }, [completedTutorials]);

  const skipAllTutorials = useCallback(() => {
    const allSteps = new Set(TUTORIAL_STEPS.map(s => s.id));
    setCompletedTutorials(allSteps);
    saveCompletedTutorials(allSteps);
    setCurrentTutorial(null);
  }, []);

  const resetTutorials = useCallback(async () => {
    setCompletedTutorials(new Set());
    await AsyncStorage.removeItem(TUTORIAL_STORAGE_KEY);
  }, []);

  const isTutorialComplete = useCallback((stepId: string) => {
    return completedTutorials.has(stepId);
  }, [completedTutorials]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      const nextStep = TUTORIAL_STEPS[currentStepIndex + 1];
      setCurrentTutorial(nextStep);
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // End of tutorial
      if (currentTutorial) {
        completeTutorial(currentTutorial.id);
      }
    }
  }, [currentStepIndex, currentTutorial, completeTutorial]);

  const handleClose = useCallback(() => {
    if (currentTutorial) {
      completeTutorial(currentTutorial.id);
    }
  }, [currentTutorial, completeTutorial]);

  return (
    <TutorialContext.Provider
      value={{
        showTutorial,
        completeTutorial,
        resetTutorials,
        isTutorialComplete,
        skipAllTutorials,
      }}
    >
      {children}
      {currentTutorial && (
        <InteractiveTutorial
          visible={!!currentTutorial}
          step={currentTutorial}
          onNext={handleNext}
          onClose={handleClose}
          onSkip={skipAllTutorials}
          currentStep={currentStepIndex + 1}
          totalSteps={TUTORIAL_STEPS.length}
        />
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
}
