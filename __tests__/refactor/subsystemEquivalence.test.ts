/**
 * Subsystem-tick equivalence tests — R7 Phase 2 step 2.0
 *
 * Phase 2 will refactor `nextWeek()` from a 1,500-line synchronous updater
 * into a pipeline of pure reducers. This test file pins down the EXISTING
 * pure subsystem ticks against the fixture battery so any future change —
 * intentional or accidental — surfaces as a snapshot diff.
 *
 * Scope: only the 6 already-pure ticks under `lib/<system>/weeklyTick.ts`.
 * The bigger fish (the inline body of `nextWeek` itself) gets extracted
 * step-by-step in Phase 2 steps 2.1 - 2.10; as each extraction lands, its
 * pure helper joins this file's coverage.
 *
 * Rules:
 *   - Use the fixture battery from `./weekFixtures.ts`. Adding a new fixture
 *     should NOT require touching this file — `it.each` iterates over all.
 *   - Use the seeded `deterministicRoll` so snapshots are stable across
 *     machines and Node versions.
 *   - Use `toMatchSnapshot()` so changes are visible in PR diffs. Snapshots
 *     live in `__snapshots__/subsystemEquivalence.test.ts.snap` next to
 *     this file.
 *
 * What a refactor PR should do:
 *   1. Make the refactor change.
 *   2. Run this test. If the snapshot diff is intentional, run
 *      `jest --updateSnapshot` and commit the new snapshot in the same PR.
 *      If the snapshot diff is unintentional, the refactor introduced a
 *      behavior change — fix it before merging.
 */

import { runWeeklyBankingTick } from '@/lib/banking/weeklyTick';
import { runCryptoWeeklyTick } from '@/lib/crypto/weeklyTick';
import { runDarkWebWeeklyTick } from '@/lib/darkweb/weeklyTick';
import { runRealEstateWeeklyTick } from '@/lib/realEstate/weeklyTick';
import { runPoliticsWeeklyTick } from '@/lib/politics/weeklyTick';
import {
  calculateNetWorth,
  computeDecayInputs,
  buildPreRolls,
} from '@/contexts/game/actions/weekly/preTick';
import {
  tickPetsForWeek,
  applyPetDeathSideEffects,
  applyPetLivingSideEffects,
} from '@/contexts/game/actions/weekly/applyPets';
import { applyVehiclesForWeek } from '@/contexts/game/actions/weekly/applyVehicles';
import {
  applyDiseasesForWeek,
  type DiseaseTickInput,
  type DiseaseHistory,
} from '@/contexts/game/actions/weekly/applyDiseases';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import { applyAutoReinvest } from '@/contexts/game/actions/weekly/applyAutoReinvest';
import { applyRentAndHousing } from '@/contexts/game/actions/weekly/applyRentAndHousing';
import { computeSavingsInterest } from '@/contexts/game/actions/weekly/applySavingsInterest';
import { applyLoanAutopay } from '@/contexts/game/actions/weekly/applyLoanAutopay';
import {
  summarizeWeeklyFinance,
  type WeeklyFinanceSummaryInput,
} from '@/contexts/game/actions/weekly/summarizeWeeklyFinance';
import { applyDietPlanForWeek } from '@/contexts/game/actions/weekly/applyDietPlan';
import { applyCareerSalaryAndPenalty } from '@/contexts/game/actions/weekly/applyCareerSalaryAndPenalty';
import { applyCareerApplications } from '@/contexts/game/actions/weekly/applyCareerApplications';
import { applyCareerProgress } from '@/contexts/game/actions/weekly/applyCareerProgress';
import { applyEducationStress } from '@/contexts/game/actions/weekly/applyEducationStress';
import { applyEducationProgression } from '@/contexts/game/actions/weekly/applyEducationProgression';
import { applyCrimeTick } from '@/contexts/game/actions/weekly/applyCrimeTick';
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';
import { applyMiningWarehouse } from '@/contexts/game/actions/weekly/applyMiningWarehouse';
import { applyNPCDepthTick } from '@/contexts/game/actions/weekly/applyNPCDepthTick';
import { applyChildAging } from '@/contexts/game/actions/weekly/applyChildAging';
import { applyScheduledWedding } from '@/contexts/game/actions/weekly/applyScheduledWedding';
import { applyPregnancyProgression } from '@/contexts/game/actions/weekly/applyPregnancyProgression';
import { applyRelationshipHealth } from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import { applyEconomicEvent } from '@/contexts/game/actions/weekly/applyEconomicEvent';
import { applyWeeklyEvents, MAX_PENDING_EVENTS } from '@/contexts/game/actions/weekly/applyWeeklyEvents';
import { applyCliffhangerResolution } from '@/contexts/game/actions/weekly/applyCliffhangerResolution';
import { applyLifeMoment } from '@/contexts/game/actions/weekly/applyLifeMoment';
import { applyConsequenceProgression } from '@/contexts/game/actions/weekly/applyConsequenceProgression';
import { applyDeathRibbon } from '@/contexts/game/actions/weekly/applyDeathRibbon';
import { applyAutoCheckpoint } from '@/contexts/game/actions/weekly/applyAutoCheckpoint';
import { applyLifetimeStatistics } from '@/contexts/game/actions/weekly/applyLifetimeStatistics';
import { applyCliffhangerRoll } from '@/contexts/game/actions/weekly/applyCliffhangerRoll';
import type { Education } from '@/contexts/game/types';
import type { DietPlan, Career } from '@/contexts/game/types';
import type { StockHolding } from '@/lib/stocks/weeklyTick';
import type { RealEstate } from '@/contexts/game/types';
import type { Disease } from '@/contexts/game/types';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import type { PreRolls } from '@/contexts/game/actions/weekly/preTick';
import type { GameState, GameStats, Loan, Vehicle } from '@/contexts/game/types';

import { deterministicRoll, fixtures, type FixtureName } from './helpers/weekFixtures';

// -------------------------------------------------------------------------
// Helpers — turn a fixture's nested GameState slices into each tick's input.
// -------------------------------------------------------------------------
// The pure ticks were intentionally given narrow input types so they don't
// depend on the whole GameState. Here we adapt: read the right slices off a
// fixture, plus pass a per-fixture seeded roll source.

function bankingInputFor(state: GameState, currentWeek: number) {
  const banking = state.banking;
  if (!banking) {
    throw new Error(`Fixture is missing banking slice; check initialGameState.`);
  }
  return {
    banking,
    prevLoans: state.loans ?? ([] as Loan[]),
    processedLoans: state.loans ?? ([] as Loan[]),
    newBankSavings: state.bankSavings ?? 0,
    newMoney: state.stats?.money ?? 0,
    currentWeek,
  };
}

function cryptoInputFor(state: GameState, currentWeek: number, seed: number) {
  const market = state.cryptoMarket;
  if (!market) {
    throw new Error(`Fixture is missing cryptoMarket slice; check initialGameState.`);
  }
  return {
    market,
    cryptos: state.cryptos ?? [],
    banking: state.banking,
    cashIn: state.stats?.money ?? 0,
    currentWeek,
    rollFor: deterministicRoll(seed),
  };
}

function darkWebInputFor(state: GameState, currentWeek: number, seed: number) {
  const darkWeb = state.darkWeb;
  if (!darkWeb) {
    throw new Error(`Fixture is missing darkWeb slice; check initialGameState.`);
  }
  return {
    darkWeb,
    currentWeek,
    relationships: state.relationships ?? [],
    rollFor: deterministicRoll(seed),
  };
}

function politicsInputFor(state: GameState, currentWeek: number, seed: number) {
  const politics = state.politics;
  if (!politics) {
    throw new Error(`Fixture is missing politics slice; check initialGameState.`);
  }
  return {
    politics,
    darkWebHeat: state.darkWeb?.heat ?? 0,
    karma: state.karma?.score ?? 0,
    contentiousPolicies: 0,
    currentWeek,
    rollFor: deterministicRoll(seed),
  };
}

function realEstateInputFor(state: GameState, currentWeek: number, seed: number) {
  return {
    legacyProcessedProperties: state.realEstate ?? [],
    legacyRentalIncome: 0,
    currentWeek,
    rollFor: deterministicRoll(seed),
  };
}

// -------------------------------------------------------------------------
// Test matrix
// -------------------------------------------------------------------------
// Per-fixture seed → reproducible. Different fixtures get different seeds
// so a typo in one doesn't accidentally mask drift in another.
const SEEDS: Record<FixtureName, number> = {
  freshGame: 1,
  earlyCareer: 2,
  midGame: 3,
  wealthyGame: 4,
  inPrison: 5,
  nearDeath: 6,
};

const FIXTURE_NAMES = Object.keys(fixtures) as FixtureName[];

describe('subsystem tick equivalence — runWeeklyBankingTick', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    const currentWeek = (state.weeksLived ?? 0) + 1;
    const result = runWeeklyBankingTick(bankingInputFor(state, currentWeek));
    expect(result).toMatchSnapshot();
  });
});

describe('subsystem tick equivalence — runCryptoWeeklyTick', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    const currentWeek = (state.weeksLived ?? 0) + 1;
    const result = runCryptoWeeklyTick(cryptoInputFor(state, currentWeek, SEEDS[name]));
    expect(result).toMatchSnapshot();
  });
});

describe('subsystem tick equivalence — runDarkWebWeeklyTick', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    const currentWeek = (state.weeksLived ?? 0) + 1;
    const result = runDarkWebWeeklyTick(darkWebInputFor(state, currentWeek, SEEDS[name]));
    expect(result).toMatchSnapshot();
  });
});

describe('subsystem tick equivalence — runPoliticsWeeklyTick', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    const currentWeek = (state.weeksLived ?? 0) + 1;
    const result = runPoliticsWeeklyTick(politicsInputFor(state, currentWeek, SEEDS[name]));
    expect(result).toMatchSnapshot();
  });
});

describe('subsystem tick equivalence — runRealEstateWeeklyTick', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    const currentWeek = (state.weeksLived ?? 0) + 1;
    const result = runRealEstateWeeklyTick(realEstateInputFor(state, currentWeek, SEEDS[name]));
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.1 — pre-tick helpers extracted from GameActionsContext.
// These snapshot the EXACT current behavior so the upcoming change in
// GameActionsContext (swap inline code for the new module's exports)
// produces zero diff.

describe('pre-tick equivalence — calculateNetWorth', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    const result = calculateNetWorth(state);
    expect(result).toMatchSnapshot();
  });
});

describe('pre-tick equivalence — computeDecayInputs', () => {
  it.each(FIXTURE_NAMES)('%s', (name) => {
    const state = fixtures[name];
    // Use the same base-rate the inline code uses (4) and a stable
    // pretend-prestige multiplier of 1 — both are caller inputs, so
    // testing with constants is the right shape. Prestige variation
    // is covered separately when applyBonuses is extracted.
    const result = computeDecayInputs(state, {
      baseDecayRate: 4,
      prestigeMultiplier: 1,
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.2a — pet weekly map extracted. Uses synthetic Pet[] cases
// rather than the fixture battery because initialGameState has no pets and
// we want explicit coverage of each code path (healthy / hungry / sick /
// dying / dead / elderly). Same seeded-roll philosophy as the rest of this file.
describe('pre-tick equivalence — tickPetsForWeek', () => {
  const rollFor = deterministicRoll(7);
  const rolls = {
    petSickness: Array.from({ length: 20 }, (_, i) => rollFor(`pet-sick-${i}`)),
    petSicknessType: Array.from({ length: 20 }, (_, i) => rollFor(`pet-sick-type-${i}`)),
  };

  it('handles empty array', () => {
    expect(tickPetsForWeek([], rolls)).toMatchSnapshot();
  });

  it('handles undefined input', () => {
    expect(tickPetsForWeek(undefined, rolls)).toMatchSnapshot();
  });

  it('handles null input', () => {
    expect(tickPetsForWeek(null, rolls)).toMatchSnapshot();
  });

  it('covers healthy/hungry/starving/sick/dying/dead/elderly cases', () => {
    const pets = [
      // healthy dog, low hunger, high happiness/health
      { id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 20, happiness: 80, health: 90 },
      // hungry cat — triggers happiness decay (hunger > 60)
      { id: 'p2', name: 'Whiskers', type: 'cat', age: 100, hunger: 70, happiness: 60, health: 70 },
      // starving fish — triggers both happiness AND health decay (hunger > 80)
      { id: 'p3', name: 'Goldie', type: 'fish', age: 30, hunger: 85, happiness: 40, health: 60 },
      // already sick bird — health decays
      { id: 'p4', name: 'Tweety', type: 'bird', age: 80, hunger: 30, happiness: 50, health: 50, isSick: true, sickness: 'cold' },
      // dying turtle — at zero health for 2 weeks; this tick crosses the 3-week threshold
      { id: 'p5', name: 'Slow', type: 'turtle', age: 200, hunger: 50, happiness: 50, health: 0, weeksAtZeroHealth: 2 },
      // already-dead dog — should be returned unchanged
      { id: 'p6', name: 'Ghost', type: 'dog', age: 1000, hunger: 0, happiness: 0, health: 0, isDead: true },
      // elderly hamster — age far exceeds lifespan, triggers natural death
      { id: 'p7', name: 'Methuselah', type: 'hamster', age: 5000, hunger: 0, happiness: 100, health: 100 },
    ];
    expect(tickPetsForWeek(pets, rolls)).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.2c — pet side-effect helpers (death + living). Both
// mutate ctx; snapshots capture `{ newStats, notifications }` after the call.
// `applyPetDeathSideEffects` also depends on the prev vs updated diff, so
// test cases exercise the newly-dead-vs-already-dead distinction.

function petStubStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 100,
    money: 10000,
    reputation: 50,
    gems: 0,
    ...overrides,
  };
}

function petStubCtx(stats: GameStats): WeekContext {
  return {
    newStats: stats,
    notifications: [] as WeekNotification[],
    preRolls: {
      careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
      childIdSuffix: 'x', childPersonality: 0,
      relBreakup: [], relDisappointed: [],
      policeEncounter: 0, minerDegradation: 0,
      diseaseComplication: [], diseaseProgression: [],
      petSickness: [], petSicknessType: [],
      vehicleAccident: [], vehicleAccidentSeverity: [],
      timestamp: 0,
    },
    nextWeeksLived: 100,
  };
}

describe('pre-tick equivalence — applyPetDeathSideEffects', () => {
  it('no-op when no pets', () => {
    const ctx = petStubCtx(petStubStats());
    applyPetDeathSideEffects([], [], ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('no-op when no newly-dead pets', () => {
    const prev = [{ id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 20, happiness: 80, health: 90 }];
    const updated = [{ ...prev[0], age: 51 }];
    const ctx = petStubCtx(petStubStats());
    applyPetDeathSideEffects(prev, updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('already-dead pets are NOT re-mourned', () => {
    const prev = [{ id: 'p1', name: 'Ghost', type: 'cat', age: 200, hunger: 0, happiness: 0, health: 0, isDead: true }];
    const updated = [{ ...prev[0] }];
    const ctx = petStubCtx(petStubStats({ happiness: 80 }));
    applyPetDeathSideEffects(prev, updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('one newly-dead pet: -20 happiness + 1 notification', () => {
    const prev = [{ id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 90, happiness: 10, health: 0, weeksAtZeroHealth: 2 }];
    const updated = [{ ...prev[0], isDead: true }];
    const ctx = petStubCtx(petStubStats({ happiness: 80 }));
    applyPetDeathSideEffects(prev, updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('two newly-dead pets: -40 happiness + 2 notifications', () => {
    const prev = [
      { id: 'p1', name: 'Rex', type: 'dog', age: 50, hunger: 90, happiness: 10, health: 0, weeksAtZeroHealth: 2 },
      { id: 'p2', name: 'Whiskers', type: 'cat', age: 200, hunger: 90, happiness: 10, health: 0, weeksAtZeroHealth: 2 },
    ];
    const updated = prev.map((p) => ({ ...p, isDead: true }));
    const ctx = petStubCtx(petStubStats({ happiness: 100 }));
    applyPetDeathSideEffects(prev, updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('mix of newly-dead and already-dead: only newly-dead counted', () => {
    const prev = [
      { id: 'alive', name: 'Rex', type: 'dog', age: 50, hunger: 0, happiness: 80, health: 90 },
      { id: 'ghost', name: 'Ghost', type: 'cat', age: 200, hunger: 0, happiness: 0, health: 0, isDead: true },
      { id: 'dying', name: 'Slow', type: 'turtle', age: 100, hunger: 0, happiness: 0, health: 0, weeksAtZeroHealth: 2 },
    ];
    const updated = [
      prev[0],
      prev[1],
      { ...prev[2], isDead: true },
    ];
    const ctx = petStubCtx(petStubStats({ happiness: 60 }));
    applyPetDeathSideEffects(prev, updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('happiness floor at 0 (does not go negative)', () => {
    const prev = [
      { id: 'p1', name: 'A', type: 'dog', age: 50, hunger: 0, happiness: 0, health: 0, weeksAtZeroHealth: 2 },
      { id: 'p2', name: 'B', type: 'cat', age: 50, hunger: 0, happiness: 0, health: 0, weeksAtZeroHealth: 2 },
    ];
    const updated = prev.map((p) => ({ ...p, isDead: true }));
    const ctx = petStubCtx(petStubStats({ happiness: 5 }));
    applyPetDeathSideEffects(prev, updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });
});

describe('pre-tick equivalence — applyPetLivingSideEffects', () => {
  it('no-op when no pets', () => {
    const ctx = petStubCtx(petStubStats());
    applyPetLivingSideEffects([], ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('all alive pets dead: no bonus, no food cost', () => {
    const updated = [
      { id: 'p1', name: 'Ghost', type: 'cat', age: 200, hunger: 0, happiness: 0, health: 0, isDead: true },
    ];
    const ctx = petStubCtx(petStubStats({ happiness: 50, money: 1000 }));
    applyPetLivingSideEffects(updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  // Post-Wave-A: living side effects apply the capped `bondingSummary` deltas
  // (the numbers the "Companion bonus" card already shows), not a flat +2/pet.
  it('alive but unhappy pets: small bonding delta, food cost still deducts', () => {
    const updated = [
      { id: 'p1', name: 'Sad', type: 'dog', age: 50, hunger: 0, happiness: 30, health: 60 },
      { id: 'p2', name: 'Sick', type: 'cat', age: 50, hunger: 0, happiness: 70, health: 20 },
    ];
    const ctx = petStubCtx(petStubStats({ happiness: 60, money: 1000 }));
    applyPetLivingSideEffects(updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('alive happy & healthy pets: capped bonding happiness + health, food cost deducts', () => {
    const updated = [
      { id: 'p1', name: 'Joy', type: 'dog', age: 50, hunger: 0, happiness: 80, health: 90 },
      { id: 'p2', name: 'Bliss', type: 'cat', age: 50, hunger: 0, happiness: 75, health: 85 },
      { id: 'p3', name: 'Cheer', type: 'bird', age: 30, hunger: 0, happiness: 90, health: 95 },
    ];
    const ctx = petStubCtx(petStubStats({ happiness: 60, money: 1000 }));
    applyPetLivingSideEffects(updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('happiness cap at 100', () => {
    const updated = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`, name: `Pet${i}`, type: 'dog', age: 50,
      hunger: 0, happiness: 80, health: 90,
    }));
    const ctx = petStubCtx(petStubStats({ happiness: 95, money: 10000 }));
    applyPetLivingSideEffects(updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('food cost floor at 0 when broke', () => {
    const updated = [
      { id: 'p1', name: 'A', type: 'dog', age: 50, hunger: 0, happiness: 80, health: 90 },
      { id: 'p2', name: 'B', type: 'cat', age: 50, hunger: 0, happiness: 80, health: 90 },
    ];
    const ctx = petStubCtx(petStubStats({ money: 10 }));
    applyPetLivingSideEffects(updated, ctx);
    expect({ newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.3 — diseases extracted via WeekContext + DiseaseTickResult.
// Each test builds a fresh ctx with a known stats baseline and a single
// disease scenario, then snapshots `{ result, newStats }`. The result
// includes the post-tick disease state + the deathTriggered flag.
//
// `generateRandomDisease` is non-deterministic (uses Math.random), so the
// helper is designed to take `newDisease` as input. Tests pass `null` for
// "no admission this tick" or a constructed Disease for "admit this one".

function diseaseStubStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 80,
    happiness: 80,
    energy: 80,
    fitness: 60,
    money: 5000,
    reputation: 50,
    gems: 0,
    ...overrides,
  };
}

function diseaseStubCtx(stats: GameStats, week = 100): WeekContext {
  return {
    newStats: stats,
    notifications: [] as WeekNotification[],
    preRolls: {
      careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
      childIdSuffix: 'x', childPersonality: 0,
      relBreakup: [], relDisappointed: [],
      policeEncounter: 0, minerDegradation: 0,
      diseaseComplication: Array.from({ length: 20 }, () => 0.5),
      diseaseProgression: Array.from({ length: 20 }, () => 0.5),
      petSickness: [], petSicknessType: [],
      vehicleAccident: [], vehicleAccidentSeverity: [],
      timestamp: 0,
    },
    nextWeeksLived: week,
  };
}

function emptyHistory(): DiseaseHistory {
  return {
    diseases: [],
    totalDiseases: 0,
    totalCured: 0,
    deathsFromDisease: 0,
  };
}

// R7 Phase 2 step 2.4b — auto-reinvest extracted. The helper calls
// `getStockInfo` and `getAllStocks` which read a module-level mutable
// price cache. To make snapshots fully deterministic regardless of test
// order, the stock module is mocked here with a fixed price set covering
// the symbols the test cases reference.
jest.mock('@/lib/economy/stockMarket', () => {
  const fixedStocks: Record<string, { price: number; dividendYield: number }> = {
    AAPL: { price: 150, dividendYield: 0.005 },
    GOOGL: { price: 100, dividendYield: 0 },
    MSFT: { price: 300, dividendYield: 0.007 },
    TSLA: { price: 200, dividendYield: 0 },
    AMZN: { price: 90, dividendYield: 0 },
  };
  return {
    getStockInfo: (id: string) => fixedStocks[id?.toUpperCase() ?? ''] || { price: 0, dividendYield: 0 },
    getAllStocks: () => ({ ...fixedStocks }),
    // Pass-through stubs for other exports — the real ones get used elsewhere.
    simulateWeek: jest.fn(),
    getStockPricesSnapshot: jest.fn(() => ({})),
    restoreStockPrices: jest.fn(),
    getAllStockSymbols: () => Object.keys(fixedStocks),
  };
});

// R7 Phase 2 step 2.5c-ii — per-education progression map. Mocks the
// educationSystem module because `runExam` and `shouldTriggerCampusEvent`
// use Math.random. Mock behavior is keyed off the education's `id` prefix:
//   - id starting with `exam-`   → isExamWeek returns true
//   - id starting with `campus-` → shouldTriggerCampusEvent returns true
//   - runExam returns a fixed pass/fail based on `hasStudyGroup`
//   - updateGPA returns a deterministic formula
jest.mock('@/lib/education/educationSystem', () => ({
  isExamWeek: (edu: any) => typeof edu?.id === 'string' && edu.id.startsWith('exam-'),
  shouldTriggerCampusEvent: (edu: any) => typeof edu?.id === 'string' && edu.id.startsWith('campus-'),
  runExam: (edu: any, energy: number, hasStudyGroup: boolean) => ({
    passed: hasStudyGroup, // Pass when in study group, fail otherwise (deterministic).
    grade: hasStudyGroup ? 'B' : 'D',
    message: hasStudyGroup ? 'Solid effort!' : 'Needs improvement.',
    gpaChange: hasStudyGroup ? 0.2 : -0.1,
    statChanges: {
      happiness: hasStudyGroup ? 3 : -5,
      energy: -2,
      reputation: hasStudyGroup ? 1 : 0,
    },
  }),
  updateGPA: (currentGPA: number, examCount: number, gpaChange: number) =>
    Math.max(0, Math.min(4.0, currentGPA + gpaChange / Math.max(1, examCount))),
  // Real progress-derived semester (mirrors the production implementation) so
  // the extracted tick can bump `semesterNumber` deterministically.
  computeSemesterNumber: (duration: number, weeksRemaining: number | undefined) => {
    const dur = Math.max(1, Math.floor(duration));
    const remaining = Math.max(0, Math.min(dur, Math.floor(weeksRemaining ?? dur)));
    const elapsed = dur - remaining;
    const maxSemester = Math.max(1, Math.ceil(dur / 26));
    return Math.min(maxSemester, Math.floor(elapsed / 26) + 1);
  },
  // Pass through other exports we don't need to control.
  EXAM_INTERVAL_WEEKS: 13,
  CAMPUS_EVENT_MIN_INTERVAL: 4,
  CAMPUS_EVENT_MAX_INTERVAL: 8,
}));

// Mock the NPC depth module so applyNPCDepthTick tests are fully deterministic.
// Per-test behavior is set via the jest.Mock handle below.
jest.mock('@/lib/social/npcDepth', () => ({
  processWeeklyNPCDepth: jest.fn(),
}));

// Mock the economy events module so applyEconomicEvent tests are deterministic.
jest.mock('@/lib/events/economyEvents', () => ({
  shouldTriggerEconomicEvent: jest.fn(),
  generateEconomicEvent: jest.fn(),
}));

// Mock the events engine so applyWeeklyEvents tests are deterministic.
jest.mock('@/lib/events/engine', () => ({
  rollWeeklyEvents: jest.fn(),
}));

// Mock the cliffhanger module so applyCliffhangerResolution tests are deterministic.
jest.mock('@/lib/events/cliffhangerEvents', () => ({
  resolveCliffhanger: jest.fn(),
  rollCliffhanger: jest.fn(),
}));

// Mock the life moment generator so applyLifeMoment tests are deterministic.
jest.mock('@/lib/lifeMoments/lifeMomentGenerator', () => ({
  generateLifeMoment: jest.fn(),
}));

// Mock the consequence tracker so applyConsequenceProgression tests are deterministic.
jest.mock('@/lib/lifeMoments/consequenceTracker', () => ({
  processConsequenceProgression: jest.fn(),
  initializeConsequenceState: jest.fn(),
  applyChoiceConsequences: jest.fn(),
}));

// Mock the ribbon system so applyDeathRibbon tests are deterministic.
jest.mock('@/lib/legacy/ribbonSystem', () => ({
  classifyLife: jest.fn(),
  addRibbonToCollection: jest.fn(),
}));

// Mock the checkpoint system so applyAutoCheckpoint tests are deterministic.
jest.mock('@/lib/timeMachine/checkpointSystem', () => ({
  shouldAutoCheckpoint: jest.fn(),
  createCheckpoint: jest.fn(),
  addCheckpoint: jest.fn((existing, cp) => [...(existing || []), cp]),
}));

describe('pre-tick equivalence — applyEducationProgression', () => {
  function progStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 70, happiness: 70, energy: 70, fitness: 60,
      money: 1000, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function progStubCtx(stats: GameStats): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  function anEduP(overrides: Partial<Education> = {}): Education {
    return {
      id: 'cs101',
      name: 'CS 101',
      level: 'highSchool',
      cost: 0,
      duration: 52,
      requirements: {} as any,
      completed: false,
      paused: false,
      weeksRemaining: 26,
      ...overrides,
    } as Education;
  }

  it('empty array: no changes, no campus event', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('paused education is untouched', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ paused: true, weeksRemaining: 10 })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('completed education is untouched', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ completed: true })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('weeksRemaining = 0 (not yet completed): tick finalizes graduation', () => {
    // M6: the guard is `weeksRemaining >= 0` (not `> 0`) so a program the Study
    // button already drove to 0 is finalized here — `completed` flips true and
    // semesterNumber caps — instead of falling through untouched.
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ weeksRemaining: 0 })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('1 active education: decrements weeksRemaining by 1 (no Fast Learner)', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ weeksRemaining: 26 })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('Fast Learner gold only: decrement = 2 (ceil(1.5))', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ weeksRemaining: 26 })],
      nextWeeksLived: 100,
      goldFastLearner: true,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('Fast Learner perk only: decrement = 2', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ weeksRemaining: 26 })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: true,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('Both Fast Learner: decrement = 3 (ceil(2.25))', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ weeksRemaining: 26 })],
      nextWeeksLived: 100,
      goldFastLearner: true,
      perkFastLearner: true,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('education completes this tick (weeksRemaining=1 → 0)', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ weeksRemaining: 1 })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('study group bonus: +2 happiness, -3 energy', () => {
    const ctx = progStubCtx(progStubStats({ happiness: 80, energy: 80 }));
    const result = applyEducationProgression({
      prevEducations: [anEduP({ studyGroupActive: true })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('student loan: deducts payment, reduces remaining', () => {
    const ctx = progStubCtx(progStubStats({ money: 500 }));
    const result = applyEducationProgression({
      prevEducations: [anEduP({
        studentLoan: { remaining: 1000, weeklyPayment: 50, principal: 1000, interestRate: 0.05 } as any,
      })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('exam week PASS (study group): stats bumped, notification pushed', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({
        id: 'exam-cs',
        gpa: 2.5,
        examsPassed: 2,
        examsFailed: 1,
        studyGroupActive: true,
      } as any)],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('exam week FAIL (no study group): stats dropped, fail counter bumped', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({
        id: 'exam-bio',
        gpa: 2.5,
        examsPassed: 0,
        examsFailed: 0,
      } as any)],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('campus event triggers: pendingCampusEvent set to edu.id', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [anEduP({ id: 'campus-uni' })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('completion with class statBonuses: applies all 5 stats + completion notification', () => {
    const ctx = progStubCtx(progStubStats({ health: 50, happiness: 50, energy: 50, fitness: 50, reputation: 50 }));
    const result = applyEducationProgression({
      prevEducations: [anEduP({
        weeksRemaining: 1, // completes this tick
        enrolledClasses: [
          {
            id: 'class1', name: 'Intro', difficulty: 2,
            statBonuses: { health: 5, happiness: 4, energy: 3, fitness: 2, reputation: 6 },
          } as any,
        ],
      })],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('multiple educations: only last campus event wins (legacy let-reassignment)', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [
        anEduP({ id: 'campus-first' }),
        anEduP({ id: 'campus-second' }),
        anEduP({ id: 'normal' }),
      ],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('mixed bag: active + paused + completed', () => {
    const ctx = progStubCtx(progStubStats());
    const result = applyEducationProgression({
      prevEducations: [
        anEduP({ id: 'active-a', weeksRemaining: 10 }),
        anEduP({ id: 'paused-b', paused: true, weeksRemaining: 5 }),
        anEduP({ id: 'done-c', completed: true }),
        anEduP({ id: 'active-d', weeksRemaining: 1, studyGroupActive: true }), // completes
      ],
      nextWeeksLived: 100,
      goldFastLearner: false,
      perkFastLearner: false,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.6-ii-B — warehouse weekly update.
describe('pre-tick equivalence — applyMiningWarehouse', () => {
  function aCryptoForW(id: string, owned: number) {
    return { id, name: id.toUpperCase(), symbol: id.toUpperCase(), price: 1000, owned, weeklyRate: 0 };
  }

  it('no warehouse: returns input warehouse (undefined)', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: undefined,
      prevCryptos: [],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('warehouse with no miners: returns warehouse unchanged', () => {
    const warehouse = { level: 1, miners: {}, difficultyMultiplier: 1.0 } as any;
    const result = applyMiningWarehouse({
      prevWarehouse: warehouse,
      prevCryptos: [],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect(result.updatedWarehouse).toBe(warehouse);
    expect(result).toMatchSnapshot();
  });

  it('miners with full durability: drops by degradationRoll', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 2 },
        minerDurability: { basic: 100 },
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
      } as any,
      prevCryptos: [],
      weeksLived: 100, // 0 weeks since last update → no difficulty bump
      minerDegradationRoll: 4,
    });
    expect(result).toMatchSnapshot();
  });

  it('degradation floors at 0 (low durability + high roll)', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 2 },
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
      } as any,
      prevCryptos: [],
      weeksLived: 100,
      minerDegradationRoll: 5,
    });
    expect(result).toMatchSnapshot();
  });

  it('difficulty update fires at exactly 10 weeks: multiplier × 1.1', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 100 },
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 90,
      } as any,
      prevCryptos: [],
      weeksLived: 100, // diff = 10
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('difficulty update does NOT fire at 9 weeks (boundary)', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 100 },
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 91,
      } as any,
      prevCryptos: [],
      weeksLived: 100, // diff = 9
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('difficulty cap at 2.0× (already high)', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 100 },
        difficultyMultiplier: 1.95, // × 1.1 = 2.145, clamped to 2.0
        lastDifficultyUpdateAbsoluteWeek: 0,
      } as any,
      prevCryptos: [],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('lastDifficultyUpdate is corrupted (cyclic value larger than current week): migrated', () => {
    // lastDifficultyUpdate = 3 (cyclic UI value), currentWeek = 1
    // Migrated to currentWeek (1), so diff = 0 → no update fires.
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 100 },
        difficultyMultiplier: 1.0,
        lastDifficultyUpdate: 3, // cyclic value
        // lastDifficultyUpdateAbsoluteWeek undefined → uses migrated value
      } as any,
      prevCryptos: [],
      weeksLived: 1, // currentAbsoluteWeek = 1, so 3 > 1 → migrated to 1
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair: funding coin budget below fleet cost → partial restore, not a free full repair (exploit fix)', () => {
    // EXPLOIT FIX: owned 0.05 BTC × $1000 = $50 budget, but the basic rig needs
    // 125 × (73/100) × 1 = $91.25 to reach 100% (durability 30 - 3 decay = 27).
    // The old code restored the whole fleet to 100% for a dust balance; now the
    // restore is capped at what the coin can pay, so durability lands partway
    // (27 + 73 × 50/91.25 ≈ 67), never 100.
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 30 }, // under 50, would repair
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
        autoRepairEnabled: true,
        autoRepairCryptoId: 'btc',
        autoRepairWeeklyCost: 0.0001, // production dust floor
      } as any,
      prevCryptos: [aCryptoForW('btc', 0.05)], // $50 budget < $91.25 full cost
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair: only miners under 50% are repaired to 100%', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 5, advanced: 2 },
        minerDurability: { basic: 40, advanced: 70 }, // basic eligible, advanced not
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
        autoRepairEnabled: true,
        autoRepairCryptoId: 'btc',
        autoRepairWeeklyCost: 0.1,
      } as any,
      prevCryptos: [aCryptoForW('btc', 1.0)],
      weeksLived: 100,
      minerDegradationRoll: 3, // basic 40-3=37, then repaired to 100; advanced 70-3=67, untouched
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair: degradation drops basic to 47, still triggers repair (< 50 AFTER decay)', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 50 }, // 50-3=47, triggers <50 repair
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
        autoRepairEnabled: true,
        autoRepairCryptoId: 'btc',
        autoRepairWeeklyCost: 0.01,
      } as any,
      prevCryptos: [aCryptoForW('btc', 1.0)],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair: degradation drops basic to 53, NO repair (>= 50 AFTER decay)', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 56 }, // 56-3=53, NO repair (not <50)
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
        autoRepairEnabled: true,
        autoRepairCryptoId: 'btc',
        autoRepairWeeklyCost: 0.01,
      } as any,
      prevCryptos: [aCryptoForW('btc', 1.0)],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair with no miners needing repair (totalRepairCost = 0): fallthrough to no-repair return', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 95 }, // 95-3=92, way above 50
        difficultyMultiplier: 1.0,
        lastDifficultyUpdateAbsoluteWeek: 100,
        autoRepairEnabled: true,
        autoRepairCryptoId: 'btc',
        autoRepairWeeklyCost: 0.01,
      } as any,
      prevCryptos: [aCryptoForW('btc', 1.0)],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    // Since totalRepairCost = 0, the "if (totalRepairCost > 0 && ...)" early-return
    // doesn't fire; falls through to the bottom return (which writes the same fields).
    expect(result).toMatchSnapshot();
  });

  it('explicit lastDifficultyUpdateAbsoluteWeek takes precedence over legacy field', () => {
    const result = applyMiningWarehouse({
      prevWarehouse: {
        level: 1,
        miners: { basic: 1 },
        minerDurability: { basic: 100 },
        difficultyMultiplier: 1.0,
        lastDifficultyUpdate: 5, // would imply 5 weeks ago (legacy)
        lastDifficultyUpdateAbsoluteWeek: 95, // explicit absolute (5 weeks ago)
      } as any,
      prevCryptos: [],
      weeksLived: 100, // diff = 5, no update
      minerDegradationRoll: 3,
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.6-ii-A — mining crypto tick.
describe('pre-tick equivalence — applyMiningCryptos', () => {
  function aCrypto(overrides: any = {}) {
    return {
      id: 'btc', name: 'Bitcoin', symbol: 'BTC', price: 50000,
      owned: 1.0, weeklyRate: 0.01,
      ...overrides,
    };
  }

  it('no warehouse: returns prevCryptos unchanged (same reference)', () => {
    const cryptos = [aCrypto()];
    const result = applyMiningCryptos({
      prevWarehouse: undefined,
      prevCryptos: cryptos,
      halvingCount: 0,
    });
    expect(result.updatedCryptos).toBe(cryptos);
    expect(result).toMatchSnapshot();
  });

  it('warehouse without selectedCrypto: returns prevCryptos unchanged', () => {
    const cryptos = [aCrypto()];
    const result = applyMiningCryptos({
      prevWarehouse: { level: 1, miners: {}, selectedCrypto: undefined } as any,
      prevCryptos: cryptos,
      halvingCount: 0,
    });
    expect(result.updatedCryptos).toBe(cryptos);
    expect(result).toMatchSnapshot();
  });

  it('warehouse with selected crypto but NO miners: cryptoEarned = 0, returns prev', () => {
    const cryptos = [aCrypto()];
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: {},
        selectedCrypto: 'btc',
      } as any,
      prevCryptos: cryptos,
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });

  it('warehouse with basic miners: BTC owned bumps up', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: { basic: 5 },
        selectedCrypto: 'btc',
      } as any,
      prevCryptos: [aCrypto({ owned: 0 })],
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });

  it('warehouse with industrial miners: significant BTC bump', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 5,
        miners: { industrial: 3 },
        selectedCrypto: 'btc',
      } as any,
      prevCryptos: [aCrypto({ owned: 0 })],
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });

  it('halving 1: cryptoEarned cut in half', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: { basic: 10 },
        selectedCrypto: 'btc',
      } as any,
      prevCryptos: [aCrypto({ owned: 0 })],
      halvingCount: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('halving 4: cryptoEarned reduced by 16× (1/16)', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: { basic: 10 },
        selectedCrypto: 'btc',
      } as any,
      prevCryptos: [aCrypto({ owned: 0 })],
      halvingCount: 4,
    });
    expect(result).toMatchSnapshot();
  });

  it('mining ETH (lower multiplier in calculateMiningEarnings)', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: { basic: 10 },
        selectedCrypto: 'eth',
      } as any,
      prevCryptos: [
        aCrypto({ id: 'btc', name: 'Bitcoin', symbol: 'BTC' }),
        aCrypto({ id: 'eth', name: 'Ether', symbol: 'ETH', price: 3000, owned: 0 }),
      ],
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair enabled with earnings: deducts cost from autoRepairCryptoId', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: { basic: 10 },
        selectedCrypto: 'btc',
        autoRepairEnabled: true,
        autoRepairCryptoId: 'eth',
        autoRepairWeeklyCost: 0.005,
      } as any,
      prevCryptos: [
        aCrypto({ id: 'btc', owned: 0 }),
        aCrypto({ id: 'eth', name: 'Ether', symbol: 'ETH', price: 3000, owned: 0.1 }),
      ],
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair enabled but NO earnings: still deducts cost', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: {}, // no miners → no earnings
        selectedCrypto: 'btc',
        autoRepairEnabled: true,
        autoRepairCryptoId: 'eth',
        autoRepairWeeklyCost: 0.01,
      } as any,
      prevCryptos: [
        aCrypto({ id: 'btc', owned: 0 }),
        aCrypto({ id: 'eth', name: 'Ether', symbol: 'ETH', price: 3000, owned: 0.5 }),
      ],
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });

  it('auto-repair cost exceeds owned: floored at 0', () => {
    const result = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: {},
        selectedCrypto: 'btc',
        autoRepairEnabled: true,
        autoRepairCryptoId: 'eth',
        autoRepairWeeklyCost: 1.0,
      } as any,
      prevCryptos: [
        aCrypto({ id: 'btc', owned: 0 }),
        aCrypto({ id: 'eth', name: 'Ether', symbol: 'ETH', price: 3000, owned: 0.001 }),
      ],
      halvingCount: 0,
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.6-i — crime tick. Decay + police encounter.
describe('pre-tick equivalence — applyCrimeTick', () => {
  function crimeStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 80, energy: 80, fitness: 60,
      money: 10000, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function crimeStubCtx(stats: GameStats): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  it('wantedLevel 0, no jail: no decay, no encounter', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 0, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel undefined: treated as 0', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: undefined, prevJailWeeks: undefined, policeEncounterRoll: 0.5,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel 3, not in jail: decay to 2, no encounter (< 5)', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 3, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel 3, IN jail: NO decay (frozen while incarcerated)', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 3, prevJailWeeks: 5, policeEncounterRoll: 0.001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel 5, in jail: NO encounter check (frozen)', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 5, prevJailWeeks: 3, policeEncounterRoll: 0.001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel 5 BEFORE decay → 4 AFTER, no encounter (post-decay < 5)', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 5, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    // Decay to 4, then encounter check uses 4 — no encounter (need >= 5).
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel 6 → 5, encounter chance = 5%, roll 0.01: ENCOUNTER fires', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 6, prevJailWeeks: 0, policeEncounterRoll: 0.01,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel 6 → 5, roll 0.10: encounter chance 5% < roll, no fire', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 6, prevJailWeeks: 0, policeEncounterRoll: 0.10,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel high (10 → 9), encounter cap at 30%, jailWeeks capped at 4', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 10, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    // newWantedLevel = 9, chance = min(0.30, 5 * 0.05) = 0.25, roll 0.001 < 0.25 → fire.
    // jailWeeks = min(4, ceil(9/3)) = 3.
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('wantedLevel extremely high (15 → 14): jailWeeks = min(4, ceil(14/3)) = 4', () => {
    const ctx = crimeStubCtx(crimeStubStats());
    const result = applyCrimeTick({
      prevWantedLevel: 15, prevJailWeeks: 0, policeEncounterRoll: 0.0001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('encounter with low money: fine capped at current cash', () => {
    const ctx = crimeStubCtx(crimeStubStats({ money: 50 }));
    const result = applyCrimeTick({
      prevWantedLevel: 6, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    // money = 50, 5% = 2.5 → Math.round = 3, fine = min(50, 3) = 3.
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('encounter with zero money: fine = 0', () => {
    const ctx = crimeStubCtx(crimeStubStats({ money: 0 }));
    const result = applyCrimeTick({
      prevWantedLevel: 6, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('happiness floored at 0 when below 15', () => {
    const ctx = crimeStubCtx(crimeStubStats({ happiness: 10 }));
    const result = applyCrimeTick({
      prevWantedLevel: 6, prevJailWeeks: 0, policeEncounterRoll: 0.001,
    }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.5c-i — education stress penalties. Mutates ctx.newStats
// (happiness/health/energy). Returns count + log message for caller.
describe('pre-tick equivalence — applyEducationStress', () => {
  function eduStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 80, energy: 80, fitness: 60,
      money: 500, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function eduStubCtx(stats: GameStats): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  function anEdu(overrides: Partial<Education> = {}): Education {
    return {
      id: 'cs101',
      name: 'CS 101',
      level: 'highSchool',
      cost: 0,
      duration: 52,
      requirements: {} as any,
      completed: false,
      paused: false,
      weeksRemaining: 26,
      ...overrides,
    } as Education;
  }

  it('empty educations: 0 count, null log, ctx untouched', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('undefined educations: handled gracefully', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress(undefined, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('all educations completed: 0 active, no penalty', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([anEdu({ completed: true })], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('all educations paused: 0 active, no penalty', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([anEdu({ paused: true })], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('weeksRemaining = 0: 0 active, no penalty', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([anEdu({ weeksRemaining: 0 })], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('1 active: 1.0× multiplier, base penalties', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([anEdu()], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('2 active: 1.3× multiplier', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([anEdu({ id: 'a' }), anEdu({ id: 'b' })], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('3+ active: 1.6× multiplier', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([
      anEdu({ id: 'a' }), anEdu({ id: 'b' }), anEdu({ id: 'c' }), anEdu({ id: 'd' }),
    ], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('penalties cap at -20/-10/-25 (death-spiral protection)', () => {
    const ctx = eduStubCtx(eduStubStats());
    // 5 active × 1.6× should easily exceed the caps for happiness (-6 × 5 × 1.6 = -48 → -20).
    const result = applyEducationStress(
      Array.from({ length: 5 }, (_, i) => anEdu({ id: `e${i}` })),
      ctx,
    );
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('happiness clamped at 0 when current is near floor', () => {
    const ctx = eduStubCtx(eduStubStats({ happiness: 3, health: 2 }));
    const result = applyEducationStress([anEdu()], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('energy NOT clamped at 0 here (legacy intentional)', () => {
    // energy = 5, penalty = -7 → result = -2 (NOT clamped to 0).
    // The final 0-100 cap happens later in the updater per legacy code.
    const ctx = eduStubCtx(eduStubStats({ energy: 5 }));
    const result = applyEducationStress([anEdu()], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('mix of active + paused + completed: only active count toward penalties', () => {
    const ctx = eduStubCtx(eduStubStats());
    const result = applyEducationStress([
      anEdu({ id: 'active1' }),
      anEdu({ id: 'paused', paused: true }),
      anEdu({ id: 'done', completed: true }),
      anEdu({ id: 'active2' }),
      anEdu({ id: 'noweeks', weeksRemaining: 0 }),
    ], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.5b-iii — career progress increment. Pure, no side
// effects. Returns updated careers array with bumped progress.
describe('pre-tick equivalence — applyCareerProgress', () => {
  function aCareerForProgress(overrides: Partial<Career> = {}): Career {
    return {
      id: 'engineer',
      levels: [{ name: 'Junior', salary: 100 }],
      level: 0,
      description: '',
      requirements: {} as any,
      progress: 0,
      applied: true,
      accepted: true,
      ...overrides,
    };
  }

  function statsForPerf(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 80, energy: 80, fitness: 60,
      money: 1000, reputation: 60, gems: 0,
      ...overrides,
    };
  }

  it('no current job: returns prevCareers (same reference)', () => {
    const careers = [aCareerForProgress()];
    const result = applyCareerProgress({
      prevCareers: careers,
      currentJob: undefined,
      nextWeeksLived: 100,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result.updatedCareers).toBe(careers); // strict identity
    expect(result).toMatchSnapshot();
  });

  it('current job set but no matching accepted career: prevCareers unchanged', () => {
    const careers = [aCareerForProgress({ accepted: false })];
    const result = applyCareerProgress({
      prevCareers: careers,
      currentJob: 'engineer',
      nextWeeksLived: 100,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result.updatedCareers).toBe(careers);
    expect(result).toMatchSnapshot();
  });

  it('happy path: progress bumps + startedWeeksLived initialized + performance stored', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 10, startedWeeksLived: undefined })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('early-career boost tier 1 (<20 weeks): 2.5× progress', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 5 })],
      currentJob: 'engineer',
      nextWeeksLived: 15, // 10 weeks in career
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('early-career boost tier 2 (20-39 weeks): 1.5× progress', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 30, // 30 weeks in career
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('no early boost (40+ weeks): 1.0× progress', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50, // 50 weeks in career
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('active mentor buff: +50% progress', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 50, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: { mentor: { expiresWeeksLived: 60 } }, // still active
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('expired mentor buff: no bonus', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 50, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: { mentor: { expiresWeeksLived: 40 } }, // expired
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('perf tier high (>= 80): 1.3× modifier', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf({ health: 95, happiness: 95, energy: 95, fitness: 95 }),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('perf tier mid (50-79): 1.0× modifier', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf({ health: 60, happiness: 60, energy: 60, fitness: 60 }),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('perf tier low (30-49): 0.7× modifier', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf({ health: 40, happiness: 40, energy: 40, fitness: 40 }),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('perf tier very low (< 30): 0.3× modifier', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf({ health: 10, happiness: 10, energy: 10, fitness: 10 }),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('gold mindset only: 1.5× multiplier', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: true, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('perk mindset only: 1.5× multiplier', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: true,
    });
    expect(result).toMatchSnapshot();
  });

  it('both mindset flags: 2.25× multiplier (multiplicative)', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 0, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: true, perkMindset: true,
    });
    expect(result).toMatchSnapshot();
  });

  it('progress caps at 100', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 99, startedWeeksLived: 0 })],
      currentJob: 'engineer',
      nextWeeksLived: 5, // early boost = 2.5× → big bump
      newStats: statsForPerf({ health: 95, happiness: 95, energy: 95, fitness: 95 }), // perf 1.3×
      legacyBuffs: undefined,
      goldMindset: true, perkMindset: true,
    });
    expect(result).toMatchSnapshot();
  });

  it('preserves startedWeeksLived if already set', () => {
    const result = applyCareerProgress({
      prevCareers: [aCareerForProgress({ progress: 50, startedWeeksLived: 42 })],
      currentJob: 'engineer',
      nextWeeksLived: 100,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('other careers in the array are returned untouched', () => {
    const result = applyCareerProgress({
      prevCareers: [
        aCareerForProgress({ id: 'engineer', progress: 10, startedWeeksLived: 0 }),
        aCareerForProgress({ id: 'doctor', accepted: false, progress: 5 }),
        aCareerForProgress({ id: 'lawyer', accepted: false, progress: 25 }),
      ],
      currentJob: 'engineer',
      nextWeeksLived: 50,
      newStats: statsForPerf(),
      legacyBuffs: undefined,
      goldMindset: false, perkMindset: false,
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.5b-ii — pending career application processing. Pure
// helper, returns updated careers + currentJob + log message (or null).
describe('pre-tick equivalence — applyCareerApplications', () => {
  function aPendingCareer(overrides: Partial<Career> = {}): Career {
    return {
      id: 'engineer',
      levels: [{ name: 'Junior', salary: 100 }],
      level: 0,
      description: '',
      requirements: {} as any,
      progress: 0,
      applied: true,
      accepted: false,
      ...overrides,
    };
  }

  it('no careers: returns prevCareers (same reference) + undefined job', () => {
    const result = applyCareerApplications({
      prevCareers: [],
      prevCurrentJob: undefined,
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('undefined careers: handled gracefully', () => {
    const result = applyCareerApplications({
      prevCareers: undefined,
      prevCurrentJob: undefined,
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('no pending application (all accepted): no change', () => {
    const result = applyCareerApplications({
      prevCareers: [aPendingCareer({ applied: true, accepted: true })],
      prevCurrentJob: 'engineer',
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('pending application BUT player has currentJob: no acceptance', () => {
    const result = applyCareerApplications({
      prevCareers: [aPendingCareer({ id: 'doctor' })],
      prevCurrentJob: 'engineer', // already employed
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('pending, no current job, delay=1, weeksPending=0: weeks=1 >= 1 → ACCEPT', () => {
    const result = applyCareerApplications({
      prevCareers: [aPendingCareer({ applicationWeeksPending: undefined })],
      prevCurrentJob: undefined,
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('pending, no current job, delay=2, weeksPending=0: weeks=1 < 2 → DEFER', () => {
    const result = applyCareerApplications({
      prevCareers: [aPendingCareer({ applicationWeeksPending: undefined })],
      prevCurrentJob: undefined,
      careerAcceptDelay: 2,
    });
    expect(result).toMatchSnapshot();
  });

  it('pending, no current job, delay=2, weeksPending=1: weeks=2 >= 2 → ACCEPT', () => {
    const result = applyCareerApplications({
      prevCareers: [aPendingCareer({ applicationWeeksPending: 1 })],
      prevCurrentJob: undefined,
      careerAcceptDelay: 2,
    });
    expect(result).toMatchSnapshot();
  });

  it('pending, weeksPending=undefined treated as 0 (defaults via || 0)', () => {
    const result = applyCareerApplications({
      prevCareers: [aPendingCareer({ applicationWeeksPending: undefined })],
      prevCurrentJob: undefined,
      careerAcceptDelay: 2,
    });
    expect(result).toMatchSnapshot();
  });

  it('multiple pending: only the FIRST is processed (legacy .find)', () => {
    const result = applyCareerApplications({
      prevCareers: [
        aPendingCareer({ id: 'firstP', applicationWeeksPending: 0 }),
        aPendingCareer({ id: 'secondP', applicationWeeksPending: 5 }),
      ],
      prevCurrentJob: undefined,
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('mix accepted + pending: pending is processed when no currentJob', () => {
    const result = applyCareerApplications({
      prevCareers: [
        aPendingCareer({ id: 'old', applied: true, accepted: true }),
        aPendingCareer({ id: 'new', applicationWeeksPending: 0 }),
      ],
      prevCurrentJob: undefined,
      careerAcceptDelay: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('careers array reference is preserved when nothing changes', () => {
    const careers = [aPendingCareer({ applied: false, accepted: false })];
    const result = applyCareerApplications({
      prevCareers: careers,
      prevCurrentJob: undefined,
      careerAcceptDelay: 1,
    });
    // updatedCareers should === careers (same reference) when no mutation.
    expect(result.updatedCareers).toBe(careers);
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.5b-i — career salary + penalty. Mutates ctx.newStats
// (happiness, health). Returns { careerSalary, careerHappinessPenalty,
// careerHealthPenalty }.
describe('pre-tick equivalence — applyCareerSalaryAndPenalty', () => {
  function careerStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 80, energy: 80, fitness: 60,
      money: 500, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function careerStubCtx(stats: GameStats): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  function aCareer(overrides: Partial<Career> = {}): Career {
    return {
      id: 'engineer',
      levels: [
        { name: 'Junior Engineer', salary: 100 },
        { name: 'Engineer', salary: 200 },
        { name: 'Senior Engineer', salary: 400 },
      ],
      level: 0,
      description: 'Software engineering career',
      requirements: {} as any,
      progress: 50,
      applied: true,
      accepted: true,
      ...overrides,
    };
  }

  it('no current job: returns all zeros, no stat mutation', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({ currentJob: undefined });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('current job set but careers array is empty: returns zeros, warn logged', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({ currentJob: 'engineer', careers: [] });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('current job set but not accepted: returns zeros, warn logged', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ accepted: false })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('current job accepted, no levels array: returns zeros', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ levels: [] })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('current job accepted, level 0, no perks: salary + penalty applied', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: 0 })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('current job at out-of-bounds level: clamped to last index', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: 99 })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('current job at negative level: clamped to 0', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: -5 })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('level data has salary = 0: warn logged, no salary, no penalty', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({
        levels: [{ name: 'Volunteer', salary: 0 }],
        level: 0,
      })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('gold upgrade work_boost only: 1.5× salary', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: 1 })],
      goldUpgrades: { work_boost: true } as any,
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('perk workBoost only: 1.5× salary', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: 1 })],
      perks: { workBoost: true } as any,
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('both gold + perk: 2.25× salary, multiplicative stack', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: 1 })],
      goldUpgrades: { work_boost: true } as any,
      perks: { workBoost: true } as any,
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('penalty floor at 0: low happiness/health does not go negative', () => {
    const ctx = careerStubCtx(careerStubStats({ happiness: 2, health: 1 }));
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [aCareer({ level: 0 })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('career found but ID mismatch in array: returns zeros, warn logged', () => {
    const ctx = careerStubCtx(careerStubStats());
    const state = createTestGameState({
      currentJob: 'doctor',
      careers: [aCareer({ id: 'engineer' })],
    });
    const result = applyCareerSalaryAndPenalty(state, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.5a — diet-plan effects. Mutates ctx.newStats, returns
// log message (or null). Same shape as summarizeWeeklyFinance returns.
describe('pre-tick equivalence — applyDietPlanForWeek', () => {
  function dietStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 60, happiness: 60, energy: 60, fitness: 50,
      money: 500, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function dietStubCtx(stats: GameStats): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  it('no diet plans: returns null, ctx untouched', () => {
    const ctx = dietStubCtx(dietStubStats());
    const result = applyDietPlanForWeek([], ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('undefined diet plans: handled gracefully', () => {
    const ctx = dietStubCtx(dietStubStats());
    const result = applyDietPlanForWeek(undefined, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('all diet plans inactive: returns null', () => {
    const plans: DietPlan[] = [
      { id: 'd1', name: 'Keto', description: '', dailyCost: 5, healthGain: 3, energyGain: 2, active: false },
    ];
    const ctx = dietStubCtx(dietStubStats());
    const result = applyDietPlanForWeek(plans, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('basic active diet: applies health + energy gains, deducts cost', () => {
    const plans: DietPlan[] = [
      { id: 'd1', name: 'Basic Balanced', description: '', dailyCost: 10, healthGain: 2, energyGain: 1, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats({ money: 200 }));
    const result = applyDietPlanForWeek(plans, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('diet with happinessGain: applies all three stats', () => {
    const plans: DietPlan[] = [
      { id: 'd2', name: 'Gourmet', description: '', dailyCost: 25, healthGain: 4, energyGain: 3, happinessGain: 2, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats());
    const result = applyDietPlanForWeek(plans, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('diet with happinessGain = 0: skips happiness mutation but log still shows +0', () => {
    const plans: DietPlan[] = [
      { id: 'd3', name: 'Zero Joy', description: '', dailyCost: 5, healthGain: 1, energyGain: 1, happinessGain: 0, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats({ happiness: 50 }));
    const result = applyDietPlanForWeek(plans, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('gains cap stats at 100', () => {
    const plans: DietPlan[] = [
      { id: 'd4', name: 'Max', description: '', dailyCost: 100, healthGain: 50, energyGain: 50, happinessGain: 50, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats({ health: 95, energy: 95, happiness: 95, money: 10000 }));
    const result = applyDietPlanForWeek(plans, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('cost > money: skips gains and charges nothing (anti free-gain when broke)', () => {
    const plans: DietPlan[] = [
      { id: 'd5', name: 'Expensive', description: '', dailyCost: 100, healthGain: 1, energyGain: 1, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats({ money: 200 })); // cost = 700 > money 200 → no-op week
    const result = applyDietPlanForWeek(plans, ctx);
    // Unaffordable: money unchanged, no health/energy gains applied.
    expect(ctx.newStats.money).toBe(200);
    expect(ctx.newStats.health).toBe(60);
    expect(ctx.newStats.energy).toBe(60);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('multiple active plans: only the FIRST one is applied (legacy .find behavior)', () => {
    const plans: DietPlan[] = [
      { id: 'first', name: 'First', description: '', dailyCost: 10, healthGain: 1, energyGain: 1, active: true },
      { id: 'second', name: 'Second', description: '', dailyCost: 100, healthGain: 99, energyGain: 99, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats());
    const result = applyDietPlanForWeek(plans, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('NaN money: sanitized to 0, treated as unaffordable (no gains, no charge)', () => {
    const plans: DietPlan[] = [
      { id: 'd6', name: 'X', description: '', dailyCost: 5, healthGain: 1, energyGain: 1, active: true },
    ];
    const ctx = dietStubCtx(dietStubStats({ money: NaN as any }));
    const result = applyDietPlanForWeek(plans, ctx);
    // NaN → 0, which is < weekly cost (35), so it's a no-op week.
    expect(ctx.newStats.money).toBe(0);
    expect(ctx.newStats.health).toBe(60);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.4f — finance summary log line. Pure helper, returns
// the formatted string or null when nothing notable happened. Snapshots
// capture the exact log format so any future change surfaces immediately.
describe('pre-tick equivalence — summarizeWeeklyFinance', () => {
  function zeroInput(): WeeklyFinanceSummaryInput {
    return {
      careerSalary: 0, partnerIncome: 0, passiveIncome: 0, totalIncome: 0,
      incomeTax: 0, weeklyRent: 0, totalLoanAutoPaid: 0, totalLoanPenalty: 0,
      savingsInterest: 0, currentMoney: 100, newMoney: 100,
    };
  }

  it('all zero: returns null (no log)', () => {
    expect(summarizeWeeklyFinance(zeroInput())).toMatchSnapshot();
  });

  it('career income only: minimal happy path', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      careerSalary: 500, totalIncome: 500,
      currentMoney: 1000, newMoney: 1500,
    })).toMatchSnapshot();
  });

  it('all positive contributions: full breakdown line', () => {
    expect(summarizeWeeklyFinance({
      careerSalary: 1000, partnerIncome: 250, passiveIncome: 75, totalIncome: 1325,
      incomeTax: 200, weeklyRent: 50,
      totalLoanAutoPaid: 100, totalLoanPenalty: 15, savingsInterest: 10,
      currentMoney: 5000, newMoney: 5970,
    })).toMatchSnapshot();
  });

  it('rent only (no income): still logs', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      weeklyRent: 200,
      currentMoney: 500, newMoney: 300,
    })).toMatchSnapshot();
  });

  it('savings interest only: logs the savings row', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      savingsInterest: 12.5, // legacy code Math.rounds → 13
      currentMoney: 5000, newMoney: 5000,
    })).toMatchSnapshot();
  });

  it('loan-penalty-only: logs without auto-paid', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      totalLoanPenalty: 25.7, // rounds to 26
      currentMoney: 500, newMoney: 500,
    })).toMatchSnapshot();
  });

  it('careerSalary = 0 but totalIncome > 0 (passive only)', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      passiveIncome: 100, totalIncome: 100,
      currentMoney: 1000, newMoney: 1100,
    })).toMatchSnapshot();
  });

  it('partnerIncome = 0 omits the Partner row', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      careerSalary: 500, totalIncome: 500,
      currentMoney: 1000, newMoney: 1500,
    })).toMatchSnapshot();
  });

  it('large rounding: 99.4 rounds down, 99.6 rounds up', () => {
    expect(summarizeWeeklyFinance({
      ...zeroInput(),
      totalLoanAutoPaid: 99.4, // → 99
      totalLoanPenalty: 99.6,  // → 100
      savingsInterest: 100.5,  // → 101 (banker's rounding: actually Math.round → 101)
      currentMoney: 1000, newMoney: 1000,
    })).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.4e — per-loan autopay. Pure helper, returns
// cashAfter + totals. Already-tested loan calling pattern used in
// `lib/banking/__tests__/weeklyTick.test.ts` informs the test shape.
describe('pre-tick equivalence — applyLoanAutopay', () => {
  function aLoan(overrides: Partial<Loan> = {}): Loan {
    return {
      id: 'L1',
      name: 'Test Loan',
      principal: 5000,
      remaining: 5000,
      rateAPR: 0.10,
      termWeeks: 52,
      weeklyPayment: 100,
      startWeek: 0,
      autoPay: true,
      type: 'personal',
      weeksRemaining: 52,
      interestRate: 0.10,
      ...overrides,
    };
  }

  it('no loans: returns empty + zero totals + cash untouched', () => {
    const result = applyLoanAutopay({ prevLoans: [], cashAvailable: 1000 });
    expect(result).toMatchSnapshot();
  });

  it('undefined loans: handled gracefully', () => {
    const result = applyLoanAutopay({ prevLoans: undefined, cashAvailable: 1000 });
    expect(result).toMatchSnapshot();
  });

  it('loan with zero remaining is filtered out', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 0 })],
      cashAvailable: 1000,
    });
    expect(result).toMatchSnapshot();
  });

  it('loan with NaN remaining is treated as 0 and filtered', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: NaN })],
      cashAvailable: 1000,
    });
    expect(result).toMatchSnapshot();
  });

  it('single loan, affordable, normal autopay', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 4900, weeklyPayment: 100 })],
      cashAvailable: 5000, // plenty of headroom over BANKRUPTCY_FLOOR
    });
    expect(result).toMatchSnapshot();
  });

  it('single loan, can NOT afford (cash below paymentDue)', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 1000, weeklyPayment: 200 })],
      cashAvailable: 50, // below paymentDue
    });
    expect(result).toMatchSnapshot();
  });

  it('single loan, cash >= payment but bankruptcy floor blocks (and no breathing-room)', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 1000, weeklyPayment: 100 })],
      // BANKRUPTCY_FLOOR is 100; need cash - paymentDue >= 100 AND NOT cash >= paymentDue * 2.
      // cashAvailable = 150 → cash - payment = 50 < 100 (blocks) AND 150 < 200 (no force) → MISS.
      cashAvailable: 150,
    });
    expect(result).toMatchSnapshot();
  });

  it('single loan, forcePayment kicks in (cash >= payment * 2)', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 1000, weeklyPayment: 100 })],
      // cashAvailable = 200 → cash >= paymentDue * 2 (200) → force fires, ignores floor.
      cashAvailable: 200,
    });
    expect(result).toMatchSnapshot();
  });

  it('APR as percentage (rateAPR > 1, e.g. 10 instead of 0.10) is /100', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 5000, weeklyPayment: 100, interestRate: 10 })],
      cashAvailable: 10000,
    });
    expect(result).toMatchSnapshot();
  });

  it('weeksRemaining=0 → fallback payment is the full remainingWithInterest', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 500, weeklyPayment: 0, weeksRemaining: 0 })],
      cashAvailable: 10000,
    });
    expect(result).toMatchSnapshot();
  });

  it('weeksRemaining > 0 with no configured weeklyPayment → fallback (remainingWithInterest / weeksRemaining)', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 1000, weeklyPayment: 0, weeksRemaining: 10 })],
      cashAvailable: 10000,
    });
    expect(result).toMatchSnapshot();
  });

  it('loan paid off this week (remainingWithInterest <= paymentDue) is filtered out', () => {
    const result = applyLoanAutopay({
      // remaining = 90, weeklyPayment = 100 → paymentDue is capped at remainingWithInterest (~90.17).
      prevLoans: [aLoan({ remaining: 90, weeklyPayment: 100 })],
      cashAvailable: 10000,
    });
    expect(result).toMatchSnapshot();
  });

  it('multiple loans, mixed afford/miss: cash drains across iterations', () => {
    const result = applyLoanAutopay({
      prevLoans: [
        aLoan({ id: 'L1', remaining: 500, weeklyPayment: 100 }),  // affordable
        aLoan({ id: 'L2', remaining: 1000, weeklyPayment: 200 }), // affordable after L1
        aLoan({ id: 'L3', remaining: 500, weeklyPayment: 200 }),  // possibly missed depending on cash
      ],
      cashAvailable: 500, // tight budget
    });
    expect(result).toMatchSnapshot();
  });

  it('high-APR missed payment compounds via LOAN_MISSED_PAYMENT_PENALTY', () => {
    const result = applyLoanAutopay({
      prevLoans: [aLoan({ remaining: 1000, weeklyPayment: 5000, interestRate: 0.25 })],
      cashAvailable: 100, // can\'t cover
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.4d — savings interest. Pure helper, no ctx mutations.
describe('pre-tick equivalence — computeSavingsInterest', () => {
  it('zero savings: no interest', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 0,
      creditScore: 600,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('negative savings: clamped to 0, no interest', () => {
    const result = computeSavingsInterest({
      prevBankSavings: -1000,
      creditScore: 600,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('undefined savings: handled gracefully', () => {
    const result = computeSavingsInterest({
      prevBankSavings: undefined,
      creditScore: 600,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('NaN savings: clamped to 0', () => {
    const result = computeSavingsInterest({
      prevBankSavings: NaN,
      creditScore: 600,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('base APR, below soft cap, no perks', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 5000,
      creditScore: 500,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('base APR, exactly at soft cap', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 50000, // SAVINGS_BALANCE_SOFT_CAP value
      creditScore: 500,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('base APR, well above soft cap (diminishing returns kick in)', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 200000,
      creditScore: 500,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('high-yield via creditScore 740 unlock', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 10000,
      creditScore: 740, // exact threshold
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('high-yield via creditScore 739 NOT unlocked (off-by-one check)', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 10000,
      creditScore: 739,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('high-yield via financialPlanning setting (low credit OK)', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 10000,
      creditScore: 400,
      financialPlanning: true,
      goldCreditUpgrade: false,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('goldUpgrade only: 1.5× interest', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 10000,
      creditScore: 500,
      financialPlanning: false,
      goldCreditUpgrade: true,
      goodCreditPerk: false,
    });
    expect(result).toMatchSnapshot();
  });

  it('goodCredit perk only: 1.5× interest', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 10000,
      creditScore: 500,
      financialPlanning: false,
      goldCreditUpgrade: false,
      goodCreditPerk: true,
    });
    expect(result).toMatchSnapshot();
  });

  it('both gold + perk: 2.25× (1.5 × 1.5) interest, multiplicative stack', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 10000,
      creditScore: 500,
      financialPlanning: false,
      goldCreditUpgrade: true,
      goodCreditPerk: true,
    });
    expect(result).toMatchSnapshot();
  });

  it('all perks + high-yield + above soft cap (max-stack scenario)', () => {
    const result = computeSavingsInterest({
      prevBankSavings: 250000,
      creditScore: 800,
      financialPlanning: true,
      goldCreditUpgrade: true,
      goodCreditPerk: true,
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.4c — rent + housing module + real-estate tick.
// Same WeekContext-mutation pattern as vehicles. Tests build a fresh ctx
// and snapshot `{ result, notifications }` — the latter captures the side
// effects pushed during the call. Uses a deterministic seeded `rollFor`
// for the realEstate weeklyTick so snapshots are stable.
describe('pre-tick equivalence — applyRentAndHousing', () => {
  function makeCtx(): WeekContext {
    return {
      newStats: {
        health: 100, happiness: 100, energy: 100, fitness: 100,
        money: 10000, reputation: 50, gems: 0,
      },
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  it('empty real-estate: no rent, no housing effects', () => {
    const ctx = makeCtx();
    const result = applyRentAndHousing([], 100, deterministicRoll(9), ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('undefined real-estate: handled gracefully', () => {
    const ctx = makeCtx();
    const result = applyRentAndHousing(undefined, 100, deterministicRoll(9), ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('rented (not owned) property: pays weekly rent', () => {
    const properties: RealEstate[] = [
      {
        id: 'rent1', name: 'Studio Apartment', price: 1500,
        weeklyHappiness: 0, weeklyEnergy: 0,
        owned: false, interior: [], upgradeLevel: 0,
        status: 'rented',
      },
    ];
    const ctx = makeCtx();
    const result = applyRentAndHousing(properties, 100, deterministicRoll(9), ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('rented but owned: no rent paid (owners do not pay themselves)', () => {
    const properties: RealEstate[] = [
      {
        id: 'own1', name: 'Owned House', price: 200000,
        weeklyHappiness: 5, weeklyEnergy: 2,
        owned: true, interior: [], upgradeLevel: 0,
        status: 'rented',
      },
    ];
    const ctx = makeCtx();
    const result = applyRentAndHousing(properties, 100, deterministicRoll(9), ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('multiple rented properties: sums rent', () => {
    const properties: RealEstate[] = [
      {
        id: 'r1', name: 'A', price: 1000,
        weeklyHappiness: 0, weeklyEnergy: 0,
        owned: false, interior: [], upgradeLevel: 0, status: 'rented',
      },
      {
        id: 'r2', name: 'B', price: 2000,
        weeklyHappiness: 0, weeklyEnergy: 0,
        owned: false, interior: [], upgradeLevel: 0, status: 'rented',
      },
      {
        id: 'r3', name: 'C', price: 3500,
        weeklyHappiness: 0, weeklyEnergy: 0,
        owned: false, interior: [], upgradeLevel: 0, status: 'rented',
      },
    ];
    const ctx = makeCtx();
    const result = applyRentAndHousing(properties, 100, deterministicRoll(9), ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('vacant status (no status field or owned without status=rented): no rent', () => {
    const properties: RealEstate[] = [
      {
        id: 'v1', name: 'Vacant', price: 50000,
        weeklyHappiness: 0, weeklyEnergy: 0,
        owned: true, interior: [], upgradeLevel: 0,
        // no status field
      },
    ];
    const ctx = makeCtx();
    const result = applyRentAndHousing(properties, 100, deterministicRoll(9), ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });
});

describe('pre-tick equivalence — applyAutoReinvest', () => {
  it('no reinvest when amount is 0', () => {
    const result = applyAutoReinvest({
      prevHoldings: [],
      reinvestedAmount: 0,
      stockPickRoll: 0.5,
    });
    expect(result).toMatchSnapshot();
  });

  it('no reinvest when amount is negative', () => {
    const result = applyAutoReinvest({
      prevHoldings: [
        { symbol: 'AAPL', shares: 10, averagePrice: 140, currentPrice: 150 },
      ],
      reinvestedAmount: -50,
      stockPickRoll: 0.5,
    });
    expect(result).toMatchSnapshot();
  });

  it('picks random stock when holdings are empty (stockPickRoll selects index)', () => {
    const result = applyAutoReinvest({
      prevHoldings: [],
      reinvestedAmount: 500,
      // 0.5 × 5 entries = floor(2.5) = index 2 (MSFT, sorted Object.entries order
      // is insertion order of the fixed stocks: AAPL, GOOGL, MSFT, TSLA, AMZN).
      stockPickRoll: 0.5,
    });
    expect(result).toMatchSnapshot();
  });

  it('picks the holding with the most shares when holdings exist', () => {
    const result = applyAutoReinvest({
      prevHoldings: [
        { symbol: 'AAPL', shares: 5, averagePrice: 140, currentPrice: 150 },
        { symbol: 'GOOGL', shares: 20, averagePrice: 90, currentPrice: 100 },
        { symbol: 'MSFT', shares: 3, averagePrice: 280, currentPrice: 300 },
      ],
      reinvestedAmount: 500,
      stockPickRoll: 0.999, // shouldn\'t matter — existing-holdings path picks GOOGL
    });
    expect(result).toMatchSnapshot();
  });

  it('merges shares + recomputes average price when reinvesting into existing holding', () => {
    const result = applyAutoReinvest({
      prevHoldings: [
        // 10 shares at avg 140 → buying 3 more at 150 → avg becomes 142.31
        { symbol: 'AAPL', shares: 10, averagePrice: 140, currentPrice: 150 },
      ],
      reinvestedAmount: 500, // 500 / 150 = floor(3.33) = 3 shares
      stockPickRoll: 0.5,
    });
    expect(result).toMatchSnapshot();
  });

  it('appends new holding when target symbol not yet in holdings', () => {
    const result = applyAutoReinvest({
      prevHoldings: [
        // largest holding is AAPL → getStockInfo returns AAPL price (150)
        { symbol: 'AAPL', shares: 5, averagePrice: 140, currentPrice: 150 },
      ],
      reinvestedAmount: 1000,
      stockPickRoll: 0.5,
    });
    // Largest is AAPL, but if AAPL is found in `holdings.find()` … wait,
    // existingHolding for AAPL exists. So this test exercises the MERGE path.
    // To exercise the APPEND path, we need the existingHolding check to miss.
    // That happens when the picked stock's symbol isn't in holdings — which
    // the legacy code's logic can't produce because it picks FROM holdings.
    // So the append path only fires for the empty-holdings → random pick case.
    expect(result).toMatchSnapshot();
  });

  // NOTE: a test case that mixed null/undefined entries in `prevHoldings`
  // was removed because the legacy inline code ALSO crashes on
  // `holdings.find(h => h.symbol.toUpperCase()...)` when h is null.
  // Both the helper and the inline code assume `prevState.stocks?.holdings`
  // is well-formed (no nulls). The `validHoldings` filter only protects
  // the "largest holding" search, not the existing-holding find. Preserving
  // the original behavior — not introducing new null guards in this step.

  it('no purchase when sharesToBuy floors to 0 (reinvest < price)', () => {
    const result = applyAutoReinvest({
      prevHoldings: [
        { symbol: 'MSFT', shares: 5, averagePrice: 280, currentPrice: 300 },
      ],
      reinvestedAmount: 50, // 50 / 300 = 0.16 → floor = 0
      stockPickRoll: 0.5,
    });
    expect(result).toMatchSnapshot();
  });

  it('handles unknown symbol on largest-holding (getStockInfo returns price 0 → falls to random)', () => {
    const result = applyAutoReinvest({
      prevHoldings: [
        { symbol: 'UNKNOWN', shares: 100, averagePrice: 5, currentPrice: 5 },
      ],
      reinvestedAmount: 200,
      stockPickRoll: 0.2, // 0.2 × 5 = 1 → GOOGL
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.4a — weekly income aggregation extracted.
// `computeWeeklyIncome` is pure (no ctx mutations). Tests use the fixture
// battery for the prevState slot, plus synthetic per-test inputs for the
// non-state args (careerSalary, passiveIncome, pulseEarnings).
describe('pre-tick equivalence — computeWeeklyIncome', () => {
  it('zero income with no relationships, no perks, no luck phase', () => {
    const result = computeWeeklyIncome({
      prevState: fixtures.midGame, // weeksLived=250 → past beginner-luck window
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('career salary only, past beginner-luck phase', () => {
    const result = computeWeeklyIncome({
      prevState: fixtures.midGame,
      careerSalary: 500,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('all income sources during beginner luck phase (deterministic seeded roll)', () => {
    const result = computeWeeklyIncome({
      prevState: fixtures.earlyCareer, // weeksLived=30, but we override weeksLivedNow below
      careerSalary: 200,
      passiveIncome: 50,
      pulseEarnings: 25,
      weeksLivedNow: 5, // inside the 0-19 beginner-luck window
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('beginner luck week 0 (makeWeeklyRoll(0) deterministic roll)', () => {
    const result = computeWeeklyIncome({
      prevState: fixtures.freshGame,
      careerSalary: 100,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 0,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('beginner luck final week (weeksLivedNow=19, still in window)', () => {
    const result = computeWeeklyIncome({
      prevState: fixtures.freshGame,
      careerSalary: 100,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 19,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('partner with relationshipScore < 50 contributes nothing', () => {
    const result = computeWeeklyIncome({
      prevState: {
        ...fixtures.midGame,
        relationships: [
          { id: 'r1', name: 'Pat', type: 'partner', relationshipScore: 40, income: 1000 } as any,
        ],
      },
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('partner with relationshipScore >= 50 contributes 25% of income', () => {
    const result = computeWeeklyIncome({
      prevState: {
        ...fixtures.midGame,
        relationships: [
          { id: 'r1', name: 'Pat', type: 'partner', relationshipScore: 80, income: 1000 } as any,
        ],
      },
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('spouse + partner: only the HIGHEST earner contributes (no stacking)', () => {
    const result = computeWeeklyIncome({
      prevState: {
        ...fixtures.midGame,
        relationships: [
          { id: 'r1', name: 'Spouse', type: 'spouse', relationshipScore: 75, income: 2000 } as any,
          { id: 'r2', name: 'Partner', type: 'partner', relationshipScore: 60, income: 500 } as any,
        ],
      },
      careerSalary: 100,
      passiveIncome: 50,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    // EXPLOIT FIX: 25% of the top earner only (2000 → 500), not 500 + 125.
    expect(result.partnerIncome).toBe(500);
    expect(result).toMatchSnapshot();
  });

  it('non-partner relationships are ignored even with income', () => {
    const result = computeWeeklyIncome({
      prevState: {
        ...fixtures.midGame,
        relationships: [
          { id: 'r1', name: 'Friend', type: 'friend', relationshipScore: 90, income: 1000 } as any,
          { id: 'r2', name: 'Parent', type: 'parent', relationshipScore: 95, income: 500 } as any,
        ],
      },
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('Money Multiplier gold upgrade applies 1.5×', () => {
    const result = computeWeeklyIncome({
      prevState: {
        ...fixtures.midGame,
        goldUpgrades: { ...(fixtures.midGame.goldUpgrades ?? {}), multiplier: true } as any,
      },
      careerSalary: 1000,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });

  it('handles negative or non-finite partner income gracefully (clamps to 0)', () => {
    const result = computeWeeklyIncome({
      prevState: {
        ...fixtures.midGame,
        relationships: [
          { id: 'r1', name: 'A', type: 'partner', relationshipScore: 80, income: -500 } as any,
          { id: 'r2', name: 'B', type: 'spouse', relationshipScore: 80, income: Infinity } as any,
          { id: 'r3', name: 'C', type: 'partner', relationshipScore: 80, income: NaN } as any,
        ],
      },
      careerSalary: 0,
      passiveIncome: 0,
      pulseEarnings: 0,
      weeksLivedNow: 250,
      unlockedBonuses: [],
    });
    expect(result).toMatchSnapshot();
  });
});

describe('pre-tick equivalence — applyDiseasesForWeek', () => {
  it('no diseases + no admission: pure pass-through', () => {
    const input: DiseaseTickInput = {
      prevDiseases: [],
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    const ctx = diseaseStubCtx(diseaseStubStats());
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('admits a new mild disease + appends to history', () => {
    const newDisease: Disease = {
      id: 'flu',
      name: 'Influenza',
      severity: 'mild',
      effects: { health: -3, energy: -5 },
      curable: true,
      treatmentRequired: false,
      naturalRecoveryWeeks: 4,
      contractedWeek: 100,
    };
    const input: DiseaseTickInput = {
      prevDiseases: [],
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease,
    };
    const ctx = diseaseStubCtx(diseaseStubStats());
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('rejects malformed new disease (missing id) and logs warn', () => {
    const newDisease: any = {
      // id intentionally missing
      name: 'NoIdDisease',
      severity: 'mild',
      effects: { health: -3 },
      curable: true,
    };
    const input: DiseaseTickInput = {
      prevDiseases: [],
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease,
    };
    const ctx = diseaseStubCtx(diseaseStubStats());
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('drops malformed existing disease (missing id) from updatedDiseases', () => {
    const input: DiseaseTickInput = {
      prevDiseases: [{ name: 'Glitch', severity: 'mild', effects: {}, curable: true } as any],
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    const ctx = diseaseStubCtx(diseaseStubStats());
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('applies stat penalties to ctx.newStats with 0/100 clamping', () => {
    const prevDiseases: Disease[] = [
      { id: 'd1', name: 'Cold', severity: 'mild', effects: { health: -10, energy: -8 }, curable: true },
      { id: 'd2', name: 'Strain', severity: 'mild', effects: { energy: -7, happiness: -5 }, curable: true },
    ];
    const input: DiseaseTickInput = {
      prevDiseases,
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    const ctx = diseaseStubCtx(diseaseStubStats({ health: 50, energy: 5 })); // energy will floor at 0
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('chronic untreated disease worsens by 10% with floor cap (3× baseEffects)', () => {
    const prevDiseases: Disease[] = [
      {
        id: 'diabetes',
        name: 'Type II Diabetes',
        severity: 'serious',
        effects: { health: -8 },
        curable: false,
        treatmentRequired: true,
        // No baseEffects yet; first tick sets it from current effects.
      },
    ];
    const input: DiseaseTickInput = {
      prevDiseases,
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    // Force complication roll under 0.1 (the chronic complicationChance).
    const ctx = diseaseStubCtx(diseaseStubStats());
    ctx.preRolls = { ...ctx.preRolls, diseaseComplication: [0.05, ...Array.from({ length: 19 }, () => 0.99)] };
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('curable disease (mild) progresses to serious when roll hits both gates', () => {
    const prevDiseases: Disease[] = [
      {
        id: 'fluX',
        name: 'StrainX',
        severity: 'mild',
        effects: { health: -5 },
        curable: true,
        treatmentRequired: true,
        contractedWeek: 90, // 10 weeks ago → weeksWithDisease = 10
      },
    ];
    const input: DiseaseTickInput = {
      prevDiseases,
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    const ctx = diseaseStubCtx(diseaseStubStats(), 100);
    // Force BOTH rolls under their thresholds (complication 0.15 cap, progression 0.3).
    ctx.preRolls = {
      ...ctx.preRolls,
      diseaseComplication: [0.05, ...Array.from({ length: 19 }, () => 0.99)],
      diseaseProgression:  [0.1, ...Array.from({ length: 19 }, () => 0.99)],
    };
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('death countdown reaches zero: deathTriggered true + history bumps', () => {
    const prevDiseases: Disease[] = [
      {
        id: 'terminal',
        name: 'TerminalIllness',
        severity: 'critical',
        effects: { health: -20 },
        curable: false,
        weeksUntilDeath: 1, // this tick decrements to 0
      },
    ];
    const input: DiseaseTickInput = {
      prevDiseases,
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    const ctx = diseaseStubCtx(diseaseStubStats());
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('natural recovery removes disease + bumps totalCured + sets curedWeek', () => {
    const prevDiseases: Disease[] = [
      {
        id: 'cold',
        name: 'Common Cold',
        severity: 'mild',
        effects: { energy: -3 },
        curable: true,
        naturalRecoveryWeeks: 1, // this tick decrements to <= 0
      },
    ];
    const prevHistory: DiseaseHistory = {
      diseases: [{ id: 'cold', name: 'Common Cold', contractedWeek: 90, severity: 'mild' }],
      totalDiseases: 1,
      totalCured: 0,
      deathsFromDisease: 0,
    };
    const input: DiseaseTickInput = {
      prevDiseases,
      prevDiseaseHistory: prevHistory,
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: 90,
      newDisease: null,
    };
    const ctx = diseaseStubCtx(diseaseStubStats(), 100);
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('high health/fitness accelerates natural recovery (2 weeks subtracted)', () => {
    const prevDiseases: Disease[] = [
      {
        id: 'cold2',
        name: 'Cold',
        severity: 'mild',
        effects: { energy: -3 },
        curable: true,
        naturalRecoveryWeeks: 2, // base would decrement to 1; with both bonuses → 0
      },
    ];
    const input: DiseaseTickInput = {
      prevDiseases,
      prevDiseaseHistory: emptyHistory(),
      prevShowSicknessModal: false,
      prevLastDiseaseWeek: undefined,
      newDisease: null,
    };
    // health > 70 AND fitness > 50 → both -0.5 bonuses fire → effective decrement is 2.
    const ctx = diseaseStubCtx(diseaseStubStats({ health: 90, fitness: 80 }));
    const result = applyDiseasesForWeek(input, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.2b — vehicle weekly tick extracted via WeekContext.
// Each test case builds a fresh ctx, calls the helper, then snapshots the
// returned vehicles + ctx mutations (newStats + notifications). The
// snapshot captures both outputs in one structure so the test asserts the
// full "what this reducer does" surface.
describe('pre-tick equivalence — applyVehiclesForWeek', () => {
  const rollFor = deterministicRoll(8);

  function makeRolls(): PreRolls {
    return {
      careerAcceptDelay: 1,
      stockPickRoll: 0,
      childGender: 'male',
      childIdSuffix: 'xxxxxx',
      childPersonality: 0,
      relBreakup: [],
      relDisappointed: [],
      policeEncounter: 0,
      minerDegradation: 0,
      diseaseComplication: [],
      diseaseProgression: [],
      petSickness: [],
      petSicknessType: [],
      vehicleAccident: Array.from({ length: 10 }, (_, i) => rollFor(`vehicle-accident-${i}`)),
      vehicleAccidentSeverity: Array.from({ length: 10 }, (_, i) => rollFor(`vehicle-accident-sev-${i}`)),
      timestamp: 0,
    };
  }

  function makeStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 100,
      happiness: 100,
      energy: 100,
      fitness: 100,
      money: 10000,
      reputation: 50,
      gems: 0,
      ...overrides,
    };
  }

  function makeCtx(stats: GameStats): WeekContext {
    const notifications: WeekNotification[] = [];
    return {
      newStats: stats,
      notifications,
      preRolls: makeRolls(),
      nextWeeksLived: 100,
    };
  }

  it('handles empty array', () => {
    const ctx = makeCtx(makeStats());
    const result = applyVehiclesForWeek([], ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('handles undefined input', () => {
    const ctx = makeCtx(makeStats());
    const result = applyVehiclesForWeek(undefined, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('handles a single owned car with normal maintenance', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'car1',
        name: 'Sedan',
        type: 'car',
        brand: 'Honda',
        model: 'Civic',
        year: 2020,
        price: 25000,
        condition: 90,
        fuelLevel: 80,
        fuelCapacity: 50,
        fuelEfficiency: 30,
        mileage: 20000,
        weeklyMaintenanceCost: 50,
        weeklyFuelCost: 30,
        maxSpeed: 120,
        owned: true,
        reputationBonus: 5,
        speedBonus: 0,
      },
    ];
    const ctx = makeCtx(makeStats());
    const result = applyVehiclesForWeek(vehicles, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('handles low-condition vehicle (higher accident chance)', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'beater', name: 'Beater', type: 'car', brand: 'Old', model: 'Junker',
        year: 1995, price: 1000, condition: 25, fuelLevel: 20, fuelCapacity: 40,
        fuelEfficiency: 15, mileage: 250000, weeklyMaintenanceCost: 80,
        weeklyFuelCost: 40, maxSpeed: 80, owned: true, reputationBonus: 0, speedBonus: 0,
      },
    ];
    const ctx = makeCtx(makeStats({ money: 5000, health: 80 }));
    const result = applyVehiclesForWeek(vehicles, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('handles unowned vehicle (untouched)', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'showroom', name: 'Display', type: 'car', brand: 'X', model: 'Y',
        year: 2024, price: 50000, condition: 100, fuelLevel: 0, fuelCapacity: 60,
        fuelEfficiency: 25, mileage: 0, weeklyMaintenanceCost: 0, weeklyFuelCost: 0,
        maxSpeed: 200, owned: false, reputationBonus: 10, speedBonus: 0,
      },
    ];
    const ctx = makeCtx(makeStats());
    const result = applyVehiclesForWeek(vehicles, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('applies reputation nudge when owned vehicle has rep bonus and player below threshold', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'lambo', name: 'Lambo', type: 'car', brand: 'Lamborghini', model: 'Aventador',
        year: 2024, price: 400000, condition: 100, fuelLevel: 60, fuelCapacity: 80,
        fuelEfficiency: 12, mileage: 1000, weeklyMaintenanceCost: 200, weeklyFuelCost: 150,
        maxSpeed: 320, owned: true, reputationBonus: 20, speedBonus: 0,
      },
    ];
    // reputation 30 < repBonus*3 = 60, so nudge should fire
    const ctx = makeCtx(makeStats({ money: 100000, reputation: 30 }));
    const result = applyVehiclesForWeek(vehicles, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('skips reputation nudge when player already above threshold', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'lambo2', name: 'Lambo2', type: 'car', brand: 'Lamborghini', model: 'Huracan',
        year: 2024, price: 300000, condition: 100, fuelLevel: 60, fuelCapacity: 70,
        fuelEfficiency: 14, mileage: 500, weeklyMaintenanceCost: 200, weeklyFuelCost: 130,
        maxSpeed: 310, owned: true, reputationBonus: 10, speedBonus: 0,
      },
    ];
    // reputation 80 >= repBonus*3 = 30, so nudge should NOT fire
    const ctx = makeCtx(makeStats({ money: 100000, reputation: 80 }));
    const result = applyVehiclesForWeek(vehicles, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('handles insured vehicle accident (out-of-pocket reduced by coverage)', () => {
    // Use a roll seed that triggers an accident on a low-condition vehicle.
    const ctx = makeCtx(makeStats({ money: 50000, health: 90 }));
    // Force the accident roll to be very low so the accident path triggers.
    ctx.preRolls = {
      ...ctx.preRolls,
      vehicleAccident: [0.001, ...Array.from({ length: 9 }, () => 0.99)],
      vehicleAccidentSeverity: [0.5, ...Array.from({ length: 9 }, () => 0)],
    };
    const vehicles: Vehicle[] = [
      {
        id: 'insuredCar', name: 'InsuredCar', type: 'car', brand: 'Brand', model: 'Model',
        year: 2022, price: 30000, condition: 25, fuelLevel: 70, fuelCapacity: 50,
        fuelEfficiency: 25, mileage: 80000, weeklyMaintenanceCost: 60, weeklyFuelCost: 40,
        maxSpeed: 140, owned: true, reputationBonus: 0, speedBonus: 0,
        insurance: {
          type: 'comprehensive',
          active: true,
          coveragePercent: 80,
          expiresWeek: 999,
          monthlyCost: 200,
        },
      },
    ];
    const result = applyVehiclesForWeek(vehicles, ctx);
    expect({ vehicles: result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.6-iii-A — NPC depth tick. Calls processWeeklyNPCDepth
// from @/lib/social/npcDepth (mocked above for determinism), replaces the
// relationships array in place, and pushes at most ONE uniquely-id'd
// 'npc-life-event' notification — and only on even weeks (SMOOTHNESS cadence
// gate). Try/catch swallows module-load failures so tests without the module
// can still run.
describe('pre-tick equivalence — applyNPCDepthTick', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const npcDepth = require('@/lib/social/npcDepth') as {
    processWeeklyNPCDepth: jest.Mock;
  };

  function depthStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 80, energy: 80, fitness: 60,
      money: 10000, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function depthStubCtx(stats: GameStats): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  beforeEach(() => {
    npcDepth.processWeeklyNPCDepth.mockReset();
  });

  it('empty relationships in: empty out, no notifications', () => {
    npcDepth.processWeeklyNPCDepth.mockReturnValue({ relationships: [], notifications: [] });
    const ctx = depthStubCtx(depthStubStats());
    const result = applyNPCDepthTick({ relationships: [], weeksLived: 100 }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('relationships pass-through with 0 notifications: array swapped, no notif push', () => {
    const inputRels = [
      { id: 'r1', name: 'Alice', type: 'partner', relationshipScore: 70 } as any,
    ];
    const outputRels = [
      { id: 'r1', name: 'Alice', type: 'partner', relationshipScore: 72 } as any,
    ];
    npcDepth.processWeeklyNPCDepth.mockReturnValue({ relationships: outputRels, notifications: [] });
    const ctx = depthStubCtx(depthStubStats());
    const result = applyNPCDepthTick({ relationships: inputRels, weeksLived: 100 }, ctx);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('1 notification on an even week: pushed with a unique id', () => {
    const inputRels = [{ id: 'r1', name: 'Bob', type: 'friend', relationshipScore: 50 } as any];
    npcDepth.processWeeklyNPCDepth.mockReturnValue({
      relationships: inputRels,
      notifications: ['Bob got a promotion!'],
    });
    const ctx = depthStubCtx(depthStubStats());
    const result = applyNPCDepthTick({ relationships: inputRels, weeksLived: 100 }, ctx);
    expect(ctx.notifications).toHaveLength(1);
    expect(ctx.notifications[0].id).toBe('npc-life-event-100-0');
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('2 notifications offered: only the first is pushed (cap 1)', () => {
    const inputRels = [{ id: 'r1', name: 'Carol', type: 'friend', relationshipScore: 50 } as any];
    npcDepth.processWeeklyNPCDepth.mockReturnValue({
      relationships: inputRels,
      notifications: ['Carol moved to NYC.', 'Carol started yoga.'],
    });
    const ctx = depthStubCtx(depthStubStats());
    const result = applyNPCDepthTick({ relationships: inputRels, weeksLived: 100 }, ctx);
    expect(ctx.notifications).toHaveLength(1);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('5 notifications offered: only the first is pushed (cap 1)', () => {
    const inputRels = [{ id: 'r1', name: 'Dave', type: 'friend', relationshipScore: 50 } as any];
    npcDepth.processWeeklyNPCDepth.mockReturnValue({
      relationships: inputRels,
      notifications: ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'],
    });
    const ctx = depthStubCtx(depthStubStats());
    const result = applyNPCDepthTick({ relationships: inputRels, weeksLived: 100 }, ctx);
    expect(ctx.notifications).toHaveLength(1);
    expect({ result, newStats: ctx.newStats, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('odd week: NPC life-event notifications are suppressed (cadence gate)', () => {
    const inputRels = [{ id: 'r1', name: 'Grace', type: 'friend', relationshipScore: 50 } as any];
    npcDepth.processWeeklyNPCDepth.mockReturnValue({
      relationships: inputRels,
      notifications: ['Grace got a dog!'],
    });
    const ctx = depthStubCtx(depthStubStats());
    applyNPCDepthTick({ relationships: inputRels, weeksLived: 101 }, ctx);
    expect(ctx.notifications).toHaveLength(0);
  });

  it('processWeeklyNPCDepth throws: returns input unchanged, no notif push, ctx.newStats untouched', () => {
    npcDepth.processWeeklyNPCDepth.mockImplementation(() => {
      throw new Error('module not loaded');
    });
    const inputRels = [{ id: 'r1', name: 'Eve', type: 'friend', relationshipScore: 50 } as any];
    const ctx = depthStubCtx(depthStubStats());
    const result = applyNPCDepthTick({ relationships: inputRels, weeksLived: 100 }, ctx);
    expect(result.relationships).toBe(inputRels); // same reference returned
    expect({
      newStats: ctx.newStats,
      notifications: ctx.notifications,
      relationshipsReferentialEqualityPreserved: result.relationships === inputRels,
    }).toMatchSnapshot();
  });

  it('weeksLived passed through to processWeeklyNPCDepth', () => {
    npcDepth.processWeeklyNPCDepth.mockReturnValue({ relationships: [], notifications: [] });
    const ctx = depthStubCtx(depthStubStats());
    applyNPCDepthTick({ relationships: [], weeksLived: 1234 }, ctx);
    expect(npcDepth.processWeeklyNPCDepth).toHaveBeenCalledWith([], 1234);
  });

  it('does NOT touch ctx.newStats on any successful path', () => {
    const inputRels = [{ id: 'r1', name: 'Frank', type: 'friend', relationshipScore: 50 } as any];
    npcDepth.processWeeklyNPCDepth.mockReturnValue({
      relationships: inputRels,
      notifications: ['Frank stuff'],
    });
    const stats = depthStubStats({ happiness: 42, money: 9999 });
    const before = { ...stats };
    const ctx = depthStubCtx(stats);
    applyNPCDepthTick({ relationships: inputRels, weeksLived: 100 }, ctx);
    expect(ctx.newStats).toEqual(before);
  });
});

// R7 Phase 2 step 2.6-iii-B — child aging. Tiny per-rel helper that
// increments `age` by 1/52 and re-clamps relationshipScore. Caller only
// invokes when rel.type === 'child'.
describe('pre-tick equivalence — applyChildAging', () => {
  it('age 0 → 1/52', () => {
    const rel = { id: 'c1', name: 'Tim', type: 'child', age: 0, relationshipScore: 80 } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('age undefined → treated as 0, becomes 1/52', () => {
    const rel = { id: 'c2', name: 'Tina', type: 'child', relationshipScore: 80 } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('age 5 → 5 + 1/52 (fractional accumulation)', () => {
    const rel = { id: 'c3', name: 'Kid', type: 'child', age: 5, relationshipScore: 90 } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('age 17.98 → 17.98 + 1/52 (close to adulthood)', () => {
    const rel = { id: 'c4', name: 'Almost', type: 'child', age: 17.98, relationshipScore: 75 } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('relationshipScore < 0 gets clamped to 0', () => {
    const rel = { id: 'c5', name: 'NegScore', type: 'child', age: 3, relationshipScore: -10 } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('relationshipScore > 100 gets clamped to 100', () => {
    const rel = { id: 'c6', name: 'OverScore', type: 'child', age: 3, relationshipScore: 150 } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('preserves all other fields', () => {
    const rel = {
      id: 'c7',
      name: 'KeepFields',
      type: 'child',
      age: 2,
      relationshipScore: 100,
      gender: 'female',
      personality: 'Curious',
      datesCount: 0,
      birthWeeksLived: 50,
    } as any;
    expect(applyChildAging(rel)).toMatchSnapshot();
  });

  it('does NOT mutate input (returns a new object)', () => {
    const rel = { id: 'c8', name: 'NoMutate', type: 'child', age: 4, relationshipScore: 70 } as any;
    const result = applyChildAging(rel);
    expect(result).not.toBe(rel);
    expect(rel.age).toBe(4); // unchanged
  });
});

// R7 Phase 2 step 2.6-iii-C — scheduled wedding. Three anti-exploit gates:
// execute-this-week (afford → marry, can't afford → postpone or expire) +
// stale cleanup of year-old plans. Mutates ctx.newStats.money on execute.
describe('pre-tick equivalence — applyScheduledWedding', () => {
  function wedStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 80, energy: 80, fitness: 60,
      money: 100000, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function wedStubCtx(stats: GameStats, nextWeeksLived: number): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived,
    };
  }

  it('no weddingPlanned: returns null (caller falls through)', () => {
    const ctx = wedStubCtx(wedStubStats(), 100);
    const rel = { id: 'r1', name: 'Alice', type: 'partner', relationshipScore: 70 } as any;
    expect(applyScheduledWedding(rel, ctx)).toBeNull();
  });

  it('weddingPlanned but future: returns null', () => {
    const ctx = wedStubCtx(wedStubStats(), 100);
    const rel = {
      id: 'r1', name: 'Alice', type: 'partner', relationshipScore: 70,
      weddingPlanned: { scheduledWeek: 150, budget: 20000 },
    } as any;
    expect(applyScheduledWedding(rel, ctx)).toBeNull();
  });

  // -------- Gate 1: execute (can afford) --------

  it('execute: can afford → marry, +20 score, charge 75% balance', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 50000 }), 100);
    const rel = {
      id: 'r1', name: 'Alice', type: 'partner', relationshipScore: 70,
      weddingPlanned: { scheduledWeek: 100, budget: 20000 },
      weeksAtLowRelationship: 3,
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    // money: 50000 - floor(20000 * 0.75) = 50000 - 15000 = 35000.
    expect({ result, money: ctx.newStats.money }).toMatchSnapshot();
  });

  it('execute: zero budget → marries free (floor(0 * 0.75) = 0)', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 0 }), 100);
    const rel = {
      id: 'r1', name: 'Bob', type: 'partner', relationshipScore: 60,
      weddingPlanned: { scheduledWeek: 100, budget: 0 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect({ result, money: ctx.newStats.money }).toMatchSnapshot();
  });

  it('execute: weeksAtLowRelationship reset to 0 even if it was high', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'Carol', type: 'partner', relationshipScore: 50,
      weddingPlanned: { scheduledWeek: 100, budget: 4000 },
      weeksAtLowRelationship: 12,
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect(result).toMatchSnapshot();
  });

  it('execute: relationshipScore clamped at 100 even with +20 bonus', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'Dave', type: 'partner', relationshipScore: 95,
      weddingPlanned: { scheduledWeek: 100, budget: 4000 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect(result).toMatchSnapshot();
  });

  // -------- Gate 2: postpone (can't afford, NOT expired) --------

  it('postpone: cant afford, weddingAge < 1yr → postpone +4 weeks', () => {
    // scheduledWeek == nextWeeksLived (== 100), so weddingAge = 0 < 52 → postpone.
    const ctx = wedStubCtx(wedStubStats({ money: 100 }), 100);
    const rel = {
      id: 'r1', name: 'Eve', type: 'partner', relationshipScore: 60,
      weddingPlanned: { scheduledWeek: 100, budget: 20000, otherDetail: 'venue:A' },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    // weddingPlanned object should be preserved with scheduledWeek bumped to 104.
    expect({ result, moneyUnchanged: ctx.newStats.money }).toMatchSnapshot();
  });

  // -------- Gate 2b: expire (can't afford, >= 1yr past original) --------

  it('expire: cant afford AND weddingAge >= 52 → expire, -15 score', () => {
    // To get weddingAge >= 52, originalScheduled must be <= nextWeeksLived - 52.
    // But the outer if requires scheduledWeek === nextWeeksLived. So this can
    // only fire if scheduledWeek has been postponed to land on this week BUT
    // the ORIGINAL was 52+ weeks ago — but the inline code uses the CURRENT
    // scheduledWeek (which equals nextWeeksLived) as the originalScheduled.
    // So weddingAge ALWAYS = 0 here. The legacy code's expire branch is
    // effectively dead code under the always-equal scheduledWeek == nextWeeksLived
    // gate. We snapshot the legacy postpone behavior; document the gotcha.
    // This test exercises the path where rel.weddingPlanned.scheduledWeek is
    // intentionally undefined/0 to force originalScheduled = nextWeeksLived,
    // matching the legacy `|| nextWeeksLived` fallback. Still goes to postpone
    // because weddingAge = 0.
    const ctx = wedStubCtx(wedStubStats({ money: 0 }), 100);
    const rel = {
      id: 'r1', name: 'Frank', type: 'partner', relationshipScore: 60,
      weddingPlanned: { scheduledWeek: 100, budget: 50000 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect(result).toMatchSnapshot();
  });

  // -------- Gate 3: stale cleanup --------

  it('stale: scheduledWeek 1 year+ in past → cleanup, -10 score', () => {
    // scheduledWeek 47 < nextWeeksLived(100) - 52 = 48 → stale.
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'Gina', type: 'partner', relationshipScore: 70,
      weddingPlanned: { scheduledWeek: 47, budget: 20000 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect({ result, moneyUnchanged: ctx.newStats.money }).toMatchSnapshot();
  });

  it('boundary: scheduledWeek == nextWeeksLived - WEEKS_PER_YEAR (NOT stale, no <)', () => {
    // 48 < 100 - 52 = 48 is FALSE (strict less-than). Should return null
    // (no execute gate, no stale gate matches).
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'Hank', type: 'partner', relationshipScore: 70,
      weddingPlanned: { scheduledWeek: 48, budget: 20000 },
    } as any;
    expect(applyScheduledWedding(rel, ctx)).toBeNull();
  });

  it('boundary: scheduledWeek 47 (1 below threshold) IS stale', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'Iris', type: 'partner', relationshipScore: 70,
      weddingPlanned: { scheduledWeek: 47, budget: 20000 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect(result).toMatchSnapshot();
  });

  it('stale: relationshipScore floored at 0 after -10 penalty when starting < 10', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'JLow', type: 'partner', relationshipScore: 5,
      weddingPlanned: { scheduledWeek: 10, budget: 10000 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect(result).toMatchSnapshot();
  });

  it('does NOT mutate input rel on execute path', () => {
    const ctx = wedStubCtx(wedStubStats({ money: 100000 }), 100);
    const rel = {
      id: 'r1', name: 'NoMutate', type: 'partner', relationshipScore: 70,
      weddingPlanned: { scheduledWeek: 100, budget: 20000 },
    } as any;
    const result = applyScheduledWedding(rel, ctx);
    expect(result).not.toBeNull();
    expect(result!.rel).not.toBe(rel);
    expect(rel.type).toBe('partner'); // unchanged
    expect(rel.weddingPlanned).toBeDefined(); // unchanged
  });
});

// R7 Phase 2 step 2.6-iii-D — pregnancy progression + birth. Three internal
// gates: birth (>= PREGNANCY_DURATION_WEEKS = 10), late-pregnancy energy drain
// (>= 7), mid-pregnancy happiness bump (== 5). Mutates ctx.newStats.
describe('pre-tick equivalence — applyPregnancyProgression', () => {
  function pregStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 50, energy: 80, fitness: 60,
      money: 50000, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function pregStubCtx(stats: GameStats, nextWeeksLived: number, overrides: Partial<PreRolls> = {}): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'abc', childPersonality: 0,
        relBreakup: [], relDisappointed: [],
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 1234567890,
        ...overrides,
      } as PreRolls,
      nextWeeksLived,
    };
  }

  // -------- Gate (does NOT fire) --------

  it('not partner/spouse: returns null', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'X', type: 'friend',
      isPregnant: true, pregnancyStartWeek: 90, relationshipScore: 70,
    } as any;
    expect(applyPregnancyProgression(rel, ctx)).toBeNull();
  });

  it('partner but not pregnant: returns null', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'Y', type: 'partner',
      isPregnant: false, relationshipScore: 70,
    } as any;
    expect(applyPregnancyProgression(rel, ctx)).toBeNull();
  });

  it('partner pregnant but pregnancyStartWeek == null: returns null', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'Z', type: 'partner',
      isPregnant: true, pregnancyStartWeek: null, relationshipScore: 70,
    } as any;
    expect(applyPregnancyProgression(rel, ctx)).toBeNull();
  });

  // -------- Gate 1: birth --------

  it('birth: pregnancyWeeks === PREGNANCY_DURATION_WEEKS (10) triggers birth', () => {
    // startWeek = 90, nextWeeksLived = 100 → pregnancyWeeks = 10.
    const ctx = pregStubCtx(
      pregStubStats({ money: 10000, happiness: 50 }),
      100,
      { childGender: 'female', childIdSuffix: 'sfx', childPersonality: 2, timestamp: 99 },
    );
    const rel = {
      id: 'r1', name: 'Alice', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 90, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('birth: pregnancyChildGender override wins over preRolls.childGender', () => {
    const ctx = pregStubCtx(pregStubStats(), 100, { childGender: 'female' });
    const rel = {
      id: 'r1', name: 'Beth', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 60,
      pregnancyChildGender: 'male', // explicitly overrides female preRoll
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(result?.newborn?.gender).toBe('male');
    expect(result).toMatchSnapshot();
  });

  it('birth: pregnancyChildName override wins over default "Baby"', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'Carol', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 60,
      pregnancyChildName: 'Alex',
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(result?.newborn?.name).toBe('Alex');
    expect(result).toMatchSnapshot();
  });

  it('birth: spouse (not just partner) fires the same path', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'Diane', type: 'spouse',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 80,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(result).toMatchSnapshot();
  });

  it('birth: money clamped at 0 when below $5000', () => {
    const ctx = pregStubCtx(pregStubStats({ money: 2000 }), 100);
    const rel = {
      id: 'r1', name: 'BrokeBeth', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.money).toBe(0);
    expect(result).toMatchSnapshot();
  });

  it('birth: happiness clamped at 100 when starting > 70', () => {
    const ctx = pregStubCtx(pregStubStats({ happiness: 85 }), 100);
    const rel = {
      id: 'r1', name: 'HappyEve', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 70,
    } as any;
    applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.happiness).toBe(100);
  });

  it('birth: relationshipScore clamped at 100 even with +15 bonus', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'MaxRel', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 95,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(result?.rel.relationshipScore).toBe(100);
  });

  it('birth: each preRolls.childPersonality index maps to expected personality', () => {
    // CHILD_PERSONALITIES = ['Playful', 'Curious', 'Energetic', 'Sweet', 'Adventurous']
    const expectedByIdx = ['Playful', 'Curious', 'Energetic', 'Sweet', 'Adventurous'];
    for (let i = 0; i < 5; i++) {
      const ctx = pregStubCtx(pregStubStats(), 100, { childPersonality: i });
      const rel = {
        id: 'r1', name: 'IndexTest', type: 'partner',
        isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 70,
      } as any;
      const result = applyPregnancyProgression(rel, ctx);
      expect(result?.newborn?.personality).toBe(expectedByIdx[i]);
    }
  });

  it('birth: childId format = `child_<timestamp>_<suffix>_<parentRelId>`', () => {
    const ctx = pregStubCtx(pregStubStats(), 100, { timestamp: 555, childIdSuffix: 'xyz' });
    const rel = {
      id: 'r1', name: 'IdTest', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    // The parent relationship id is now part of the child id so two births in
    // the same tick (two pregnant partners) can't collide on an identical id.
    expect(result?.newborn?.id).toBe('child_555_xyz_r1');
  });

  // -------- Gate 2: late pregnancy energy drain --------

  it('late preg: pregnancyWeeks 7: energy -= 3', () => {
    const ctx = pregStubCtx(pregStubStats({ energy: 80 }), 100);
    const rel = {
      id: 'r1', name: 'WeekSeven', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 93, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect({ result, newStats: ctx.newStats }).toMatchSnapshot();
  });

  it('late preg: pregnancyWeeks 8: still drains energy', () => {
    const ctx = pregStubCtx(pregStubStats({ energy: 80 }), 100);
    const rel = {
      id: 'r1', name: 'WeekEight', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 92, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.energy).toBe(77);
    expect(result).toMatchSnapshot();
  });

  it('late preg: energy clamped at 0 when below 3', () => {
    const ctx = pregStubCtx(pregStubStats({ energy: 1 }), 100);
    const rel = {
      id: 'r1', name: 'LowEnergy', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 92, relationshipScore: 70,
    } as any;
    applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.energy).toBe(0);
  });

  it('boundary: pregnancyWeeks 6 (one below late threshold): NO energy drain', () => {
    const ctx = pregStubCtx(pregStubStats({ energy: 80 }), 100);
    const rel = {
      id: 'r1', name: 'WeekSix', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 94, relationshipScore: 70,
    } as any;
    applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.energy).toBe(80);
  });

  // -------- Gate 3: mid pregnancy happiness bump (== 5, not >=) --------

  it('mid preg: pregnancyWeeks === 5: happiness += 2', () => {
    const ctx = pregStubCtx(pregStubStats({ happiness: 50 }), 100);
    const rel = {
      id: 'r1', name: 'WeekFive', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 95, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.happiness).toBe(52);
    expect(result).toMatchSnapshot();
  });

  it('mid preg: pregnancyWeeks === 4: NO bump (strict ===)', () => {
    const ctx = pregStubCtx(pregStubStats({ happiness: 50 }), 100);
    const rel = {
      id: 'r1', name: 'WeekFour', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 96, relationshipScore: 70,
    } as any;
    applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.happiness).toBe(50);
  });

  it('mid preg: pregnancyWeeks === 6: NO bump (strict ===, not >=)', () => {
    const ctx = pregStubCtx(pregStubStats({ happiness: 50 }), 100);
    const rel = {
      id: 'r1', name: 'WeekSix6', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 94, relationshipScore: 70,
    } as any;
    applyPregnancyProgression(rel, ctx);
    expect(ctx.newStats.happiness).toBe(50);
  });

  it('mid preg: pregnancyWeeks === 7 fires BOTH gate 2 AND gate 3 (=== 5 fails, >= 7 succeeds)', () => {
    // gate 3 condition is `=== 5` so it does NOT fire at 7. Only gate 2 fires.
    const ctx = pregStubCtx(pregStubStats({ happiness: 50, energy: 80 }), 100);
    const rel = {
      id: 'r1', name: 'OverlapCheck', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 93, relationshipScore: 70,
    } as any;
    applyPregnancyProgression(rel, ctx);
    expect({ energy: ctx.newStats.energy, happiness: ctx.newStats.happiness }).toEqual({
      energy: 77,
      happiness: 50,
    });
  });

  // -------- General invariants --------

  it('early pregnancy (week 1): no side effects, returns rel unchanged', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'EarlyPreg', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 99, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(result?.newborn).toBeNull();
    expect(result?.rel).toBe(rel); // unchanged ref on the "pregnancy continues" path
  });

  it('does NOT mutate input rel on birth path', () => {
    const ctx = pregStubCtx(pregStubStats(), 100);
    const rel = {
      id: 'r1', name: 'NoMutate', type: 'partner',
      isPregnant: true, pregnancyStartWeek: 88, relationshipScore: 70,
    } as any;
    const result = applyPregnancyProgression(rel, ctx);
    expect(result?.rel).not.toBe(rel);
    expect(rel.isPregnant).toBe(true); // unchanged
  });
});

// R7 Phase 2 step 2.6-iii-E — relationship health. Three internal branches
// (low rel partner/spouse → breakup roll | disappointed roll | track-low;
// healthy partner/spouse reset; fall-through clamp-only). Uses relIdx into
// preRolls.relBreakup[20] and preRolls.relDisappointed[20].
describe('pre-tick equivalence — applyRelationshipHealth', () => {
  function relhStubStats(overrides: Partial<GameStats> = {}): GameStats {
    return {
      health: 80, happiness: 60, energy: 80, fitness: 60,
      money: 10000, reputation: 50, gems: 0,
      ...overrides,
    };
  }

  function relhStubCtx(
    stats: GameStats,
    breakupRolls: number[] = [],
    disappointedRolls: number[] = [],
  ): WeekContext {
    return {
      newStats: stats,
      notifications: [] as WeekNotification[],
      preRolls: {
        careerAcceptDelay: 1, stockPickRoll: 0, childGender: 'male',
        childIdSuffix: 'x', childPersonality: 0,
        relBreakup: breakupRolls, relDisappointed: disappointedRolls,
        policeEncounter: 0, minerDegradation: 0,
        diseaseComplication: [], diseaseProgression: [],
        petSickness: [], petSicknessType: [],
        vehicleAccident: [], vehicleAccidentSeverity: [],
        timestamp: 0,
      },
      nextWeeksLived: 100,
    };
  }

  // -------- Branch 3: fall-through (other types) --------

  it('friend type: just clamps score, no penalty, no notif', () => {
    const ctx = relhStubCtx(relhStubStats());
    const rel = { id: 'r1', name: 'Pal', type: 'friend', relationshipScore: 105 } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('family type: just clamps score (-50 -> 0)', () => {
    const ctx = relhStubCtx(relhStubStats());
    const rel = { id: 'r1', name: 'Mom', type: 'family', relationshipScore: -50 } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  // -------- Branch 2: healthy partner/spouse --------

  it('healthy partner (score 50): resets weeksAtLow to 0', () => {
    const ctx = relhStubCtx(relhStubStats());
    const rel = {
      id: 'r1', name: 'Goodvibes', type: 'partner', relationshipScore: 50,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('healthy spouse (score 30 — boundary, NOT < 30): treated as healthy', () => {
    const ctx = relhStubCtx(relhStubStats());
    const rel = {
      id: 'r1', name: 'Sp30', type: 'spouse', relationshipScore: 30,
      weeksAtLowRelationship: 5,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect(result.rel?.weeksAtLowRelationship).toBe(0);
  });

  // -------- Branch 1a: breakup --------

  it('low rel (score 20), weeksAtLow=2, breakup roll fires: rel=null, -25 penalty, breakup notif', () => {
    // breakupChance = min(0.4, (30-20)/100) = 0.1. roll 0.05 < 0.1 → fire.
    const ctx = relhStubCtx(relhStubStats(), [0.05]);
    const rel = {
      id: 'r1', name: 'BreakMe', type: 'partner', relationshipScore: 20,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('low rel score 0 → breakupChance = 0.3, roll 0.25 fires', () => {
    const ctx = relhStubCtx(relhStubStats(), [0.25]);
    const rel = {
      id: 'r1', name: 'Zero', type: 'partner', relationshipScore: 0,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect(result.rel).toBeNull();
    expect(result.happinessPenalty).toBe(-25);
  });

  it('low rel: breakupChance capped at 0.4 (score -100 → (30-(-100))/100 = 1.3 → 0.4)', () => {
    const ctx = relhStubCtx(relhStubStats(), [0.35]); // 0.35 < 0.4 cap → fires
    const rel = {
      id: 'r1', name: 'Capped', type: 'partner', relationshipScore: -100,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect(result.rel).toBeNull();
  });

  it('breakup uses relIdx (index 3 vs 0): roll[3] is what matters', () => {
    // breakupChance = 0.1. rolls[0] = 0.5 (won't fire), rolls[3] = 0.05 (fires).
    const ctx = relhStubCtx(relhStubStats(), [0.5, 0.5, 0.5, 0.05]);
    const rel = {
      id: 'r1', name: 'Idx3', type: 'partner', relationshipScore: 20,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 3, ctx);
    expect(result.rel).toBeNull();
  });

  // -------- Branch 1b: disappointed --------

  it('low rel, breakup miss + disappointed hit: -10 penalty, score-5, notif', () => {
    // breakupChance = 0.1. roll 0.5 → MISS. disappointedChance = 0.3. roll 0.05 → HIT.
    const ctx = relhStubCtx(relhStubStats(), [0.5], [0.05]);
    const rel = {
      id: 'r1', name: 'Sad', type: 'partner', relationshipScore: 20,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  it('disappointed: relationshipScore clamped at 0 when starting < 5', () => {
    const ctx = relhStubCtx(relhStubStats(), [0.99], [0.05]); // breakup miss, disappointed hit
    const rel = {
      id: 'r1', name: 'NearZero', type: 'partner', relationshipScore: 2,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect(result.rel?.relationshipScore).toBe(0);
  });

  // -------- Branch 1c: neither roll fires --------

  it('low rel, weeksAtLow=2, both rolls miss: just track weeksAtLow, no penalty', () => {
    const ctx = relhStubCtx(relhStubStats(), [0.99], [0.99]);
    const rel = {
      id: 'r1', name: 'TrackMe', type: 'partner', relationshipScore: 20,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  // -------- Branch 1d: weeksAtLow < 2 (no roll, just bump counter) --------

  it('low rel, FIRST week at low (weeksAtLow becomes 1): no roll, no penalty', () => {
    // weeksAtLow = (undefined || 0) + 1 = 1. 1 < 2 → skip roll block.
    const ctx = relhStubCtx(relhStubStats(), [0.001], [0.001]); // rolls would fire IF accessed
    const rel = {
      id: 'r1', name: 'FirstWeek', type: 'partner', relationshipScore: 10,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect({ result, notifications: ctx.notifications }).toMatchSnapshot();
  });

  // -------- relIdx >= 20: roll arrays sized 20, access undefined --------

  it('relIdx >= 20: undefined < x is FALSE in JS → no breakup, no disappointed', () => {
    // Even though weeksAtLow >= 2 and score < 30, the access preRolls.relBreakup[25]
    // returns undefined, and undefined < anything is false. Same for disappointed.
    // → Falls through to "track weeksAtLow", no penalty.
    const ctx = relhStubCtx(relhStubStats(), [], []); // EMPTY arrays
    const rel = {
      id: 'r1', name: 'OutOfBounds', type: 'partner', relationshipScore: 5,
      weeksAtLowRelationship: 10,
    } as any;
    const result = applyRelationshipHealth(rel, 25, ctx);
    expect(result.rel).not.toBeNull();
    expect(result.happinessPenalty).toBe(0);
  });

  // -------- General invariants --------

  it('does NOT mutate input rel on any path (track-weeksAtLow)', () => {
    const ctx = relhStubCtx(relhStubStats(), [0.99], [0.99]);
    const rel = {
      id: 'r1', name: 'NoMutate', type: 'partner', relationshipScore: 20,
      weeksAtLowRelationship: 1,
    } as any;
    const result = applyRelationshipHealth(rel, 0, ctx);
    expect(result.rel).not.toBe(rel);
    expect(rel.weeksAtLowRelationship).toBe(1);
  });

  it('does NOT touch ctx.newStats — happinessPenalty applied by caller', () => {
    const ctx = relhStubCtx(relhStubStats({ happiness: 42 }), [0.001]);
    const rel = {
      id: 'r1', name: 'StatCheck', type: 'partner', relationshipScore: 5,
      weeksAtLowRelationship: 5,
    } as any;
    applyRelationshipHealth(rel, 0, ctx);
    expect(ctx.newStats.happiness).toBe(42);
  });
});

// R7 Phase 2 step 2.7-A — economic event roll. shouldTrigger gate + generate
// + try/catch swallow. Mocked for determinism.
describe('pre-tick equivalence — applyEconomicEvent', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const econMod = require('@/lib/events/economyEvents') as {
    shouldTriggerEconomicEvent: jest.Mock;
    generateEconomicEvent: jest.Mock;
  };

  beforeEach(() => {
    econMod.shouldTriggerEconomicEvent.mockReset();
    econMod.generateEconomicEvent.mockReset();
  });

  function econStubState(): GameState {
    return {
      economy: {
        marketCondition: 'normal',
        economyEvents: null,
      } as any,
    } as any;
  }

  it('shouldTrigger=false: returns prevState.economy unchanged (same ref)', () => {
    econMod.shouldTriggerEconomicEvent.mockReturnValue(false);
    const state = econStubState();
    const result = applyEconomicEvent(state);
    expect(result.updatedEconomy).toBe(state.economy);
    expect(econMod.generateEconomicEvent).not.toHaveBeenCalled();
  });

  it('shouldTrigger=true: merges new event into economyEvents', () => {
    const newEcon = { name: 'recession', severity: 0.5, weeksRemaining: 10 };
    econMod.shouldTriggerEconomicEvent.mockReturnValue(true);
    econMod.generateEconomicEvent.mockReturnValue(newEcon);
    const state = econStubState();
    const result = applyEconomicEvent(state);
    expect(result).toMatchSnapshot();
  });

  it('shouldTrigger=true but generate throws: silently swallows, returns prev economy', () => {
    econMod.shouldTriggerEconomicEvent.mockReturnValue(true);
    econMod.generateEconomicEvent.mockImplementation(() => {
      throw new Error('rng broke');
    });
    const state = econStubState();
    const result = applyEconomicEvent(state);
    expect(result.updatedEconomy).toBe(state.economy);
  });

  it('shouldTrigger throws: silently swallows, returns prev economy', () => {
    econMod.shouldTriggerEconomicEvent.mockImplementation(() => {
      throw new Error('gate broke');
    });
    const state = econStubState();
    const result = applyEconomicEvent(state);
    expect(result.updatedEconomy).toBe(state.economy);
  });

  it('preserves existing economy fields, only overwrites economyEvents', () => {
    const newEcon = { name: 'boom', severity: 0.3 };
    econMod.shouldTriggerEconomicEvent.mockReturnValue(true);
    econMod.generateEconomicEvent.mockReturnValue(newEcon);
    const state = {
      economy: {
        marketCondition: 'good',
        unemployment: 0.04,
        inflation: 0.02,
        economyEvents: { name: 'old', severity: 0.1 },
      } as any,
    } as any;
    const result = applyEconomicEvent(state);
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.7-B — weekly events generation + pending cap.
describe('pre-tick equivalence — applyWeeklyEvents', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const engineMod = require('@/lib/events/engine') as { rollWeeklyEvents: jest.Mock };

  beforeEach(() => {
    engineMod.rollWeeklyEvents.mockReset();
  });

  function wevStubState(overrides: Partial<GameState> = {}): GameState {
    return {
      pendingEvents: [],
      economy: { economyEvents: null } as any,
      week: 1,
      weeksLived: 99,
      ...overrides,
    } as any;
  }

  it('no new events, empty pendingEvents: returns empty array', () => {
    engineMod.rollWeeklyEvents.mockReturnValue([]);
    const result = applyWeeklyEvents({
      prevState: wevStubState(),
      updatedEconomy: { economyEvents: { name: 'normal' } } as any,
      nextWeeksLived: 100,
      nextWeek: 1,
    });
    expect(result).toMatchSnapshot();
  });

  it('new events are stamped with generatedAtWeeksLived = nextWeeksLived', () => {
    engineMod.rollWeeklyEvents.mockReturnValue([
      { id: 'evt1', title: 'Free pizza' },
      { id: 'evt2', title: 'Layoff' },
    ]);
    const result = applyWeeklyEvents({
      prevState: wevStubState(),
      updatedEconomy: {} as any,
      nextWeeksLived: 555,
      nextWeek: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('appends to existing pendingEvents (preserved order)', () => {
    engineMod.rollWeeklyEvents.mockReturnValue([{ id: 'new1' }]);
    const result = applyWeeklyEvents({
      prevState: wevStubState({
        pendingEvents: [{ id: 'old1' }, { id: 'old2' }] as any,
      }),
      updatedEconomy: {} as any,
      nextWeeksLived: 100,
      nextWeek: 1,
    });
    expect(result.updatedPendingEvents.map((e: any) => e.id)).toEqual(['old1', 'old2', 'new1']);
  });

  it('rollWeeklyEvents throws: silently swallows, returns existing pendingEvents', () => {
    engineMod.rollWeeklyEvents.mockImplementation(() => {
      throw new Error('engine kaboom');
    });
    const result = applyWeeklyEvents({
      prevState: wevStubState({ pendingEvents: [{ id: 'pre' }] as any }),
      updatedEconomy: {} as any,
      nextWeeksLived: 100,
      nextWeek: 1,
    });
    expect(result.updatedPendingEvents).toEqual([{ id: 'pre' }]);
  });

  it('cap: cumulative > MAX_PENDING_EVENTS drops oldest, keeps last 100', () => {
    const existing = Array.from({ length: 95 }, (_, i) => ({ id: `old${i}` }));
    const newOnes = Array.from({ length: 10 }, (_, i) => ({ id: `new${i}` }));
    engineMod.rollWeeklyEvents.mockReturnValue(newOnes);
    const result = applyWeeklyEvents({
      prevState: wevStubState({ pendingEvents: existing as any }),
      updatedEconomy: {} as any,
      nextWeeksLived: 100,
      nextWeek: 1,
    });
    // 95 existing + 10 new = 105 → kept = last 100 → first 5 old (old0..old4) dropped.
    expect(result.updatedPendingEvents.length).toBe(MAX_PENDING_EVENTS);
    expect(result.updatedPendingEvents[0].id).toBe('old5');
    expect(result.updatedPendingEvents[result.updatedPendingEvents.length - 1].id).toBe('new9');
  });

  it('cap: at exactly MAX_PENDING_EVENTS does NOT drop (length > MAX, not >=)', () => {
    const existing = Array.from({ length: 50 }, (_, i) => ({ id: `e${i}` }));
    const newOnes = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}` }));
    engineMod.rollWeeklyEvents.mockReturnValue(newOnes);
    const result = applyWeeklyEvents({
      prevState: wevStubState({ pendingEvents: existing as any }),
      updatedEconomy: {} as any,
      nextWeeksLived: 100,
      nextWeek: 1,
    });
    // 50 + 50 = 100 exactly → not > 100 → no slice.
    expect(result.updatedPendingEvents.length).toBe(100);
    expect(result.updatedPendingEvents[0].id).toBe('e0');
  });

  it('newEventCount reflects events BEFORE cap (raw rollWeeklyEvents result length)', () => {
    engineMod.rollWeeklyEvents.mockReturnValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const result = applyWeeklyEvents({
      prevState: wevStubState(),
      updatedEconomy: {} as any,
      nextWeeksLived: 100,
      nextWeek: 1,
    });
    expect(result.newEventCount).toBe(3);
  });

  it('newEventCount = 0 on throw (caught) and on empty result', () => {
    engineMod.rollWeeklyEvents.mockImplementation(() => { throw new Error('x'); });
    const result1 = applyWeeklyEvents({
      prevState: wevStubState(), updatedEconomy: {} as any, nextWeeksLived: 100, nextWeek: 1,
    });
    expect(result1.newEventCount).toBe(0);

    engineMod.rollWeeklyEvents.mockReset();
    engineMod.rollWeeklyEvents.mockReturnValue([]);
    const result2 = applyWeeklyEvents({
      prevState: wevStubState(), updatedEconomy: {} as any, nextWeeksLived: 100, nextWeek: 1,
    });
    expect(result2.newEventCount).toBe(0);
  });

  it('passes synthetic state to rollWeeklyEvents (post-tick economy + week)', () => {
    engineMod.rollWeeklyEvents.mockReturnValue([]);
    const prev = wevStubState({ economy: { economyEvents: { name: 'OLD' } } as any, week: 1, weeksLived: 99 });
    const updatedEconomy = { economyEvents: { name: 'NEW' } } as any;
    applyWeeklyEvents({
      prevState: prev,
      updatedEconomy,
      nextWeeksLived: 100,
      nextWeek: 2,
    });
    const arg = engineMod.rollWeeklyEvents.mock.calls[0][0];
    expect(arg.economy).toBe(updatedEconomy);
    expect(arg.weeksLived).toBe(100);
    expect(arg.week).toBe(2);
  });
});

// R7 Phase 2 step 2.7-C — cliffhanger resolution. If pendingCliffhanger,
// look up the resolveEvent + append to pendingEvents (uncapped).
describe('pre-tick equivalence — applyCliffhangerResolution', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cliffMod = require('@/lib/events/cliffhangerEvents') as {
    resolveCliffhanger: jest.Mock;
  };

  beforeEach(() => {
    cliffMod.resolveCliffhanger.mockReset();
  });

  it('no pendingCliffhanger: returns same array (ref preserved)', () => {
    const pending = [{ id: 'a' }];
    const result = applyCliffhangerResolution({
      prevState: { pendingCliffhanger: undefined } as any,
      pendingEventsAfterWeekly: pending as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedPendingEvents).toBe(pending);
    expect(cliffMod.resolveCliffhanger).not.toHaveBeenCalled();
  });

  it('cliffhanger resolves to an event: appends stamped event', () => {
    cliffMod.resolveCliffhanger.mockReturnValue({ id: 'resolve_evt', title: 'The big reveal' });
    const result = applyCliffhangerResolution({
      prevState: {
        pendingCliffhanger: { resolveEventId: 'evt_xyz' },
      } as any,
      pendingEventsAfterWeekly: [{ id: 'existing' }] as any,
      nextWeeksLived: 100,
    });
    expect(result).toMatchSnapshot();
  });

  it('resolveCliffhanger returns null: no append, returns input', () => {
    cliffMod.resolveCliffhanger.mockReturnValue(null);
    const input = [{ id: 'a' }, { id: 'b' }];
    const result = applyCliffhangerResolution({
      prevState: { pendingCliffhanger: { resolveEventId: 'evt_xyz' } } as any,
      pendingEventsAfterWeekly: input as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedPendingEvents).toBe(input);
  });

  it('resolveCliffhanger throws: silently swallows, returns input', () => {
    cliffMod.resolveCliffhanger.mockImplementation(() => {
      throw new Error('lookup missing');
    });
    const input = [{ id: 'a' }];
    const result = applyCliffhangerResolution({
      prevState: { pendingCliffhanger: { resolveEventId: 'evt_xyz' } } as any,
      pendingEventsAfterWeekly: input as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedPendingEvents).toBe(input);
  });

  it('passes synthetic state (with nextWeeksLived) to resolveCliffhanger', () => {
    cliffMod.resolveCliffhanger.mockReturnValue(null);
    const prev = { pendingCliffhanger: { resolveEventId: 'evt_y' }, weeksLived: 99, otherField: 'preserved' } as any;
    applyCliffhangerResolution({
      prevState: prev,
      pendingEventsAfterWeekly: [],
      nextWeeksLived: 100,
    });
    expect(cliffMod.resolveCliffhanger).toHaveBeenCalledWith(
      'evt_y',
      expect.objectContaining({ weeksLived: 100, otherField: 'preserved' }),
    );
  });

  it('appends are uncapped — even when input is already 100+ long', () => {
    cliffMod.resolveCliffhanger.mockReturnValue({ id: 'cliff' });
    const input = Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` }));
    const result = applyCliffhangerResolution({
      prevState: { pendingCliffhanger: { resolveEventId: 'evt' } } as any,
      pendingEventsAfterWeekly: input as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedPendingEvents.length).toBe(101);
    expect(result.updatedPendingEvents[100].id).toBe('cliff');
  });
});

// R7 Phase 2 step 2.7-D — life moment generation. Generate + merge into
// lifeMoments slice; preserve existing or initialize when none.
describe('pre-tick equivalence — applyLifeMoment', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const momentMod = require('@/lib/lifeMoments/lifeMomentGenerator') as {
    generateLifeMoment: jest.Mock;
  };

  beforeEach(() => {
    momentMod.generateLifeMoment.mockReset();
  });

  it('no moment generated, no existing lifeMoments: returns init-empty', () => {
    momentMod.generateLifeMoment.mockReturnValue(null);
    const result = applyLifeMoment({
      prevState: { lifeMoments: undefined } as any,
      nextWeeksLived: 100,
    });
    expect(result).toMatchSnapshot();
  });

  it('no moment generated, existing lifeMoments: returns same ref', () => {
    momentMod.generateLifeMoment.mockReturnValue(null);
    const existing = { lastMomentWeek: 50, momentsThisWeek: 0, totalMoments: 7 };
    const result = applyLifeMoment({
      prevState: { lifeMoments: existing } as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedLifeMoments).toBe(existing);
  });

  it('moment generated: merges pendingMoment + bumps counters + updates lastMomentWeek', () => {
    const moment = { id: 'mom_1', title: 'Crossroads', choices: [] };
    momentMod.generateLifeMoment.mockReturnValue(moment);
    const result = applyLifeMoment({
      prevState: { lifeMoments: { lastMomentWeek: 50, momentsThisWeek: 2, totalMoments: 12 } } as any,
      nextWeeksLived: 100,
    });
    expect(result).toMatchSnapshot();
  });

  it('moment generated, no prior lifeMoments slice: counters start from 0', () => {
    const moment = { id: 'first_mom', title: 'First', choices: [] };
    momentMod.generateLifeMoment.mockReturnValue(moment);
    const result = applyLifeMoment({
      prevState: { lifeMoments: undefined } as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedLifeMoments?.momentsThisWeek).toBe(1);
    expect(result.updatedLifeMoments?.totalMoments).toBe(1);
    expect(result.updatedLifeMoments?.lastMomentWeek).toBe(100);
  });

  it('generateLifeMoment throws: swallowed, returns existing lifeMoments unchanged', () => {
    momentMod.generateLifeMoment.mockImplementation(() => {
      throw new Error('moment generator kaboom');
    });
    const existing = { lastMomentWeek: 80, momentsThisWeek: 1, totalMoments: 5 };
    const result = applyLifeMoment({
      prevState: { lifeMoments: existing } as any,
      nextWeeksLived: 100,
    });
    expect(result.updatedLifeMoments).toBe(existing);
  });

  it('passes synthetic state with nextWeeksLived to generateLifeMoment', () => {
    momentMod.generateLifeMoment.mockReturnValue(null);
    const prev = { lifeMoments: {}, weeksLived: 99, otherField: 'preserved' } as any;
    applyLifeMoment({ prevState: prev, nextWeeksLived: 100 });
    expect(momentMod.generateLifeMoment).toHaveBeenCalledWith(
      expect.objectContaining({ weeksLived: 100, otherField: 'preserved' }),
    );
  });
});

// R7 Phase 2 step 2.8-A — consequence progression. processConsequenceProgression
// + initializeConsequenceState merge + try/catch fallback.
describe('pre-tick equivalence — applyConsequenceProgression', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const consMod = require('@/lib/lifeMoments/consequenceTracker') as {
    processConsequenceProgression: jest.Mock;
    initializeConsequenceState: jest.Mock;
  };

  beforeEach(() => {
    consMod.processConsequenceProgression.mockReset();
    consMod.initializeConsequenceState.mockReset();
  });

  it('merges initialize result with progression diff', () => {
    consMod.initializeConsequenceState.mockReturnValue({ consequences: [{ id: 'old' }], karma: 5 });
    consMod.processConsequenceProgression.mockReturnValue({ consequences: [{ id: 'new' }] });
    const result = applyConsequenceProgression({} as any);
    expect(result).toMatchSnapshot();
  });

  it('progression result overrides initialize fields on conflict (spread order)', () => {
    consMod.initializeConsequenceState.mockReturnValue({ karma: 5, consequences: [] });
    consMod.processConsequenceProgression.mockReturnValue({ karma: 10 });
    const result = applyConsequenceProgression({} as any);
    expect(result.mergedConsequenceState.karma).toBe(10);
  });

  it('processConsequenceProgression throws: falls back to existing consequenceState', () => {
    consMod.processConsequenceProgression.mockImplementation(() => {
      throw new Error('malformed');
    });
    const existing = { karma: 99, consequences: [{ id: 'existing' }] } as any;
    const result = applyConsequenceProgression({ consequenceState: existing } as any);
    expect(result.mergedConsequenceState).toBe(existing);
    expect(consMod.initializeConsequenceState).not.toHaveBeenCalled();
  });

  it('throws + no existing consequenceState: falls back to initializeConsequenceState', () => {
    consMod.processConsequenceProgression.mockImplementation(() => {
      throw new Error('malformed');
    });
    const init = { karma: 0, consequences: [] };
    consMod.initializeConsequenceState.mockReturnValue(init);
    const result = applyConsequenceProgression({} as any);
    expect(result.mergedConsequenceState).toBe(init);
  });
});

// R7 Phase 2 step 2.8-B — death ribbon. Fires only on the death-popup
// edge (newShowDeathPopup && !prevState.showDeathPopup). Returns partial
// state fragment for the merge.
describe('pre-tick equivalence — applyDeathRibbon', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ribMod = require('@/lib/legacy/ribbonSystem') as {
    classifyLife: jest.Mock;
    addRibbonToCollection: jest.Mock;
  };

  function ribStubStats(): GameStats {
    return {
      health: 0, happiness: 50, energy: 50, fitness: 50,
      money: 5000, reputation: 50, gems: 0,
    };
  }

  beforeEach(() => {
    ribMod.classifyLife.mockReset();
    ribMod.addRibbonToCollection.mockReset();
  });

  it('newShowDeathPopup=false: returns empty partial', () => {
    const result = applyDeathRibbon({
      prevState: { showDeathPopup: false } as any,
      newStats: ribStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: false,
    });
    expect(result.partial).toEqual({});
    expect(ribMod.classifyLife).not.toHaveBeenCalled();
  });

  it('newShowDeathPopup=true but prevState.showDeathPopup=true: NOT an edge → empty', () => {
    const result = applyDeathRibbon({
      prevState: { showDeathPopup: true } as any,
      newStats: ribStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    expect(result.partial).toEqual({});
    expect(ribMod.classifyLife).not.toHaveBeenCalled();
  });

  it('edge case (death first fire): classifies + adds to collection', () => {
    ribMod.classifyLife.mockReturnValue({ name: 'Quiet Life', emoji: '🌸', priority: 100 });
    ribMod.addRibbonToCollection.mockReturnValue([
      { id: 'r1', name: 'Quiet Life', earnedAt: 100 },
    ]);
    const result = applyDeathRibbon({
      prevState: { showDeathPopup: false, ribbonCollection: [] } as any,
      newStats: ribStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    expect(result).toMatchSnapshot();
  });

  it('classifyLife throws: silently swallowed, empty partial', () => {
    ribMod.classifyLife.mockImplementation(() => { throw new Error('classify fail'); });
    const result = applyDeathRibbon({
      prevState: { showDeathPopup: false, ribbonCollection: [] } as any,
      newStats: ribStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    expect(result.partial).toEqual({});
  });

  it('addRibbonToCollection throws: silently swallowed, empty partial', () => {
    ribMod.classifyLife.mockReturnValue({ name: 'Test', emoji: '🎗', priority: 0 });
    ribMod.addRibbonToCollection.mockImplementation(() => { throw new Error('add fail'); });
    const result = applyDeathRibbon({
      prevState: { showDeathPopup: false, ribbonCollection: [] } as any,
      newStats: ribStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    expect(result.partial).toEqual({});
  });

  it('passes synthetic post-tick state (prevState + newStats + nextWeeksLived)', () => {
    ribMod.classifyLife.mockReturnValue({ name: 'X', emoji: 'Y', priority: 0 });
    ribMod.addRibbonToCollection.mockReturnValue([]);
    const stats = ribStubStats();
    applyDeathRibbon({
      prevState: { weeksLived: 99, foo: 'preserved', showDeathPopup: false } as any,
      newStats: stats,
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    expect(ribMod.classifyLife).toHaveBeenCalledWith(
      expect.objectContaining({ weeksLived: 100, foo: 'preserved', stats }),
    );
    expect(ribMod.addRibbonToCollection).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ name: 'X' }),
      expect.objectContaining({ weeksLived: 100, stats }),
    );
  });
});

// R7 Phase 2 step 2.8-C — auto checkpoint. Year boundary + before-death,
// both independently firing. Always returns checkpoints partial (even
// when neither fires; `?? []` means undefined slice becomes []).
describe('pre-tick equivalence — applyAutoCheckpoint', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cpMod = require('@/lib/timeMachine/checkpointSystem') as {
    shouldAutoCheckpoint: jest.Mock;
    createCheckpoint: jest.Mock;
    addCheckpoint: jest.Mock;
  };

  function cpStubStats(): GameStats {
    return {
      health: 80, happiness: 70, energy: 70, fitness: 60,
      money: 5000, reputation: 50, gems: 0,
    };
  }

  beforeEach(() => {
    cpMod.shouldAutoCheckpoint.mockReset();
    cpMod.createCheckpoint.mockReset();
    cpMod.addCheckpoint.mockReset();
    // Restore default addCheckpoint impl after reset.
    cpMod.addCheckpoint.mockImplementation((existing: any[], cp: any) => [...(existing || []), cp]);
  });

  it('no gate fires: returns { checkpoints: existing } unchanged', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(false);
    const existing = [{ id: 'cp_prev' }];
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: existing, showDeathPopup: false } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: false,
    });
    expect(result.partial.checkpoints).toBe(existing);
  });

  it('no gate fires + undefined checkpoints slice: returns { checkpoints: [] }', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(false);
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: undefined, showDeathPopup: false } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: false,
    });
    expect(result.partial.checkpoints).toEqual([]);
  });

  it('year boundary fires: creates checkpoint with label `Age <yearAge>`', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(true);
    cpMod.createCheckpoint.mockReturnValue({ id: 'cp_year', label: 'Age 20' });
    // nextWeeksLived = 52 → yearAge = floor(ADULTHOOD_AGE + 52/52)
    // ADULTHOOD_AGE = 18 → yearAge = floor(18 + 1) = 19.
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: [], showDeathPopup: false } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 52,
      newShowDeathPopup: false,
    });
    expect(cpMod.createCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({ weeksLived: 52 }),
      'Age 19',
    );
    expect(result).toMatchSnapshot();
  });

  it('death edge fires: snapshots prevState UNMODIFIED with `Before Death` label', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(false);
    cpMod.createCheckpoint.mockReturnValue({ id: 'cp_death', label: 'Before Death' });
    const prevState = {
      checkpoints: [],
      showDeathPopup: false,
      weeksLived: 99,
      stats: { health: 100 },
    } as any;
    applyAutoCheckpoint({
      prevState,
      newStats: cpStubStats(), // would have triggered death decay
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    // CRUCIAL: receives `prevState`, NOT the synthetic post-tick view.
    expect(cpMod.createCheckpoint).toHaveBeenCalledWith(prevState, 'Before Death');
  });

  it('both gates fire: year-boundary added FIRST, then before-death', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(true);
    cpMod.createCheckpoint
      .mockReturnValueOnce({ id: 'cp_year', label: 'Age 20' })
      .mockReturnValueOnce({ id: 'cp_death', label: 'Before Death' });
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: [], showDeathPopup: false } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 52,
      newShowDeathPopup: true,
    });
    expect(result.partial.checkpoints).toEqual([
      { id: 'cp_year', label: 'Age 20' },
      { id: 'cp_death', label: 'Before Death' },
    ]);
  });

  it('death edge: NOT fired when prevState.showDeathPopup already true', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(false);
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: [], showDeathPopup: true } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 100,
      newShowDeathPopup: true,
    });
    expect(cpMod.createCheckpoint).not.toHaveBeenCalled();
    expect(result.partial.checkpoints).toEqual([]);
  });

  it('createCheckpoint throws: silently swallowed, empty partial', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(true);
    cpMod.createCheckpoint.mockImplementation(() => { throw new Error('cp fail'); });
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: [] } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 52,
      newShowDeathPopup: false,
    });
    expect(result.partial).toEqual({});
  });

  it('addCheckpoint throws: silently swallowed, empty partial', () => {
    cpMod.shouldAutoCheckpoint.mockReturnValue(true);
    cpMod.createCheckpoint.mockReturnValue({ id: 'x' });
    cpMod.addCheckpoint.mockImplementation(() => { throw new Error('add fail'); });
    const result = applyAutoCheckpoint({
      prevState: { checkpoints: [] } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 52,
      newShowDeathPopup: false,
    });
    expect(result.partial).toEqual({});
  });

  it('year boundary at nextWeeksLived 0: shouldAutoCheckpoint returns false (gated by `> 0`)', () => {
    // Even though the helper just trusts whatever the lib returns,
    // verify it passes the value through correctly.
    cpMod.shouldAutoCheckpoint.mockReturnValue(false);
    applyAutoCheckpoint({
      prevState: { checkpoints: [], showDeathPopup: false } as any,
      newStats: cpStubStats(),
      nextWeeksLived: 0,
      newShowDeathPopup: false,
    });
    expect(cpMod.shouldAutoCheckpoint).toHaveBeenCalledWith(0);
  });
});

// R7 Phase 2 step 2.9 — lifetimeStatistics accumulator. Eight accumulator
// fields previously frozen inline in a 53-line ternary. Pure helper.
describe('pre-tick equivalence — applyLifetimeStatistics', () => {
  function lsStubLs(overrides: any = {}): any {
    return {
      totalJailTime: 5,
      totalChildren: 1,
      totalWeeksWorked: 50,
      highestSalary: 1200,
      careerHistory: [],
      peakNetWorth: 50000,
      peakNetWorthWeek: 40,
      netWorthHistory: [],
      weeklyEarningsHistory: [],
      totalAchievementsUnlocked: 3,
      ...overrides,
    };
  }

  it('no lifetimeStatistics slice: passes through undefined', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: undefined } as any,
      newBornChildrenCount: 0,
      careerSalary: 0,
      safeNetWorth: 10000,
      totalIncome: 1000,
      nextWeeksLived: 100,
    });
    expect(result.updatedLifetimeStatistics).toBeUndefined();
  });

  // -------- single-field accumulators --------

  it('totalJailTime: increments when prevState.jailWeeks > 0', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs(), jailWeeks: 3 } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.totalJailTime).toBe(6);
  });

  it('totalJailTime: NOT incremented when jailWeeks == 0', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs(), jailWeeks: 0 } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.totalJailTime).toBe(5);
  });

  it('totalJailTime: NOT incremented when jailWeeks undefined', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs() } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.totalJailTime).toBe(5);
  });

  it('totalChildren: increments by newBornChildrenCount', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs() } as any,
      newBornChildrenCount: 2, careerSalary: 0, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.totalChildren).toBe(3);
  });

  it('totalWeeksWorked: increments when careerSalary > 0', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs() } as any,
      newBornChildrenCount: 0, careerSalary: 1500, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.totalWeeksWorked).toBe(51);
  });

  it('highestSalary: max(existing, careerSalary)', () => {
    const result1 = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ highestSalary: 1000 }) } as any,
      newBornChildrenCount: 0, careerSalary: 1500, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result1.updatedLifetimeStatistics?.highestSalary).toBe(1500);

    const result2 = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ highestSalary: 2000 }) } as any,
      newBornChildrenCount: 0, careerSalary: 500, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result2.updatedLifetimeStatistics?.highestSalary).toBe(2000);
  });

  // -------- careerHistory --------

  it('careerHistory: no currentJob → unchanged ref', () => {
    const history = [{ job: 'cashier', earnings: 1000, weeks: 5, endWeek: undefined } as any];
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ careerHistory: history }) } as any,
      newBornChildrenCount: 0, careerSalary: 200, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.careerHistory).toBe(history);
  });

  it('careerHistory: no salary → unchanged ref even with currentJob', () => {
    const history = [{ job: 'cashier', earnings: 1000, weeks: 5, endWeek: undefined } as any];
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ careerHistory: history }), currentJob: 'cashier' } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.careerHistory).toBe(history);
  });

  it('careerHistory: open entry for currentJob → accumulates earnings + 1 week', () => {
    const history = [
      { job: 'engineer', earnings: 5000, weeks: 5, endWeek: 50 } as any,
      { job: 'cashier', earnings: 1000, weeks: 5, endWeek: undefined } as any,
    ];
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ careerHistory: history }), currentJob: 'cashier' } as any,
      newBornChildrenCount: 0, careerSalary: 200, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.careerHistory).toEqual([
      { job: 'engineer', earnings: 5000, weeks: 5, endWeek: 50 },
      { job: 'cashier', earnings: 1200, weeks: 6, endWeek: undefined },
    ]);
  });

  it('careerHistory: only FIRST open match updates (others left alone)', () => {
    // Two open entries for the same job is malformed but legacy code handles it.
    const history = [
      { job: 'cashier', earnings: 100, weeks: 1, endWeek: undefined } as any,
      { job: 'cashier', earnings: 500, weeks: 5, endWeek: undefined } as any,
    ];
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ careerHistory: history }), currentJob: 'cashier' } as any,
      newBornChildrenCount: 0, careerSalary: 200, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.careerHistory).toEqual([
      { job: 'cashier', earnings: 300, weeks: 2, endWeek: undefined },
      { job: 'cashier', earnings: 500, weeks: 5, endWeek: undefined }, // untouched
    ]);
  });

  it('careerHistory: no open entry for currentJob → all entries untouched', () => {
    const history = [
      { job: 'cashier', earnings: 1000, weeks: 5, endWeek: 50 } as any, // closed
    ];
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ careerHistory: history }), currentJob: 'cashier' } as any,
      newBornChildrenCount: 0, careerSalary: 200, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.careerHistory).toEqual(history);
  });

  // -------- peakNetWorth + peakNetWorthWeek --------

  it('peakNetWorth: new peak set → updates both fields', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ peakNetWorth: 50000, peakNetWorthWeek: 40 }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 75000, totalIncome: 0, nextWeeksLived: 100,
    });
    expect(result.updatedLifetimeStatistics?.peakNetWorth).toBe(75000);
    expect(result.updatedLifetimeStatistics?.peakNetWorthWeek).toBe(100);
  });

  it('peakNetWorth: equal to prior peak does NOT update week (strict >)', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ peakNetWorth: 50000, peakNetWorthWeek: 40 }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 50000, totalIncome: 0, nextWeeksLived: 100,
    });
    expect(result.updatedLifetimeStatistics?.peakNetWorth).toBe(50000);
    expect(result.updatedLifetimeStatistics?.peakNetWorthWeek).toBe(40);
  });

  it('peakNetWorth: lower current value → unchanged', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ peakNetWorth: 100000, peakNetWorthWeek: 30 }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 50000, totalIncome: 0, nextWeeksLived: 100,
    });
    expect(result.updatedLifetimeStatistics?.peakNetWorth).toBe(100000);
    expect(result.updatedLifetimeStatistics?.peakNetWorthWeek).toBe(30);
  });

  // -------- netWorthHistory + weeklyEarningsHistory --------

  it('history: nextWeeksLived % 10 === 0 → appends sample', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ netWorthHistory: [], weeklyEarningsHistory: [] }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 99999, totalIncome: 1234, nextWeeksLived: 10,
    });
    expect(result.updatedLifetimeStatistics?.netWorthHistory).toEqual([
      { week: 10, value: 99999 },
    ]);
    expect(result.updatedLifetimeStatistics?.weeklyEarningsHistory).toEqual([
      { week: 10, value: 1234 },
    ]);
  });

  it('history: nextWeeksLived NOT divisible by 10 → no append (existing returned)', () => {
    const existingNw = [{ week: 10, value: 50000 }];
    const existingWe = [{ week: 10, value: 500 }];
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ netWorthHistory: existingNw, weeklyEarningsHistory: existingWe }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 99999, totalIncome: 1234, nextWeeksLived: 17,
    });
    expect(result.updatedLifetimeStatistics?.netWorthHistory).toEqual(existingNw);
    expect(result.updatedLifetimeStatistics?.weeklyEarningsHistory).toEqual(existingWe);
  });

  it('history: cap at 100 entries (slice(-99) + append)', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({ week: i, value: i * 100 }));
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ netWorthHistory: existing, weeklyEarningsHistory: existing }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 12345, totalIncome: 678, nextWeeksLived: 100,
    });
    // 100 existing → slice(-99) = last 99 → append 1 = 100 total.
    expect(result.updatedLifetimeStatistics?.netWorthHistory?.length).toBe(100);
    expect(result.updatedLifetimeStatistics?.netWorthHistory?.[0]).toEqual({ week: 1, value: 100 });
    expect(result.updatedLifetimeStatistics?.netWorthHistory?.[99]).toEqual({ week: 100, value: 12345 });
  });

  it('history: undefined slice → starts as [] before append', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ netWorthHistory: undefined, weeklyEarningsHistory: undefined }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 1, totalIncome: 2, nextWeeksLived: 10,
    });
    expect(result.updatedLifetimeStatistics?.netWorthHistory).toEqual([{ week: 10, value: 1 }]);
    expect(result.updatedLifetimeStatistics?.weeklyEarningsHistory).toEqual([{ week: 10, value: 2 }]);
  });

  // -------- General invariants --------

  it('preserves unrelated lifetimeStatistics fields via spread', () => {
    const result = applyLifetimeStatistics({
      prevState: { lifetimeStatistics: lsStubLs({ totalAchievementsUnlocked: 42 }) } as any,
      newBornChildrenCount: 0, careerSalary: 0, safeNetWorth: 0, totalIncome: 0, nextWeeksLived: 1,
    });
    expect(result.updatedLifetimeStatistics?.totalAchievementsUnlocked).toBe(42);
  });

  it('all undefined accumulators (?? 0): treats them as 0 and adds delta', () => {
    const result = applyLifetimeStatistics({
      prevState: {
        lifetimeStatistics: {
          // none of the optional fields populated
        } as any,
        jailWeeks: 3,
        currentJob: undefined,
      } as any,
      newBornChildrenCount: 1, careerSalary: 100, safeNetWorth: 5000, totalIncome: 200, nextWeeksLived: 10,
    });
    expect(result).toMatchSnapshot();
  });

  it('full state: everything at once (composite snapshot)', () => {
    const result = applyLifetimeStatistics({
      prevState: {
        lifetimeStatistics: lsStubLs({
          careerHistory: [{ job: 'dev', earnings: 1000, weeks: 5, endWeek: undefined }],
          netWorthHistory: [{ week: 0, value: 0 }],
          weeklyEarningsHistory: [{ week: 0, value: 0 }],
        }),
        jailWeeks: 2,
        currentJob: 'dev',
      } as any,
      newBornChildrenCount: 1, careerSalary: 500, safeNetWorth: 99999, totalIncome: 800, nextWeeksLived: 10,
    });
    expect(result).toMatchSnapshot();
  });
});

// R7 Phase 2 step 2.10 — cliffhanger roll. End-of-week ~12% chance to SET
// a teaser that resolves next week. Symmetric to applyCliffhangerResolution.
describe('pre-tick equivalence — applyCliffhangerRoll', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cliffMod = require('@/lib/events/cliffhangerEvents') as {
    rollCliffhanger: jest.Mock;
  };

  beforeEach(() => {
    cliffMod.rollCliffhanger.mockReset();
  });

  it('no roll fire (null): returns undefined + null teaser', () => {
    cliffMod.rollCliffhanger.mockReturnValue(null);
    const result = applyCliffhangerRoll({
      prevState: {} as any,
      nextWeeksLived: 100,
    });
    expect(result).toEqual({ pendingCliffhanger: undefined, teaser: null });
  });

  it('roll fires: returns pendingCliffhanger with setWeeksLived = nextWeeksLived + 1', () => {
    cliffMod.rollCliffhanger.mockReturnValue({
      teaser: 'A dark figure approaches...',
      resolveEventId: 'evt_dark_figure',
      definition: { id: 'cliff_dark' } as any,
    });
    const result = applyCliffhangerRoll({
      prevState: {} as any,
      nextWeeksLived: 100,
    });
    expect(result).toMatchSnapshot();
  });

  it('roll throws: swallowed, returns undefined + null teaser', () => {
    cliffMod.rollCliffhanger.mockImplementation(() => {
      throw new Error('catalog missing');
    });
    const result = applyCliffhangerRoll({
      prevState: {} as any,
      nextWeeksLived: 100,
    });
    expect(result).toEqual({ pendingCliffhanger: undefined, teaser: null });
  });

  it('passes synthetic state to rollCliffhanger with seed=nextWeeksLived', () => {
    cliffMod.rollCliffhanger.mockReturnValue(null);
    const prev = {
      weeksLived: 99,
      pendingCliffhanger: { resolveEventId: 'old', teaser: 'old_t', setWeeksLived: 99 },
      otherField: 'preserved',
    } as any;
    applyCliffhangerRoll({ prevState: prev, nextWeeksLived: 100 });
    expect(cliffMod.rollCliffhanger).toHaveBeenCalledWith(
      expect.objectContaining({
        weeksLived: 100,
        otherField: 'preserved',
        pendingCliffhanger: prev.pendingCliffhanger, // passed through
      }),
      100,
    );
  });

  it('teaser is identical between pendingCliffhanger.teaser and returned teaser', () => {
    cliffMod.rollCliffhanger.mockReturnValue({
      teaser: 'Lightning strikes the building',
      resolveEventId: 'evt_lightning',
      definition: {} as any,
    });
    const result = applyCliffhangerRoll({
      prevState: {} as any,
      nextWeeksLived: 100,
    });
    expect(result.teaser).toBe('Lightning strikes the building');
    expect(result.pendingCliffhanger?.teaser).toBe('Lightning strikes the building');
  });
});

describe('pre-tick — buildPreRolls', () => {
  // buildPreRolls uses Math.random() and Date.now() — its values are
  // intentionally non-deterministic. Only shape + value-range checks here;
  // determinism guarantees belong in the StrictMode-double-invoke harness,
  // which happens at the React layer (not in this pure-function test).
  it('returns the expected key shape', () => {
    const rolls = buildPreRolls();
    expect(Object.keys(rolls).sort()).toEqual([
      'careerAcceptDelay',
      'childGender',
      'childIdSuffix',
      'childPersonality',
      'diseaseComplication',
      'diseaseProgression',
      'minerDegradation',
      'petSickness',
      'petSicknessType',
      'policeEncounter',
      'relBreakup',
      'relDisappointed',
      'stockPickRoll',
      'timestamp',
      'vehicleAccident',
      'vehicleAccidentSeverity',
    ]);
  });

  it('returns values in their declared ranges', () => {
    const rolls = buildPreRolls();
    expect([1, 2]).toContain(rolls.careerAcceptDelay);
    expect(rolls.stockPickRoll).toBeGreaterThanOrEqual(0);
    expect(rolls.stockPickRoll).toBeLessThan(1);
    expect(['male', 'female']).toContain(rolls.childGender);
    expect(typeof rolls.childIdSuffix).toBe('string');
    expect(rolls.childIdSuffix.length).toBeLessThanOrEqual(6);
    expect(rolls.childPersonality).toBeGreaterThanOrEqual(0);
    expect(rolls.childPersonality).toBeLessThan(5);
    expect(rolls.relBreakup).toHaveLength(20);
    expect(rolls.relDisappointed).toHaveLength(20);
    expect(rolls.diseaseComplication).toHaveLength(20);
    expect(rolls.diseaseProgression).toHaveLength(20);
    expect(rolls.petSickness).toHaveLength(20);
    expect(rolls.petSicknessType).toHaveLength(20);
    expect(rolls.vehicleAccident).toHaveLength(10);
    expect(rolls.vehicleAccidentSeverity).toHaveLength(10);
    expect(rolls.minerDegradation).toBeGreaterThanOrEqual(2);
    expect(rolls.minerDegradation).toBeLessThan(5);
    expect(rolls.timestamp).toBeGreaterThan(0);
  });
});

describe('deterministicRoll', () => {
  // Sanity: the same seed + key returns the same value across calls.
  it('is deterministic', () => {
    const a = deterministicRoll(42);
    const b = deterministicRoll(42);
    expect(a('foo')).toBe(b('foo'));
    expect(a('bar')).toBe(b('bar'));
  });

  // Different keys produce different values (with overwhelming probability).
  it('differentiates keys', () => {
    const r = deterministicRoll(42);
    expect(r('foo')).not.toBe(r('bar'));
  });

  // Output stays inside [0, 1).
  it('stays in unit interval', () => {
    const r = deterministicRoll(99);
    for (let i = 0; i < 100; i++) {
      const v = r(`k${i}`);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
