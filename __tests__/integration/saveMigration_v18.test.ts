/**
 * Save Migration v18 — OnionApp / Dark Web remake.
 *
 *   1. Additive — existing wantedLevel, darkWebItems[], hacks[] preserved.
 *   2. Idempotent — running twice is a no-op.
 *   3. Defensive — handles missing wantedLevel, missing arrays.
 *   4. Seeds `darkWeb.heat` from legacy `wantedLevel` so mid-game players don't reset.
 *   5. Chains end-to-end from v10 → CURRENT_STATE_VERSION.
 */

import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';

describe('Save migration → v18 (Dark Web remake)', () => {
  describe('additive preservation', () => {
    it('preserves wantedLevel and seeds heat from it (×10 scaling)', () => {
      const v17 = { version: 17, weeksLived: 10, wantedLevel: 5 };
      const { state, errors } = runMigrations(v17);
      expect(errors).toEqual([]);
      expect(state.wantedLevel).toBe(5);
      expect(state.darkWeb.heat).toBe(50);
    });

    it('caps seeded heat at 100', () => {
      const v17 = { version: 17, weeksLived: 0, wantedLevel: 15 };
      const { state } = runMigrations(v17);
      expect(state.darkWeb.heat).toBe(100);
    });

    it('preserves darkWebItems[] and hacks[] verbatim', () => {
      const v17 = {
        version: 17,
        weeksLived: 0,
        darkWebItems: [{ id: 'vpn', name: 'VPN', costBtc: 0.007, owned: true }],
        hacks: [{ id: 'phishing', name: 'Phishing', description: 'x', costBtc: 0.01, risk: 0.3, reward: 400, purchased: true, energyCost: 10 }],
      };
      const { state } = runMigrations(v17);
      expect(state.darkWebItems[0].owned).toBe(true);
      expect(state.hacks[0].purchased).toBe(true);
    });

    it('seeds 4 default vendors', () => {
      const { state } = runMigrations({ version: 17, weeksLived: 0 });
      expect(state.darkWeb.vendors).toHaveLength(4);
      expect(state.darkWeb.vendors.map((v: any) => v.id).sort()).toEqual([
        'vendor-burner',
        'vendor-shadow',
        'vendor-veil',
        'vendor-zerocool',
      ]);
    });

    it('seeds the four skill slots at level 1', () => {
      const { state } = runMigrations({ version: 17, weeksLived: 0 });
      const ids = Object.keys(state.darkWeb.skills).sort();
      expect(ids).toEqual(['hacking', 'laundering', 'opsec', 'social']);
      for (const id of ids) {
        expect(state.darkWeb.skills[id].level).toBe(1);
        expect(state.darkWeb.skills[id].xp).toBe(0);
      }
    });

    it('initializes empty market, jobs, laundering, recent events', () => {
      const { state } = runMigrations({ version: 17, weeksLived: 0 });
      expect(state.darkWeb.listings).toEqual([]);
      expect(state.darkWeb.activeJobs).toEqual([]);
      expect(state.darkWeb.jobHistory).toEqual([]);
      expect(state.darkWeb.laundering).toEqual([]);
      expect(state.darkWeb.recentEvents).toEqual([]);
      expect(state.darkWeb.dirtyBtc).toBe(0);
      expect(state.darkWeb.cleanBtc).toBe(0);
    });
  });

  describe('idempotence', () => {
    it('running v18 twice leaves darkWeb identical', () => {
      const v17 = { version: 17, weeksLived: 5, wantedLevel: 3 };
      const first = runMigrations(v17);
      const snapshot = JSON.parse(JSON.stringify(first.state.darkWeb));
      const second = runMigrations(first.state);
      expect(second.state.darkWeb).toEqual(snapshot);
    });
  });

  describe('defensive', () => {
    it('handles missing wantedLevel (heat defaults to 0)', () => {
      const { state, errors } = runMigrations({ version: 17, weeksLived: 0 });
      expect(errors).toEqual([]);
      expect(state.darkWeb.heat).toBe(0);
    });

    it('handles NaN wantedLevel (heat defaults to 0)', () => {
      const { state, errors } = runMigrations({ version: 17, weeksLived: 0, wantedLevel: NaN });
      expect(errors).toEqual([]);
      expect(state.darkWeb.heat).toBe(0);
    });

    it('handles missing weeksLived (lastHeatDecayWeek defaults to 0)', () => {
      const { state } = runMigrations({ version: 17 });
      expect(state.darkWeb.lastHeatDecayWeek).toBe(0);
    });
  });

  describe('chained migrations', () => {
    it('migrates a v10 save through to v18', () => {
      const v10 = {
        version: 10,
        weeksLived: 50,
        wantedLevel: 2,
        bankSavings: 100,
        cryptos: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50000, change: 0, changePercent: 0, owned: 0 }],
      };
      const { state, errors, migrationsApplied } = runMigrations(v10);
      expect(errors).toEqual([]);
      expect(state.version).toBe(CURRENT_STATE_VERSION);
      expect(migrationsApplied).toEqual(expect.arrayContaining([11, 12, 13, 14, 15, 16, 17, 18]));
      expect(state.darkWeb).toBeDefined();
      expect(state.banking).toBeDefined();
      expect(state.cryptoMarket).toBeDefined();
    });
  });

  describe('CURRENT_STATE_VERSION', () => {
    it('is at least 18 (dark-web remake landed)', () => {
      expect(CURRENT_STATE_VERSION).toBeGreaterThanOrEqual(18);
    });
  });
});
