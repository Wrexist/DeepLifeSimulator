/**
 * Save Migration v22 — App Depth Program (Wave A) additive batch.
 *
 *   1. Additive — every new optional field is default-filled, existing data kept.
 *   2. Data-preserving — Pet `ownedToys` is MERGED into `toys` (never dropped).
 *   3. Idempotent — running twice is a no-op.
 *   4. Chains end-to-end to CURRENT_STATE_VERSION (>= 22).
 */
import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';

function v21State(over: Record<string, any> = {}) {
  return {
    version: 21,
    weeksLived: 40,
    banking: {
      accounts: [], creditCards: [], billPayRules: [], budgetSpend: [],
      creditScore: { score: 650, band: 'fair', componentBreakdown: {}, lastUpdatedWeek: 0, history: [], inquiries: [] },
      savingsGoals: [], totalLateFeesPaid: 0, totalInterestEarned: 5, totalInterestPaid: 3, taxDueThisYear: 0,
    },
    socialMedia: { followers: 1234 },
    gamingStreaming: { subscribers: 100, experience: 500, level: 1 },
    travel: { visitedDestinations: ['paris'], passportOwned: true, businessOpportunities: {}, travelHistory: [] },
    pets: [
      { id: 'p1', name: 'Rex', type: 'dog', age: 1, hunger: 50, happiness: 50, health: 50, toys: ['ball'], ownedToys: ['ball', 'bone'] },
      { id: 'p2', name: 'Mimi', type: 'cat', age: 2, hunger: 50, happiness: 50, health: 50, ownedToys: ['feather'] },
    ],
    ...over,
  };
}

describe('Save migration → v22 (App Depth Program Wave A)', () => {
  it('default-fills every additive field', () => {
    const { state, errors } = runMigrations(v21State());
    expect(errors).toEqual([]);
    expect(state.version).toBe(CURRENT_STATE_VERSION);
    expect(CURRENT_STATE_VERSION).toBeGreaterThanOrEqual(22);

    expect(state.banking.rateEnvironment).toEqual({ depositMult: 1, loanDelta: 0 });
    expect(state.banking.budgetTargets).toEqual({});
    // Existing interest ledgers preserved.
    expect(state.banking.totalInterestEarned).toBe(5);
    expect(state.banking.totalInterestPaid).toBe(3);

    // Follower history seeded with a current-followers anchor (capped 52).
    expect(Array.isArray(state.socialMedia.followerHistory)).toBe(true);
    expect(state.socialMedia.followerHistory[0]).toEqual({ week: 40, followers: 1234 });
    expect(state.socialMedia.scandalRiskScore).toBe(0);

    expect(state.gamingStreaming.perkTier).toBe(0);
    expect(state.gamingStreaming.lastMemberWeek).toBe(0);
    expect(state.gamingStreaming.hypeStreak).toBe(0);

    expect(state.travel.passportMilestones).toEqual([]);
    expect(state.realEstateActivity).toEqual([]);
  });

  it('MERGES pet ownedToys into toys without dropping any (data-preserving)', () => {
    const { state } = runMigrations(v21State());
    const rex = state.pets.find((p: any) => p.id === 'p1');
    const mimi = state.pets.find((p: any) => p.id === 'p2');
    // Union of toys(['ball']) + ownedToys(['ball','bone']) → ['ball','bone'], no dupes.
    expect(new Set(rex.toys)).toEqual(new Set(['ball', 'bone']));
    // Mimi had only ownedToys — its contents land in toys.
    expect(new Set(mimi.toys)).toEqual(new Set(['feather']));
    // ownedToys is emptied (data now lives in toys).
    expect(rex.ownedToys).toEqual([]);
    expect(mimi.ownedToys).toEqual([]);
  });

  it('is idempotent (running the whole chain twice is stable)', () => {
    const once = runMigrations(v21State()).state;
    const twice = runMigrations({ ...once }).state;
    expect(twice.pets.find((p: any) => p.id === 'p1').toys.sort()).toEqual(['ball', 'bone']);
    expect(twice.banking.rateEnvironment).toEqual({ depositMult: 1, loanDelta: 0 });
    expect(twice.socialMedia.followerHistory).toHaveLength(1);
    expect(twice.version).toBe(CURRENT_STATE_VERSION);
  });

  it('does not clobber pre-existing v22 values on re-run', () => {
    const withValues = v21State({
      version: 22,
      banking: { rateEnvironment: { depositMult: 1.15, loanDelta: -0.005 }, budgetTargets: { food: 200 }, accounts: [], creditCards: [], billPayRules: [], budgetSpend: [], creditScore: { score: 650, band: 'fair', componentBreakdown: {}, lastUpdatedWeek: 0, history: [], inquiries: [] }, savingsGoals: [], totalLateFeesPaid: 0, totalInterestEarned: 0, totalInterestPaid: 0, taxDueThisYear: 0 },
    });
    const { state } = runMigrations(withValues);
    expect(state.banking.rateEnvironment).toEqual({ depositMult: 1.15, loanDelta: -0.005 });
    expect(state.banking.budgetTargets).toEqual({ food: 200 });
  });

  it('is defensive against missing optional slices', () => {
    const { state, errors } = runMigrations({ version: 21, weeksLived: 3 });
    expect(errors).toEqual([]);
    expect(state.realEstateActivity).toEqual([]);
    expect(state.version).toBe(CURRENT_STATE_VERSION);
  });
});
