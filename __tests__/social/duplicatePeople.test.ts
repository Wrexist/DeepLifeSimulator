/**
 * One person, one record — Master Program 11 exploit red team.
 *
 * A promoted match shares its id with the relationship it creates, so both
 * promotion paths guarded on "have I promoted this MATCH?". That is not the
 * same question as "is this PERSON already in my life", and `unmatch`
 * (reachable from `PartnerProfileScreen`) is what separates them: it removes
 * the match and leaves the relationship standing, so swiping the same profile
 * again in a later week mints a NEW match id that walked past the guard.
 *
 * Measured before the fix: two relationships both named "Sarah Johnson", each
 * counting toward `social_butterfly` (10 friends → 25 gems),
 * `social_celebrity` (25 friends → 75 gems) and `strongRelationshipCount`,
 * which the goal engine reads as social emphasis. Duplicated social state and
 * gems for a person met once.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';
import { promoteMatchToFriend, promoteMatchToRelationship } from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';

function withMatch(matchId: string, profileId: string, rels: GameState['relationships'] = []): GameState {
  const base = createTestGameState();
  return {
    ...base,
    relationships: rels,
    sparkApp: {
      ...(base.sparkApp as NonNullable<GameState['sparkApp']>),
      matches: [{ id: matchId, profileId, matchedWeek: 1, superLiked: false, promoted: false }],
    },
  };
}

const PROFILE = DATING_PROFILES[0];

describe('unmatch → re-match cannot duplicate a person', () => {
  it('as a friend', () => {
    const first = withMatch('m1', PROFILE.id);
    const s1 = createSetGameStateStub(first);
    expect(promoteMatchToFriend(s1.setGameState, first, 'm1').success).toBe(true);
    const afterFirst = s1.current();
    expect(afterFirst.relationships).toHaveLength(1);

    // The player unmatches (sparkApp only — the friendship survives), then
    // swipes the same profile again next week: a brand-new match id.
    const second = withMatch('m2', PROFILE.id, afterFirst.relationships);
    const s2 = createSetGameStateStub(second);
    const r = promoteMatchToFriend(s2.setGameState, second, 'm2');

    expect(r.success).toBe(false);
    expect(r.message).toContain('already in your contacts');
    expect(s2.current().relationships).toHaveLength(1);
  });

  it('as a partner', () => {
    const first = withMatch('m1', PROFILE.id);
    const s1 = createSetGameStateStub(first);
    promoteMatchToFriend(s1.setGameState, first, 'm1');

    // …and now try to also date them off a second match.
    const second = withMatch('m2', PROFILE.id, s1.current().relationships);
    const s2 = createSetGameStateStub(second);
    const r = promoteMatchToRelationship(s2.setGameState, second, 'm2');

    expect(r.success).toBe(false);
    expect(s2.current().relationships).toHaveLength(1);
  });

  it('and the achievement counters see one friend, not two', () => {
    const first = withMatch('m1', PROFILE.id);
    const s1 = createSetGameStateStub(first);
    promoteMatchToFriend(s1.setGameState, first, 'm1');
    const second = withMatch('m2', PROFILE.id, s1.current().relationships);
    const s2 = createSetGameStateStub(second);
    promoteMatchToFriend(s2.setGameState, second, 'm2');

    const friends = (s2.current().relationships ?? []).filter((r) => r.type === 'friend');
    expect(friends).toHaveLength(1);
  });

  it('a DIFFERENT profile is still perfectly welcome', () => {
    const first = withMatch('m1', PROFILE.id);
    const s1 = createSetGameStateStub(first);
    promoteMatchToFriend(s1.setGameState, first, 'm1');

    const other = DATING_PROFILES[1];
    const second = withMatch('m2', other.id, s1.current().relationships);
    const s2 = createSetGameStateStub(second);

    expect(promoteMatchToFriend(s2.setGameState, second, 'm2').success).toBe(true);
    expect(s2.current().relationships).toHaveLength(2);
  });
});
