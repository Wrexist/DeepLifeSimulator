/**
 * Cliffhanger windfalls — Master Program 10 (2026-09-03).
 *
 * Two inheritances (`ch_mysterious_letter` $2,000, `ch_email_from_lawyer`
 * $3,000) could re-fire for the whole life: a seeded life received the same
 * long-lost relative's money at weeks 16 and 19. Together they were a ~$40/wk
 * standing faucet at any income - a third of an entry wage - paid for tapping
 * a popup. They are once per life now, derived from `eventLog`.
 *
 * `ch_investment_news` had never fired: its gate tested `Array.isArray(s.stocks)`
 * on an object.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { CLIFFHANGERS, resolvedThisLife } from '@/lib/events/cliffhangerEvents';

type LogEntry = NonNullable<GameState['eventLog']>[number];

const logEntry = (id: string): LogEntry =>
  ({ id, description: 'x', choice: 'a', week: 1, weeksLived: 30 }) as LogEntry;

const def = (id: string) => {
  const d = CLIFFHANGERS.find((c) => c.id === id);
  if (!d) throw new Error(`no cliffhanger ${id}`);
  return d;
};

const eligible = (id: string, state: GameState) => {
  const d = def(id);
  return !d.condition || d.condition(state);
};

/** A life old enough for every time gate in the catalogue. */
const matureLife = (extra: Partial<GameState> = {}): GameState =>
  createTestGameState({ weeksLived: 400, lifeStartWeek: 300, ...extra });

describe('inheritance cliffhangers fire once per life', () => {
  it.each([
    ['ch_mysterious_letter', 'ch_mysterious_letter_resolve'],
    ['ch_email_from_lawyer', 'ch_email_from_lawyer_resolve'],
  ])('%s is eligible before its resolution has been lived and not after', (id, resolveId) => {
    expect(eligible(id, matureLife())).toBe(true);
    expect(eligible(id, matureLife({ eventLog: [logEntry(resolveId)] }))).toBe(false);
  });

  it('a lived letter does not block the lawyer, and vice versa', () => {
    const lettered = matureLife({ eventLog: [logEntry('ch_mysterious_letter_resolve')] });
    expect(eligible('ch_email_from_lawyer', lettered)).toBe(true);
    const lawyered = matureLife({ eventLog: [logEntry('ch_email_from_lawyer_resolve')] });
    expect(eligible('ch_mysterious_letter', lawyered)).toBe(true);
  });

  it('a new life starts with an empty log, so the guard is per life', () => {
    expect(resolvedThisLife(createTestGameState(), 'ch_mysterious_letter_resolve')).toBe(false);
    expect(resolvedThisLife({ eventLog: undefined } as any, 'ch_mysterious_letter_resolve')).toBe(false);
  });

  it('the repeatable cliffhangers are unchanged', () => {
    const s = matureLife({ currentJob: 'janitor', eventLog: [logEntry('ch_boss_meeting_resolve')] });
    expect(eligible('ch_boss_meeting', s)).toBe(true);
  });
});

describe('ch_investment_news', () => {
  it('fires for a player who holds stock and not for one who does not', () => {
    const base = createTestGameState();
    const holder: GameState = {
      ...base,
      stocks: {
        ...(base.stocks ?? { holdings: [], watchlist: [] }),
        holdings: [{ symbol: 'JNJ', shares: 10, averagePrice: 150, currentPrice: 150 }],
      } as GameState['stocks'],
    };
    expect(eligible('ch_investment_news', holder)).toBe(true);
    expect(eligible('ch_investment_news', base)).toBe(false);
  });
});
