/**
 * NPC mood / memory / wants — the "relationships feel alive" layer.
 *
 * Covers the additive depth added on top of the existing NPC-depth module:
 *   - Mood ladder (brighten/sour) clamps at the ends; deterministic context drift
 *     from neglect + bond strength.
 *   - Wants: deterministic rotation, satisfy-boost with DIMINISHING returns,
 *     and the small cost of ignoring a needy want (honouring "space" is rewarded).
 *   - Memory: recorded on notable interactions, bounded length, age-decay.
 *   - Interaction variation: the SAME action produces DIFFERENT score deltas +
 *     copy by mood / want, and is DETERMINISTIC (seeded — no save-scum), while
 *     collapsing to the flat base bonus when no depth fields are present.
 */

import type { Relationship, NPCWant, NPCMemory } from '@/contexts/game/types';
import {
  brightenMood,
  sourMood,
  driftMoodFromContext,
  wantBonus,
  wantSatisfiedBy,
  applyWantProgress,
  pickWant,
  rotateWantIfDue,
  WANT_ROTATION_WEEKS,
  decayMemories,
  MEMORY_TTL_WEEKS,
  resolveInteraction,
  processWeeklyNPCDepth,
  getMoodEmoji,
} from '@/lib/social/npcDepth';

function makeRel(over: Partial<Relationship> = {}): Relationship {
  return {
    id: 'rel-1',
    name: 'Sam',
    type: 'friend',
    relationshipScore: 50,
    personality: 'caring',
    gender: 'female',
    age: 30,
    ...over,
  };
}

function makeWant(over: Partial<NPCWant> = {}): NPCWant {
  return { id: 'hear_from_you', label: 'Wishes you would call more', since: 10, satisfiedCount: 0, ...over };
}

describe('mood ladder + drift', () => {
  it('brightenMood / sourMood step one rung and clamp at the ends', () => {
    expect(brightenMood('neutral')).toBe('happy');
    expect(sourMood('neutral')).toBe('stressed');
    expect(brightenMood('happy')).toBe('happy'); // clamp top
    expect(sourMood('angry')).toBe('angry'); // clamp bottom
    // undefined is treated as neutral
    expect(brightenMood(undefined)).toBe('happy');
    expect(sourMood(undefined)).toBe('stressed');
  });

  it('driftMoodFromContext sours a neglected / weak bond (deterministic)', () => {
    const rel = makeRel({ npcMood: 'neutral', lastInteractionWeek: 0, relationshipScore: 50 });
    // weeksLived 100 → 100 weeks of neglect. roll < 0.4 sours a notch.
    expect(driftMoodFromContext(rel, 100, 0.1)).toBe('stressed');
    // roll >= 0.4 and not well-tended → unchanged
    expect(driftMoodFromContext(rel, 100, 0.9)).toBe('neutral');
  });

  it('driftMoodFromContext brightens a well-tended, strong bond', () => {
    const rel = makeRel({ npcMood: 'neutral', lastInteractionWeek: 100, relationshipScore: 80 });
    expect(driftMoodFromContext(rel, 100, 0.8)).toBe('happy');
  });

  it('driftMoodFromContext output always stays on the ladder', () => {
    const moods: Relationship['npcMood'][] = ['happy', 'neutral', 'stressed', 'sad', 'angry', undefined];
    for (const m of moods) {
      for (const roll of [0, 0.2, 0.5, 0.8, 0.99]) {
        const out = driftMoodFromContext(makeRel({ npcMood: m, lastInteractionWeek: 0 }), 50, roll);
        expect(['happy', 'neutral', 'stressed', 'sad', 'angry']).toContain(out);
      }
    }
  });

  it('getMoodEmoji returns a non-empty glyph for every mood', () => {
    for (const m of ['happy', 'neutral', 'stressed', 'sad', 'angry', undefined] as Relationship['npcMood'][]) {
      expect(getMoodEmoji(m).length).toBeGreaterThan(0);
    }
  });
});

describe('wants — rotation, satisfy-boost, diminishing returns', () => {
  it('wantBonus diminishes: 4, 2, 1, then 0', () => {
    expect(wantBonus(0)).toBe(4);
    expect(wantBonus(1)).toBe(2);
    expect(wantBonus(2)).toBe(1);
    expect(wantBonus(3)).toBe(0);
    expect(wantBonus(10)).toBe(0);
  });

  it('wantSatisfiedBy maps actions correctly', () => {
    expect(wantSatisfiedBy(makeWant({ id: 'hear_from_you' }), 'call')).toBe(true);
    expect(wantSatisfiedBy(makeWant({ id: 'hear_from_you' }), 'hangout')).toBe(false);
    expect(wantSatisfiedBy(makeWant({ id: 'quality_time' }), 'hangout')).toBe(true);
    expect(wantSatisfiedBy(makeWant({ id: 'quality_time' }), 'date')).toBe(true);
    expect(wantSatisfiedBy(makeWant({ id: 'a_gift' }), 'gift')).toBe(true);
    expect(wantSatisfiedBy(makeWant({ id: 'space' }), 'call')).toBe(false); // space is satisfied by absence
    expect(wantSatisfiedBy(undefined, 'call')).toBe(false);
  });

  it('applyWantProgress diminishes across repeated satisfies in one cycle', () => {
    let want: NPCWant | undefined = makeWant({ id: 'hear_from_you', satisfiedCount: 0 });
    const first = applyWantProgress(want, 'call', 10);
    expect(first.bonus).toBe(4);
    expect(first.satisfied).toBe(true);
    want = first.want;
    const second = applyWantProgress(want, 'call', 10);
    expect(second.bonus).toBe(2);
    want = second.want;
    const third = applyWantProgress(want, 'call', 10);
    expect(third.bonus).toBe(1);
    want = third.want;
    const fourth = applyWantProgress(want, 'call', 10);
    expect(fourth.bonus).toBe(0);
    expect(fourth.satisfied).toBe(false);
  });

  it('applyWantProgress is a no-op for a non-matching action', () => {
    const want = makeWant({ id: 'quality_time', satisfiedCount: 0 });
    const out = applyWantProgress(want, 'call', 10);
    expect(out.bonus).toBe(0);
    expect(out.satisfied).toBe(false);
    expect(out.want).toBe(want); // unchanged reference
  });

  it('pickWant is deterministic and returns a want valid for the type', () => {
    const a = pickWant('rel-1', 3, 'friend');
    const b = pickWant('rel-1', 3, 'friend');
    expect(a).toBe(b);
    // friends never get partner-only wants
    for (let cycle = 0; cycle < 40; cycle++) {
      expect(pickWant('rel-x', cycle, 'friend')).not.toBe('a_gift');
    }
    // a_gift can appear for partners
    const partnerWants = new Set(Array.from({ length: 40 }, (_, c) => pickWant('p', c, 'partner')));
    expect(partnerWants.size).toBeGreaterThan(1);
  });

  it('rotateWantIfDue initialises a want on first encounter (no cost)', () => {
    const rel = makeRel({ npcWant: undefined, relationshipScore: 50 });
    const { rel: out, notification } = rotateWantIfDue(rel, 20);
    expect(out.npcWant).toBeDefined();
    expect(out.npcWant!.since).toBe(20);
    expect(out.npcWant!.satisfiedCount).toBe(0);
    expect(out.relationshipScore).toBe(50); // no penalty on init
    expect(notification).toBeUndefined();
  });

  it('rotateWantIfDue leaves a still-current want untouched', () => {
    const rel = makeRel({ npcWant: makeWant({ since: 12 }) });
    const { rel: out } = rotateWantIfDue(rel, 12 + WANT_ROTATION_WEEKS - 1);
    expect(out.npcWant!.since).toBe(12); // not rotated
  });

  it('ignoring a needy want costs bond + mood + a remembered slight', () => {
    const rel = makeRel({
      npcWant: makeWant({ id: 'quality_time', since: 10, satisfiedCount: 0 }),
      lastInteractionWeek: 5, // before the want began → ignored all cycle
      relationshipScore: 50,
      npcMood: 'neutral',
    });
    const { rel: out, notification } = rotateWantIfDue(rel, 10 + WANT_ROTATION_WEEKS);
    expect(out.relationshipScore).toBe(48); // −2
    expect(out.npcMood).toBe('stressed'); // soured a notch
    expect(notification).toBeDefined();
    expect((out.npcMemories ?? []).some((m) => m.sentiment === 'negative')).toBe(true);
    expect(out.npcWant!.since).toBe(10 + WANT_ROTATION_WEEKS); // fresh want assigned
  });

  it('honouring a "space" want (left alone) is quietly rewarded', () => {
    const rel = makeRel({
      npcWant: makeWant({ id: 'space', since: 10, satisfiedCount: 0 }),
      lastInteractionWeek: 5, // no contact during the cycle → space honoured
      relationshipScore: 50,
      npcMood: 'neutral',
    });
    const { rel: out } = rotateWantIfDue(rel, 10 + WANT_ROTATION_WEEKS);
    expect(out.relationshipScore).toBe(51); // +1
    expect(out.npcMood).toBe('happy'); // brightened a notch
    expect((out.npcMemories ?? []).some((m) => m.sentiment === 'positive')).toBe(true);
  });

  it('violating a "space" want (interacting anyway) earns no reward', () => {
    const rel = makeRel({
      npcWant: makeWant({ id: 'space', since: 10, satisfiedCount: 0 }),
      lastInteractionWeek: 13, // interacted DURING the cycle
      relationshipScore: 50,
      npcMood: 'neutral',
    });
    const { rel: out } = rotateWantIfDue(rel, 10 + WANT_ROTATION_WEEKS);
    expect(out.relationshipScore).toBe(50); // unchanged
    expect(out.npcMood).toBe('neutral');
  });
});

describe('memory — record, bounded length, age-decay', () => {
  function mem(weeksLived: number, sentiment: NPCMemory['sentiment'] = 'positive'): NPCMemory {
    return { id: `m${weeksLived}`, type: 'kindness', description: `d${weeksLived}`, weeksLived, sentiment };
  }

  it('decayMemories keeps a short list untouched', () => {
    const list = [mem(1), mem(2)];
    expect(decayMemories(list, 999)).toEqual(list);
  });

  it('decayMemories drops memories older than the TTL but keeps recent ones', () => {
    const list = [mem(10), mem(20), mem(90), mem(95), mem(99)];
    const out = decayMemories(list, 100, MEMORY_TTL_WEEKS);
    expect(out.map((m) => m.weeksLived)).toEqual([90, 95, 99]); // 10 & 20 are >52wk old
  });

  it('decayMemories always keeps at least the most recent few (never blanks)', () => {
    const list = [mem(1), mem(2), mem(3), mem(4), mem(5)]; // all ancient vs week 100
    const out = decayMemories(list, 100, MEMORY_TTL_WEEKS, 3);
    expect(out.length).toBe(3);
    expect(out.map((m) => m.weeksLived)).toEqual([3, 4, 5]);
  });

  it('processWeeklyNPCDepth keeps memories bounded over a long neglected run', () => {
    let rels = [makeRel({ id: 'busy', type: 'friend', age: 30 })];
    for (let week = 1; week <= 400; week++) {
      ({ relationships: rels } = processWeeklyNPCDepth(rels, week));
    }
    expect((rels[0].npcMemories ?? []).length).toBeLessThanOrEqual(20);
  });
});

describe('interaction variation — deterministic, varies by mood + want', () => {
  it('collapses to the flat base bonus when no depth fields are present', () => {
    const out = resolveInteraction(makeRel(), 'call', 3, 10);
    expect(out.scoreDelta).toBe(3);
    expect(out.wantSatisfied).toBe(false);
    expect(out.message).toContain('(+3)');
  });

  it('is deterministic — same inputs yield the same delta AND copy', () => {
    const rel = makeRel({ npcMood: 'happy' });
    const a = resolveInteraction(rel, 'call', 3, 42);
    const b = resolveInteraction(rel, 'call', 3, 42);
    expect(a).toEqual(b);
  });

  it('the SAME action lands differently by mood', () => {
    const happy = resolveInteraction(makeRel({ npcMood: 'happy' }), 'call', 3, 10);
    const upset = resolveInteraction(makeRel({ npcMood: 'sad' }), 'call', 3, 10);
    expect(happy.scoreDelta).toBeGreaterThan(upset.scoreDelta); // happy warmer, upset a rebuff
    expect(happy.tone).toBe('warm');
    expect(upset.tone).toBe('cool');
    expect(happy.message).not.toBe(upset.message);
    // Never punitive for a friendly reach-out — floored at 1.
    expect(upset.scoreDelta).toBeGreaterThanOrEqual(1);
  });

  it('satisfying the current want gives a big boost + brighter mood + a memory', () => {
    const rel = makeRel({
      npcMood: 'neutral',
      npcWant: makeWant({ id: 'hear_from_you', satisfiedCount: 0 }),
    });
    const out = resolveInteraction(rel, 'call', 3, 10);
    expect(out.wantSatisfied).toBe(true);
    expect(out.scoreDelta).toBe(7); // base 3 + want bonus 4
    expect(out.npcMood).toBe('happy'); // brightened from neutral
    expect(out.npcWant!.satisfiedCount).toBe(1);
    expect(out.memory?.sentiment).toBe('positive');
    expect(out.tone).toBe('warm');
  });

  it('an action that does NOT match the current want does not satisfy it', () => {
    const rel = makeRel({
      npcMood: 'neutral',
      npcWant: makeWant({ id: 'quality_time', satisfiedCount: 0 }),
    });
    const out = resolveInteraction(rel, 'call', 3, 10); // call ≠ quality_time
    expect(out.wantSatisfied).toBe(false);
    expect(out.scoreDelta).toBe(3);
    expect(out.npcWant).toBeUndefined(); // want left untouched
  });

  it('interacting when they want space is a cool, reduced outcome', () => {
    const rel = makeRel({ npcMood: 'neutral', npcWant: makeWant({ id: 'space', satisfiedCount: 0 }) });
    const out = resolveInteraction(rel, 'hangout', 6, 10);
    expect(out.tone).toBe('cool');
    expect(out.scoreDelta).toBeLessThan(6); // reduced vs the base bonus
    expect(out.scoreDelta).toBeGreaterThanOrEqual(1);
  });
});
