/**
 * checkAnniversary — now wired on the live path (a cheap check whenever Contacts
 * opens / weeksLived advances), so it MUST be idempotent per anniversary year:
 * a re-check in the same week can't re-grant happiness, duplicate the milestone,
 * or re-post to Pulse.
 */
import { checkAnniversary } from '@/contexts/game/actions/DatingActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import type { GameState, Relationship } from '@/contexts/game/types';

const DEPS = { updateStats };

function harness(initial: GameState) {
  let current = initial;
  const setGameState = (u: any) => { current = typeof u === 'function' ? u(current) : u; };
  return { setGameState, getState: () => current };
}

function marriedState(weeksLived: number, marriageWeek: number): GameState {
  const s = createTestGameState({ weeksLived });
  s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  s.stats = { ...s.stats, energy: 100, happiness: 50 };
  s.relationships = [
    { id: 'sp', name: 'Robin', type: 'spouse', relationshipScore: 80, marriageWeek, anniversaryWeek: marriageWeek } as Relationship,
  ];
  return s;
}

describe('checkAnniversary - live-path idempotence', () => {
  it('fires on the exact 1-year boundary and records exactly one milestone', () => {
    const { setGameState, getState } = harness(marriedState(200 + WEEKS_PER_YEAR, 200));
    const r = checkAnniversary(getState(), setGameState, DEPS);
    expect(r.isAnniversary).toBe(true);
    expect(r.yearsMarried).toBe(1);
    expect((getState().lifeMilestones ?? []).filter((m) => m.type === 'anniversary').length).toBe(1);
  });

  it('a second check in the same week does not re-fire, double the milestone, or re-grant happiness', () => {
    const { setGameState, getState } = harness(marriedState(200 + WEEKS_PER_YEAR, 200));
    checkAnniversary(getState(), setGameState, DEPS);
    const happinessAfterFirst = getState().stats.happiness;

    const r2 = checkAnniversary(getState(), setGameState, DEPS);
    expect(r2.isAnniversary).toBe(false);
    expect((getState().lifeMilestones ?? []).filter((m) => m.type === 'anniversary').length).toBe(1);
    expect(getState().stats.happiness).toBe(happinessAfterFirst);
  });

  it('does not fire one week off the anniversary', () => {
    const { setGameState, getState } = harness(marriedState(200 + WEEKS_PER_YEAR + 1, 200));
    expect(checkAnniversary(getState(), setGameState, DEPS).isAnniversary).toBe(false);
  });

  it('auto-posts the anniversary to Pulse once when the player already posts', () => {
    const s = marriedState(200 + WEEKS_PER_YEAR, 200);
    s.socialMedia!.totalPosts = 4;
    const { setGameState, getState } = harness(s);

    checkAnniversary(getState(), setGameState, DEPS);
    let sm = getState().socialMedia!;
    expect(sm.totalPosts).toBe(5);
    expect(sm.recentPosts?.[0]?.hashtags).toContain('#anniversary');

    // A same-week re-check is idempotent → no second post.
    checkAnniversary(getState(), setGameState, DEPS);
    sm = getState().socialMedia!;
    expect(sm.totalPosts).toBe(5);
  });
});
