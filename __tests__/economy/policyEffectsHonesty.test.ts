/**
 * R4-X7 — eight policy effects that were declared, priced, and rendered on the
 * card the player reads before spending $100,000–$300,000, with nothing behind
 * them.
 *
 * R3-M9 fixed exactly this shape for `stocks.stockVolatility` and
 * `jobAvailability` by WIRING them to the systems they named. This round found
 * eight more, and they split cleanly in two:
 *
 * WIRED — `economy.inflationRate`. Three policies carry it (+2%, +3%, +2%), the
 * card renders "Inflation +2.0%", and `calculateActivePolicyEffects` had no
 * `economy` slice at all, so nothing could read it even in principle. Inflation
 * is a real, weekly system, so this one is now connected: stimulus that cannot
 * cause inflation is a free lunch, and the card said otherwise.
 *
 * UNRENDERED — the other seven, plus `economy.priceIndex`. They describe
 * systems that do not exist: `lib/rd/patents.ts` has zero production callers,
 * there is no property-tax system, and nothing reads crypto regulation or
 * stability. Building those is a product decision, not an audit fix. The keys
 * stay on the schema and in the catalogue — deleting them would erase the
 * record of intent — but the card no longer claims them.
 *
 * 2026-07-31 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { POLICIES, INERT_POLICY_KEYS } from '@/lib/politics/policies';
import { calculateActivePolicyEffects } from '@/contexts/game/actions/PoliticalActions';
import { applyWeeklyInflation, policyInflationDelta } from '@/lib/economy/inflation';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const APP = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'computer', 'PoliticalApp.tsx'),
  'utf8',
);
const APP_CODE = APP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The policies that actually carry an inflation delta. */
const INFLATION_POLICIES = POLICIES.filter(
  (p) => p.effects?.economy?.inflationRate !== undefined,
).map((p) => p.id);

function withPolicies(ids: string[], annual = 0.03): GameState {
  const base = createTestGameState();
  return createTestGameState({
    economy: { ...base.economy, inflationRateAnnual: annual, priceIndex: 1 } as never,
    politics: { ...(base.politics ?? {}), activePolicyEffects: calculateActivePolicyEffects(ids) } as never,
  });
}

describe('economy.inflationRate reaches the inflation system', () => {
  it('policies really do carry it (the premise)', () => {
    expect(INFLATION_POLICIES.length).toBeGreaterThan(0);
  });

  it('the aggregator has an economy slice at all', () => {
    // It had none. That is why nothing downstream could read the key.
    const effects = calculateActivePolicyEffects(INFLATION_POLICIES);

    expect(effects?.economy).toBeDefined();
    expect(effects!.economy!.inflationRate).toBeGreaterThan(0);
  });

  it('an enacted stimulus makes prices rise faster', () => {
    const plain = applyWeeklyInflation(withPolicies([]));
    const stimulus = applyWeeklyInflation(withPolicies(INFLATION_POLICIES));

    expect(stimulus.economy!.priceIndex).toBeGreaterThan(plain.economy!.priceIndex!);
  });

  it('a player with no policies is completely unaffected', () => {
    // The control: this must not change the baseline economy for everyone else.
    const before = withPolicies([]);
    const after = applyWeeklyInflation(before);
    const baseline = applyWeeklyInflation(
      createTestGameState({ economy: { inflationRateAnnual: 0.03, priceIndex: 1 } as never }),
    );

    expect(after.economy!.priceIndex).toBeCloseTo(baseline.economy!.priceIndex!, 12);
    expect(policyInflationDelta(before)).toBe(0);
  });

  it('the delta is bounded, so a stack cannot run the price index away', () => {
    const stacked = withPolicies([...INFLATION_POLICIES, ...INFLATION_POLICIES]);

    expect(policyInflationDelta(stacked)).toBeLessThanOrEqual(0.05);
    expect(policyInflationDelta(stacked)).toBeGreaterThanOrEqual(-0.05);
  });

  it('a corrupt persisted value cannot drive it', () => {
    for (const bad of [NaN, Infinity, -Infinity, 999, -999]) {
      const corrupt = createTestGameState({
        politics: { activePolicyEffects: { economy: { inflationRate: bad } } } as never,
      });
      const delta = policyInflationDelta(corrupt);

      expect(`${bad}: finite ${Number.isFinite(delta)}, in band ${Math.abs(delta) <= 0.05}`)
        .toBe(`${bad}: finite true, in band true`);
    }
  });

  it('a deflationary stack never runs the price index backwards', () => {
    const deflation = createTestGameState({
      economy: { inflationRateAnnual: 0.01, priceIndex: 1 } as never,
      politics: { activePolicyEffects: { economy: { inflationRate: -0.05 } } } as never,
    });

    expect(applyWeeklyInflation(deflation).economy!.priceIndex).toBeGreaterThanOrEqual(1);
  });
});

describe('the policy card no longer claims effects with no system', () => {
  it('the register is non-empty and every entry names a real schema key', () => {
    expect(INERT_POLICY_KEYS.length).toBeGreaterThan(0);

    for (const key of INERT_POLICY_KEYS) {
      const [group, field] = key.split('.');
      const carrier = POLICIES.find(
        (p) => (p.effects as Record<string, Record<string, unknown> | undefined>)?.[group]?.[field] !== undefined,
      );
      // `economy.priceIndex` is the one entry no policy sets - it was a row for
      // a field the catalogue never populated, which is its own kind of dead.
      if (key !== 'economy.priceIndex') {
        expect(`${key} is carried by a policy: ${Boolean(carrier)}`).toBe(`${key} is carried by a policy: true`);
      }
    }
  });

  it('none of them is rendered', () => {
    for (const key of INERT_POLICY_KEYS) {
      const field = key.split('.')[1];
      const rendered = new RegExp(`\\?\\.${field}\\)\\s*push\\(`).test(APP_CODE)
        || new RegExp(`push\\([^)]*\\.${field}`).test(APP_CODE);

      expect(`${key} rendered: ${rendered}`).toBe(`${key} rendered: false`);
    }
  });

  it('the effects that DO work are still rendered', () => {
    // The control. Hiding the dead rows must not have hidden the live ones -
    // rentModifier, miningBonus, the healthcare pair, the transport pair, the
    // education trio, the stock pair, and the newly-wired inflation.
    for (const field of [
      'rentModifier', 'miningBonus', 'healthBonus', 'medicalCostReduction',
      'travelCostReduction', 'commuteTimeReduction', 'weeksReduction',
      'costReduction', 'scholarshipAmount', 'volatilityModifier', 'dividendBonus',
      'inflationRate',
    ]) {
      expect(`${field} rendered: ${APP_CODE.includes(field)}`).toBe(`${field} rendered: true`);
    }
  });

  it('the keys survive on the schema rather than being deleted', () => {
    // Deleting them would be a data change with no gameplay effect that also
    // erases the record of what these policies were meant to do.
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'politics', 'policies.ts'), 'utf8',
    );

    for (const key of INERT_POLICY_KEYS) {
      const field = key.split('.')[1];
      expect(`${field} still declared: ${src.includes(`${field}?:`)}`).toBe(`${field} still declared: true`);
    }
  });
});
