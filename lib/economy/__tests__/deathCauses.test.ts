/**
 * The death screen's explanation - the three fair-failure questions answered
 * from the state the character died in (Master Program 7).
 */
import { createTestGameState } from '../../../__tests__/helpers/createTestGameState';
import { explainVitalDeath } from '../deathCauses';
import type { GameState } from '@/contexts/game/types';

const deadOfHappiness = (extra: Partial<GameState> = {}): GameState =>
  createTestGameState({
    weeksLived: 117,
    lifeStartWeek: 104,
    showDeathPopup: true,
    deathReason: 'happiness',
    happinessZeroWeeks: 4,
    realEstate: [],
    rental: undefined,
    currentJob: 'janitor',
    careers: (createTestGameState().careers ?? []).map((c) =>
      c.id === 'janitor' ? { ...c, applied: true, accepted: true, level: 0 } : c,
    ),
    ...extra,
  });

describe('explainVitalDeath', () => {
  it('names what happened, what was pulling the vital down, and the fix', () => {
    const s = deadOfHappiness();
    s.stats.happiness = 0;
    const e = explainVitalDeath(s)!;
    expect(e.what).toBe('Happiness sat at 0 for 4 weeks.');
    expect(e.why).toContain('No home');
    expect(e.why).toContain('shifts');
    expect(e.why).toContain('Natural decay');
    expect(e.fix).toContain('Life → Health');
    expect(e.fix).toContain('Market → Housing');
  });

  it('a housed death does not point at the housing list', () => {
    const s = deadOfHappiness({ rental: { tierId: 'shared-room', startedWeek: 105 }, deathReason: 'health', healthZeroWeeks: 4 });
    const e = explainVitalDeath(s)!;
    expect(e.what).toBe('Health sat at 0 for 4 weeks.');
    expect(e.why).not.toContain('No home');
    expect(e.fix).not.toContain('Market → Housing');
  });

  it('only explains vital deaths', () => {
    expect(explainVitalDeath(deadOfHappiness({ deathReason: 'age' as any }))).toBeNull();
    expect(explainVitalDeath(deadOfHappiness({ deathReason: undefined }))).toBeNull();
    expect(explainVitalDeath(null)).toBeNull();
  });

  it('never throws on a malformed state', () => {
    const broken = { ...deadOfHappiness(), careers: undefined, items: undefined, stats: undefined } as unknown as GameState;
    const e = explainVitalDeath(broken)!;
    expect(e.what).toContain('Happiness sat at 0');
    expect(e.fix).toContain('Life → Health');
  });
});
