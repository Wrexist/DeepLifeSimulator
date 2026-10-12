import { runMigrations } from '@/utils/saveMigrations';

/**
 * v53: diet plans are stored by value, so the reprice must reach existing
 * saves - and must keep the player's selected plan selected.
 */
describe('v53 diet reprice', () => {
  const v52 = () => ({
    version: 52,
    dietPlans: [
      { id: 'basic', name: 'Basic Diet', dailyCost: 2500, active: false },
      { id: 'premium', name: 'Premium Diet', dailyCost: 6000, active: true },
      { id: 'athlete', name: 'Athlete Diet', dailyCost: 10000, active: false },
      { id: 'custom', name: 'Unknown', dailyCost: 999, active: false },
    ],
  });

  it('reprices the three known plans and keeps the active one', () => {
    const out = runMigrations(v52() as never) as unknown as { state?: { dietPlans: { id: string; dailyCost: number; active: boolean }[]; version: number } } & { dietPlans?: unknown };
    const state = (out.state ?? out) as unknown as { dietPlans: { id: string; dailyCost: number; active: boolean }[]; version: number };
    const byId = Object.fromEntries(state.dietPlans.map((p) => [p.id, p]));
    expect(byId.basic.dailyCost).toBe(20);
    expect(byId.premium.dailyCost).toBe(50);
    expect(byId.athlete.dailyCost).toBe(85);
    expect(byId.premium.active).toBe(true);
    expect(byId.custom.dailyCost).toBe(999);
    expect(state.version).toBeGreaterThanOrEqual(53);
  });
});
