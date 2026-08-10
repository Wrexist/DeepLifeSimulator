/**
 * Conglomerate — more than one company of the same type.
 *
 * `createCompany` set `id: companyType` and rejected a second founding, so the
 * ceiling was five companies and the whole system cost $12.0M to own and max
 * out completely, with a ~50-week payback. The deepest money engine in the game
 * was finite and finished early.
 *
 * The property that makes this safe to ship is worth stating plainly:
 * `PER_SOURCE_CAPS.companies` is a hard $200k/wk ceiling on TOTAL company
 * income, which the five maxed originals already exceed (~$238k/wk). So a
 * subsidiary adds cost and no income — a pure sink, which is exactly what the
 * economy audit found the late game to be missing.
 */

import fs from 'fs';
import path from 'path';
import {
  SUBSIDIARY_COST_MULTIPLIER,
  MAX_PER_COMPANY_TYPE,
  countCompaniesOfType,
  nextCompanyId,
  subsidiaryCost,
  canFoundAnother,
  subsidiaryName,
} from '@/lib/business/subsidiaries';
import {
  isPrestigeFeatureUnlocked,
  prestigeUnlockRequirement,
  prestigeTier,
} from '@/lib/progress/featureUnlocks';

const co = (id: string, type: string) => ({ id, type });

describe('counting', () => {
  it('is zero for an empty, missing or corrupt list', () => {
    for (const bad of [undefined, null, [], 'nope' as unknown as []]) {
      expect(countCompaniesOfType(bad as never, 'bank')).toBe(0);
    }
  });

  it('counts by type, not by id', () => {
    const companies = [co('bank', 'bank'), co('bank-2', 'bank'), co('factory', 'factory')];
    expect(countCompaniesOfType(companies, 'bank')).toBe(2);
    expect(countCompaniesOfType(companies, 'factory')).toBe(1);
    expect(countCompaniesOfType(companies, 'ai')).toBe(0);
  });

  it('falls back to the id for a legacy record with no type', () => {
    // Pre-`type` records always used the bare type as their id.
    const legacy = [{ id: 'bank' }] as unknown as { id: string; type?: string }[];
    expect(countCompaniesOfType(legacy, 'bank')).toBe(1);
  });

  it('skips null entries rather than throwing', () => {
    const companies = [null, co('bank', 'bank')] as unknown as { id: string; type: string }[];
    expect(countCompaniesOfType(companies, 'bank')).toBe(1);
  });
});

describe('id allocation', () => {
  it('gives the FIRST company of a type the bare type id', () => {
    // The back-compat guarantee: every existing save keeps resolving, so no
    // migration is needed.
    expect(nextCompanyId([], 'bank')).toBe('bank');
    expect(nextCompanyId([co('factory', 'factory')], 'bank')).toBe('bank');
  });

  it('suffixes the second onward', () => {
    expect(nextCompanyId([co('bank', 'bank')], 'bank')).toBe('bank-2');
    expect(nextCompanyId([co('bank', 'bank'), co('bank-2', 'bank')], 'bank')).toBe('bank-3');
  });

  it('never collides with an id already taken', () => {
    // A save with a gap — a sold subsidiary — must not mint a duplicate.
    const withGap = [co('bank', 'bank'), co('bank-3', 'bank')];
    const next = nextCompanyId(withGap, 'bank');
    expect(next).toBe('bank-2');
    expect(withGap.some((c) => c.id === next)).toBe(false);
  });

  it('produces a unique id for every founding up to the cap', () => {
    const companies: { id: string; type: string }[] = [];
    for (let i = 0; i < MAX_PER_COMPANY_TYPE; i += 1) {
      const id = nextCompanyId(companies, 'bank');
      expect(companies.some((c) => c.id === id)).toBe(false);
      companies.push(co(id, 'bank'));
    }
    expect(new Set(companies.map((c) => c.id)).size).toBe(MAX_PER_COMPANY_TYPE);
  });
});

describe('escalating price', () => {
  it('charges base for the first', () => {
    expect(subsidiaryCost(2_000_000, 0)).toBe(2_000_000);
  });

  it('multiplies per subsidiary already owned', () => {
    expect(subsidiaryCost(2_000_000, 1)).toBe(2_000_000 * SUBSIDIARY_COST_MULTIPLIER);
    expect(subsidiaryCost(2_000_000, 2)).toBe(
      Math.round(2_000_000 * SUBSIDIARY_COST_MULTIPLIER ** 2)
    );
  });

  it('makes the full set a genuinely late-game sink', () => {
    // Three of every type, at the real catalogue prices. This is the number
    // that has to be large for the feature to be worth shipping — the whole
    // point is a cost that scales into the late game.
    const catalogue = [50_000, 90_000, 130_000, 200_000, 2_000_000];
    let total = 0;
    for (const base of catalogue) {
      for (let owned = 0; owned < MAX_PER_COMPANY_TYPE; owned += 1) {
        total += subsidiaryCost(base, owned);
      }
    }
    // The pre-change ceiling was $2.47M of foundings ($12.0M with all upgrades).
    expect(total).toBeGreaterThan(20_000_000);
  });

  it('is monotonic and never negative', () => {
    let prev = -1;
    for (let owned = 0; owned <= MAX_PER_COMPANY_TYPE; owned += 1) {
      const cost = subsidiaryCost(50_000, owned);
      expect(cost).toBeGreaterThan(prev);
      prev = cost;
    }
  });

  it('returns 0 rather than NaN for a corrupt base cost', () => {
    for (const bad of [0, -1, NaN, Infinity, undefined as unknown as number]) {
      expect(`${String(bad)}:${subsidiaryCost(bad, 1)}`).toBe(`${String(bad)}:0`);
    }
  });

  it('treats a corrupt owned count as zero rather than NaN', () => {
    for (const bad of [NaN, -3, undefined as unknown as number]) {
      expect(`${String(bad)}:${subsidiaryCost(50_000, bad)}`).toBe(`${String(bad)}:50000`);
    }
  });
});

describe('the per-type cap', () => {
  it('allows founding up to the cap and refuses past it', () => {
    const companies: { id: string; type: string }[] = [];
    for (let i = 0; i < MAX_PER_COMPANY_TYPE; i += 1) {
      expect(canFoundAnother(companies, 'bank')).toBe(true);
      companies.push(co(nextCompanyId(companies, 'bank'), 'bank'));
    }
    expect(canFoundAnother(companies, 'bank')).toBe(false);
  });

  it('caps per type, not globally', () => {
    const maxedBanks = Array.from({ length: MAX_PER_COMPANY_TYPE }, (_, i) =>
      co(i === 0 ? 'bank' : `bank-${i + 1}`, 'bank')
    );
    expect(canFoundAnother(maxedBanks, 'bank')).toBe(false);
    expect(canFoundAnother(maxedBanks, 'factory')).toBe(true);
  });
});

describe('naming', () => {
  it('leaves the first unsuffixed and numbers the rest', () => {
    expect(subsidiaryName('My Bank', 0)).toBe('My Bank');
    expect(subsidiaryName('My Bank', 1)).toBe('My Bank II');
    expect(subsidiaryName('My Bank', 2)).toBe('My Bank III');
  });

  it('does not produce "undefined" past the suffix table', () => {
    expect(subsidiaryName('My Bank', 99)).not.toMatch(/undefined/);
  });
});

describe('the action and the UI quote the same price', () => {
  // The advertised-vs-actual class: the create screen used to compute its
  // figure from the flat catalogue cost, which after this change is not what
  // createCompany charges for a subsidiary.
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

  it('both derive the cost from subsidiaryCost', () => {
    expect(read('contexts/game/actions/CompanyActions.ts')).toMatch(/subsidiaryCost\s*\(/);
    expect(read('components/mobile/Hustle/screens/CreateCompanyScreen.tsx')).toMatch(
      /subsidiaryCost\s*\(/
    );
  });

  it('the action re-checks the per-type cap inside its updater', () => {
    // §4.4: the id, the count and the price are all computed OUTSIDE the
    // updater, so the cap has to be re-checked against `prev` or a concurrent
    // founding could buy a third at the second's price.
    const source = read('contexts/game/actions/CompanyActions.ts');
    const updater = source.slice(source.indexOf('setGameState(prev =>'));
    expect(updater).toMatch(/canFoundAnother\(prev\.companies/);
  });
});

describe('the prestige gate — the first answer to "why prestige again?"', () => {
  // Before this, a repo-wide grep for `prestigeLevel >=` found only cosmetic UI
  // checks: NOTHING was gated on having prestiged, so prestige #5 was
  // mechanically identical to prestige #2.
  const stateWith = (totalPrestiges: number) =>
    ({ prestige: { totalPrestiges } }) as never;

  it('locks subsidiaries for a player who has never prestiged', () => {
    expect(isPrestigeFeatureUnlocked(stateWith(0), 'feature:conglomerate')).toBe(false);
    expect(prestigeUnlockRequirement(stateWith(0), 'feature:conglomerate')).toMatch(/prestige/i);
  });

  it('unlocks them after one prestige', () => {
    expect(isPrestigeFeatureUnlocked(stateWith(1), 'feature:conglomerate')).toBe(true);
    expect(prestigeUnlockRequirement(stateWith(1), 'feature:conglomerate')).toBe('');
  });

  it('treats a missing or corrupt prestige record as zero rather than NaN', () => {
    for (const bad of [undefined, null, {}, { prestige: {} }, { prestige: { totalPrestiges: NaN } }]) {
      expect(`${JSON.stringify(bad)}:${prestigeTier(bad as never)}`)
        .toBe(`${JSON.stringify(bad)}:0`);
    }
  });

  it('clamps the tier so a 50-prestige veteran does not overflow the scale', () => {
    expect(prestigeTier(stateWith(50))).toBe(5);
  });

  it('leaves an unregistered capability UNLOCKED', () => {
    // Same deliberate default as isFeatureUnlocked: forgetting to register
    // something should make it visible, not invisible.
    expect(isPrestigeFeatureUnlocked(stateWith(0), 'feature:not_registered')).toBe(true);
  });

  it('does NOT gate the first company of a type', () => {
    // The rule for this table: new content only. Gating something players
    // already have is a takeaway, not a reward.
    const source = fs.readFileSync(
      path.join(__dirname, '../..', 'contexts/game/actions/CompanyActions.ts'),
      'utf8'
    );
    expect(source).toMatch(/ownedOfType > 0 && !isPrestigeFeatureUnlocked/);
  });

  it('the UI surfaces the same lock, so no tap dead-ends', () => {
    const screen = fs.readFileSync(
      path.join(__dirname, '../..', 'components/mobile/Hustle/screens/CreateCompanyScreen.tsx'),
      'utf8'
    );
    expect(screen).toMatch(/isPrestigeFeatureUnlocked/);
  });
});
