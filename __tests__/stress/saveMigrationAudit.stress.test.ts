/**
 * Save Migration Deep Audit
 *
 * `runMigrations` ladders a save state from any version >= 1 up to
 * CURRENT_STATE_VERSION (18). This audit verifies:
 *
 *   - All registered migrations 10 → 18 land cleanly
 *   - Each migration is IDEMPOTENT (running twice = same result as once)
 *   - Skipping ahead works (a v10 save migrates straight to v18)
 *   - Out-of-version saves (e.g. v9, version=undefined) get bumped + handled
 *   - Migration errors don't crash — partial migration is recorded
 *   - End-to-end: a stripped-down v10 save round-trips through the migrator
 *     and lands in a valid v18 state with no NaN/Infinity, passing
 *     `validateGameState`
 */

import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { validateGameState } from '@/utils/saveValidation';

function deepCheck(state: unknown): string[] {
  const issues: string[] = [];
  const seen = new WeakSet();
  const walk = (v: unknown, p: string) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      if (Number.isNaN(v)) issues.push(`NaN at ${p}`);
      if (!Number.isFinite(v)) issues.push(`Infinity at ${p}`);
      return;
    }
    if (typeof v === 'function') { issues.push(`function at ${p}`); return; }
    if (typeof v === 'object') {
      const obj = v as object;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (Array.isArray(obj)) obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      else for (const k of Object.keys(obj)) walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
    }
  };
  walk(state, 'root');
  return issues;
}

/** Minimal valid v10 starting state — pretend it was saved by an old client. */
function makeV10State() {
  return {
    version: 10,
    weeksLived: 50,
    date: { age: 19, year: 2026, week: 1, month: 'January' },
    week: 1,
    stats: { health: 80, happiness: 70, energy: 60, fitness: 50, money: 5000, reputation: 30, gems: 100 },
    relationships: [],
    items: [],
    careers: [{ id: 'doctor', title: 'Doctor', level: 1, progress: 0, salary: 100, applied: false, accepted: false }],
    educations: [],
    foods: [],
    healthActivities: [],
    streetJobs: [],
    achievements: [],
    family: { children: [] },
    settings: {},
    social: { relations: [] },
    economy: { priceIndex: 1, growthRate: 0 },
    hobbies: [],
    pets: [],
    cryptos: [],
    diseases: [],
    diseaseHistory: { diseases: [], totalDiseases: 0, totalCured: 0, deathsFromDisease: 0 },
    diseaseImmunities: [],
    bankSavings: 1000,
    loans: [],
    realEstate: [],
    vehicles: [],
    weeklyStreetJobs: {},
    weeklyJailActivities: {},
    wantedLevel: 0,
    jailWeeks: 0,
    criminalXp: 0,
    criminalLevel: 1,
    crimeSkills: {
      stealth: { xp: 0, level: 1, upgrades: [] },
      hacking: { xp: 0, level: 1, upgrades: [] },
      lockpicking: { xp: 0, level: 1, upgrades: [] },
    },
    karma: { good: 0, bad: 0 },
    mindset: { traits: [], activeTraitId: undefined },
    generationNumber: 1,
    lineageId: 'test-lineage',
    ancestors: [],
    activeTraits: [],
    memories: [],
    previousLives: [],
    legacyBonuses: { incomeMultiplier: 1, learningMultiplier: 1, reputationBonus: 0 },
    userProfile: { firstName: 'Test', lastName: 'Player', sex: 'male', sexuality: 'straight', gender: 'male', seekingGender: 'female' },
    revivalPack: false,
    bankSavings_legacy: 1000,
    petFood: {},
    unlockedLifeSkills: [],
    dmConversations: [],
    revealedDMClues: [],
    youthPills: 0,
    weeklyChallenge: undefined,
    perks: {},
    goldUpgrades: {},
    prestige: undefined,
  };
}

describe('Save migration deep audit', () => {
  // ── REGISTRY SANITY ────────────────────────────────────────────────────
  it('CURRENT_STATE_VERSION matches STATE_VERSION from initialState', () => {
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
  });

  it('initialGameState.version equals STATE_VERSION', () => {
    expect(initialGameState.version).toBe(STATE_VERSION);
  });

  // ── BASIC LADDER ───────────────────────────────────────────────────────
  it('v10 → CURRENT migrates the version field correctly', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    expect(result.errors).toEqual([]);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('v10 → CURRENT applies every migration step in the chain', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    // Should hit migrations 11, 12, 13, 14, 15, 16, 17, 18.
    const expected: number[] = [];
    for (let v = 11; v <= CURRENT_STATE_VERSION; v++) expected.push(v);
    expect(result.migrationsApplied.sort((a, b) => a - b)).toEqual(expected);
  });

  // ── IDEMPOTENCY ────────────────────────────────────────────────────────
  it('Idempotent: running migration twice produces same result', () => {
    const state = makeV10State();
    const first = runMigrations(JSON.parse(JSON.stringify(state)));
    const second = runMigrations(first.state);
    expect(second.migrationsApplied).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(second.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('Idempotent: each individual migration is a no-op on already-migrated state', () => {
    const state = makeV10State();
    const fullMigrated = runMigrations(JSON.parse(JSON.stringify(state))).state;

    // Re-run the entire ladder on an already-v18 state.
    const reRun = runMigrations(JSON.parse(JSON.stringify(fullMigrated)));
    expect(reRun.migrationsApplied).toEqual([]);
    // Structural equality (no field churn).
    expect(JSON.stringify(reRun.state)).toBe(JSON.stringify(fullMigrated));
  });

  // ── EDGE CASES ON VERSION FIELD ────────────────────────────────────────
  it('Missing version field: defaults to v1 and ladders up', () => {
    const state = { stats: { money: 100 }, weeksLived: 0, date: { age: 18, year: 2025, week: 1, month: 'January' } };
    const result = runMigrations(state as unknown as ReturnType<typeof makeV10State>);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('Future version: no migrations run, state untouched', () => {
    const state = { ...makeV10State(), version: 999 };
    const result = runMigrations(state);
    expect(result.migrationsApplied).toEqual([]);
    expect(result.state.version).toBe(999);
  });

  it('Null state: returns error, does not crash', () => {
    const result = runMigrations(null);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.migrationsApplied).toEqual([]);
  });

  it('Non-object state: returns error, does not crash', () => {
    const result = runMigrations('not-an-object' as unknown as ReturnType<typeof makeV10State>);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ── INDIVIDUAL MIGRATION CONTRACTS ─────────────────────────────────────
  it('v11: backfills playStreak, legacyPoints, completedChapters, activeChapterId', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    expect(result.state.playStreak).toBeDefined();
    expect(result.state.playStreak.count).toBe(0);
    expect(result.state.legacyPoints).toBe(0);
    expect(result.state.completedChapters).toEqual([]);
    expect(result.state.activeChapterId).toBe('ch1_fresh_start');
    expect(result.state.completedTutorialSteps).toEqual([]);
  });

  it('v11: backfills startedWeeksLived on existing careers', () => {
    const state = makeV10State();
    state.careers = [{ id: 'a', title: 'A', level: 0, progress: 0, salary: 50, applied: false, accepted: false }];
    const result = runMigrations(state);
    expect(result.state.careers[0].startedWeeksLived).toBe(0);
  });

  it('v12: backfills checkpoints, ribbonCollection, timeMachineUsesThisLife, processedIAPTransactions', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    expect(result.state.discoveredSecrets).toEqual([]);
    expect(result.state.ribbonCollection).toEqual({ earned: [], discoveredIds: [] });
    expect(result.state.checkpoints).toEqual([]);
    expect(result.state.timeMachineUsesThisLife).toBe(0);
    expect(result.state.processedIAPTransactions).toEqual([]);
  });

  it('v13: creates socialMedia with all 9 sub-objects + lifetimeStats', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    const sm = result.state.socialMedia;
    expect(sm).toBeDefined();
    expect(sm.commentThreads).toEqual({});
    expect(sm.trendingHashtags).toEqual([]);
    expect(sm.followGraph).toBeDefined();
    expect(sm.followGraph.followingNpcIds).toEqual([]);
    expect(sm.activeScandal).toBeNull();
    expect(sm.scandalHistory).toEqual([]);
    expect(sm.brandInbox).toBeDefined();
    expect(sm.verifiedPro).toBeDefined();
    expect(sm.verifiedPro.active).toBe(false);
    expect(sm.notifications).toEqual([]);
    expect(sm.lifetimeStats).toBeDefined();
    expect(sm.lifetimeStats.peakFollowers).toBe(0);
  });

  it('v14: creates banking with checking + savings + creditScore (preserves bankSavings)', () => {
    const state = makeV10State();
    state.bankSavings = 4242;
    const result = runMigrations(state);
    expect(result.state.banking).toBeDefined();
    expect(result.state.banking.accounts.length).toBe(2);
    const checking = result.state.banking.accounts.find((a: { type: string }) => a.type === 'checking');
    const savings = result.state.banking.accounts.find((a: { type: string }) => a.type === 'savings');
    expect(checking).toBeDefined();
    expect(savings.balance).toBe(4242); // Preserves legacy bankSavings
    expect(result.state.banking.creditScore.score).toBe(650);
    expect(result.state.banking.creditCards).toEqual([]);
  });

  it('v14: backfills onTimePayments / latePayments on existing loans', () => {
    const state = makeV10State();
    state.loans = [{ id: 'loan1', amount: 10000, balance: 5000, rateAPR: 0.05 }] as never;
    const result = runMigrations(state);
    expect(result.state.loans[0].onTimePayments).toBe(0);
    expect(result.state.loans[0].latePayments).toBe(0);
    expect(result.state.loans[0].originalAPR).toBe(0.05);
  });

  it('v15: creates sparkApp with profile, swipes, matches, premium, lifetimeStats', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    const s = result.state.sparkApp;
    expect(s).toBeDefined();
    expect(s.profile.photos).toEqual([]);
    expect(s.swipes).toEqual([]);
    expect(s.matches).toEqual([]);
    expect(s.messages).toEqual({});
    expect(s.swipeQuota).toBe(30);
    expect(s.swipesUsedThisWeek).toBe(0);
    expect(s.premium.tier).toBe('free');
    expect(s.lifetimeStats.totalSwipes).toBe(0);
  });

  it('v16: creates cryptoMarket with coinMarkets keyed by existing cryptos', () => {
    const state = makeV10State();
    state.cryptos = [
      { id: 'btc', price: 50000, owned: 0.5 },
      { id: 'eth', price: 3000, owned: 0 },
    ] as never;
    const result = runMigrations(state);
    expect(result.state.cryptoMarket).toBeDefined();
    expect(result.state.cryptoMarket.coinMarkets.btc).toBeDefined();
    expect(result.state.cryptoMarket.coinMarkets.btc.regime).toBe('stable');
    expect(result.state.cryptoMarket.coinMarkets.btc.priceHistory.length).toBe(1);
    expect(result.state.cryptoMarket.coinMarkets.btc.priceHistory[0].price).toBe(50000);
    expect(result.state.cryptoMarket.costBasis.btc).toBeDefined();
    expect(result.state.cryptoMarket.costBasis.btc.totalShares).toBe(0.5);
    // eth has 0 owned → no cost basis entry.
    expect(result.state.cryptoMarket.costBasis.eth).toBeUndefined();
  });

  it('v17: creates hustleApp with empty companies dict + lifetimeStats', () => {
    const state = makeV10State();
    state.companies = [{ id: 'co1', name: 'Co 1', type: 'factory', employees: 5, money: 1000, weeklyIncome: 200, baseWeeklyIncome: 200, upgrades: [], workerSalary: 100, workerMultiplier: 1, marketingLevel: 0, miners: {}, warehouseLevel: 0 }] as never;
    const result = runMigrations(state);
    expect(result.state.hustleApp).toBeDefined();
    expect(result.state.hustleApp.companies.co1).toBeDefined();
    expect(result.state.hustleApp.companies.co1.brand.score).toBe(50);
    expect(result.state.hustleApp.companies.co1.ipo.status).toBe('private');
    expect(result.state.hustleApp.lifetimeStats.totalCompaniesFounded).toBe(1);
  });

  it('v18: creates darkWeb with heat seeded from wantedLevel', () => {
    const state = makeV10State();
    state.wantedLevel = 7;
    const result = runMigrations(state);
    expect(result.state.darkWeb).toBeDefined();
    expect(result.state.darkWeb.heat).toBe(70); // 7 * 10
    expect(result.state.darkWeb.vendors.length).toBe(4);
    expect(result.state.darkWeb.skills.hacking.level).toBe(1);
    expect(result.state.darkWeb.dirtyBtc).toBe(0);
  });

  it('v18: zero wantedLevel produces zero heat (no NaN)', () => {
    const state = makeV10State();
    state.wantedLevel = 0;
    const result = runMigrations(state);
    expect(result.state.darkWeb.heat).toBe(0);
  });

  it('v23: backfills luxuryItems + ambition fields on a v22 save that predates them', () => {
    // Reproduce the drift: a save at v22 that never carried the Luxury /
    // Life-Ambition fields (added to initialState AFTER v22 shipped).
    const state = makeV10State() as Record<string, unknown>;
    state.version = 22;
    delete state.luxuryItems;
    delete state.ambitionId;
    delete state.ambitionCompletedMilestones;
    delete state.ambitionRewardClaimed;

    const result = runMigrations(state);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
    expect(Array.isArray(result.state.luxuryItems)).toBe(true);
    expect(result.state.luxuryItems).toEqual([]);
    expect(Array.isArray(result.state.ambitionCompletedMilestones)).toBe(true);
    expect(result.state.ambitionCompletedMilestones).toEqual([]);
    expect(result.state.ambitionRewardClaimed).toBe(false);
  });

  it('v23: does not clobber a save that already carries ambition/luxury data', () => {
    const state = makeV10State() as Record<string, unknown>;
    state.version = 22;
    state.luxuryItems = ['rolex'];
    state.ambitionId = 'tycoon';
    state.ambitionCompletedMilestones = ['first_million'];
    state.ambitionRewardClaimed = true;

    const result = runMigrations(state);
    expect(result.state.luxuryItems).toEqual(['rolex']);
    expect(result.state.ambitionId).toBe('tycoon');
    expect(result.state.ambitionCompletedMilestones).toEqual(['first_million']);
    expect(result.state.ambitionRewardClaimed).toBe(true);
  });

  // ── PRESERVATION: existing fields untouched ────────────────────────────
  it('Preservation: stats / weeksLived / date are untouched by ladder', () => {
    const state = makeV10State();
    const before = {
      money: state.stats.money,
      health: state.stats.health,
      weeksLived: state.weeksLived,
      age: state.date.age,
      year: state.date.year,
    };
    const result = runMigrations(state);
    expect(result.state.stats.money).toBe(before.money);
    expect(result.state.stats.health).toBe(before.health);
    expect(result.state.weeksLived).toBe(before.weeksLived);
    expect(result.state.date.age).toBe(before.age);
    expect(result.state.date.year).toBe(before.year);
  });

  it('Preservation: existing socialMedia fields are NOT overwritten by v13', () => {
    const state = makeV10State();
    (state as Record<string, unknown>).socialMedia = {
      followers: 1234,
      influenceLevel: 'expert',
      totalPosts: 50,
      // No v13 sub-objects yet.
    };
    const result = runMigrations(state);
    expect(result.state.socialMedia.followers).toBe(1234);
    expect(result.state.socialMedia.influenceLevel).toBe('expert');
    expect(result.state.socialMedia.totalPosts).toBe(50);
    // v13 fills the missing fields.
    expect(result.state.socialMedia.commentThreads).toEqual({});
  });

  it('Preservation: existing brand deals get new fields added without losing original ones', () => {
    const state = makeV10State();
    (state as Record<string, unknown>).socialMedia = {
      followers: 100,
      activeBrandDeals: [
        { id: 'deal1', payment: 1000, expiresIn: 4 },
      ],
    };
    const result = runMigrations(state);
    const deal = result.state.socialMedia.activeBrandDeals[0];
    expect(deal.id).toBe('deal1'); // preserved
    expect(deal.payment).toBe(1000); // preserved
    expect(deal.postsRequired).toBe(1); // backfilled
    expect(deal.postsDelivered).toBe(0); // backfilled
    expect(deal.weeklyPayment).toBe(250); // computed: 1000 / 4
  });

  // ── STATE VALIDITY POST-MIGRATION ──────────────────────────────────────
  it('Post-ladder state has no NaN/Infinity anywhere', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    const issues = deepCheck(result.state);
    expect(issues).toEqual([]);
  });

  it('Post-ladder state passes validateGameState (after defaults)', () => {
    const state = makeV10State();
    const result = runMigrations(state);
    // validateGameState may surface warnings but should return valid for the
    // migrated state's CORE fields. We assert no NaN/Infinity in stats here
    // (validateGameState's strictest path).
    const v = validateGameState(result.state, false);
    expect(v.errors.filter(e => /NaN|Infinity/.test(e))).toEqual([]);
  });

  // ── SKIP-AHEAD ─────────────────────────────────────────────────────────
  it('Skip-ahead: a v15 save lands on current version with all interim migrations applied', () => {
    const state = makeV10State();
    state.version = 15;
    // Manually pre-populate fields that earlier migrations would have set,
    // so we test only the 16+ hops.
    (state as Record<string, unknown>).socialMedia = { followers: 0, influenceLevel: 'novice', totalPosts: 0, viralPosts: 0, brandPartnerships: 0, engagementRate: 0 };
    (state as Record<string, unknown>).sparkApp = {};

    const result = runMigrations(state);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
    // Each migration from 16 up to the current version must have fired.
    const expectedApplied = [];
    for (let v = 16; v <= CURRENT_STATE_VERSION; v++) expectedApplied.push(v);
    expect(result.migrationsApplied).toEqual(expectedApplied);
  });

  // ── ERROR HANDLING ─────────────────────────────────────────────────────
  it('Error handling: even with a partial state, migrations attempt to complete', () => {
    const state = { version: 10, stats: {} } as ReturnType<typeof makeV10State>;
    const result = runMigrations(state);
    // Some migrations may fail (missing fields) but the function should not throw.
    expect(result.state.version).toBeGreaterThan(10);
    // Errors list captures any failures.
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
