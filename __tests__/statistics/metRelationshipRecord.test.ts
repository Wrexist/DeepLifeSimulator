/**
 * S1 (owner decisions, 2026-10-23): the lifetime relationship count counts
 * PEOPLE, not arrivals.
 *
 * Every relationship door mints a stable id for the same person - `met-w<N>`
 * for the meeting window, `spm-<profile>` for a Spark match, `intro-<contact>-
 * <week>` for a favour - and each door called `countNewRelationship` on every
 * append. So meeting somebody, removing them and meeting them again counted
 * them twice toward "Social Network - form 25 relationships". v58 adds
 * `metRelationshipIds`, the per-life record of who has been met.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';
import { meetSomeone, resolveMeeting } from '@/contexts/game/actions/ContactsActions';
import { promoteMatchToFriend } from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import { metRelationshipIdsOf, recordMetRelationship } from '@/lib/statistics/statisticsTracker';
import { runMigrations } from '@/utils/saveMigrations';

const total = (s: GameState) => s.lifetimeStatistics?.totalRelationships ?? 0;
const without = (s: GameState, id: string): GameState => ({
  ...s,
  relationships: (s.relationships ?? []).filter((r) => r.id !== id),
});

describe('S1: meeting somebody again does not count them again', () => {
  it('meet -> remove -> meet the same person: counted once', () => {
    const start = createTestGameState({ weeksLived: 12, lifeStartWeek: 0, currentJob: 'janitor' });
    const first = resolveMeeting(start);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(total(first.next)).toBe(total(start) + 1);
    expect(first.next.metRelationshipIds).toContain(first.relationshipId);

    // The same window offers the same person again once they are gone.
    const removed = without(first.next, first.relationshipId);
    const again = resolveMeeting(removed);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.relationshipId).toBe(first.relationshipId);
    expect((again.next.relationships ?? []).some((r) => r.id === first.relationshipId)).toBe(true);
    // The regression: this was total(start) + 2.
    expect(total(again.next)).toBe(total(start) + 1);
  });

  it('through the action, with the same-batch double tap still paying once', () => {
    const s = createTestGameState({ weeksLived: 12, lifeStartWeek: 0, currentJob: 'janitor' });
    const stub = createSetGameStateStub(s);
    expect(meetSomeone(s, stub.setGameState).success).toBe(true);
    meetSomeone(s, stub.setGameState);
    const met = stub.current();
    expect(total(met)).toBe(total(s) + 1);
    const id = met.metRelationshipIds![met.metRelationshipIds!.length - 1];

    const back = createSetGameStateStub(without(met, id));
    expect(meetSomeone(back.current(), back.setGameState).success).toBe(true);
    expect(total(back.current())).toBe(total(s) + 1);
  });

  it('a Spark friend un-promoted and promoted again is counted once', () => {
    const s = createTestGameState({ weeksLived: 3_000 });
    s.sparkApp!.matches = [
      { id: 'm1', profileId: DATING_PROFILES[0].id, matchedWeek: 100, superLiked: false, promoted: false },
    ];
    const stub = createSetGameStateStub(s);
    expect(promoteMatchToFriend(stub.setGameState, s, 'm1').success).toBe(true);
    const once = stub.current();
    expect(total(once)).toBe(total(s) + 1);

    // Unfriended and the match reopened (what a breakup's Spark un-promote does).
    const reopened: GameState = {
      ...without(once, 'm1'),
      sparkApp: { ...once.sparkApp!, matches: once.sparkApp!.matches.map((m) => ({ ...m, promoted: false })) },
    };
    const again = createSetGameStateStub(reopened);
    expect(promoteMatchToFriend(again.setGameState, reopened, 'm1').success).toBe(true);
    expect(total(again.current())).toBe(total(s) + 1);
  });

  it('somebody genuinely new still counts', () => {
    const s = createTestGameState({ weeksLived: 12, lifeStartWeek: 0, metRelationshipIds: ['met-w1'] });
    const out = recordMetRelationship(s, 'met-w2');
    expect(out.lifetimeStatistics?.totalRelationships).toBe(total(s) + 1);
    expect(out.metRelationshipIds).toEqual(['met-w1', 'met-w2']);
  });
});

describe('S1: a save without the record (pre-v58) resolves instead of resetting', () => {
  it('seeds from the people currently in the life, so none of them can count again', () => {
    const base = createTestGameState({ weeksLived: 12, lifeStartWeek: 0 });
    const s: GameState = {
      ...base,
      metRelationshipIds: undefined,
      relationships: [
        ...(base.relationships ?? []),
        { id: 'met-w1', name: 'Ana Ruiz', type: 'friend', relationshipScore: 45, personality: 'kind', gender: 'female', age: 25 },
      ],
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalRelationships: 7 },
    };
    expect(metRelationshipIdsOf(s)).toContain('met-w1');

    const known = recordMetRelationship(s, 'met-w1');
    expect(known.lifetimeStatistics?.totalRelationships).toBe(7);

    const fresh = recordMetRelationship(s, 'met-w2');
    // Progress is never taken away: the stored counter only ever moves up.
    expect(fresh.lifetimeStatistics?.totalRelationships).toBe(8);
    expect(fresh.metRelationshipIds).toEqual([...(s.relationships ?? []).map((r) => r.id), 'met-w2']);
  });

  it('the v58 migration snapshots the current people, so a removal before the next door cannot re-arm one', () => {
    const base = createTestGameState({ weeksLived: 12, lifeStartWeek: 0 });
    const old = {
      ...base,
      version: 57,
      metRelationshipIds: undefined,
      relationships: [
        ...(base.relationships ?? []),
        { id: 'spm-p7', name: 'Ana Ruiz', type: 'partner', relationshipScore: 60, personality: 'kind', gender: 'female', age: 25 },
      ],
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalRelationships: 7 },
    } as GameState;
    const migrated = runMigrations(old).state as GameState;
    expect(migrated.metRelationshipIds).toContain('spm-p7');

    // Removed after the load, before any door call, then met again: no recount.
    const afterBreakup: GameState = {
      ...migrated,
      relationships: (migrated.relationships ?? []).filter((r) => r.id !== 'spm-p7'),
    };
    expect(recordMetRelationship(afterBreakup, 'spm-p7').lifetimeStatistics?.totalRelationships).toBe(7);
  });

  it('a stored record wins over the current list', () => {
    const s = createTestGameState({ metRelationshipIds: ['gone-friend'] });
    expect(metRelationshipIdsOf(s)).toEqual(['gone-friend']);
    expect(recordMetRelationship(s, 'gone-friend').lifetimeStatistics).toBe(s.lifetimeStatistics);
  });
});
