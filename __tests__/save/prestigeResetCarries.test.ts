/**
 * What the prestige RESET path dropped that the heir path kept.
 *
 *  - Family-business debt: reset carried the companies and started with empty
 *    `loans` - the exact debt-shedding move the heir path's ANTI-EXPLOIT block
 *    exists to stop. Both paths now share one helper.
 *  - `dynastyStats` (heirlooms): only the heir path wrote it, so a reset
 *    restored `initialGameState`'s empty record. `applyDynastyTransition` now
 *    refuses to let the record go backward on either path.
 *  - Device preferences (sound, haptics, notifications, theme) reset to the
 *    template on every prestige, heir continuation and fresh start.
 */
import { executePrestige, continueAsChild } from '@/lib/prestige/prestigeExecution';
import {
  USER_PREFERENCE_SETTINGS_KEYS,
  carryAccountLevelEntitlements,
} from '@/lib/prestige/accountEntitlements';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Loan, Heirloom } from '@/contexts/game/types';

const businessLoan: Loan = {
  id: 'loan-co1',
  name: 'Business Expansion Loan',
  principal: 80_000,
  remaining: 50_000,
  rateAPR: 0.08,
  termWeeks: 260,
  weeklyPayment: 400,
  startWeek: 900,
  autoPay: true,
  type: 'business',
  weeksRemaining: 125,
  interestRate: 0.08,
};

const heirloom: Heirloom = {
  id: 'heirloom-watch',
  name: 'Founder Watch',
  description: 'Passed down since the first generation.',
  rarity: 'legendary',
  generationsHeld: 2,
  originalOwner: 'Ada',
  currentValue: 250_000,
  bonuses: { incomeBonus: 5 },
  icon: 'watch',
};

/** A wealthy owner of a family business, with a business loan, an heirloom and quiet settings. */
function owner(): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 2000,
    stats: { ...base.stats, money: 500_000_000 },
    companies: [{ id: 'co1', name: 'Acme' }] as never,
    familyBusinesses: [
      { companyId: 'co1', foundedGeneration: 1, generationsHeld: 1, brandValue: 0, reputation: 50 },
    ],
    loans: [businessLoan],
    dynastyStats: {
      ...base.dynastyStats!,
      totalGenerations: 3,
      heirlooms: [heirloom],
    },
    settings: {
      ...base.settings,
      soundEnabled: false,
      musicEnabled: false,
      hapticFeedback: false,
      notificationsEnabled: false,
      darkMode: false,
    },
    family: {
      ...base.family,
      children: [{ id: 'heir-1', name: 'Ada', age: 20, gender: 'female' }],
    } as never,
  });
}

describe('prestige reset keeps family-business debt with the family business', () => {
  it('reset carries the company AND its loan', () => {
    const after = executePrestige(owner(), 'reset');
    expect(after.companies?.some((c) => c.id === 'co1')).toBe(true);
    expect(after.loans?.find((l) => l.id === 'loan-co1')?.remaining).toBe(50_000);
  });

  it('the heir path still does (shared helper), and does not alias the old loan', () => {
    const before = owner();
    const after = executePrestige(before, 'child', 'heir-1');
    const carried = after.loans?.find((l) => l.id === 'loan-co1');
    expect(carried?.remaining).toBe(50_000);
    expect(carried).not.toBe(before.loans?.[0]);
  });
});

describe('dynastyStats survive a prestige reset', () => {
  it('an heirloom survives a reset, generation count unchanged', () => {
    const after = executePrestige(owner(), 'reset');
    expect(after.dynastyStats?.heirlooms.map((h) => h.id)).toEqual(['heirloom-watch']);
    expect(after.dynastyStats?.totalGenerations).toBe(3);
  });

  it('the heir path still folds the ended life in (it is AHEAD, so it stands)', () => {
    const after = continueAsChild(owner(), 'heir-1');
    expect(after.dynastyStats?.totalGenerations).toBe(4);
    expect(after.dynastyStats?.heirlooms.some((h) => h.id === 'heirloom-watch')).toBe(true);
  });

  it('the reset copy is detached from the outgoing life', () => {
    const before = owner();
    const after = executePrestige(before, 'reset');
    after.dynastyStats!.heirlooms.push({ ...heirloom, id: 'later' });
    expect(before.dynastyStats!.heirlooms).toHaveLength(1);
  });
});

describe.each([
  ['prestige reset', (s: GameState) => executePrestige(s, 'reset')],
  ['prestige as child', (s: GameState) => executePrestige(s, 'child', 'heir-1')],
  ['death -> continue as heir', (s: GameState) => continueAsChild(s, 'heir-1')],
  ['fresh start (DangerZone)', (s: GameState) =>
    carryAccountLevelEntitlements(s, JSON.parse(JSON.stringify(initialGameState)) as typeof initialGameState)],
])('device preferences survive %s', (_label, run) => {
  it('keeps sound, music, haptics, notifications and theme as the player set them', () => {
    const s = run(owner()).settings;
    expect(s.soundEnabled).toBe(false);
    expect(s.musicEnabled).toBe(false);
    expect(s.hapticFeedback).toBe(false);
    expect(s.notificationsEnabled).toBe(false);
    expect(s.darkMode).toBe(false);
  });
});

it('the preference list holds no weeksLived marker (those must not cross a life)', () => {
  for (const key of USER_PREFERENCE_SETTINGS_KEYS) {
    expect(key.toLowerCase()).not.toContain('week');
  }
});
