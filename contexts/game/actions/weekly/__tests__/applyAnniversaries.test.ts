/**
 * applyAnniversaries — the weekly-tick marriage-anniversary grant that replaced
 * the ContactsApp-only `checkAnniversary` effect.
 *
 * Pins: exact happiness bonus + milestone on the year boundary, per-year
 * idempotence, the legacy cyclic-marriageWeek skip, and a DETERMINISTIC Pulse
 * post (seed-free ids, tick timestamp) gated on shouldAutoPostMilestone.
 */
import { applyAnniversaries } from '@/contexts/game/actions/weekly/applyAnniversaries';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import type { GameState, Relationship } from '@/contexts/game/types';

const MARRIAGE_WEEK = 200;
const BOUNDARY = MARRIAGE_WEEK + WEEKS_PER_YEAR; // first 1-year anniversary week

function marriedRels(marriageWeek = MARRIAGE_WEEK): Relationship[] {
  return [
    {
      id: 'sp',
      name: 'Robin',
      type: 'spouse',
      relationshipScore: 85,
      marriageWeek,
      anniversaryWeek: marriageWeek,
    } as Relationship,
  ];
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({ weeksLived: BOUNDARY - 1, lifeMilestones: [], ...overrides });
}

describe('applyAnniversaries (weekly tick anniversary grant)', () => {
  it('fires on the exact 1-year boundary: +11 happiness and one anniversary milestone', () => {
    const res = applyAnniversaries({
      prevState: baseState(),
      relationships: marriedRels(),
      nextWeeksLived: BOUNDARY, // the tick crosses the boundary
      nextYear: 2030,
      timestamp: 1_000_000,
    });

    expect(res.isAnniversary).toBe(true);
    expect(res.yearsMarried).toBe(1);
    expect(res.happinessBonus).toBe(11); // 10 + yearsMarried
    expect(res.milestone).not.toBeNull();
    expect(res.milestone!.type).toBe('anniversary');
    expect(res.milestone!.partnerId).toBe('sp');
    expect(res.milestone!.week).toBe(BOUNDARY);
    expect((res.milestone!.details as { yearsMarried: number }).yearsMarried).toBe(1);
  });

  it('is idempotent: no re-grant when this anniversary is already recorded', () => {
    const prevState = baseState({
      lifeMilestones: [
        { id: 'x', type: 'anniversary', week: 0, year: 0, partnerId: 'sp', details: { yearsMarried: 1 } } as any,
      ],
    });
    const res = applyAnniversaries({
      prevState,
      relationships: marriedRels(),
      nextWeeksLived: BOUNDARY,
      nextYear: 2030,
      timestamp: 1_000_000,
    });

    expect(res.isAnniversary).toBe(false);
    expect(res.happinessBonus).toBe(0);
    expect(res.milestone).toBeNull();
    expect(res.post).toBeNull();
  });

  it('does not fire one week off the anniversary', () => {
    const res = applyAnniversaries({
      prevState: baseState({ weeksLived: BOUNDARY }),
      relationships: marriedRels(),
      nextWeeksLived: BOUNDARY + 1,
      nextYear: 2030,
      timestamp: 1,
    });
    expect(res.isAnniversary).toBe(false);
  });

  it('skips legacy saves whose marriageWeek is the cyclic 1-4 value', () => {
    const res = applyAnniversaries({
      prevState: baseState({ weeksLived: 299 }),
      relationships: marriedRels(4), // legacy cyclic marriageWeek
      nextWeeksLived: 300,
      nextYear: 2030,
      timestamp: 1,
    });
    expect(res.isAnniversary).toBe(false);
  });

  it('emits a deterministic Pulse post only for players who already post', () => {
    const withPosts = baseState();
    withPosts.socialMedia = { totalPosts: 4 } as any;
    const res1 = applyAnniversaries({
      prevState: withPosts,
      relationships: marriedRels(),
      nextWeeksLived: BOUNDARY,
      nextYear: 2030,
      timestamp: 42,
    });
    expect(res1.post).not.toBeNull();
    expect(res1.post!.hashtags).toContain('#anniversary');
    expect(res1.post!.timestamp).toBe(42); // deterministic — tick clock, not Date.now()
    expect(res1.post!.id).toBe(`pp_anniversary_${BOUNDARY}_sp`); // seed-free id

    const noPosts = baseState();
    noPosts.socialMedia = { totalPosts: 0 } as any;
    const res2 = applyAnniversaries({
      prevState: noPosts,
      relationships: marriedRels(),
      nextWeeksLived: BOUNDARY,
      nextYear: 2030,
      timestamp: 42,
    });
    expect(res2.post).toBeNull();
    // The reward (happiness + milestone) still lands even without a Pulse post.
    expect(res2.isAnniversary).toBe(true);
    expect(res2.happinessBonus).toBe(11);
  });
});
