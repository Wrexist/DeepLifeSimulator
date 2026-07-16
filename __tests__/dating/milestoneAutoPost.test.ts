/**
 * DatingActions milestones → auto-post to Pulse (Spark→Pulse bridge wiring).
 *
 * executeWedding / fileDivorce now translate the milestone through
 * sparkPulseBridge and dispatch it via composePost — but only for a player who
 * already uses Pulse (shouldAutoPostMilestone). This pins that wiring, including
 * the "never surprise a never-posted account" guard.
 */
import { executeWedding, fileDivorce } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, Relationship, WeddingPlan } from '@/contexts/game/types';

const DEPS = { updateMoney, updateStats };

function harness(initial: GameState) {
  let current = initial;
  const setGameState = (u: any) => { current = typeof u === 'function' ? u(current) : u; };
  return { setGameState, getState: () => current };
}

function baseState(): GameState {
  const s = createTestGameState({ weeksLived: 60 });
  s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  if (s.sparkApp) s.sparkApp = JSON.parse(JSON.stringify(s.sparkApp));
  s.stats = { ...s.stats, money: 50000, energy: 100 };
  return s;
}

const PLAN: WeddingPlan = {
  venueId: 'courthouse', venueName: 'City Courthouse', venueType: 'courthouse',
  partnerId: 'p1', guestCount: 10, scheduledWeek: 0, budget: 1000,
  catering: false, photography: false, music: false, decorations: false,
};

describe('milestone auto-post wiring', () => {
  it('executeWedding appends a wedding post when the player already posts', () => {
    const s = baseState();
    s.socialMedia!.totalPosts = 5;
    s.relationships = [
      { id: 'p1', name: 'Alex', type: 'partner', relationshipScore: 80, engagementWeek: 0, weddingPlanned: PLAN, datesCount: 10 } as Relationship,
    ];
    const { setGameState, getState } = harness(s);

    const r = executeWedding(getState(), setGameState, 'p1', DEPS);
    expect(r.success).toBe(true);

    const sm = getState().socialMedia!;
    expect(sm.totalPosts).toBe(6);
    expect(sm.recentPosts?.[0]?.content).toContain('Alex');
    expect(sm.recentPosts?.[0]?.hashtags).toContain('#married');
  });

  it('does NOT auto-post when the player has never posted (totalPosts === 0)', () => {
    const s = baseState();
    s.socialMedia!.totalPosts = 0;
    s.relationships = [
      { id: 'p1', name: 'Alex', type: 'partner', relationshipScore: 80, engagementWeek: 0, weddingPlanned: PLAN, datesCount: 10 } as Relationship,
    ];
    const { setGameState, getState } = harness(s);

    const r = executeWedding(getState(), setGameState, 'p1', DEPS);
    expect(r.success).toBe(true);

    const sm = getState().socialMedia!;
    expect(sm.totalPosts).toBe(0);
    expect(sm.recentPosts?.length ?? 0).toBe(0);
  });

  it('fileDivorce appends a divorce post when the player already posts', () => {
    const s = baseState();
    s.socialMedia!.totalPosts = 3;
    s.lastDivorceWeek = 0;
    s.relationships = [
      { id: 'p1', name: 'Jamie', type: 'spouse', relationshipScore: 40, marriageWeek: 6 } as Relationship,
    ];
    const { setGameState, getState } = harness(s);

    const r = fileDivorce(getState(), setGameState, 'p1', DEPS);
    expect(r.success).toBe(true);

    const sm = getState().socialMedia!;
    expect(sm.totalPosts).toBe(4);
    expect(sm.recentPosts?.[0]?.hashtags).toContain('#divorce');
  });
});
