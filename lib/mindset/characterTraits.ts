/**
 * Character traits - what the Home "Traits" panel lists, and what each one
 * really does.
 *
 * Two kinds of trait are shown there, and both used to be fiction.
 *
 * STAT TRAITS (happy / sad, healthy / sick, energetic / tired) are read off the
 * current stats. The panel promised "+15% salary bonus, +8 energy per week,
 * Immunity to sickness" for a healthy character: payroll has no stat term
 * (`careerPayMultiplier`), there is no weekly energy grant, and illness still
 * rolls at any health. Their lines are now DERIVED from what the game does
 * with those stats - job performance (`calculatePerformance`), illness risk
 * and recovery (`calculateDiseaseRisk`, `applyDiseases`), the happiness-gain
 * curve, and the zero-stat death rule - so they cannot promise more.
 *
 * SCENARIO TRAITS (fit, tough, smart, ...) were written to `activeTraits` at
 * the start of a life and read by nothing. Each now has a real effect through
 * a system that already exists: a starting stat, the criminal record, a crime
 * skill, the starting child's bond, or the street-job toll and pity rule. The
 * panel's lines are generated from the same numbers the game applies.
 *
 * Pure: no state is written here. `gameStateBuilder` applies the start
 * effects; `getStreetJobTerms` (JobActions) reads the street effects.
 */
import type { CrimeSkillId, GameState } from '@/contexts/game/types';
import { calculatePerformance } from '@/lib/events/careerEvents';
import { HAPPINESS_FULL_VALUE_BELOW, happinessGainFalloff } from '@/lib/economy/happinessGain';
import { ZERO_STAT_DEATH_WEEKS } from '@/lib/config/gameConstants';
import { CLEAN_CRIMINAL_LEVEL, hiringPenalty } from '@/lib/crime/criminalRecord';
import { NEWBORN_BOND } from '@/lib/parenting/parentingLogic';
import { PITY_THRESHOLD_STREET_JOB } from '@/lib/randomness/randomnessConstants';

// ── Scenario traits ─────────────────────────────────────────────────────────

/** A scenario trait's real effect. Absent keys are neutral. */
export interface ScenarioTraitEffect {
  name: string;
  /** One-off changes applied when a life starts from a scenario with this trait. */
  start?: {
    /** Added to starting fitness. */
    fitness?: number;
    /** Starting criminal level (the record system reads it). */
    criminalLevel?: number;
    /** Starting level for one crime skill. */
    crimeSkill?: { skill: CrimeSkillId; level: number };
    /** Added to the starting child's bond (scenarios that start with a child). */
    childBond?: number;
  };
  /** Ongoing street-job effects while the trait is held. */
  street?: {
    /** Street jobs cost this much LESS health. */
    healthRelief?: number;
    /** Street jobs cost this much LESS happiness. */
    happinessRelief?: number;
    /** Failures in a row after which the next street job is guaranteed. */
    pityAfter?: number;
  };
}

/** Street-job crime skills start at level 1 (initialState.crimeSkills). */
const BASE_CRIME_SKILL_LEVEL = 1;
/** Every save starts at criminal level 1 (initialState.criminalLevel). */
const BASE_CRIMINAL_LEVEL = CLEAN_CRIMINAL_LEVEL;

/** THE table. The panel copy below is generated from these numbers. */
export const SCENARIO_TRAIT_EFFECTS: Readonly<Record<string, ScenarioTraitEffect>> = {
  fit: { name: 'Fit', start: { fitness: 20 } },
  tough: { name: 'Tough', street: { healthRelief: 1 } },
  determined: { name: 'Determined', street: { pityAfter: 3 } },
  criminal_record: { name: 'Criminal Record', start: { criminalLevel: 2 } },
  caring: { name: 'Caring', start: { childBond: 15 } },
  smart: { name: 'Smart', start: { crimeSkill: { skill: 'hacking', level: 2 } } },
  disciplined: { name: 'Disciplined', street: { happinessRelief: 1 } },
};

export function isScenarioTrait(id: unknown): id is string {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SCENARIO_TRAIT_EFFECTS, id);
}

/**
 * The scenario traits THIS life holds.
 *
 * Read from `activeTraits`, which the builder writes at the start of a life
 * and both prestige paths rebuild from a fresh state - so an heir does not
 * inherit (or get described as having) a start bonus that was never theirs,
 * even though `scenarioId` is carried across for the lineage's title.
 */
export function heldScenarioTraits(activeTraits: unknown): string[] {
  if (!Array.isArray(activeTraits)) return [];
  return [...new Set(activeTraits.filter(isScenarioTrait))];
}

/** Folded street-job effects of the held scenario traits. */
export interface ScenarioTraitStreetTerms {
  healthRelief: number;
  happinessRelief: number;
  /** Failures in a row before a guaranteed success. */
  pityThreshold: number;
}

export function scenarioTraitStreetTerms(activeTraits: unknown): ScenarioTraitStreetTerms {
  let healthRelief = 0;
  let happinessRelief = 0;
  let pityThreshold = PITY_THRESHOLD_STREET_JOB;
  for (const id of heldScenarioTraits(activeTraits)) {
    const street = SCENARIO_TRAIT_EFFECTS[id].street;
    if (!street) continue;
    healthRelief += street.healthRelief ?? 0;
    happinessRelief += street.happinessRelief ?? 0;
    if (typeof street.pityAfter === 'number') pityThreshold = Math.min(pityThreshold, street.pityAfter);
  }
  return {
    healthRelief: Math.max(0, Math.min(3, healthRelief)),
    happinessRelief: Math.max(0, Math.min(3, happinessRelief)),
    pityThreshold: Math.max(1, pityThreshold),
  };
}

/** What the start effects add up to for a set of scenario traits. */
export interface ScenarioStartEffects {
  fitness: number;
  /** Minimum starting criminal level, or null to leave it alone. */
  criminalLevel: number | null;
  /** Minimum starting level per crime skill. */
  crimeSkillLevels: Partial<Record<CrimeSkillId, number>>;
  childBond: number;
}

export function scenarioStartEffects(traits: unknown): ScenarioStartEffects {
  const out: ScenarioStartEffects = { fitness: 0, criminalLevel: null, crimeSkillLevels: {}, childBond: 0 };
  for (const id of heldScenarioTraits(traits)) {
    const start = SCENARIO_TRAIT_EFFECTS[id].start;
    if (!start) continue;
    out.fitness += start.fitness ?? 0;
    out.childBond += start.childBond ?? 0;
    if (typeof start.criminalLevel === 'number') {
      out.criminalLevel = Math.max(out.criminalLevel ?? 0, start.criminalLevel);
    }
    if (start.crimeSkill) {
      const { skill, level } = start.crimeSkill;
      out.crimeSkillLevels[skill] = Math.max(out.crimeSkillLevels[skill] ?? 0, level);
    }
  }
  return out;
}

const SKILL_LABEL: Record<CrimeSkillId, string> = {
  stealth: 'Stealth',
  hacking: 'Hacking',
  lockpicking: 'Lockpicking',
};

/** Points of success a crime-skill level adds to its jobs (JobActions' skill bonus). */
export const CRIME_SKILL_SUCCESS_PER_LEVEL = 5;

/**
 * The panel lines for a scenario trait, generated from the table so the copy
 * cannot claim a number the game does not apply. Start effects are phrased
 * as the rule of the start ("This start gives ...") because they are applied
 * once, when the life begins.
 */
export function describeScenarioTrait(id: string): string[] {
  const effect = SCENARIO_TRAIT_EFFECTS[id];
  if (!effect) return [];
  const lines: string[] = [];
  const start = effect.start;
  if (start?.fitness) lines.push(`This start gives +${start.fitness} fitness`);
  if (typeof start?.criminalLevel === 'number') {
    const withRecord = hiringPenalty(start.criminalLevel, 0);
    const clean = hiringPenalty(BASE_CRIMINAL_LEVEL, 0);
    lines.push(`This start begins at criminal level ${start.criminalLevel} (a clean start is ${BASE_CRIMINAL_LEVEL})`);
    lines.push(`Legitimate job applications lose ${withRecord} points of acceptance to background checks, not ${clean}`);
    lines.push(`Crime jobs that need criminal level ${start.criminalLevel} are open from day one`);
  }
  if (start?.crimeSkill) {
    const { skill, level } = start.crimeSkill;
    const label = SKILL_LABEL[skill];
    const extraSuccess = (level - BASE_CRIME_SKILL_LEVEL) * CRIME_SKILL_SUCCESS_PER_LEVEL;
    const talentPoints = level - BASE_CRIME_SKILL_LEVEL;
    lines.push(`This start gives ${label} skill level ${level} instead of ${BASE_CRIME_SKILL_LEVEL}`);
    lines.push(`+${extraSuccess}% success on ${label.toLowerCase()} jobs and ${talentPoints} ${label} talent point${talentPoints === 1 ? '' : 's'}`);
  }
  if (start?.childBond) {
    const bond = Math.min(100, NEWBORN_BOND + start.childBond);
    lines.push(`This start's child begins with a bond of ${bond} instead of ${NEWBORN_BOND}`);
  }
  const street = effect.street;
  if (street?.healthRelief) lines.push(`Street jobs cost ${street.healthRelief} less health`);
  if (street?.happinessRelief) lines.push(`Street jobs cost ${street.happinessRelief} less happiness`);
  if (typeof street?.pityAfter === 'number') {
    lines.push(
      `After ${street.pityAfter} failed street jobs in a row, the next one is guaranteed to succeed (normally ${PITY_THRESHOLD_STREET_JOB})`,
    );
  }
  return lines;
}

// ── Stat traits ─────────────────────────────────────────────────────────────

export type StatTraitId = 'happy' | 'sad' | 'healthy' | 'sick' | 'energetic' | 'tired';

/** A stat at or above this reads as the positive trait. */
export const STAT_TRAIT_HIGH = 70;
/** A stat at or below this reads as the negative trait. */
export const STAT_TRAIT_LOW = 30;

/**
 * Health below this adds illness risk; at or above it, health adds none
 * (`calculateDiseaseRisk`, lib/diseases/diseaseGenerator.ts).
 */
export const ILLNESS_RISK_HEALTH_FLOOR = 70;
/**
 * Health ABOVE this speeds natural recovery by half a week per week
 * (`applyDiseases`).
 */
export const FAST_RECOVERY_HEALTH_ABOVE = 70;
export const FAST_RECOVERY_EXTRA_WEEKS = 0.5;

type Vitals = { happiness?: number; health?: number; energy?: number } | null | undefined;

const num = (n: unknown, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : fallback;

export function deriveStatTraits(stats: Vitals): StatTraitId[] {
  const happiness = num(stats?.happiness, 0);
  const health = num(stats?.health, 0);
  const energy = num(stats?.energy, 0);
  const out: StatTraitId[] = [];
  if (happiness >= STAT_TRAIT_HIGH) out.push('happy');
  else if (happiness <= STAT_TRAIT_LOW) out.push('sad');
  if (health >= STAT_TRAIT_HIGH) out.push('healthy');
  else if (health <= STAT_TRAIT_LOW) out.push('sick');
  if (energy >= STAT_TRAIT_HIGH) out.push('energetic');
  else if (energy <= STAT_TRAIT_LOW) out.push('tired');
  return out;
}

/**
 * How much ONE stat moves weekly job performance, everything else neutral -
 * through the same `calculatePerformance` the career tick uses, so the weights
 * are not restated here.
 */
export function performanceFrom(stat: 'happiness' | 'health' | 'energy', value: number): number {
  const neutral = { energy: 50, happiness: 50, health: 50 };
  return calculatePerformance({ ...neutral, [stat]: value }) - calculatePerformance(neutral);
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

function performanceLine(stat: 'happiness' | 'health' | 'energy', value: number): string {
  return `Job performance ${signed(performanceFrom(stat, value))} from ${stat} while employed (performance sets promotion speed and raise eligibility)`;
}

/** The panel lines for a stat trait, for the CURRENT stats. */
export function describeStatTrait(id: StatTraitId, stats: Vitals): string[] {
  const happiness = num(stats?.happiness, 0);
  const health = num(stats?.health, 0);
  const energy = num(stats?.energy, 0);
  switch (id) {
    case 'happy':
      return [
        performanceLine('happiness', happiness),
        `New happiness gains count for ${Math.round(happinessGainFalloff(happiness) * 100)}% right now - gains shrink above ${HAPPINESS_FULL_VALUE_BELOW}`,
      ];
    case 'sad':
      return [
        performanceLine('happiness', happiness),
        `At 0 happiness for ${ZERO_STAT_DEATH_WEEKS} weeks in a row, this life ends`,
      ];
    case 'healthy': {
      const lines = [`No added illness risk from health (it only rises below ${ILLNESS_RISK_HEALTH_FLOOR})`];
      if (health > FAST_RECOVERY_HEALTH_ABOVE) {
        lines.push(`Illnesses heal faster: +${FAST_RECOVERY_EXTRA_WEEKS} week of recovery each week`);
      }
      lines.push(performanceLine('health', health));
      return lines;
    }
    case 'sick':
      return [
        'Low health raises your illness risk - the lower it goes, the higher (up to 3x from health alone at 0)',
        `At 0 health for ${ZERO_STAT_DEATH_WEEKS} weeks in a row, this life ends`,
        performanceLine('health', health),
      ];
    case 'energetic':
      return [performanceLine('energy', energy)];
    case 'tired':
      return [
        performanceLine('energy', energy),
        'Actions that cost more energy than you have are locked',
      ];
  }
}

export const STAT_TRAIT_NAMES: Readonly<Record<StatTraitId, string>> = {
  happy: 'Happy',
  sad: 'Sad',
  healthy: 'Healthy',
  sick: 'Sick',
  energetic: 'Energetic',
  tired: 'Tired',
};

/** Everything the Traits panel shows, in display order. */
export interface TraitPanelEntry {
  id: string;
  name: string;
  lines: string[];
}

export function traitPanelEntries(
  state: Pick<GameState, 'activeTraits'> & { stats?: Vitals },
): TraitPanelEntry[] {
  const entries: TraitPanelEntry[] = heldScenarioTraits(state?.activeTraits).map((id) => ({
    id,
    name: SCENARIO_TRAIT_EFFECTS[id].name,
    lines: describeScenarioTrait(id),
  }));
  for (const id of deriveStatTraits(state?.stats)) {
    entries.push({ id, name: STAT_TRAIT_NAMES[id], lines: describeStatTrait(id, state?.stats) });
  }
  return entries;
}
