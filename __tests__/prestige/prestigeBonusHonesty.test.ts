/**
 * Every prestige bonus must do what its card says - 2026-10-17 audit of all
 * 45 purchasable bonuses against their consumers.
 *
 * Previous rounds found bonuses with NO consumer (Investment Portfolio,
 * Achievement Hunter, the automation set). This round found none of those
 * left; what remained were cards that described a different effect from the
 * one the code delivers, two duplicates that cost points for nothing, and one
 * bonus that silently granted nothing to dynasty players. Each is pinned here
 * against the code path that really applies it, not against the copy alone.
 */
import fs from 'fs';
import path from 'path';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { computeWeeklyIncome } from '@/contexts/game/actions/weekly/applyIncome';
import { applyStartingBonuses, getIncomeMultiplier } from '@/lib/prestige/applyBonuses';
import { getBonusById } from '@/lib/prestige/prestigeBonuses';
import { redundantBonusReason } from '@/lib/prestige/inertBonuses';
import { netWorthPrestigePoints } from '@/lib/prestige/prestigePoints';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';

const describe_ = (id: string): string => getBonusById(id)?.description ?? '';

/** The stats a prestige RESET hands the next life before bonuses apply. */
const freshResetStart = () =>
  createTestGameState({ stats: { health: 100, happiness: 100, energy: 100, fitness: 10, money: 200 } });

describe('starting stat boosts on a fresh (reset) life', () => {
  it.each([
    ['starting_stats_1', 5],
    ['starting_stats_2', 10],
    ['starting_stats_3', 20],
  ])('%s moves fitness only - the other three already start at 100', (id, amount) => {
    const out = applyStartingBonuses(freshResetStart(), [id]);
    expect(out.stats.fitness).toBe(10 + amount);
    expect([out.stats.health, out.stats.happiness, out.stats.energy]).toEqual([100, 100, 100]);
    // So the card says fitness, and says the rest is for heirs.
    expect(describe_(id)).toMatch(new RegExp(`^\\+${amount} starting fitness; heirs also get`));
    expect(describe_(id)).not.toMatch(/all starting stats/);
  });

  it('Life Master boosts the stat amount and never the inheritance money', () => {
    const owned = ['starting_money_1', 'starting_money_1', 'starting_stats_3'];
    const without = applyStartingBonuses(freshResetStart(), owned);
    const withSynergy = applyStartingBonuses(freshResetStart(), [...owned, 'synergy_life_master']);
    expect(withSynergy.stats.money).toBe(without.stats.money);
    expect(withSynergy.stats.fitness).toBe(10 + Math.floor(20 * 1.25));
    expect(describe_('synergy_life_master')).toMatch(/Boost bonuses give \+25% more stats/);
  });

  it('Perfect Start names the four stats it sets (reputation is untouched)', () => {
    const out = applyStartingBonuses(freshResetStart(), ['perfect_start']);
    expect(out.stats.fitness).toBe(100);
    expect(out.stats.reputation).toBe(freshResetStart().stats.reputation);
    expect(describe_('perfect_start')).toBe('Start every life at 100 health, happiness, energy and fitness');
  });
});

describe('the Learner bonuses speed up STUDY, not career experience', () => {
  it.each(['experience_multiplier_1', 'experience_multiplier_2', 'experience_multiplier_3'])(
    '%s says study speed',
    id => {
      // Their only consumer is the education tick (applyEducationProgression);
      // careers have their own experience, which these never touch.
      expect(describe_(id)).toMatch(/study speed/);
      expect(describe_(id)).not.toMatch(/experience/i);
    },
  );
});

describe('Wealth Magnet multiplies ALL income, not passive income', () => {
  it('raises a salary-only paycheck by the full income multiplier', () => {
    const pay = (unlockedBonuses: string[]) =>
      computeWeeklyIncome({
        prevState: createTestGameState(),
        careerSalary: 1_000,
        passiveIncome: 0,
        pulseEarnings: 0,
        weeksLivedNow: 500,
        unlockedBonuses,
        economyIncomeMultiplier: 1,
      }).totalIncome;
    expect(pay(['wealth_magnet'])).toBe(Math.round(1_000 * getIncomeMultiplier(['wealth_magnet'])));
    expect(pay(['wealth_magnet'])).toBeGreaterThan(pay([]));
    expect(describe_('wealth_magnet')).toBe('+100% to all income sources');
  });
});

describe('duplicates that would cost points for nothing', () => {
  it('prestige Immortality is flagged when the Gem Shop one is owned', () => {
    expect(redundantBonusReason('immortality', { goldUpgrades: { immortality: true } }))
      .toMatch(/Gem Shop/);
    expect(redundantBonusReason('immortality', { goldUpgrades: {} })).toBeNull();
    // Already bought: nothing left to warn about.
    expect(redundantBonusReason('immortality', {
      unlockedBonuses: ['immortality'], goldUpgrades: { immortality: true },
    })).toBeNull();
  });

  it('the two "complete every education" bonuses flag each other', () => {
    expect(redundantBonusReason('legacy_education', { unlockedBonuses: ['early_education_access'] }))
      .toMatch(/Educated Start/);
    expect(redundantBonusReason('early_education_access', { unlockedBonuses: ['legacy_education'] }))
      .toMatch(/Educational Legacy/);
    expect(redundantBonusReason('legacy_education', { unlockedBonuses: [] })).toBeNull();
  });

  it('is null for everything else', () => {
    expect(redundantBonusReason('wealth_magnet', { unlockedBonuses: [], goldUpgrades: { immortality: true } })).toBeNull();
  });
});

describe('player-facing copy quotes the numbers the code uses', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the Help screen states the real curve and threshold', () => {
    const help = read('components/HelpModal.tsx');
    expect(netWorthPrestigePoints(10_000_000)).toBe(10_000);
    expect(netWorthPrestigePoints(40_000_000)).toBe(20_000);
    expect(netWorthPrestigePoints(1_000_000_000)).toBe(100_000);
    expect(help).toMatch(/10,000 points at \$10M \(1,000 per \$1M up to there\)/);
    expect(help).toMatch(/\$40M pays 20,000 and \$1B pays 100,000/);
    expect(help).toMatch(/never less than 100 per \$1M/);
    expect(getPrestigeThreshold(0)).toBe(10_000_000);
    expect(getPrestigeThreshold(1)).toBe(12_500_000);
    // The retired $100M-era copy, and its 0.1-per-$1M formula, are gone.
    expect(help).not.toMatch(/\$100M\+? net worth/);
    expect(help).not.toMatch(/1,000,000\) \* 0\.1/);
  });

  it('the death screen lists the stat boost as what it does on a fresh life', () => {
    const death = read('components/DeathPopup.tsx');
    expect(death).not.toMatch(/\+5 to all starting stats/);
    expect(death).toMatch(/\+5 starting fitness \(1,000 pts\)/);
  });

  it('the prestige gate prints the exact threshold, not a rounded million', () => {
    // $12,500,000 printed as "$13M" by toFixed(0).
    const modal = read('components/PrestigeModal.tsx');
    expect(modal).not.toMatch(/threshold \/ 1_000_000\)\.toFixed\(0\)/);
    expect(modal).toMatch(/threshold\.toLocaleString\('en-US'\)/);
  });
});
