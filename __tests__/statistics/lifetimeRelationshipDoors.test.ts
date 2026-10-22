/**
 * Every door somebody new enters a life through counts toward the LIFETIME
 * relationship total.
 *
 * The weekly tick counted `totalRelationships` as growth in the list WITHIN a
 * tick, and the only thing that grows the list inside a tick is a birth. The
 * doors (Spark promotion, `meetSomeone`, the `intro` favour - CLAUDE.md §4.8)
 * all run between ticks, so a friend was already in `prevState` and added 0:
 * "Social Network - form 25 relationships" needed 25 children.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';
import { meetSomeone } from '@/contexts/game/actions/ContactsActions';
import { promoteMatchToFriend, resolveMatchPromotion } from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';

const total = (s: GameState) => s.lifetimeStatistics?.totalRelationships ?? 0;

function withMatch(): GameState {
  const s = createTestGameState({ weeksLived: 3_000 });
  s.sparkApp!.matches = [
    { id: 'm1', profileId: DATING_PROFILES[0].id, matchedWeek: 100, superLiked: false, promoted: false },
  ];
  return s;
}

describe('lifetime relationship count', () => {
  it('meeting somebody counts once, even on a same-batch double tap', () => {
    const s = createTestGameState({ weeksLived: 12, lifeStartWeek: 0, currentJob: 'janitor' });
    const stub = createSetGameStateStub(s);
    expect(meetSomeone(s, stub.setGameState).success).toBe(true);
    meetSomeone(s, stub.setGameState);
    expect(total(stub.current())).toBe(total(s) + 1);
  });

  it('a Spark friend counts', () => {
    const s = withMatch();
    const stub = createSetGameStateStub(s);
    expect(promoteMatchToFriend(stub.setGameState, s, 'm1').success).toBe(true);
    expect(total(stub.current())).toBe(total(s) + 1);
  });

  it('a Spark partner counts', () => {
    const s = withMatch();
    const r = resolveMatchPromotion(s, 'm1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(total(r.next)).toBe(total(s) + 1);
  });

  it('starts the counter on a save with no lifetime statistics', () => {
    const s: GameState = { ...withMatch(), lifetimeStatistics: undefined };
    const r = resolveMatchPromotion(s, 'm1');
    if (r.ok) expect(total(r.next)).toBe(1);
  });
});
