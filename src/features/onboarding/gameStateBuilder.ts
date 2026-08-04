/**
 * Pure-function game state builder for onboarding.
 *
 * Extracted from Perks.tsx lines 302-470 — constructs the initial GameState
 * from onboarding selections (scenario, identity, perks, mindset).
 */

import { WEEKS_PER_YEAR, WEEKS_PER_MONTH, ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import type { MindsetId } from '@/lib/mindset/config';
import { avatarSexFromId } from '@/utils/facePool';
import { perks as perksCatalog } from './perksData';
import { NEWBORN_BOND } from '@/lib/parenting/parentingLogic';

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
  avatarId?: string;
  scenario: OnboardingScenario;
  challengeScenarioId?: string;
  selectedPerks: string[];
  permanentPerks: string[];
  selectedMindset: MindsetId | null;
  /** Chosen Life Ambition id (lib/ambitions). Optional — undefined = freeform life. */
  ambitionId?: string;
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

/** Map scenario education names to game education IDs (keys are lower-cased so
 *  both life-path 'College' and challenge 'college' resolve the same). */
const EDUCATION_MAP: Record<string, string> = {
  college: 'business_degree',
};

/** Display names for seeded educations (mirrors the EducationApp catalog). */
const EDUCATION_NAME_MAP: Record<string, string> = {
  business_degree: 'Business Degree',
};

/** GPA recorded for degrees granted by a scenario ("solid" band). */
const SEEDED_EDUCATION_GPA = 3.0;

export function mapScenarioItemIds(scenarioItems: string[]): string[] {
  return scenarioItems.map((sid) => ITEM_ID_MAP[sid] || sid).filter(Boolean);
}

/** Calculate absolute weeksLived from a starting age. */
export function computeWeeksLived(startingAge: number): number {
  return Math.max(0, Math.floor((startingAge - ADULTHOOD_AGE) * WEEKS_PER_YEAR));
}

function clampBoundedStat(value: number): number {
  return Math.max(0, Math.min(100, value));
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
    // R3-F5: headroom, so parenting actions are not clamped away on arrival.
    relationshipScore: NEWBORN_BOND,
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
    avatarId,
    ambitionId,
  } = params;

  // A picked avatar's sex wins over "random" so appearance and gameplay agree.
  const resolvedSex = avatarSexFromId(avatarId) ?? resolveRandomSex(sex);
  const seekingGender = computeSeekingGender(resolvedSex, sexuality);
  const scenarioItems = scenario.start.items || [];
  const mappedItemIds = mapScenarioItemIds(scenarioItems);
  const weeksLived = computeWeeksLived(scenario.start.age);

  // Build family + relationships (handles single-parent and noChildren scenarios)
  const { family, relationships } = buildFamilyAndRelationships(
    initialGameState,
    scenario.start
  );

  // Aggregate every selected perk's statBoosts from the catalog. Previously
  // only legacy_builder and astute_planner were applied via inline checks;
  // the other 18 perks were tracked as flags but never contributed their
  // advertised stat bonuses (iron_will, lucky_charm, trust_fund, etc.
  // were essentially cosmetic). Permanent perks earn the same boosts.
  const perkStatBoosts: Record<string, number> = {};
  const allActivePerkIds = [...permanentPerks, ...selectedPerks];
  for (const perkId of allActivePerkIds) {
    const perk = perksCatalog.find((p) => p.id === perkId);
    if (!perk?.effects?.statBoosts) continue;
    for (const [key, value] of Object.entries(perk.effects.statBoosts)) {
      perkStatBoosts[key] = (perkStatBoosts[key] || 0) + (value as number);
    }
  }

  const baseStats = initialGameState.stats;
  const newState: any = {
    ...initialGameState,
    stats: {
      ...baseStats,
      money: scenario.start.cash + (perkStatBoosts.money || 0),
      reputation: clampBoundedStat(baseStats.reputation + (perkStatBoosts.reputation || 0)),
      energy: clampBoundedStat(baseStats.energy + (perkStatBoosts.energy || 0)),
      health: clampBoundedStat(baseStats.health + (perkStatBoosts.health || 0)),
      happiness: clampBoundedStat(baseStats.happiness + (perkStatBoosts.happiness || 0)),
      fitness: clampBoundedStat(baseStats.fitness + (perkStatBoosts.fitness || 0)),
    },
    weeksLived,
    week: (weeksLived % WEEKS_PER_MONTH) + 1,
    date: { ...initialGameState.date, age: scenario.start.age, week: (weeksLived % WEEKS_PER_YEAR) + 1 },
    educations: (() => {
      const existing: any[] = initialGameState.educations.map((e: any) => {
        const eduFromScenario = scenario.start.education;
        if (!eduFromScenario) return e;
        const wanted = Array.isArray(eduFromScenario) ? eduFromScenario : [eduFromScenario];
        const mappedWanted = wanted
          .map((w) => EDUCATION_MAP[w.toLowerCase()] || w)
          .filter((w) => w.toLowerCase() !== 'dropout');
        if (mappedWanted.length > 0 && mappedWanted.includes(e.id)) {
          return {
            ...e,
            completed: true,
            weeksRemaining: undefined,
            gpa: e.gpa ?? SEEDED_EDUCATION_GPA,
            name: e.name ?? EDUCATION_NAME_MAP[e.id] ?? e.id,
          };
        }
        return e;
      });
      // BUGFIX: initialGameState.educations is empty by design — the player
      // grows the list by enrolling in school during gameplay. Scenarios that
      // advertise "Start with X education" (corporate_intern → College, etc.)
      // were silently no-oping because the `.map` had nothing to mark complete.
      // Append any scenario-requested education that isn't already in the list.
      const eduFromScenario = scenario.start.education;
      if (eduFromScenario) {
        const wanted = Array.isArray(eduFromScenario) ? eduFromScenario : [eduFromScenario];
        const mappedWanted = wanted
          .map((w) => EDUCATION_MAP[w.toLowerCase()] || w)
          .filter((w) => w.toLowerCase() !== 'dropout');
        for (const eduId of mappedWanted) {
          if (!existing.find((e) => e.id === eduId)) {
            existing.push({
              id: eduId,
              name: EDUCATION_NAME_MAP[eduId] || eduId,
              description: '',
              cost: 0,
              duration: 0,
              completed: true,
              gpa: SEEDED_EDUCATION_GPA,
            });
          }
        }
      }
      return existing;
    })(),
    userProfile: {
      ...initialGameState.userProfile,
      firstName,
      lastName,
      sex: resolvedSex,
      sexuality,
      avatarId,
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
    // Life Ambition — the chosen lifelong goal (or undefined for a freeform life).
    // Milestone tracking + payoff flag start clean so progress accrues over the life.
    ambitionId: ambitionId || undefined,
    ambitionCompletedMilestones: [],
    ambitionRewardClaimed: false,
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
