/**
 * ECO-9 (owner decision 2026-10-22): a car can move reputation, but it cannot
 * buy a career.
 *
 * Before: the weekly nudge held reputation at 3x the best car's bonus (a $55k
 * Sports Coupe, +15, held it at 45), and purchase grants stacked, so a nobody
 * with $120k of cars cleared the Celebrity bar (30) and walked onto the
 * $4,600/wk ladder with no degree.
 */
import { applyVehiclesForWeek } from '@/contexts/game/actions/weekly/applyVehicles';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { careerGateReputation, checkCareerRequirements } from '@/lib/careers/careerRequirements';
import { isCareerUnlocked, ADVANCED_CAREERS } from '@/lib/careers/advancedCareers';
import {
  VEHICLE_TEMPLATES,
  createVehicleFromTemplate,
  vehicleReputationFloor,
  VEHICLE_REPUTATION_FLOOR_CAP,
} from '@/lib/vehicles/vehicles';
import type { GameStats, Vehicle } from '@/contexts/game/types';

const template = (id: string) => VEHICLE_TEMPLATES.find((t) => t.id === id)!;
const owned = (id: string, granted?: number): Vehicle => ({
  ...createVehicleFromTemplate(template(id), 0),
  ...(granted !== undefined ? { reputationGranted: granted } : {}),
});

function ctx(reputation: number): WeekContext {
  const s: GameStats = { health: 100, happiness: 100, energy: 100, fitness: 100, money: 1e6, reputation, gems: 0 };
  return { newStats: s, notifications: [], preRolls: zeroPreRolls({}), nextWeeksLived: 100 };
}

describe('ECO-9: the ownership nudge holds reputation at the bonus, capped at 20', () => {
  it('floor = min(bonus, 20)', () => {
    expect(vehicleReputationFloor(15)).toBe(15);
    expect(vehicleReputationFloor(30)).toBe(VEHICLE_REPUTATION_FLOOR_CAP);
    expect(vehicleReputationFloor(NaN)).toBe(0);
  });

  it('a Sports Coupe no longer ratchets reputation from 15 to 45', () => {
    const coupe = owned('sports_coupe');
    expect(coupe.reputationBonus).toBeGreaterThan(0);
    let rep = 0;
    let garage = [coupe];
    for (let w = 0; w < 100; w++) {
      const c = ctx(rep);
      garage = applyVehiclesForWeek(garage, c, coupe.id);
      rep = c.newStats.reputation;
    }
    expect(rep).toBe(vehicleReputationFloor(coupe.reputationBonus));
    expect(rep).toBeLessThan(30);
  });
});

describe('ECO-9: career reputation gates count only earned reputation', () => {
  const celebrity = () => createTestGameState().careers.find((c) => c.id === 'celebrity')!;

  it('two status cars on top of 0 earned reputation do not open Celebrity', () => {
    const coupe = owned('sports_coupe', template('sports_coupe').reputationBonus);
    const muscle = owned('muscle_car', template('muscle_car').reputationBonus);
    const bought = coupe.reputationGranted! + muscle.reputationGranted!;
    expect(bought).toBeGreaterThanOrEqual(30);
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: bought },
      vehicles: [coupe, muscle],
    });
    expect(careerGateReputation(state)).toBe(0);
    const check = checkCareerRequirements(celebrity().requirements, state);
    expect(check.met).toBe(false);
    expect(check.reputationShortfall).toEqual({ required: 30, actual: 0, fromVehicles: bought });
  });

  it('earned reputation still opens it, with or without a car', () => {
    const coupe = owned('sports_coupe', 15);
    const withCar = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: 45 },
      vehicles: [coupe],
    });
    expect(careerGateReputation(withCar)).toBe(30);
    expect(checkCareerRequirements(celebrity().requirements, withCar).met).toBe(true);
  });

  it('a pre-v55 car (no grant record) is counted at its whole bonus, like a sale', () => {
    const legacy = owned('sports_coupe');
    delete (legacy as Partial<Vehicle>).reputationGranted;
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: 40 },
      vehicles: [legacy, { ...owned('muscle_car', 18), owned: false }],
    });
    expect(careerGateReputation(state)).toBe(40 - legacy.reputationBonus);
  });

  it('advanced careers read the same earned figure', () => {
    const career = ADVANCED_CAREERS.find((c) => 'reputation' in c.unlockRequirements && (c.unlockRequirements.reputation ?? 0) > 0)!;
    const need = career.unlockRequirements.reputation ?? 0;
    const gate = {
      education: (career.unlockRequirements.education ?? []).map((id) => ({ id, completed: true })),
      claimedAchievements: career.unlockRequirements.achievements ?? [],
      weeksLived: 100_000,
      netWorth: 1e12,
      stats: { reputation: need },
    };
    expect(isCareerUnlocked(career, gate)).toBe(true);
    expect(isCareerUnlocked(career, { ...gate, vehicles: [owned('sports_coupe', 15)] })).toBe(false);
  });
});
