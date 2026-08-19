/**
 * The obituary's net worth counts the real estate the character owned.
 *
 * It did not. The inline wealth sum read `r.value` through an `(r: any)` cast,
 * and `RealEstate` has no `value` field — the market value lives in
 * `currentValue` (falling back to `price`). So every property evaluated to
 * `undefined ?? 0`, the whole asset class dropped out of the death-screen and
 * social-share net worth, and a property tycoon with little cash was eulogised
 * as "humble". Same fabricated-property bug class, and same file, as the
 * `career.name` obituary bug (obituaryCareer.test.ts) — caught by the weekly
 * audit's qualitative pass, 2026-08-19.
 *
 * It also counted un-owned entries: `state.realEstate` retains sold homes as
 * `owned: false` records, so the raw `.length` overcounted "owned N properties".
 */
import { generateObituary } from '@/lib/legacy/obituaryGenerator';
import { createTestGameState } from '../helpers/createTestGameState';
import type { RealEstate } from '@/contexts/game/types';

const property = (over: Partial<RealEstate> = {}): RealEstate => ({
  id: 'estate',
  name: 'Estate',
  price: 1_000_000,
  weeklyHappiness: 0,
  weeklyEnergy: 0,
  owned: true,
  interior: [],
  upgradeLevel: 0,
  ...over,
});

/** A character who dies cash-poor but property-rich. */
const diedWithProperty = (realEstate: RealEstate[]) =>
  createTestGameState({
    weeksLived: 400,
    deathReason: 'health',
    stats: { ...createTestGameState().stats, money: 0 },
    bankSavings: 0,
    realEstate,
  });

describe('the obituary counts owned real estate in net worth', () => {
  it('values a property by currentValue, not the nonexistent `value` field', () => {
    const { body } = generateObituary(
      diedWithProperty([property({ currentValue: 5_000_000 })])
    );

    // $5M of property with no cash is a millionaire, not "humble".
    expect(body).toContain('Millionaire');
    expect(body).not.toContain('Humble');
  });

  it('falls back to price when currentValue is absent', () => {
    const { body } = generateObituary(
      diedWithProperty([property({ price: 2_000_000, currentValue: undefined })])
    );

    expect(body).toContain('Millionaire');
    expect(body).not.toContain('Humble');
  });

  it('excludes properties the player no longer owns', () => {
    const { body } = generateObituary(
      diedWithProperty([property({ currentValue: 5_000_000, owned: false })])
    );

    // A sold home must not inflate the net worth of a cash-poor estate.
    expect(body).toContain('Humble');
    expect(body).not.toContain('Millionaire');
  });

  it('counts only owned properties in the "owned N properties" fact', () => {
    const { body } = generateObituary(
      diedWithProperty([
        property({ id: 'a', owned: true }),
        property({ id: 'b', owned: true }),
        property({ id: 'c', owned: true }),
        property({ id: 'sold', owned: false }),
      ])
    );

    expect(body).toContain('owned 3 properties');
    expect(body).not.toContain('owned 4 properties');
  });
});
