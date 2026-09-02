/**
 * Diseases weekly tick — R7 Phase 2 step 2.3.
 *
 * Scope: per-tick disease state evolution. The previous inline code at
 * `GameActionsContext.tsx` lines 1721-1955 (~235 lines) handled:
 *   1. Optional new-disease admission (caller pre-generates via
 *      `generateRandomDisease` and passes as `newDisease`).
 *   2. Per-disease validation (drop malformed entries).
 *   3. Per-disease stat-penalty accumulation into a `diseaseEffects` bag
 *      (halved for diseases under managed chronic care — see
 *      `lib/diseases/chronicCare.ts`).
 *   4. Complication rolls: chronic untreated diseases worsen up to 3× base
 *      (with a -100 floor) unless under managed care; curable untreated
 *      diseases can progress mild → serious + worsen effects.
 *   5. Death countdown for diseases with `weeksUntilDeath`.
 *   6. Natural recovery for diseases with `naturalRecoveryWeeks` (with
 *      health/fitness bonuses).
 *   7. Final `diseaseEffects` application to ctx.newStats (clamped 0-100).
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats[stat]` — clamped Math.max(0, Math.min(100, ...))
 *     across each stat the diseases penalize
 *
 * Reads from `ctx`:
 *   - `ctx.preRolls.diseaseComplication[i]` — per-disease complication chance
 *   - `ctx.preRolls.diseaseProgression[i]`  — mild→serious progression roll
 *   - `ctx.nextWeeksLived`                  — week counter for contractedWeek + countdown math
 *
 * Returns the post-tick disease state PLUS local "did diseases kill the
 * player" flags. The caller threads them into `newShowDeathPopup` /
 * `newDeathReason` exactly as the inline code did.
 *
 * Disease GENERATION is the caller's job because `generateRandomDisease`
 * is non-deterministic (uses Math.random internally). Pre-generating gives
 * us a pure helper that's snapshot-testable: tests pass `newDisease: null`
 * or a known Disease object and get deterministic output.
 */

import type { Disease, GameStats } from '@/contexts/game/types';
import { isDiseaseManagedForWeek, MANAGED_SYMPTOM_FACTOR } from '@/lib/diseases/chronicCare';
import { logger } from '@/utils/logger';
import type { WeekContext } from './weekContext';

/**
 * Inline diseaseHistory shape from `GameState.diseaseHistory`. Repeated
 * here because the type lives anonymously on `GameState` (no exported
 * alias). If the GameState shape changes, this must change too.
 */
export interface DiseaseHistory {
  diseases: {
    id: string;
    name: string;
    contractedWeek: number;
    curedWeek?: number;
    severity: string;
  }[];
  totalDiseases: number;
  totalCured: number;
  deathsFromDisease: number;
}

/**
 * Caller-supplied inputs the tick consumes. The four "prev*" fields are
 * the pre-tick state slices; `newDisease` is the result of the caller's
 * `generateRandomDisease` invocation (or null when no disease was rolled).
 */
export interface DiseaseTickInput {
  prevDiseases: Disease[] | undefined;
  prevDiseaseHistory: DiseaseHistory | undefined;
  /** GameState's `showSicknessModal` is a required boolean — accept it as-is. */
  prevShowSicknessModal: boolean;
  /** GameState's `lastDiseaseWeek` is optional. */
  prevLastDiseaseWeek: number | undefined;
  /** Pre-generated disease (or null if no admission this tick). */
  newDisease: Disease | null;
}

/**
 * Post-tick state slices the caller writes into the final GameState
 * (or threads into local newShowDeathPopup / newDeathReason vars).
 */
export interface DiseaseTickResult {
  diseases: Disease[];
  diseaseHistory: DiseaseHistory;
  showSicknessModal: boolean;
  lastDiseaseWeek: number | undefined;
  /** True iff a disease's weeksUntilDeath countdown reached zero this tick. */
  deathTriggered: boolean;
  /** Death reason — 'health' iff deathTriggered. */
  deathReason: 'health' | undefined;
}

const MAX_DISEASE_HISTORY = 50;
const DEFAULT_DISEASE_HISTORY: DiseaseHistory = {
  diseases: [],
  totalDiseases: 0,
  totalCured: 0,
  deathsFromDisease: 0,
};

export function applyDiseasesForWeek(
  input: DiseaseTickInput,
  ctx: WeekContext,
): DiseaseTickResult {
  const { nextWeeksLived } = ctx;

  let updatedDiseases: Disease[] = [...(input.prevDiseases || [])];
  // CRASH GUARD: normalize the history shape, not just its presence. A save can
  // carry a diseaseHistory OBJECT that lacks `.diseases` (or has NaN counters) —
  // the || fallback only catches null/undefined, and the spread/`.map` on the
  // missing array below would throw inside the weekly updater, bricking
  // "Next Week" for that save on every attempt.
  const rawHistory = input.prevDiseaseHistory || DEFAULT_DISEASE_HISTORY;
  let updatedDiseaseHistory: DiseaseHistory = {
    ...rawHistory,
    diseases: Array.isArray(rawHistory.diseases) ? rawHistory.diseases : [],
    totalDiseases: typeof rawHistory.totalDiseases === 'number' && isFinite(rawHistory.totalDiseases)
      ? rawHistory.totalDiseases : 0,
    totalCured: typeof rawHistory.totalCured === 'number' && isFinite(rawHistory.totalCured)
      ? rawHistory.totalCured : 0,
    deathsFromDisease: typeof rawHistory.deathsFromDisease === 'number' && isFinite(rawHistory.deathsFromDisease)
      ? rawHistory.deathsFromDisease : 0,
  };
  // The health popup must NEVER auto-open or persist across a week advance — it
  // interrupted the Next Week flow. Health is surfaced passively on the player
  // card ("Health Issues") and on demand via the TopStatsBar disease badge.
  // Forcing this false every tick also self-heals any save where the flag got
  // stuck `true`, which would otherwise re-show the popup on every Next Week.
  const showSicknessModal = false;
  let lastDiseaseWeek = input.prevLastDiseaseWeek;
  let diseaseDeathTriggered = false;
  let diseaseDeathReason: 'health' | undefined = undefined;

  // 1) Admit the new disease (if caller rolled one).
  const newDisease = input.newDisease;
  if (newDisease) {
    if (newDisease.id && newDisease.name && newDisease.severity) {
      updatedDiseases.push(newDisease);
      // Do NOT auto-open the sickness modal on week advance — it interrupted
      // the Next Week flow. The disease is still tracked and is surfaced
      // passively via the player card "Health Issues" section and the
      // TopStatsBar disease badge (tapping the badge still opens this modal).
      lastDiseaseWeek = nextWeeksLived;

      // ANTI-BLOAT: keep only the most recent MAX_DISEASE_HISTORY
      // entries. `totalDiseases` still tracks lifetime totals for
      // achievements; the array is only displayed in the UI sickness log.
      const appendedDiseases = [
        ...updatedDiseaseHistory.diseases,
        {
          id: newDisease.id,
          name: newDisease.name,
          contractedWeek: nextWeeksLived,
          severity: newDisease.severity,
        },
      ];
      updatedDiseaseHistory = {
        ...updatedDiseaseHistory,
        diseases: appendedDiseases.length > MAX_DISEASE_HISTORY
          ? appendedDiseases.slice(-MAX_DISEASE_HISTORY)
          : appendedDiseases,
        totalDiseases: updatedDiseaseHistory.totalDiseases + 1,
      };
    } else {
      logger.warn('Invalid disease generated, skipping:', newDisease);
    }
  }

  // 2) Apply per-disease effects + progression.
  const diseaseEffects: Partial<GameStats> = {};
  const diseasesToRemove: number[] = [];

  // Validate diseases array (paranoia — would only fail if input is malformed).
  if (!Array.isArray(updatedDiseases)) {
    updatedDiseases = [];
  }

  updatedDiseases.forEach((disease, index) => {
    // Validate disease object.
    if (!disease || typeof disease !== 'object' || !disease.id || !disease.name) {
      logger.warn('Invalid disease object found, skipping:', disease);
      diseasesToRemove.push(index);
      return;
    }

    // Pre-roll arrays are capped (length 20). For diseases beyond the cap, wrap
    // the index deterministically so they still roll their complication /
    // progression rather than reading `undefined` (which silently skips the
    // roll for disease #21+). Wrapping keeps it StrictMode-deterministic.
    const complicationRoll = ctx.preRolls.diseaseComplication[index % ctx.preRolls.diseaseComplication.length];
    const progressionRoll = ctx.preRolls.diseaseProgression[index % ctx.preRolls.diseaseProgression.length];

    // Chronic-care window (doctor visit / hospital stay on a non-curable
    // disease): while managed, symptoms are halved and complications don't
    // roll. Absent field = unmanaged = the legacy behavior, byte-for-byte.
    const isManaged = isDiseaseManagedForWeek(disease, nextWeeksLived);

    // Accumulate stat penalties (halved while under managed care).
    if (disease.effects) {
      Object.entries(disease.effects).forEach(([stat, value]) => {
        if (typeof value === 'number' && value < 0) {
          const applied = isManaged ? value * MANAGED_SYMPTOM_FACTOR : value;
          const statKey = stat as keyof GameStats;
          if (statKey in diseaseEffects) {
            (diseaseEffects[statKey] as number) = ((diseaseEffects[statKey] as number) || 0) + applied;
          } else {
            (diseaseEffects[statKey] as number) = applied;
          }
        }
      });
    }

    // Disease complications: untreated diseases can worsen.
    // R4-G: cap each effect at 3× the original magnitude (or -100 at
    // minimum). Without a cap the 10%/week compounding hit values like
    // ×13,780 after ~100 weeks, eventually producing Infinity and NaN.
    if (disease.treatmentRequired && !disease.curable) {
      // Chronic diseases that require treatment — check if worsening. Managed
      // care (see lib/diseases/chronicCare.ts) blocks the worsening roll; the
      // death countdown below is deliberately NOT blocked — management eases
      // symptoms but never stops a terminal disease's progression.
      const complicationChance = 0.1; // 10% chance per week if untreated.
      if (!isManaged && complicationRoll < complicationChance) {
        const baseEffects = (disease as { baseEffects?: typeof disease.effects }).baseEffects ?? disease.effects;
        const worsenedEffects = { ...disease.effects };
        Object.keys(worsenedEffects).forEach((stat) => {
          const statKey = stat as keyof typeof worsenedEffects;
          if (typeof worsenedEffects[statKey] === 'number' && worsenedEffects[statKey]! < 0) {
            const baseVal = (baseEffects as Record<string, number>)[stat as string];
            const floor = typeof baseVal === 'number' ? baseVal * 3 : -100;
            const candidate = (worsenedEffects[statKey] as number) * 1.1;
            (worsenedEffects[statKey] as number) = Math.max(floor, candidate);
          }
        });
        updatedDiseases[index] = {
          ...disease,
          // Preserve the original magnitudes so a cure-then-reinfect resets
          // the compounding rather than carrying it across infections.
          baseEffects: baseEffects,
          effects: worsenedEffects,
        } as typeof disease;
      }
    } else if (disease.treatmentRequired && disease.curable) {
      // Curable diseases that require treatment — can worsen if not treated.
      const weeksWithDisease = 'contractedWeek' in disease && typeof disease.contractedWeek === 'number'
        ? nextWeeksLived - disease.contractedWeek
        : 0;

      // Higher chance of worsening the longer it's untreated.
      if (weeksWithDisease > 2) {
        const complicationChance = Math.min(0.15, weeksWithDisease * 0.05); // Up to 15% chance.
        if (complicationRoll < complicationChance) {
          // Disease worsens — could progress to more severe.
          // FLOOR CAP: mirror the chronic path — never let an effect compound
          // worse than 3x its original magnitude, otherwise an ignored curable
          // disease accumulates astronomically negative values in the save over
          // many untreated weeks (corrupting net-worth/threshold math).
          const baseEffects = (disease as { baseEffects?: typeof disease.effects }).baseEffects ?? disease.effects;
          const worsenWithFloor = (mult: number) => {
            const worsenedEffects = { ...disease.effects };
            Object.keys(worsenedEffects).forEach((stat) => {
              const statKey = stat as keyof typeof worsenedEffects;
              if (typeof worsenedEffects[statKey] === 'number' && worsenedEffects[statKey]! < 0) {
                const baseVal = (baseEffects as Record<string, number>)[stat as string];
                const floor = typeof baseVal === 'number' ? baseVal * 3 : -100;
                const candidate = (worsenedEffects[statKey] as number) * mult;
                (worsenedEffects[statKey] as number) = Math.max(floor, candidate);
              }
            });
            return worsenedEffects;
          };
          if (disease.severity === 'mild' && progressionRoll < 0.3) {
            // 30% chance to progress to serious.
            updatedDiseases[index] = {
              ...disease,
              severity: 'serious',
              baseEffects,
              effects: worsenWithFloor(1.5), // 50% worse.
            } as typeof disease;
          } else {
            // Just increase effects.
            updatedDiseases[index] = {
              ...disease,
              baseEffects,
              effects: worsenWithFloor(1.2), // 20% worse.
            } as typeof disease;
          }
        }
      }
    }

    // Death countdown.
    if ('weeksUntilDeath' in disease && typeof disease.weeksUntilDeath === 'number') {
      const updatedWeeksUntilDeath = disease.weeksUntilDeath - 1;
      if (updatedWeeksUntilDeath <= 0) {
        // Death triggered.
        diseaseDeathTriggered = true;
        diseaseDeathReason = 'health';
        updatedDiseaseHistory = {
          ...updatedDiseaseHistory,
          deathsFromDisease: updatedDiseaseHistory.deathsFromDisease + 1,
        };
      } else {
        // Update countdown. Spread the just-written object (if any) instead of
        // the original closure `disease`, so a disease with BOTH weeksUntilDeath
        // and naturalRecoveryWeeks doesn't clobber the other block's write.
        const base = updatedDiseases[index] ?? disease;
        updatedDiseases[index] = {
          ...base,
          weeksUntilDeath: updatedWeeksUntilDeath,
        };
      }
    }

    // Natural recovery.
    if ('naturalRecoveryWeeks' in disease && typeof disease.naturalRecoveryWeeks === 'number') {
      // Base 1 week of recovery progress per tick, plus health/fitness bonuses.
      let recoveryDecrement = 1;
      if (ctx.newStats.health > 70) {
        recoveryDecrement += 0.5; // Recover faster.
      }
      if (ctx.newStats.fitness > 50) {
        recoveryDecrement += 0.5;
      }
      // Life Skills: Resilience (+25% recovery speed) scales the whole decrement.
      const recoveryMult = ctx.lifeSkillMods?.recoveryMult ?? 1;
      if (typeof recoveryMult === 'number' && isFinite(recoveryMult) && recoveryMult > 1) {
        recoveryDecrement *= recoveryMult;
      }
      const recoveryWeeks = disease.naturalRecoveryWeeks - recoveryDecrement;

      if (recoveryWeeks <= 0) {
        // Disease naturally recovered.
        diseasesToRemove.push(index);
        // RECOVERY → LOWER RISK (Program 8). The generator's 4-week cooldown
        // (`shouldGenerateDisease`) counted from ONSET, so a 12-week illness
        // could be joined by a second one at week 4 and a third at week 8 -
        // measured: a careful 40-year-old spent 45 of 52 weeks ill, mostly
        // with two or three conditions at once. Restarting the clock at
        // recovery makes illnesses sequential: four clear weeks after every
        // one, whether it ran its course here or was cured by a doctor.
        lastDiseaseWeek = nextWeeksLived;
        updatedDiseaseHistory = {
          ...updatedDiseaseHistory,
          totalCured: updatedDiseaseHistory.totalCured + 1,
          diseases: updatedDiseaseHistory.diseases.map((d) =>
            d.id === disease.id && !d.curedWeek
              ? { ...d, curedWeek: nextWeeksLived }
              : d,
          ),
        };
      } else {
        // Spread the just-written object (if the death-countdown block already
        // wrote this index) so we don't clobber its weeksUntilDeath update.
        const base = updatedDiseases[index] ?? disease;
        updatedDiseases[index] = {
          ...base,
          naturalRecoveryWeeks: Math.max(0, Math.ceil(recoveryWeeks)),
        };
      }
    }
  });

  // Remove naturally recovered diseases (in reverse order to maintain indices).
  diseasesToRemove.reverse().forEach((index) => {
    updatedDiseases.splice(index, 1);
  });

  // 3) Apply accumulated stat penalties to ctx.newStats.
  Object.entries(diseaseEffects).forEach(([stat, value]) => {
    const statKey = stat as keyof GameStats;
    if (typeof value === 'number') {
      const currentValue = (ctx.newStats[statKey] as number) || 0;
      // GameStats doesn't have an index signature; cast through `unknown`
      // to satisfy the strict type-check. Behavior matches the legacy
      // inline code: `(newStats as Record<string, number>)[statKey] = ...`.
      (ctx.newStats as unknown as Record<string, number>)[statKey] = Math.max(0, Math.min(100, currentValue + value));
    }
  });

  return {
    diseases: updatedDiseases,
    diseaseHistory: updatedDiseaseHistory,
    showSicknessModal,
    lastDiseaseWeek,
    deathTriggered: diseaseDeathTriggered,
    deathReason: diseaseDeathReason,
  };
}
