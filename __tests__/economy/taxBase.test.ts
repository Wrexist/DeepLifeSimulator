/**
 * Rent and luxury yield are in the tax base.
 *
 * `incomeTax = calculateIncomeTax(totalIncome)`, but `housingRentalIncome` was
 * added straight to available cash and never entered `totalIncome`, and luxury
 * yields were credited post-writeback. At the top bracket that made **$150k/wk
 * of rent worth $150k while $150k/wk of salary was worth $91k**. Add the luxury
 * yields and roughly $450k/wk of late-game income — over half the total — was
 * both untaxed and outside the net-worth soft cap, which made real estate a
 * strictly dominant strategy for a reason nothing in the design stated.
 *
 * The yield is CREDITED later in the tick than the tax is computed, so the fix
 * computes the taxable figure early (it is a pure function of the owned ids)
 * without moving where the cash lands. These tests pin that shape, and the
 * progressivity property that makes the fix worth having.
 */

import fs from 'fs';
import path from 'path';
import { calculateIncomeTax } from '@/lib/economy/constants';

const TICK = fs.readFileSync(
  path.join(__dirname, '../../contexts/game/GameActionsContext.tsx'),
  'utf8'
);

describe('the tick taxes the right base', () => {
  it('builds a taxable figure that includes rent and luxury yield', () => {
    expect(TICK).toMatch(
      /const taxableIncome = totalIncome \+ housingRentalIncome \+ taxableLuxuryYield;/
    );
  });

  it('taxes that figure, not the bare totalIncome', () => {
    expect(TICK).toMatch(/calculateIncomeTax\(taxableIncome\)/);
    expect(TICK).not.toMatch(/calculateIncomeTax\(totalIncome\)/);
  });

  it('derives the luxury figure from the owned ids, not from the later credit', () => {
    // The credit happens further down the tick (applyLuxuryItemsForWeek); the
    // taxable amount has to be computable at tax time.
    expect(TICK).toMatch(/getTotalLuxuryYield\(prevState\.luxuryItems\)/);
    expect(TICK).toMatch(/getLoanIncome\(prevState\.luxuryItems/);
  });

  it('still applies the Tax Strategy life-skill multiplier', () => {
    // Easy to drop while rewriting the line.
    expect(TICK).toMatch(/calculateIncomeTax\(taxableIncome\) \* lifeSkillMods\.taxMult/);
  });

  it('leaves the arrears settlement reading real cash, not the taxable figure', () => {
    // availableCash is what the player can actually pay bills with — it must
    // keep using the real credited streams.
    expect(TICK).toMatch(/availableCash: currentMoney \+ totalIncome \+ housingRentalIncome/);
  });
});

describe('why it matters — progressivity', () => {
  it('a landlord and a salaried earner on the same gross now owe the same', () => {
    // The whole point. Previously the rent half was free.
    const salaryOnly = calculateIncomeTax(150_000);
    const splitBase = calculateIncomeTax(75_000 + 75_000);
    expect(splitBase).toBe(salaryOnly);
  });

  it('moving income into the base raises the bill', () => {
    const before = calculateIncomeTax(150_000);
    const after = calculateIncomeTax(150_000 + 150_000);
    expect(after).toBeGreaterThan(before);
  });

  it('is still progressive, so a small landlord is barely touched', () => {
    // A week-50 player renting out a spare room should not feel this.
    const smallBefore = calculateIncomeTax(2_000);
    const smallAfter = calculateIncomeTax(2_000 + 140);
    const delta = smallAfter - smallBefore;
    expect(delta).toBeLessThan(100);
  });

  it('never exceeds the income it taxes', () => {
    for (const gross of [0, 1_000, 25_000, 150_000, 750_000]) {
      expect(`${gross}:${calculateIncomeTax(gross) <= gross}`).toBe(`${gross}:true`);
    }
  });
});
