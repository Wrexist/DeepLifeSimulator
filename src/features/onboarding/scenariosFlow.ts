import type { ImageSourcePropType } from 'react-native';
import type { Scenario as OnboardingScenario } from '@/src/features/onboarding/scenarioData';
import type { Scenario as ChallengeScenarioDefinition } from '@/lib/scenarios/scenarioDefinitions';

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

type ChallengeStartingConditions = ChallengeScenarioDefinition['startingConditions'];

/**
 * Traits a challenge's premise implies but its `startingConditions` cannot
 * express. Redemption Arc's card promises "a criminal record"; the record
 * system reads `criminalLevel`, which the `criminal_record` trait sets.
 */
const CHALLENGE_START_TRAITS: Record<string, string[]> = {
  redemption_arc: ['criminal_record'],
};

/**
 * Map a challenge's `startingConditions` onto the onboarding `start` shape
 * that `buildNewGameState` reads. EVERY condition key is carried: the card
 * mapping used to copy only age, cash, the first education and items, so
 * Single Parent started childless and every challenge's reputation and vitals
 * were silently replaced by the template's (LIFE-4 / ONB-1).
 * `relationships` is the only key not carried - no challenge populates it and
 * the builder has no reader for it.
 */
export const challengeStartFromConditions = (
  challengeId: string,
  conditions: ChallengeStartingConditions | undefined
): OnboardingScenario['start'] => {
  const c: ChallengeStartingConditions = conditions && typeof conditions === 'object' ? conditions : {};
  const education = Array.isArray(c.education)
    ? c.education.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const items = Array.isArray(c.items)
    ? c.items.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const stats =
    c.stats && typeof c.stats === 'object'
      ? {
          ...(typeof c.stats.health === 'number' ? { health: c.stats.health } : {}),
          ...(typeof c.stats.happiness === 'number' ? { happiness: c.stats.happiness } : {}),
          ...(typeof c.stats.energy === 'number' ? { energy: c.stats.energy } : {}),
        }
      : undefined;
  return {
    age: typeof c.age === 'number' ? c.age : 18,
    cash: typeof c.money === 'number' ? c.money : 0,
    education: education.length > 0 ? education[0] : undefined,
    items,
    traits: CHALLENGE_START_TRAITS[challengeId] ?? [],
    ...(typeof c.reputation === 'number' ? { reputation: c.reputation } : {}),
    ...(stats ? { stats } : {}),
    ...(c.hasChild === true
      ? { hasChild: true, childAge: typeof c.childAge === 'number' ? c.childAge : 3 }
      : {}),
    ...(c.noChildren === true ? { noChildren: true } : {}),
  };
};
