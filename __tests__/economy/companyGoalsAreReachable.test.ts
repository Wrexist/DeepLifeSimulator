/**
 * No achievement may promise something the code forbids.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "The max amount of companies currently
 * available is 5. The game only lets you have one of each. There are
 * achievements that state you could own 10 or even 20. This is not feasible."
 *
 * Both halves were right. The hard ceiling is `COMPANY_TYPES ×
 * MAX_PER_COMPANY_TYPE` = 5 × 3 = **15**, so `company_emperor` offered 300 gold
 * for owning 20 — unreachable by construction, not merely hard. And the 5 he
 * counted is also correct: a SECOND company of a type is gated behind
 * `feature:conglomerate`, which costs one prestige, so a player who has never
 * prestiged genuinely caps at one of each.
 *
 * The goal was retargeted to 15 rather than raising the cap, because
 * `MAX_PER_COMPANY_TYPE` is a deliberate balance decision documented in
 * `lib/business/subsidiaries.ts`.
 *
 * This test exists because nothing connected the two numbers. An achievement
 * table and a gameplay cap living in different files, with no assertion between
 * them, is how a 300-gold promise stayed impossible without anyone noticing —
 * so the invariant is pinned rather than the value.
 */
import { MAX_PER_COMPANY_TYPE } from '@/lib/business/subsidiaries';
import { achievements } from '@/src/features/onboarding/achievementsData';

/**
 * The company types `createCompany` accepts. Kept as a literal on purpose: it
 * mirrors the `companyCosts` table in `contexts/game/actions/CompanyActions.ts`,
 * and the test below asserts the two agree rather than importing one into the
 * other — an import would make a silent deletion there look like a smaller cap
 * here instead of failing.
 */
const COMPANY_TYPES = ['factory', 'ai', 'restaurant', 'realestate', 'bank'] as const;

const MAX_COMPANIES = COMPANY_TYPES.length * MAX_PER_COMPANY_TYPE;

describe('the company ceiling is what this test thinks it is', () => {
  it('CompanyActions still offers exactly these five types', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../contexts/game/actions/CompanyActions.ts'),
      'utf8',
    ) as string;
    const from = src.indexOf('const companyCosts');
    const to = src.indexOf('const baseCost');
    expect(`anchors found: ${from > -1 && to > from}`).toBe('anchors found: true');
    const table = src.slice(from, to);

    // EXACT set, both directions. Only checking that the five expected keys are
    // present would accept a sixth type being added - at which point
    // MAX_COMPANIES silently understates the real ceiling and the achievement
    // this file guards becomes reachable-but-wrong instead of unreachable.
    const declared = [...table.matchAll(/^\s{4}(\w+):\s*\d/gm)].map((m) => m[1]).sort();
    expect(declared).toEqual([...COMPANY_TYPES].sort());
  });

  it('the absolute maximum is 15', () => {
    expect(MAX_COMPANIES).toBe(15);
  });
});

/**
 * A `progressSpec` that carries a numeric target.
 *
 * The spec is a union, and the other members have no `goal`. Reading it through
 * an inline `as { goal: number }` bypasses that union - the cast asserts the
 * member rather than checking it, so a spec shape change would compile and this
 * whole file would quietly test nothing. CLAUDE.md Hard Rule #2: access union
 * members via a guard, never a cast.
 */
interface CounterGoalSpec {
  goal: number;
}

function hasNumericGoal(spec: unknown): spec is CounterGoalSpec {
  return (
    typeof spec === 'object' &&
    spec !== null &&
    'goal' in spec &&
    typeof (spec as CounterGoalSpec).goal === 'number' &&
    isFinite((spec as CounterGoalSpec).goal)
  );
}

describe('every company achievement is reachable', () => {
  const companyCountGoals = achievements.filter(
    (a) => a.group === 'company' && /Own \d+ compan/i.test(a.description ?? ''),
  );

  it('found the company-count achievements (guards the assertion below)', () => {
    expect(companyCountGoals.length).toBeGreaterThan(0);
  });

  it('no goal exceeds the number of companies the game can hold', () => {
    // `flatMap` rather than filter-then-map: a filter on a property does not
    // narrow the element type, so the map would still need a cast - which is the
    // thing the guard exists to remove.
    const impossible = companyCountGoals.flatMap((a) => {
      const spec = a.progressSpec;
      if (!hasNumericGoal(spec)) return [];
      return spec.goal > MAX_COMPANIES ? [`${a.id} wants ${spec.goal} of ${MAX_COMPANIES}`] : [];
    });

    expect(impossible).toEqual([]);
  });

  it('the description matches the goal it actually checks', () => {
    // The description is what the player reads; the goal is what pays out.
    // `company_emperor` said "Own 20" while awarding at 20 - consistent, and
    // consistently impossible. This catches the other failure: fixing one and
    // not the other.
    const mismatched = companyCountGoals
      .map((a) => {
        const stated = Number(/Own (\d+)/i.exec(a.description ?? '')?.[1]);
        const goal = hasNumericGoal(a.progressSpec) ? a.progressSpec.goal : undefined;
        return { id: a.id, stated, goal };
      })
      .filter((x) => Number.isFinite(x.stated) && x.stated !== x.goal)
      .map((x) => `${x.id}: says ${x.stated}, checks ${x.goal}`);

    expect(mismatched).toEqual([]);
  });
});
