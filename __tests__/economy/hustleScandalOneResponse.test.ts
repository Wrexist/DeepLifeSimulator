/**
 * A company scandal takes ONE response, and that response commits once
 * (2026-10-17 economy audit).
 *
 *   - The free apology (-25 severity, +2 rep, $0) was repeatable: tapping it
 *     until the scandal cleared cost nothing and banked reputation per tap, so
 *     the paid responses (up to $200k) were strictly dominated.
 *   - The updater skipped the overlay change when the scandal was already gone
 *     but STILL charged the cost and applied the reputation, so a same-batch
 *     double tap of Restructure billed $400,000 and granted +16 reputation.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { businessState } from '../helpers/businessFixture';
import { resolveScandal } from '@/contexts/game/actions/HustleActions';
import { createDefaultCompanyOverlay } from '@/lib/business/hustleLogic';
import type { GameState, HustleActiveScandal } from '@/contexts/game/types';

const CO = 'factory';

const scandal = (over: Partial<HustleActiveScandal> = {}): HustleActiveScandal => ({
  id: 'sc-1',
  kind: 'data_breach',
  severity: 60,
  startedWeek: 100,
  weeksRemaining: 5,
  headline: 'Data breach exposed',
  resolutionMethod: null,
  revenueDragPercent: 10,
  ...over,
});

function stateWith(active: HustleActiveScandal | null, money = 1_000_000, reputation = 50): GameState {
  const biz = businessState();
  const overlay = { ...createDefaultCompanyOverlay(CO, 100), activeScandal: active };
  return createTestGameState({
    weeksLived: 104,
    stats: { money, reputation },
    companies: biz.companies,
    company: biz.company,
    hustleApp: { ...biz.hustleApp!, companies: { [CO]: overlay } },
  });
}

function capture() {
  const updaters: ((s: GameState) => GameState)[] = [];
  const set: Dispatch<SetStateAction<GameState>> = u => {
    if (typeof u === 'function') updaters.push(u);
  };
  return { set, updaters };
}

const active = (s: GameState) => s.hustleApp?.companies?.[CO]?.activeScandal ?? null;

describe('same-batch double tap', () => {
  it('Restructure charges $200k and grants +8 reputation ONCE', () => {
    const s = stateWith(scandal());
    const c = capture();
    expect(resolveScandal(c.set, s, CO, 'restructure').success).toBe(true);
    expect(resolveScandal(c.set, s, CO, 'restructure').success).toBe(true); // stale snapshot passes the outer gate
    const once = c.updaters[0](s);
    const twice = c.updaters[1](once);
    expect(active(once)).toBeNull(); // 60 - 70 -> resolved
    expect(twice).toBe(once);
    expect(twice.stats.money).toBe(1_000_000 - 200_000);
    expect(twice.stats.reputation).toBe(58);
  });

  it('a double tap of the free apology applies one apology, not two', () => {
    const s = stateWith(scandal());
    const c = capture();
    resolveScandal(c.set, s, CO, 'apology');
    resolveScandal(c.set, s, CO, 'apology');
    const once = c.updaters[0](s);
    const twice = c.updaters[1](once);
    expect(active(once)?.severity).toBe(35);
    expect(twice).toBe(once);
    expect(twice.stats.reputation).toBe(52);
  });

  it('refuses when prev no longer holds THIS scandal (resolved, or replaced by another)', () => {
    const s = stateWith(scandal());
    const c = capture();
    resolveScandal(c.set, s, CO, 'recall');
    const gone = stateWith(null);
    expect(c.updaters[0](gone)).toBe(gone);
    const other = stateWith(scandal({ id: 'sc-2' }));
    expect(c.updaters[0](other)).toBe(other);
  });
});

describe('one response per scandal', () => {
  it('the apology cannot be repeated to clear a scandal for free', () => {
    const s = stateWith(scandal());
    const c = capture();
    resolveScandal(c.set, s, CO, 'apology');
    const afterApology = c.updaters[0](s);
    expect(active(afterApology)?.resolutionMethod).toBe('apology');

    const again = capture();
    const r = resolveScandal(again.set, afterApology, CO, 'apology');
    expect(r.success).toBe(false);
    expect(again.updaters).toHaveLength(0);
  });

  it('an answered scandal refuses a second, different response too', () => {
    const answered = stateWith(scandal({ severity: 35, resolutionMethod: 'apology' }));
    const c = capture();
    const r = resolveScandal(c.set, answered, CO, 'restructure');
    expect(r.success).toBe(false);
    expect(r.costPaid).toBe(0);
    expect(c.updaters).toHaveLength(0);
  });

  it('the in-updater gate refuses an answered scandal even from a stale unanswered snapshot', () => {
    const s = stateWith(scandal());
    const c = capture();
    resolveScandal(c.set, s, CO, 'recall');
    const answeredPrev = stateWith(scandal({ severity: 35, resolutionMethod: 'apology' }));
    expect(c.updaters[0](answeredPrev)).toBe(answeredPrev);
  });
});
