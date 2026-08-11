/**
 * Friends can exist, and neglect finally costs something.
 *
 * PLAYER REPORT (BBQ, 2026-08-11), two items that turned out to be one gap:
 *
 *   "Cannot make any friends. Mom Dad children and spouse are all that's
 *    available. You can match with as many people as you want on Spark but only
 *    the first one is a contact."
 *
 *   "There's no penalty for letting relations go to 1 or bad. They can be at
 *    risk all they want. Nothing happens."
 *
 * `'friend'` was a declared `Relationship` type read in at least six places and
 * written by NOTHING — `promoteMatchToRelationship` was the only relationship
 * producer in the codebase and it creates partners, so its (correct)
 * anti-bigamy guard left every match after the first with nowhere to go.
 * Meanwhile `applyRelationshipHealth`'s fall-through branch clamped the score
 * and returned zero penalty for every non-partner type at any score, forever,
 * while `ContactsApp` rendered an "At risk" counter driven by
 * `contactsNeedingAttention`.
 *
 * Neither change touches the save format: the friend's type lives on the
 * relationship (not a new `SparkMatch` field) and the neglect counter reuses
 * the existing optional `weeksAtLowRelationship`.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { applyWithSetState as apply } from '../helpers/setGameStateStub';
import { GameState, Relationship } from '@/contexts/game/types';
import { promoteMatchToFriend, promoteMatchToRelationship } from '@/contexts/game/actions/SparkActions';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import {
  applyRelationshipHealth,
  NEGLECT_THRESHOLD,
  FRIEND_DRIFT_MIN_WEEKS,
  NEGLECT_HAPPINESS_DRAG,
  FRIEND_DRIFT_HAPPINESS_PENALTY,
} from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';

// ── X-3: friends ───────────────────────────────────────────────────────────

/** A state with two unpromoted Spark matches against real catalogue profiles. */
function stateWithMatches(): GameState {
  const base = createTestGameState();
  const [p1, p2] = DATING_PROFILES;
  return {
    ...base,
    relationships: [],
    sparkApp: {
      ...(base.sparkApp ?? ({} as never)),
      profile: base.sparkApp?.profile ?? { bio: '', photos: [], interests: [] },
      swipes: base.sparkApp?.swipes ?? [],
      matches: [
        { id: 'm1', profileId: p1.id, matchedWeek: 1, superLiked: false, promoted: false },
        { id: 'm2', profileId: p2.id, matchedWeek: 2, superLiked: false, promoted: false },
      ],
      messages: base.sparkApp?.messages ?? {},
      likedYou: base.sparkApp?.likedYou ?? [],
    } as NonNullable<GameState['sparkApp']>,
  };
}

describe('a Spark match can become a friend', () => {
  it('creates a relationship of type friend', () => {
    const after = apply(stateWithMatches(), (set) =>
      promoteMatchToFriend(set, stateWithMatches(), 'm1')
    );
    const rel = after.relationships?.find((r) => r.id === 'm1');
    expect(rel?.type).toBe('friend');
    expect(rel?.name).toBe(DATING_PROFILES[0].name);
  });

  it('REPORTS success on the happy path', () => {
    // The outcome is a pessimistic capture (initialised to a refusal and
    // overwritten inside the updater), which is the shape the C-9 ratchet
    // requires of a new action. Its failure mode is reporting failure forever if
    // the assignment is ever moved or dropped, and every other test here asserts
    // on committed STATE rather than the return value — so nothing else would
    // notice.
    const base = stateWithMatches();
    let committed = base;
    const set = (u: unknown) => {
      committed = typeof u === 'function' ? (u as (p: GameState) => GameState)(committed) : (u as GameState);
    };
    const result = promoteMatchToFriend(set as never, base, 'm1');

    expect(result.success).toBe(true);
    expect(result.relationshipId).toBe('m1');
    expect(result.message).toMatch(/friend/i);
  });

  it('starts above the neglect threshold — a new friend is not born "at risk"', () => {
    const after = apply(stateWithMatches(), (set) =>
      promoteMatchToFriend(set, stateWithMatches(), 'm1')
    );
    const rel = after.relationships?.find((r) => r.id === 'm1');
    expect(rel!.relationshipScore).toBeGreaterThan(NEGLECT_THRESHOLD);
  });

  it('is NOT exclusive — every match can become a friend', () => {
    // The whole point of the report: only the first match could ever become a
    // contact, because partners are exclusive and friends did not exist.
    const base = stateWithMatches();
    const one = apply(base, (set) => promoteMatchToFriend(set, base, 'm1'));
    const two = apply(one, (set) => promoteMatchToFriend(set, one, 'm2'));

    expect(two.relationships?.filter((r) => r.type === 'friend')).toHaveLength(2);
  });

  it('coexists with a partner — befriending does not trip anti-bigamy', () => {
    const base = stateWithMatches();
    const dating = apply(base, (set) => promoteMatchToRelationship(set, base, 'm1'));
    const both = apply(dating, (set) => promoteMatchToFriend(set, dating, 'm2'));

    expect(both.relationships?.find((r) => r.id === 'm1')?.type).toBe('partner');
    expect(both.relationships?.find((r) => r.id === 'm2')?.type).toBe('friend');
  });

  it('a double-tap in one batch cannot add the same person twice', () => {
    // The updater re-checks `prev`, not the caller's snapshot (CLAUDE.md §4.4).
    const base = stateWithMatches();
    let committed = base;
    const set = (u: unknown) => {
      committed = typeof u === 'function' ? (u as (p: GameState) => GameState)(committed) : (u as GameState);
    };
    promoteMatchToFriend(set as never, base, 'm1');
    promoteMatchToFriend(set as never, base, 'm1'); // same stale snapshot

    expect(committed.relationships?.filter((r) => r.id === 'm1')).toHaveLength(1);
  });

  it('refuses a match that is already promoted', () => {
    const base = stateWithMatches();
    const once = apply(base, (set) => promoteMatchToFriend(set, base, 'm1'));
    const result = promoteMatchToFriend(() => {}, once, 'm1');

    expect(result.success).toBe(false);
  });
});

// ── X-5: neglect has consequences ──────────────────────────────────────────

function ctx(rolls: number[] = []): WeekContext {
  return {
    notifications: [],
    preRolls: {
      relBreakup: rolls.length ? rolls : Array.from({ length: 20 }, () => 0.99),
      relDisappointed: Array.from({ length: 20 }, () => 0.99),
    },
  } as unknown as WeekContext;
}

const rel = (over: Partial<Relationship>): Relationship =>
  ({ id: 'r1', name: 'Sam', type: 'friend', relationshipScore: 50, ...over } as Relationship);

describe('neglecting family and friends finally costs something', () => {
  it('a neglected friend costs happiness every week', () => {
    const r = applyRelationshipHealth(rel({ relationshipScore: 10 }), 0, ctx());
    expect(r.happinessPenalty).toBe(NEGLECT_HAPPINESS_DRAG);
    expect(r.rel?.weeksAtLowRelationship).toBe(1);
  });

  it('a neglected parent costs happiness too', () => {
    const r = applyRelationshipHealth(rel({ type: 'parent', relationshipScore: 5 }), 0, ctx());
    expect(r.happinessPenalty).toBe(NEGLECT_HAPPINESS_DRAG);
  });

  it('warns once when the slide starts, not every week', () => {
    const first = ctx();
    applyRelationshipHealth(rel({ relationshipScore: 10 }), 0, first);
    expect(first.notifications).toHaveLength(1);

    const later = ctx();
    applyRelationshipHealth(rel({ relationshipScore: 10, weeksAtLowRelationship: 3 }), 0, later);
    expect(later.notifications).toHaveLength(0);
  });

  it('a healthy friend is untouched and costs nothing', () => {
    const c = ctx();
    const r = applyRelationshipHealth(rel({ relationshipScore: 80 }), 0, c);
    expect(r.happinessPenalty).toBe(0);
    expect(c.notifications).toHaveLength(0);
  });

  it('does not write weeksAtLowRelationship onto a never-neglected relationship', () => {
    // Stamping 0 onto every parent and child would churn the family tree to
    // record a value its absence already means.
    const r = applyRelationshipHealth(rel({ type: 'parent', relationshipScore: 90 }), 0, ctx());
    expect('weeksAtLowRelationship' in (r.rel ?? {})).toBe(false);
  });

  it('clears the counter once a neglected relationship recovers', () => {
    const r = applyRelationshipHealth(
      rel({ relationshipScore: 90, weeksAtLowRelationship: 6 }),
      0,
      ctx()
    );
    expect(r.rel?.weeksAtLowRelationship).toBe(0);
  });
});

describe('friends fade, family does not', () => {
  const lowLong = { relationshipScore: 5, weeksAtLowRelationship: FRIEND_DRIFT_MIN_WEEKS };

  it('a long-neglected friend can drift away entirely', () => {
    const c = ctx(Array.from({ length: 20 }, () => 0.0)); // roll always fires
    const r = applyRelationshipHealth(rel(lowLong), 0, c);

    expect(r.rel).toBeNull();
    expect(r.happinessPenalty).toBe(FRIEND_DRIFT_HAPPINESS_PENALTY);
    expect(c.notifications[0].title).toMatch(/Faded/);
  });

  it('but not before the minimum sustained neglect', () => {
    const c = ctx(Array.from({ length: 20 }, () => 0.0));
    const r = applyRelationshipHealth(
      rel({ relationshipScore: 5, weeksAtLowRelationship: FRIEND_DRIFT_MIN_WEEKS - 2 }),
      0,
      c
    );
    expect(r.rel).not.toBeNull();
  });

  it('a parent is NEVER removed, however long they are neglected', () => {
    // Deleting a parent would break inheritance, the family tree and every
    // `parent`-typed consumer — estrangement is a happiness cost, not a delete.
    const c = ctx(Array.from({ length: 20 }, () => 0.0));
    const r = applyRelationshipHealth(rel({ type: 'parent', ...lowLong }), 0, c);

    expect(r.rel).not.toBeNull();
    expect(r.rel?.type).toBe('parent');
  });

  it('a child is never removed either', () => {
    const c = ctx(Array.from({ length: 20 }, () => 0.0));
    const r = applyRelationshipHealth(rel({ type: 'child', ...lowLong }), 0, c);
    expect(r.rel).not.toBeNull();
  });

  it('Empathy (relationshipDecayMult) actually blocks a roll that would otherwise fire', () => {
    // At score 5: driftChance = min(0.25, (25-5)/100) = 0.20.
    // A roll of 0.15 fires at mult 1 (0.15 < 0.20) and MISSES at mult 0.5
    // (0.15 > 0.10). One roll, two outcomes — so the multiplier is doing the
    // work, not the roll.
    const rolls = Array.from({ length: 20 }, () => 0.15);

    const unskilled = {
      ...ctx(rolls),
      lifeSkillMods: { relationshipDecayMult: 1 },
    } as unknown as WeekContext;
    expect(applyRelationshipHealth(rel(lowLong), 0, unskilled).rel).toBeNull();

    const empathic = {
      ...ctx(rolls),
      lifeSkillMods: { relationshipDecayMult: 0.5 },
    } as unknown as WeekContext;
    expect(applyRelationshipHealth(rel(lowLong), 0, empathic).rel).not.toBeNull();
  });
});

describe('the warning fires before the consequence', () => {
  it('the neglect threshold sits below the UI "at risk" strength cutoff', () => {
    // `contactsNeedingAttention` flags strength < 50. If the mechanic bit at the
    // same number, the Attention tab would be a post-mortem rather than a
    // warning.
    expect(NEGLECT_THRESHOLD).toBeLessThan(50);
  });
});
