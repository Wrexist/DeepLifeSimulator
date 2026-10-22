/**
 * TAB-4 / TAB-6 / TAB-7: the projection the recap and the vital breakdown
 * modals read must charge studying exactly as the tick does (capped), and must
 * not promise a diet gain the tick will skip for lack of cash.
 */
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import { educationStressPenalties } from '@/lib/education/educationStress';
import { applyEducationStress } from '@/contexts/game/actions/weekly/applyEducationStress';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Education, DietPlan, GameState } from '@/contexts/game/types';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';

const course = (id: string): Education =>
  ({ id, name: id, description: '', cost: 0, duration: 10, weeksRemaining: 5, completed: false } as Education);

function withCourses(n: number): GameState {
  const s = createTestGameState();
  return { ...s, educations: Array.from({ length: n }, (_, i) => course(`c${i}`)) };
}

describe('education stress: one formula for the tick and the projection', () => {
  it.each([1, 2, 3, 4, 6])('%i courses: projection equals what the tick applies', (n) => {
    const state = withCourses(n);
    const edu = projectWeeklyVitalDrift(state).causes.find((c) => c.id === 'education');
    const ctx = { newStats: { happiness: 80, health: 80, energy: 80 } } as unknown as WeekContext;
    applyEducationStress(state.educations, ctx);
    expect(edu?.happiness).toBe(ctx.newStats.happiness - 80);
    expect(edu?.health).toBe(ctx.newStats.health - 80);
    expect(edu?.energy).toBe(ctx.newStats.energy - 80);
  });

  it('caps 3+ courses at -20 happiness / -10 health / -25 energy', () => {
    expect(educationStressPenalties(3)).toEqual({ happiness: -20, health: -10, energy: -25 });
    expect(educationStressPenalties(4)).toEqual({ happiness: -20, health: -10, energy: -25 });
  });

  it('the recap net line now includes studying', () => {
    const none = projectWeeklyVitalDrift(withCourses(0));
    const one = projectWeeklyVitalDrift(withCourses(1));
    expect(one.happiness).toBe(none.happiness - 6);
  });
});

describe('diet plan projection honours the tick\'s affordability skip', () => {
  const plan = {
    id: 'athlete', name: 'Athlete', description: '', dailyCost: 50,
    healthGain: 12, energyGain: 8, happinessGain: 0, active: true,
  } as unknown as DietPlan;

  it('projects the gain when this week is affordable', () => {
    const s = createTestGameState();
    const state = { ...s, dietPlans: [plan], stats: { ...s.stats, money: 1000 } };
    const diet = projectWeeklyVitalDrift(state).causes.find((c) => c.id === 'diet');
    expect(diet?.health).toBe(12);
  });

  it('projects nothing when the plan will be skipped', () => {
    const s = createTestGameState();
    const state = { ...s, dietPlans: [plan], stats: { ...s.stats, money: 100 } };
    expect(projectWeeklyVitalDrift(state).causes.find((c) => c.id === 'diet')).toBeUndefined();
  });
});
