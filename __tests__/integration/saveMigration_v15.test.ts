/**
 * Save Migration v15 — Spark dating platform.
 *
 * Verifies the v14 → v15 migration is:
 *   1. Additive — relationships/family stay intact
 *   2. Idempotent — running twice is a no-op
 *   3. Defensive — handles missing sparkApp, partial state
 *   4. Chained — earlier versions migrate through cleanly
 */
import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';

describe('Save migration → v15 (Spark dating platform)', () => {
  describe('additive preservation', () => {
    it('preserves existing relationships untouched', () => {
      const v14 = {
        version: 14,
        weeksLived: 20,
        relationships: [
          { id: 'r1', name: 'Sarah', type: 'partner', relationshipScore: 75, personality: 'friendly', gender: 'female', age: 26 },
        ],
        family: { children: [] },
      };
      const { state, errors } = runMigrations(v14);
      expect(errors).toEqual([]);
      expect(state.version).toBeGreaterThanOrEqual(15);
      expect(state.relationships).toHaveLength(1);
      expect(state.relationships[0].name).toBe('Sarah');
    });

    it('initializes sparkApp with all required sub-objects', () => {
      const { state } = runMigrations({ version: 14, weeksLived: 5 });
      const sp = state.sparkApp;
      expect(sp).toBeDefined();
      expect(sp.profile).toEqual({
        bio: '', photos: [], interests: [], showAge: true, showJob: true, showWealth: false,
      });
      expect(Array.isArray(sp.swipes)).toBe(true);
      expect(Array.isArray(sp.matches)).toBe(true);
      expect(typeof sp.messages).toBe('object');
      expect(sp.swipeQuota).toBe(30);
      expect(sp.swipesUsedThisWeek).toBe(0);
      expect(sp.premium.active).toBe(false);
      expect(sp.premium.tier).toBe('free');
      expect(sp.premium.perks.boostMultiplier).toBe(1.0);
      expect(sp.activeJealousy === null).toBe(true);
      expect(sp.boost === null).toBe(true);
      expect(sp.lifetimeStats.peakPremiumTier).toBe('free');
    });
  });

  describe('idempotency', () => {
    it('running v15 migration twice is a no-op', () => {
      const v14 = { version: 14, weeksLived: 1 };
      const first = runMigrations(v14);
      const snapshot = JSON.parse(JSON.stringify(first.state));
      const second = runMigrations(first.state);
      expect(second.state).toEqual(snapshot);
      expect(second.migrationsApplied).toEqual([]);
    });
  });

  describe('chained migration', () => {
    it('migrates a minimal v10 save end-to-end through v15', () => {
      const v10 = { version: 10, weeksLived: 3 };
      const { state, errors, migrationsApplied } = runMigrations(v10);
      expect(errors).toEqual([]);
      expect(state.version).toBe(CURRENT_STATE_VERSION);
      expect(migrationsApplied).toEqual(expect.arrayContaining([11, 12, 13, 14, 15]));
      expect(state.sparkApp).toBeDefined();
      expect(state.socialMedia).toBeDefined(); // v13
      expect(state.banking).toBeDefined();     // v14
    });
  });

  describe('repairGameState fills v15 defaults', () => {
    it('rebuilds sparkApp when missing entirely', () => {
      const corrupted: any = { version: 15, weeksLived: 0 };
      const { repaired, repairs } = repairGameState(corrupted);
      expect(repaired).toBe(true);
      expect(repairs.length).toBeGreaterThan(0);
      expect(corrupted.sparkApp).toBeDefined();
      expect(corrupted.sparkApp.profile).toBeDefined();
      expect(corrupted.sparkApp.premium.tier).toBe('free');
      expect(corrupted.sparkApp.lifetimeStats).toBeDefined();
    });

    it('preserves an already-present sparkApp.messages map', () => {
      const partial: any = {
        version: 15,
        weeksLived: 10,
        sparkApp: {
          profile: { bio: 'hi', photos: ['p.jpg'], interests: ['art'], showAge: true, showJob: true, showWealth: false },
          messages: { 'match-1': [{ id: 'm1', matchId: 'match-1', from: 'player', text: 'hey', timestamp: 1, gameWeek: 5 }] },
        },
      };
      repairGameState(partial);
      expect(partial.sparkApp.profile.bio).toBe('hi');
      expect(partial.sparkApp.messages['match-1']).toHaveLength(1);
      expect(partial.sparkApp.swipes).toEqual([]);
      expect(partial.sparkApp.matches).toEqual([]);
    });
  });
});
