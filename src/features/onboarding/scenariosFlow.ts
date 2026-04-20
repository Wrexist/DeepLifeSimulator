import type { ImageSourcePropType } from 'react-native';
import type { Scenario as OnboardingScenario } from '@/src/features/onboarding/scenarioData';

export type ScenarioTab = 'life_paths' | 'challenges';

type OnboardingScenarioStateShape = {
  scenario?: OnboardingScenario;
  challengeScenarioId?: string;
};

type ChallengeScenarioSelection = Pick<
  OnboardingScenario,
  'id' | 'title' | 'difficulty' | 'lifeGoal' | 'description' | 'bonus' | 'start'
>;

export const getInitialScenarioTab = (challengeScenarioId?: string): ScenarioTab => {
  return challengeScenarioId ? 'challenges' : 'life_paths';
};

export const canContinueFromScenarioSelection = (selectedScenario: unknown): boolean => {
  return Boolean(selectedScenario);
};

export const applyLifePathSelectionToOnboardingState = <T extends OnboardingScenarioStateShape>(
  previousState: T,
  selectedLifePath: OnboardingScenario
): T => {
  return {
    ...previousState,
    scenario: selectedLifePath,
    challengeScenarioId: undefined,
  };
};

export const buildOnboardingScenarioFromChallenge = (
  selection: ChallengeScenarioSelection,
  fallbackIcon: ImageSourcePropType
): OnboardingScenario => {
  return {
    id: selection.id,
    title: selection.title,
    difficulty: selection.difficulty,
    lifeGoal: selection.lifeGoal,
    description: selection.description,
    bonus: selection.bonus,
    start: selection.start,
    icon: fallbackIcon,
  };
};

export const applyChallengeSelectionToOnboardingState = <T extends OnboardingScenarioStateShape>(
  previousState: T,
  selection: ChallengeScenarioSelection,
  fallbackIcon: ImageSourcePropType
): T => {
  return {
    ...previousState,
    scenario: buildOnboardingScenarioFromChallenge(selection, fallbackIcon),
    challengeScenarioId: selection.id,
  };
};
