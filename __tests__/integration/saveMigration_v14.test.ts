/**
 * Save Migration v14 — Banking system remake
 *
 * Verifies the v13 → v14 migration is:
 *   1. Additive — every existing field is preserved verbatim (bankSavings, loans, etc.)
 *   2. Idempotent — running twice is a no-op
 *   3. Defensive — handles missing banking, missing loans, NaN balances
 *   4. Mirrors legacy state — banking.accounts savings balance equals bankSavings
 *   5. Chained — v10 → v11 → v12 → v13 → v14 runs end-to-end and lands clean
 */

import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';

describe('Save migration → v14 (Banking system)', () => {
  describe('additive preservation', () => {
    it('preserves legacy bankSavings + loans', () => {
      const v13 = {
        version: 13,
        weeksLived: 42,
        bankSavings: 3450,
        loans: [
          {
            id: 'l1',
            name: 'Personal',
            principal: 5000,
            remaining: 2500,
            rateAPR: 0.08,
            termWeeks: 52,
            weeklyPayment: 102,
            startWeek: 0,
            autoPay: true,
            type: 'personal' as const,
            weeksRemaining: 26,
            interestRate: 0.08,
          },
        ],
      };
      const { state, errors } = runMigrations(v13);
      expect(errors).toEqual([]);
      expect(state.version).toBeGreaterThanOrEqual(14);
      expect(state.bankSavings).toBe(3450);
      expect(state.loans).toHaveLength(1);
      expect(state.loans[0].id).toBe('l1');
      expect(state.loans[0].principal).toBe(5000);
    });

    it('seeds banking.accounts with the legacy savings balance', () => {
      const v13 = { version: 13, weeksLived: 10, bankSavings: 1234 };
      const { state } = runMigrations(v13);
      expect(state.banking).toBeDefined();
      const savings = state.banking.accounts.find((a: any) => a.type === 'savings');
      expect(savings.balance).toBe(1234);
    });

    it('also creates a default checking account starting at $0', () => {
      const v13 = { version: 13, weeksLived: 10, bankSavings: 0 };
      const { state } = runMigrations(v13);
      const checking = state.banking.accounts.find((a: any) => a.type === 'checking');
      expect(checking).toBeDefined();
      expect(checking.balance).toBe(0);
    });

    it('starts new players in the fair credit band', () => {
      const v13 = { version: 13, weeksLived: 0 };
      const { state } = runMigrations(v13);
      expect(state.banking.creditScore.band).toBe('fair');
      expect(state.banking.creditScore.score).toBeGreaterThanOrEqual(580);
      expect(state.banking.creditScore.score).toBeLessThanOrEqual(669);
    });

    it('backfills loans with on-time/late payment trackers', () => {
      const v13 = {
        version: 13,
        weeksLived: 0,
        loans: [
          {
            id: 'l1',
            name: 'L',
            principal: 1000,
            remaining: 500,
            rateAPR: 0.08,
            termWeeks: 52,
            weeklyPayment: 25,
            startWeek: 0,
            autoPay: true,
            type: 'personal' as const,
            weeksRemaining: 26,
            interestRate: 0.08,
          },
        ],
      };
      const { state } = runMigrations(v13);
      expect(state.loans[0].onTimePayments).toBe(0);
      expect(state.loans[0].latePayments).toBe(0);
      expect(state.loans[0].originalAPR).toBe(0.08);
    });
  });

  describe('idempotence', () => {
    it('running v14 migration twice produces an identical result', () => {
      const v13 = { version: 13, weeksLived: 5, bankSavings: 999 };
      const first = runMigrations(v13);
      const beforeSecond = JSON.parse(JSON.stringify(first.state));
      const second = runMigrations(first.state);
      expect(second.state.banking).toEqual(beforeSecond.banking);
      expect(second.errors).toEqual([]);
    });
  });

  describe('defensive', () => {
    it('handles missing bankSavings (defaults to 0)', () => {
      const v13 = { version: 13, weeksLived: 0 };
      const { state, errors } = runMigrations(v13);
      expect(errors).toEqual([]);
      const savings = state.banking.accounts.find((a: any) => a.type === 'savings');
      expect(savings.balance).toBe(0);
    });

    it('handles NaN bankSavings (treats as 0)', () => {
      const v13 = { version: 13, weeksLived: 0, bankSavings: NaN };
      const { state, errors } = runMigrations(v13);
      expect(errors).toEqual([]);
      const savings = state.banking.accounts.find((a: any) => a.type === 'savings');
      expect(savings.balance).toBe(0);
    });

    it('handles missing loans[] (no crash)', () => {
      const v13 = { version: 13, weeksLived: 0 };
      const { state, errors } = runMigrations(v13);
      expect(errors).toEqual([]);
      expect(state.banking).toBeDefined();
    });

    it('handles missing weeksLived (treats as 0)', () => {
      const v13 = { version: 13 };
      const { state, errors } = runMigrations(v13);
      expect(errors).toEqual([]);
      expect(state.banking.accounts[0].openedWeek).toBe(0);
    });
  });

  describe('chained migrations', () => {
    it('migrates a v10 save all the way through to v14', () => {
      const v10 = {
        version: 10,
        weeksLived: 100,
        bankSavings: 500,
        socialMedia: {
          followers: 10,
          influenceLevel: 'novice',
          totalPosts: 1,
          viralPosts: 0,
          brandPartnerships: 0,
          engagementRate: 0,
        },
      };
      const { state, migrationsApplied, errors } = runMigrations(v10);
      expect(errors).toEqual([]);
      expect(state.version).toBe(CURRENT_STATE_VERSION);
      expect(migrationsApplied).toEqual(expect.arrayContaining([11, 12, 13, 14]));
      expect(state.banking).toBeDefined();
      expect(state.banking.accounts.find((a: any) => a.type === 'savings').balance).toBe(500);
    });
  });

  describe('CURRENT_STATE_VERSION', () => {
    it('is at least 14 (banking remake landed)', () => {
      expect(CURRENT_STATE_VERSION).toBeGreaterThanOrEqual(14);
    });
  });
});
