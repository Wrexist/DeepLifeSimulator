/**
 * The Budget tab must record what the week actually took.
 *
 * `banking.budgetSpend` is fed by the `spendEvents` list in the week loop, and
 * it had the same two gaps the identity card had:
 *
 *   - its housing row was `weeklyRent + housingUpkeep`, missing
 *     `housingWellbeing.rent` — the v32 TENANCY rent. A renting player's
 *     housing spend therefore read as upkeep alone, usually $0, while the tick
 *     charged $45-$950 a week and could evict them over the arrears.
 *   - there was no education row at all, though `BudgetCategory` has always
 *     had `'education'`. A category with a type but no writer.
 *
 * Both figures are already computed by the tick and folded into
 * `weeklyBillsDue`; they simply were not reported. These assertions read the
 * SOURCE rather than driving a full tick, because the alternative is
 * reconstructing the week loop in a fixture — which is how the card's copy
 * drifted from the tick in the first place.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'),
  'utf8',
);

/** The `spendEvents: [ ... ]` array literal, comments stripped. */
const spendEvents = (() => {
  const at = SRC.indexOf('spendEvents: [');
  expect(at).toBeGreaterThan(-1);
  return SRC.slice(at, SRC.indexOf('\n ],', at))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
})();

describe('the budget records the housing the tick charges', () => {
  it('the housing row includes the tenancy rent', () => {
    expect(spendEvents).toMatch(/category: 'housing', amount: weeklyRent \+ housingWellbeing\.rent \+ housingUpkeep/);
  });

  it('and it is the same term the bill line uses', () => {
    // One source for the number. `weeklyBillsDue` is the authority on what is
    // owed; the budget row must not compute its own housing figure.
    expect(SRC).toMatch(/weeklyBillsDue = Math\.max\(0, incomeTax \+ weeklyRent \+ housingWellbeing\.rent \+ housingUpkeep/);
  });
});

describe('and the education it charges', () => {
  it('an education row exists and reports the charged amount', () => {
    expect(spendEvents).toMatch(/category: 'education', amount: educationWeeklyCost/);
  });

  it('`educationWeeklyCost` is the amount actually deducted, not a projection', () => {
    // The tick measures it as a money delta across the progression helper, so
    // a broke week reports what was really taken rather than the sticker.
    expect(SRC).toMatch(/educationWeeklyCost = Math\.max\(0, moneyBeforeEducation -/);
  });
});

describe('the categories it writes are real ones (the control)', () => {
  it('every category in spendEvents is a declared BudgetCategory', () => {
    const declared = fs
      .readFileSync(path.join(__dirname, '..', '..', 'contexts/game/types.ts'), 'utf8')
      .slice(0, 200_000);
    const union = declared.slice(declared.indexOf('export type BudgetCategory ='));
    const valid = new Set(
      (union.slice(0, union.indexOf(';')).match(/'([a-z]+)'/g) || []).map((s) => s.slice(1, -1)),
    );

    const used = [...spendEvents.matchAll(/category: '([a-z]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(5);
    for (const c of used) expect([...valid]).toContain(c);
  });
});
