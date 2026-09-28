import { familyPlanningBlock } from '@/lib/dating/familyPlanning';
import { cancelEngagement, executeWedding, giveGift, goOnDate, planWedding } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createWeddingPlan, WEDDING_VENUES } from '@/lib/dating/weddingVenues';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const deps = { updateMoney, updateStats };
function fixture() {
  const state = createTestGameState();
  return { ...state, weeksLived: 200,
    stats: { ...state.stats, money: 100000, energy: 100, happiness: 80 },
    relationships: [{ id: 'partner', name: 'Alex', type: 'partner' as const,
      age: 25, gender: 'female' as const, personality: 'kind',
      relationshipScore: 80, engagementWeek: 190 }],
  };
}
function queue(snapshot: GameState) {
  const updates: ((prev: GameState) => GameState)[] = [];
  const setter = (update: GameState | ((prev: GameState) => GameState)) => {
    updates.push(typeof update === 'function' ? update : () => update);
  };
  return { setter, flush: (latest = snapshot) => updates.reduce((s, f) => f(s), latest) };
}

describe('relationship confirmations revalidate at commit', () => {
  it.each(['cash', 'energy', 'partner', 'jail', 'death'])('rejects a queued date after %s changes without any grant or charge', reason => {
    const snapshot = fixture(); const q = queue(snapshot);
    goOnDate(snapshot, q.setter, 'partner', 'dinner', deps);
    const latest: GameState = { ...snapshot, stats: { ...snapshot.stats } };
    if (reason === 'cash') latest.stats.money = 10;
    if (reason === 'energy') latest.stats.energy = 0;
    if (reason === 'partner') latest.relationships = [];
    if (reason === 'jail') latest.jailWeeks = 2;
    if (reason === 'death') latest.showDeathPopup = true;
    expect(q.flush(latest)).toBe(latest);
  });
  it('still allows a free chat with no cash and sufficient energy', () => {
    const snapshot = fixture(); snapshot.stats.money = 0;
    const q = queue(snapshot); goOnDate(snapshot, q.setter, 'partner', 'chat', deps);
    const result = q.flush();
    expect(result.relationships[0].datesCount).toBe(1);
    expect(result.stats.money).toBe(0);
    expect(result.stats.energy).toBeLessThan(snapshot.stats.energy);
  });
  it('does not give romantic gifts after a breakup', () => {
    const snapshot = fixture(); const q = queue(snapshot);
    giveGift(snapshot, q.setter, 'partner', 'flowers');
    const latest: GameState = { ...snapshot, relationships: [{ ...snapshot.relationships[0], type: 'friend' }] };
    expect(q.flush(latest)).toBe(latest);
  });
  it('cancels only once and records the happiness loss in the summary', () => {
    const snapshot = fixture(); const q = queue(snapshot);
    cancelEngagement(snapshot, q.setter, 'partner', deps);
    cancelEngagement(snapshot, q.setter, 'partner', deps);
    const result = q.flush();
    expect(result.stats.happiness).toBe(65);
    expect(result.relationships[0].relationshipScore).toBe(60);
    expect(result.relationships[0].engagementWeek).toBeUndefined();
    expect(result.dailySummary).not.toEqual(snapshot.dailySummary);
  });
  it('does not charge a wedding deposit after cancellation', () => {
    const snapshot = fixture(); const q = queue(snapshot);
    planWedding(snapshot, q.setter, 'partner', WEDDING_VENUES[0].id, 2, 4, {});
    const latest = { ...snapshot, relationships: [{ ...snapshot.relationships[0], engagementWeek: undefined }] };
    expect(q.flush(latest)).toBe(latest);
  });
  it.each(['cancelled', 'rescheduled'])('does not execute a %s wedding from an old confirmation', reason => {
    const snapshot: GameState = fixture();
    const plan = createWeddingPlan(WEDDING_VENUES[0].id, 'partner', 2, 200)!;
    snapshot.relationships[0].weddingPlanned = plan;
    const q = queue(snapshot); executeWedding(snapshot, q.setter, 'partner', deps);
    const latest = { ...snapshot, relationships: [{ ...snapshot.relationships[0],
      weddingPlanned: reason === 'cancelled' ? undefined : { ...plan, scheduledWeek: 205 } }] };
    expect(q.flush(latest)).toBe(latest);
  });
});

describe('family planning eligibility', () => {
  it('requires cash but does not charge a conception fee', () => {
    const state = fixture();
    expect(familyPlanningBlock(state, 'partner')).toBeNull();
    expect(state.stats.money).toBe(100000);
    state.stats.money = 4999;
    expect(familyPlanningBlock(state, 'partner')).toContain('$5,000');
  });
  it('requires an adult, committed relationship and sufficient bond', () => {
    const state = fixture(); state.date.age = 17;
    expect(familyPlanningBlock(state, 'partner')).toContain('18');
    state.date.age = 20; state.relationships[0].relationshipScore = 69;
    expect(familyPlanningBlock(state, 'partner')).toContain('70%');
    state.relationships[0].relationshipScore = 80;
    const latest = { ...state, relationships: [{ ...state.relationships[0], engagementWeek: undefined }] };
    expect(familyPlanningBlock(latest, 'partner')).toContain('Move in');
  });
  it('rejects an existing pregnancy', () => {
    const state: GameState = fixture(); state.relationships[0].isPregnant = true;
    expect(familyPlanningBlock(state, 'partner')).toContain('Already expecting');
  });
});
