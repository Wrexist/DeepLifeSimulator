/**
 * Pure-function game state builder for onboarding.
 *
 * Extracted from Perks.tsx lines 302-470 — constructs the initial GameState
 * from onboarding selections (scenario, identity, perks, mindset).
 */

import { WEEKS_PER_YEAR, WEEKS_PER_MONTH, ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import type { MindsetId } from '@/lib/mindset/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioStart {
  age: number;
  cash: number;
  education?: string | string[];
  items?: string[];
  traits?: string[];
  hasChild?: boolean;
  childAge?: number;
  noChildren?: boolean;
}

export interface OnboardingScenario {
  id: string;
  start: ScenarioStart;
  [key: string]: unknown;
}

export interface BuildGameStateParams {
  /** The base template game state (initialGameState). */
  initialGameState: any;
  /** Current STATE_VERSION for save compatibility. */
  stateVersion: number;
  /** Onboarding selections. */
  firstName: string;
  lastName: string;
  sex: 'male' | 'female' | 'random';
  sexuality: 'straight' | 'gay' | 'bi';
  scenario: OnboardingScenario;
  challengeScenarioId?: string;
  selectedPerks: string[];
  permanentPerks: string[];
  selectedMindset: MindsetId | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve "random" sex to a concrete value. */
export function resolveRandomSex(sex: 'male' | 'female' | 'random'): 'male' | 'female' {
  if (sex === 'random') return Math.random() < 0.5 ? 'male' : 'female';
  return sex;
}

/** Determine seeking gender based on resolved sex and sexuality. */
export function computeSeekingGender(
  resolvedSex: 'male' | 'female',
  sexuality: 'straight' | 'gay' | 'bi'
): 'male' | 'female' {
  if (sexuality === 'straight') return resolvedSex === 'male' ? 'female' : 'male';
  if (sexuality === 'gay') return resolvedSex;
  // bi — default to opposite
  return resolvedSex === 'male' ? 'female' : 'male';
}

/** Map scenario item IDs to actual game item IDs. */
const ITEM_ID_MAP: Record<string, string> = {
  smartphone: 'smartphone',
  computer: 'computer',
  business_suit: 'suit',
  suit: 'suit',
  gym_membership: 'gym_membership',
  bike: 'bike',
  basic_camera: 'camera',
  driver_license: 'driver_license',
};

/** Map scenario education names to game education IDs. */
const EDUCATION_MAP: Record<string, string> = {
  College: 'business_degree',
};

export function mapScenarioItemIds(scenarioItems: string[]): string[] {
  return scenarioItems.map((sid) => ITEM_ID_MAP[sid] || sid).filter(Boolean);
}

/** Calculate absolute weeksLived from a starting age. */
export function computeWeeksLived(startingAge: number): number {
  return Math.max(0, Math.floor((startingAge - ADULTHOOD_AGE) * WEEKS_PER_YEAR));
}

/** Create a random child for the single-parent scenario. */
export function buildChildForSingleParent(childAge: number): any {
  const childNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'River'];
  const childGenders: ('male' | 'female')[] = ['male', 'female'];
  const personalities = ['Playful', 'Curious', 'Energetic', 'Sweet', 'Adventurous'];

  return {
    id: `child_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: childNames[Math.floor(Math.random() * childNames.length)],
    type: 'child' as const,
    relationshipScore: 100,
    personality: personalities[Math.floor(Math.random() * personalities.length)],
    gender: childGenders[Math.floor(Math.random() * childGenders.length)],
    age: childAge,
    datesCount: 0,
    educationLevel: 'none',
    careerPath: undefined,
    savings: 0,
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build a complete initial game state from onboarding selections.
 *
 * This is a pure function (aside from random child/sex generation).
 * All dependencies are injected via params.
 */
export function buildNewGameState(params: BuildGameStateParams): any {
  const {
    initialGameState,
    stateVersion,
    firstName,
    lastName,
    sex,
    sexuality,
    scenario,
    challengeScenarioId,
    selectedPerks,
    permanentPerks,
    selectedMindset,
  } = params;

  const resolvedSex = resolveRandomSex(sex);
  const seekingGender = computeSeekingGender(resolvedSex, sexuality);
  const scenarioItems = scenario.start.items || [];
  const mappedItemIds = mapScenarioItemIds(scenarioItems);
  const weeksLived = computeWeeksLived(scenario.start.age);

  // Build family + relationships (handles single-parent and noChildren scenarios)
  const { family, relationships } = buildFamilyAndRelationships(
    initialGameState,
    scenario.start
  );

  const newState: any = {
    ...initialGameState,
    stats: {
      ...initialGameState.stats,
      money: scenario.start.cash + (selectedPerks.includes('legacy_builder') ? 5000 : 0),
      reputation: initialGameState.stats.reputation + (selectedPerks.includes('legacy_builder') ? 5 : 0),
      energy: initialGameState.stats.energy + (selectedPerks.includes('astute_planner') ? 10 : 0),
    },
    weeksLived,
    week: (weeksLived % WEEKS_PER_MONTH) + 1,
    date: { ...initialGameState.date, age: scenario.start.age, week: (weeksLived % WEEKS_PER_YEAR) + 1 },
    educations: initialGameState.educations.map((e: any) => {
      const eduFromScenario = scenario.start.education;
      if (!eduFromScenario) return e;
      const wanted = Array.isArray(eduFromScenario) ? eduFromScenario : [eduFromScenario];
      const mappedWanted = wanted.map((w) => EDUCATION_MAP[w] || w).filter((w) => w !== 'Dropout');
      if (mappedWanted.length > 0 && mappedWanted.includes(e.id)) {
        return { ...e, completed: true, weeksRemaining: undefined };
      }
      return e;
    }),
    userProfile: {
      ...initialGameState.userProfile,
      firstName,
      lastName,
      sex: resolvedSex,
      sexuality,
      gender: resolvedSex,
      seekingGender,
    },
    perks: {
      ...permanentPerks.reduce((acc: any, id: string) => ({ ...acc, [id]: true }), {}),
      ...selectedPerks.reduce((acc: any, id: string) => ({ ...acc, [id]: true }), {}),
    },
    mindset: selectedMindset
      ? { activeTraitId: selectedMindset, traits: [selectedMindset] }
      : undefined,
    scenarioId: scenario.id,
    challengeScenarioId,
    activeTraits: scenario.start.traits || [],
    items: initialGameState.items.map((i: any) => {
      if (mappedItemIds.includes(i.id)) return { ...i, owned: true };
      return i;
    }),
    hasPhone: scenarioItems.includes('smartphone') || mappedItemIds.includes('smartphone'),
    family,
    relationships,
    version: stateVersion,
  };

  return newState;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildFamilyAndRelationships(
  initialGameState: any,
  scenarioStart: ScenarioStart
): { family: any; relationships: any[] } {
  const baseFamily = { ...initialGameState.family };
  const baseRelationships = [...(initialGameState.relationships || [])];

  if (scenarioStart.noChildren) {
    return {
      family: { ...baseFamily, children: [] },
      relationships: baseRelationships.filter((rel: any) => rel.type !== 'child'),
    };
  }

  if (scenarioStart.hasChild) {
    const child = buildChildForSingleParent(scenarioStart.childAge || 3);
    return {
      family: { ...baseFamily, children: [child] },
      relationships: [...baseRelationships, child],
    };
  }

  return { family: baseFamily, relationships: baseRelationships };
}
