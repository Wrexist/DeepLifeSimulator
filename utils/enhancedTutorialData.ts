import { EnhancedTutorialStep } from '@/types/tutorial';
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const ENHANCED_GAME_TUTORIAL_STEPS: EnhancedTutorialStep[] = [
    {
        id: 'welcome',
        title: '🎮 Welcome!',
        message: 'Welcome to DeepLife Simulator! This quick tour will show you the basics.',
        tooltipPosition: 'center',
    },
    {
        id: 'character-stats',
        title: '📊 Your Stats',
        message: 'Keep an eye on your Health, Happiness, and Energy bars at the top. Try to keep them high!',
        highlightArea: {
            x: 10,
            y: 40,
            width: width - 20,
            height: 60,
        },
        arrowPosition: 'bottom',
        tooltipPosition: 'bottom',
    },
    {
        id: 'time',
        title: '⏰ Time Progression',
        message: 'Press the button to advance time. Your stats will change each week based on your actions.',
        highlightArea: {
            x: width / 2 - 35,
            y: height - 130,
            width: 70,
            height: 70,
        },
        arrowPosition: 'top',
        tooltipPosition: 'top',
    },
    {
        id: 'work-tab',
        title: '💼 Work & Career',
        message: 'Visit the Work tab to clear job listings and earn money.',
        highlightArea: {
            x: width * 0.25,
            y: height - 85,
            width: width * 0.25,
            height: 50,
        },
        arrowPosition: 'top',
        tooltipPosition: 'top',
    },
    {
        id: 'ready',
        title: '🚀 You\'re Ready!',
        message: 'Start your life simulation now. Good luck!',
        tooltipPosition: 'center',
    }
];

export function getEnhancedTutorialSteps(context: 'game' | 'onboarding' | 'advanced' = 'game'): EnhancedTutorialStep[] {
    switch (context) {
        case 'game':
        default:
            return ENHANCED_GAME_TUTORIAL_STEPS;
    }
}
