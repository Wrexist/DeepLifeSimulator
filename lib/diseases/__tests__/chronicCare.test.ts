/**
 * Chronic-care management loop — regression tests (flawless audit, final
 * MEDIUM item). Chronic (non-curable, treatment-requiring) diseases used to
 * have zero counterplay: full stat drain every week plus a 10%/week
 * complication roll compounding effects up to 3x base, while every treatment
 * path (doctor / hospital / experimental) skipped them entirely — even though
 * the UI promised "can be managed / regular doctor visits help". These tests
 * pin the loop that makes that promise true.
 */
import { applyDiseasesForWeek } from '@/contexts/game/actions/weekly/applyDiseases';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import type { Disease, GameStats } from '@/contexts/game/types';
import {
  applyChronicCare,
  DOCTOR_MANAGEMENT_WEEKS,
  HOSPITAL_MANAGEMENT_WEEKS,
  isDiseaseManagedForWeek,
} from '@/lib/diseases/chronicCare';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

function stubStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 100,
    money: 100000,
    reputation: 50,
    gems: 0,
    ...overrides,
  };
}

function stubCtx(
  stats: GameStats,
  nextWeeksLived: number,
  preRollOverrides: Partial<WeekContext['preRolls']> = {},
): WeekContext {
  return {
    newStats: stats,
    notifications: [] as WeekNotification[],
    preRolls: zeroPreRolls({
      // Always below the 10% worsening gate: any disease whose complication
      // roll is NOT blocked by managed care WILL worsen this tick.
      diseaseComplication: [0.0001],
      diseaseProgression: [0.9],
      ...preRollOverrides,
    }),
    nextWeeksLived,
  };
}

const chronicDisease = (overrides: Partial<Disease> = {}): Disease => ({
  id: 'diabetes',
  name: 'Type 2 Diabetes',
  severity: 'serious',
  effects: { health: -4, energy: -3 },
  curable: false,
  treatmentRequired: true,
  contractedWeek: 90,
  ...overrides,
});

const tick = (disease: Disease, nextWeeksLived: number) => {
  const ctx = stubCtx(stubStats(), nextWeeksLived);
  const result = applyDiseasesForWeek(
    {
      prevDiseases: [disease],
      prevDiseaseHistory: undefined,
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: 0,
      newDisease: null,
    },
    ctx,
  );
  return { ctx, result };
};

describe('chronic care - weekly tick (applyDiseasesForWeek)', () => {
  it('unmanaged chronic disease keeps the legacy behavior: full penalties + worsening', () => {
    const { ctx, result } = tick(chronicDisease(), 100);
    expect(ctx.newStats.health).toBe(96);
    expect(ctx.newStats.energy).toBe(97);
    // complicationRoll 0.0001 < 0.1 → worsened by 10% (capped at 3x base).
    expect(result.diseases[0].effects.health).toBeCloseTo(-4.4, 5);
  });

  it('managed chronic disease: penalties halved, worsening blocked', () => {
    const { ctx, result } = tick(chronicDisease({ managedUntilWeek: 104 }), 100);
    expect(ctx.newStats.health).toBe(98);
    expect(ctx.newStats.energy).toBe(98.5);
    // Same sub-0.1 roll, but managed care blocks the complication entirely.
    expect(result.diseases[0].effects.health).toBe(-4);
  });

  it('management covers ticks up to and including managedUntilWeek, then lapses', () => {
    const managed = chronicDisease({ managedUntilWeek: 104 });
    expect(isDiseaseManagedForWeek(managed, 104)).toBe(true);
    expect(isDiseaseManagedForWeek(managed, 105)).toBe(false);

    const boundary = tick(managed, 104);
    expect(boundary.ctx.newStats.health).toBe(98);
    expect(boundary.result.diseases[0].effects.health).toBe(-4);

    const lapsed = tick(managed, 105);
    expect(lapsed.ctx.newStats.health).toBe(96);
    expect(lapsed.result.diseases[0].effects.health).toBeCloseTo(-4.4, 5);
  });

  it('management never pauses a terminal countdown - symptoms ease, progression continues', () => {
    const terminal = chronicDisease({
      id: 'organ_failure',
      name: 'Organ Failure',
      severity: 'critical',
      weeksUntilDeath: 6,
      managedUntilWeek: 110,
    });
    const { ctx, result } = tick(terminal, 100);
    expect(ctx.newStats.health).toBe(98); // halved symptoms
    expect(result.diseases[0].weeksUntilDeath).toBe(5); // countdown unaffected
    expect(result.deathTriggered).toBe(false);
  });

  it('a stray managedUntilWeek on a curable disease is ignored (management is chronic-only)', () => {
    const curable: Disease = {
      id: 'flu',
      name: 'Influenza',
      severity: 'serious',
      effects: { health: -5 },
      curable: true,
      treatmentRequired: true,
      contractedWeek: 99,
      managedUntilWeek: 200,
    };
    const { ctx } = tick(curable, 100);
    expect(ctx.newStats.health).toBe(95); // full penalty
  });
});

describe('chronic care - treatment helper (applyChronicCare)', () => {
  it('doctor visit manages chronic conditions for 4 weeks and resets compounded effects to base', () => {
    const compounded = chronicDisease({
      effects: { health: -8.8, energy: -6.6 }, // worsened over untreated weeks
      baseEffects: { health: -4, energy: -3 },
    });
    const { diseases, managedNames } = applyChronicCare([compounded], 100, DOCTOR_MANAGEMENT_WEEKS);
    expect(managedNames).toEqual(['Type 2 Diabetes']);
    expect(diseases[0].managedUntilWeek).toBe(100 + DOCTOR_MANAGEMENT_WEEKS);
    expect(diseases[0].effects).toEqual({ health: -4, energy: -3 }); // back to baseline
  });

  it('hospital stay grants the longer 12-week window', () => {
    const { diseases } = applyChronicCare([chronicDisease()], 50, HOSPITAL_MANAGEMENT_WEEKS);
    expect(diseases[0].managedUntilWeek).toBe(50 + HOSPITAL_MANAGEMENT_WEEKS);
  });

  it('first-time management seeds baseEffects from current effects', () => {
    const { diseases } = applyChronicCare([chronicDisease()], 100, DOCTOR_MANAGEMENT_WEEKS);
    expect(diseases[0].baseEffects).toEqual({ health: -4, energy: -3 });
  });

  it('leaves curable and non-treatment diseases untouched', () => {
    const curable: Disease = {
      id: 'cold',
      name: 'Common Cold',
      severity: 'mild',
      effects: { health: -2 },
      curable: true,
      contractedWeek: 99,
    };
    const noTreatment: Disease = {
      id: 'fatigue',
      name: 'Chronic Fatigue',
      severity: 'mild',
      effects: { energy: -3 },
      curable: false,
      contractedWeek: 99,
    };
    const { diseases, managedNames } = applyChronicCare([curable, noTreatment], 100, DOCTOR_MANAGEMENT_WEEKS);
    expect(managedNames).toEqual([]);
    expect(diseases[0]).toBe(curable);
    expect(diseases[1]).toBe(noTreatment);
  });
});
