import {
  applyChallengeSelectionToOnboardingState,
  applyLifePathSelectionToOnboardingState,
  buildOnboardingScenarioFromChallenge,
  canContinueFromScenarioSelection,
  getInitialScenarioTab,
} from '@/src/features/onboarding/scenariosFlow';
import { scenarios as LIFE_PATH_SCENARIOS } from '@/src/features/onboarding/scenarioData';

const FALLBACK_ICON = { uri: 'fallback-icon' } as const;
type ScenarioDraftState = {
  slot: number;
  perks: string[];
  scenario?: (typeof LIFE_PATH_SCENARIOS)[number];
  challengeScenarioId?: string;
};

describe('Scenarios flow checks', () => {
  it('defaults tab to life paths when no challenge is selected', () => {
    expect(getInitialScenarioTab(undefined)).toBe('life_paths');
  });

  it('defaults tab to challenges when challengeScenarioId exists', () => {
    expect(getInitialScenarioTab('rags_to_riches')).toBe('challenges');
  });

  it('clears challengeScenarioId when selecting a life path', () => {
    const previousState: ScenarioDraftState = {
      slot: 1,
      challengeScenarioId: 'rags_to_riches',
      perks: ['legacy_builder'],
    };
    const selectedLifePath = LIFE_PATH_SCENARIOS[0];
    const nextState = applyLifePathSelectionToOnboardingState(previousState, selectedLifePath);

    expect(nextState.scenario).toEqual(selectedLifePath);
    expect(nextState.challengeScenarioId).toBeUndefined();
    expect(nextState.slot).toBe(1);
    expect(nextState.perks).toEqual(['legacy_builder']);
  });

  it('sets challengeScenarioId and normalized scenario when selecting a challenge', () => {
    const previousState: ScenarioDraftState = {
      slot: 2,
      perks: [],
    };
    const challengeSelection = {
      id: 'entrepreneur',
      title: 'Entrepreneur',
      difficulty: 'Hard',
      lifeGoal: 'Become a CEO',
      description: 'Build multiple businesses and scale.',
      bonus: 'Rewards: 100 gems',
      start: {
        age: 25,
        cash: 10000,
        education: undefined,
        items: ['computer', 'smartphone'],
        traits: [],
      },
    };

    const nextState = applyChallengeSelectionToOnboardingState(previousState, challengeSelection, FALLBACK_ICON);

    expect(nextState.challengeScenarioId).toBe('entrepreneur');
    expect(nextState.scenario?.id).toBe('entrepreneur');
    expect(nextState.scenario?.icon).toEqual(FALLBACK_ICON);
    expect(nextState.slot).toBe(2);
  });

  it('builds challenge scenario payload with fallback icon', () => {
    const challengeSelection = {
      id: 'academic_excellence',
      title: 'Academic Excellence',
      difficulty: 'Hard',
      lifeGoal: 'Complete PhD',
      description: 'Finish all higher education milestones.',
      bonus: 'Rewards: 75 gems',
      start: {
        age: 18,
        cash: 5000,
        education: undefined,
        items: ['computer'],
        traits: [],
      },
    };

    const scenario = buildOnboardingScenarioFromChallenge(challengeSelection, FALLBACK_ICON);
    expect(scenario.id).toBe('academic_excellence');
    expect(scenario.icon).toEqual(FALLBACK_ICON);
    expect(scenario.start.cash).toBe(5000);
  });

  it('allows continue only when a selection exists', () => {
    expect(canContinueFromScenarioSelection(null)).toBe(false);
    expect(canContinueFromScenarioSelection(undefined)).toBe(false);
    expect(canContinueFromScenarioSelection({ id: 'corporate_intern' })).toBe(true);
  });
});
