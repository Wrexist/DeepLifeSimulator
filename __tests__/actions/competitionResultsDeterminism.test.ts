/**
 * WP-E — `RDActions.processCompetitionResults` rolled its RNG INSIDE the
 * updater.
 *
 * The competitor count, their scores, and therefore the player's rank and the
 * PRIZE MONEY were drawn with `Math.random()` inside `setGameState(prev => …)`.
 * React StrictMode double-invokes an updater and a rebased update re-runs it,
 * so the discarded pass and the committed pass resolved DIFFERENT competitions:
 * the log line reported one rank and the bank paid another. The docblock's
 * idempotence claim held only for the `completed` flag, not for the payout.
 *
 * The rolls are now drawn outside the updater and memoised (the `preTick.ts`
 * `buildPreRolls` pattern, minus its fixed-shape machinery — the pending set is
 * only knowable from `prev`), with the cursor reset per invocation. Invoking
 * the same updater twice on the same `prev` must therefore produce identical
 * state, while separate CALLS still roll fresh (the distribution is unchanged).
 */
import { processCompetitionResults } from '@/contexts/game/actions/RDActions';
import { COMPETITIONS } from '@/lib/rd/competitions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Company, CompetitionEntry } from '@/contexts/game/types';

const COMPETITION = COMPETITIONS.find((c) => c.id === 'quarterly_innovation')!;
const RESULT_WEEK = 40;

const entry = (i: number): CompetitionEntry => ({
  competitionId: COMPETITION.id,
  competitionName: COMPETITION.name,
  entryWeek: i, // distinct — the resolution map is keyed on `id|entryWeek`
  endWeek: 20,
  score: 1000,
  completed: false,
});

/** Several companies × several pending entries, so many rolls are consumed. */
function stateWithPendingEntries(): GameState {
  const company = (id: string): Company =>
    ({
      id,
      name: `Co ${id}`,
      type: 'tech',
      unlockedTechnologies: ['t1'],
      patents: [],
      competitionHistory: [entry(1), entry(2), entry(3)],
    }) as unknown as Company;

  return createTestGameState({
    weeksLived: RESULT_WEEK,
    stats: { money: 10_000 } as never,
    companies: [company('co1'), company('co2')] as never,
  });
}

/** Capture the functional updater without committing it. */
function captureUpdater(week = RESULT_WEEK): (prev: GameState) => GameState {
  const updaters: ((p: GameState) => GameState)[] = [];
  processCompetitionResults(
    ((u: unknown) => {
      if (typeof u !== 'function') throw new Error('non-functional updater');
      updaters.push(u as (p: GameState) => GameState);
    }) as React.Dispatch<React.SetStateAction<GameState>>,
    week,
  );
  expect(updaters).toHaveLength(1);
  return updaters[0];
}

const summarise = (s: GameState) => ({
  money: s.stats.money,
  history: (s.companies ?? []).map((c) => c.competitionHistory),
});

describe('WP-E — processCompetitionResults is invocation-stable', () => {
  it('the fixture really resolves something (the premise)', () => {
    const prev = stateWithPendingEntries();
    const next = captureUpdater()(prev);
    const resolved = (next.companies ?? []).flatMap((c) => c.competitionHistory ?? []);
    expect(resolved).toHaveLength(6);
    expect(resolved.every((e) => e.completed)).toBe(true);
    expect(resolved.every((e) => typeof e.rank === 'number')).toBe(true);
  });

  it('invoking the SAME updater twice on the same prev gives identical results', () => {
    const prev = stateWithPendingEntries();
    const updater = captureUpdater();

    // StrictMode: pass one is discarded, pass two is committed. They must agree
    // — including on the prize money, which is what reached the player's bank.
    const discarded = updater(prev);
    const committed = updater(prev);

    expect(summarise(committed)).toEqual(summarise(discarded));
  });

  it('repeated re-invocation stays stable (not just the first two passes)', () => {
    const prev = stateWithPendingEntries();
    const updater = captureUpdater();
    const first = summarise(updater(prev));
    for (let i = 0; i < 5; i++) {
      expect(summarise(updater(prev))).toEqual(first);
    }
  });

  it('but separate calls still roll fresh — the randomness was hoisted, not removed', () => {
    const prev = stateWithPendingEntries();
    const outcomes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      outcomes.add(JSON.stringify(summarise(captureUpdater()(prev))));
    }
    // 40 independent resolutions of 6 entries each collapsing to one outcome
    // would mean the draw had been frozen.
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('prizes stay inside the competition prize table', () => {
    const prev = stateWithPendingEntries();
    const next = captureUpdater()(prev);
    const allowed = new Set([0, COMPETITION.prizes.first, COMPETITION.prizes.second, COMPETITION.prizes.third]);
    for (const e of (next.companies ?? []).flatMap((c) => c.competitionHistory ?? [])) {
      expect(allowed.has(e.prize ?? 0)).toBe(true);
    }
    const total = (next.companies ?? [])
      .flatMap((c) => c.competitionHistory ?? [])
      .reduce((sum, e) => sum + (e.prize ?? 0), 0);
    expect(next.stats.money).toBe(prev.stats.money + total);
  });

  it('nothing pending leaves the state untouched', () => {
    const prev = createTestGameState({ weeksLived: RESULT_WEEK, companies: [] as never });
    expect(captureUpdater()(prev)).toBe(prev);
  });
});
