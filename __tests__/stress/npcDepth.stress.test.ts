/**
 * NPC Depth Deep Audit
 *
 * Per-tick processing of relationships (goals, opinion, memories, life events,
 * mood) is one of the heaviest weekly branches. Coverage:
 *
 *   - Opinion math: bounded [0, 100] for trust/attraction/respect across all
 *     deltas and starting points
 *   - Memory cap (MAX_MEMORIES = 20) honored on heavy event injection
 *   - decayMood is deterministic given input + bounded
 *   - rollNPCLifeEvent: applicable-event filter (child can't lose job, etc.)
 *   - applyNPCLifeEvent: income clamped to ≥0, memory pushed, lastLifeEvent set
 *   - processWeeklyNPCDepth: initializes missing depth fields on first encounter
 *   - getGiftPreferences / getGiftMultiplier: stable across personalities
 *   - createInitialOpinion: every relationship type produces in-range values
 *   - 500-week run: memories cap holds, opinion stays bounded, no NaN escapes
 */

import { makeWeeklyRoll } from '@/utils/seededRoll';
import type { Relationship, NPCOpinion } from '@/contexts/game/types';
// NPCLifeEvent is exported by the npcDepth module, not by contexts/game/types.
// Importing it from the wrong place made the name resolve to `any`, so all 27
// uses below were unchecked while looking fully typed.
import type { NPCLifeEvent } from '@/lib/social/npcDepth';
import {
  getGiftPreferences,
  getGiftMultiplier,
  generateNPCGoals,
  createInitialOpinion,
  updateOpinion,
  addMemory,
  rollNPCLifeEvent,
  applyNPCLifeEvent,
  decayMood,
  processWeeklyNPCDepth,
  getMoodEmoji,
  getMoodLabel,
} from '@/lib/social/npcDepth';

function makeRel(over: Partial<Relationship> = {}): Relationship {
  return {
    id: 'rel-1',
    name: 'Test',
    type: 'friend',
    relationshipScore: 50,
    personality: 'caring',
    gender: 'female',
    age: 25,
    ...over,
  };
}

function deepCheck(state: unknown): string[] {
  const issues: string[] = [];
  const seen = new WeakSet();
  const walk = (v: unknown, p: string) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      if (Number.isNaN(v)) issues.push(`NaN at ${p}`);
      if (!Number.isFinite(v)) issues.push(`Infinity at ${p}`);
      return;
    }
    if (typeof v === 'object') {
      const obj = v as object;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (Array.isArray(obj)) obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      else for (const k of Object.keys(obj)) walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
    }
  };
  walk(state, 'root');
  return issues;
}

describe('NPC depth audit', () => {
  // ── createInitialOpinion ───────────────────────────────────────────────
  it('createInitialOpinion: every relationship type produces in-range [0, 100] values', () => {
    const types: Relationship['type'][] = ['spouse', 'partner', 'friend', 'child', 'parent'];
    for (const t of types) {
      for (const score of [0, 25, 50, 75, 100]) {
        const op = createInitialOpinion(t, score);
        expect(op.trust).toBeGreaterThanOrEqual(0);
        expect(op.trust).toBeLessThanOrEqual(100);
        expect(op.attraction).toBeGreaterThanOrEqual(0);
        expect(op.attraction).toBeLessThanOrEqual(100);
        expect(op.respect).toBeGreaterThanOrEqual(0);
        expect(op.respect).toBeLessThanOrEqual(100);
      }
    }
  });

  it('createInitialOpinion: spouse starts with HIGH trust (base+20)', () => {
    const op = createInitialOpinion('spouse', 50);
    expect(op.trust).toBeGreaterThanOrEqual(50);
  });

  it('createInitialOpinion: child has 0 attraction (sanity)', () => {
    const op = createInitialOpinion('child', 50);
    expect(op.attraction).toBe(0);
  });

  // ── updateOpinion ──────────────────────────────────────────────────────
  it('updateOpinion: positive event raises trust/attraction/respect', () => {
    const base: NPCOpinion = { trust: 50, attraction: 50, respect: 50 };
    const after = updateOpinion(base, 'married');
    expect(after.trust).toBeGreaterThan(base.trust);
    expect(after.attraction).toBeGreaterThan(base.attraction);
    expect(after.respect).toBeGreaterThan(base.respect);
  });

  it('updateOpinion: negative event drops trust', () => {
    const base: NPCOpinion = { trust: 50, attraction: 50, respect: 50 };
    const after = updateOpinion(base, 'lied');
    expect(after.trust).toBeLessThan(base.trust);
    expect(after.respect).toBeLessThan(base.respect);
  });

  it('updateOpinion: clamps to [0, 100]', () => {
    let op: NPCOpinion = { trust: 100, attraction: 100, respect: 100 };
    op = updateOpinion(op, 'married'); // +10/+5/+5
    expect(op.trust).toBe(100);
    expect(op.attraction).toBe(100);
    expect(op.respect).toBe(100);

    op = { trust: 5, attraction: 5, respect: 5 };
    op = updateOpinion(op, 'lied'); // -8/-/-5
    expect(op.trust).toBe(0);
    expect(op.respect).toBe(0);
  });

  it('updateOpinion: unknown event returns unchanged opinion', () => {
    const base: NPCOpinion = { trust: 50, attraction: 60, respect: 70 };
    const after = updateOpinion(base, 'totally_not_an_event' as never);
    expect(after).toEqual(base);
  });

  // ── addMemory ──────────────────────────────────────────────────────────
  it('addMemory: appends a new entry with id + remaining fields', () => {
    const existing = [{ id: 'm1', type: 'date' as const, description: 'd1', weeksLived: 100, sentiment: 'positive' as const }];
    const updated = addMemory(existing, { type: 'gift', description: 'd2', weeksLived: 110, sentiment: 'positive' });
    expect(updated.length).toBe(2);
    expect(updated[1].description).toBe('d2');
    expect(updated[1].id).toBeDefined();
  });

  it('addMemory: caps at MAX_MEMORIES = 20', () => {
    let memories: ReturnType<typeof addMemory> = [];
    for (let i = 0; i < 50; i++) {
      memories = addMemory(memories, { type: 'date', description: `mem ${i}`, weeksLived: i, sentiment: 'positive' });
    }
    expect(memories.length).toBe(20);
    // Most recent are kept.
    expect(memories[memories.length - 1].description).toBe('mem 49');
  });

  // ── rollNPCLifeEvent ───────────────────────────────────────────────────
  it('rollNPCLifeEvent: returns null or a valid event over 100 trials', () => {
    const rel = makeRel({ type: 'friend', age: 30 });
    let nullCount = 0;
    let eventCount = 0;
    for (let i = 0; i < 200; i++) {
      const ev = rollNPCLifeEvent(rel);
      if (ev === null) nullCount++;
      else {
        eventCount++;
        expect(typeof ev.id).toBe('string');
        expect(typeof ev.description).toBe('string');
        expect(typeof ev.weight).toBe('number');
      }
    }
    // ~15% fire rate → ~30 events, ~170 nulls.
    expect(nullCount).toBeGreaterThan(eventCount);
  });

  it('rollNPCLifeEvent: never returns lost_job/got_promotion for child under 16', () => {
    const child = makeRel({ type: 'child', age: 10 });
    let firedAtAll = 0;
    for (let i = 0; i < 500; i++) {
      const ev = rollNPCLifeEvent(child);
      if (ev !== null) {
        firedAtAll++;
        expect(['lost_job', 'got_promotion', 'bonus_at_work']).not.toContain(ev.id);
      }
    }
    // Child under 16 never gets events at all per the function.
    expect(firedAtAll).toBe(0);
  });

  it('rollNPCLifeEvent: teen child (16+) CAN get events, but never job-related', () => {
    const teen = makeRel({ type: 'child', age: 17 });
    let jobEventCount = 0;
    for (let i = 0; i < 500; i++) {
      const ev = rollNPCLifeEvent(teen);
      if (ev && ['lost_job', 'got_promotion', 'bonus_at_work'].includes(ev.id)) {
        jobEventCount++;
      }
    }
    expect(jobEventCount).toBe(0);
  });

  // ── applyNPCLifeEvent ──────────────────────────────────────────────────
  it('applyNPCLifeEvent: applies mood + income + memory + lastLifeEvent', () => {
    const rel = makeRel({ income: 1000, npcMood: 'neutral' });
    const event: NPCLifeEvent = {
      id: 'test_event',
      description: '{name} won the lottery!',
      effects: { mood: 'happy', incomeChange: 500, relationshipScoreChange: 5 },
      weight: 1,
    };
    const after = applyNPCLifeEvent(rel, event, 100);
    expect(after.npcMood).toBe('happy');
    expect(after.income).toBe(1500);
    expect(after.relationshipScore).toBe(55);
    expect(after.lastLifeEvent).toBeDefined();
    expect(after.lastLifeEvent!.event).toBe('Test won the lottery!');
    expect(after.lastLifeEvent!.weeksLived).toBe(100);
    expect(after.npcMemories?.length).toBe(1);
  });

  it('applyNPCLifeEvent: income clamped to ≥0 (no negative income from event)', () => {
    const rel = makeRel({ income: 100, npcMood: 'neutral' });
    const event: NPCLifeEvent = {
      id: 'test',
      description: '{name} got fired',
      effects: { mood: 'sad', incomeChange: -1000 },
      weight: 1,
    };
    const after = applyNPCLifeEvent(rel, event, 100);
    expect(after.income).toBe(0); // clamped, not -900
  });

  it('applyNPCLifeEvent: jobChange updates rel.job', () => {
    const rel = makeRel({ job: 'engineer', npcMood: 'neutral' });
    const event: NPCLifeEvent = {
      id: 'test',
      description: '{name} switched careers',
      effects: { jobChange: 'teacher' },
      weight: 1,
    };
    const after = applyNPCLifeEvent(rel, event, 100);
    expect(after.job).toBe('teacher');
  });

  it('applyNPCLifeEvent: relationshipScore clamped to [0, 100]', () => {
    const high = makeRel({ relationshipScore: 95 });
    const positive: NPCLifeEvent = { id: 'p', description: '{name} good', effects: { relationshipScoreChange: 20 }, weight: 1 };
    expect(applyNPCLifeEvent(high, positive, 100).relationshipScore).toBe(100);

    const low = makeRel({ relationshipScore: 5 });
    const negative: NPCLifeEvent = { id: 'n', description: '{name} bad', effects: { relationshipScoreChange: -50 }, weight: 1 };
    expect(applyNPCLifeEvent(low, negative, 100).relationshipScore).toBe(0);
  });

  // ── decayMood ──────────────────────────────────────────────────────────
  it('decayMood: neutral stays neutral', () => {
    expect(decayMood('neutral')).toBe('neutral');
    expect(decayMood(undefined)).toBe('neutral');
  });

  it('decayMood: non-neutral mood EVENTUALLY decays to neutral over many trials', () => {
    // 33% chance per week; over 50 trials, very likely to see at least one neutral.
    let sawNeutral = false;
    for (let i = 0; i < 50; i++) {
      if (decayMood('happy') === 'neutral') {
        sawNeutral = true;
        break;
      }
    }
    expect(sawNeutral).toBe(true);
  });

  // ── getGiftPreferences ────────────────────────────────────────────────
  it('getGiftPreferences: every personality returns likes + dislikes arrays', () => {
    const personalities = ['caring', 'cool', 'kind', 'shy', 'extrovert', 'unknown_personality'];
    for (const p of personalities) {
      const prefs = getGiftPreferences(p);
      expect(Array.isArray(prefs.likes)).toBe(true);
      expect(Array.isArray(prefs.dislikes)).toBe(true);
    }
  });

  // ── getGiftMultiplier ─────────────────────────────────────────────────
  it('getGiftMultiplier: returns a finite positive number', () => {
    const rel = makeRel({ giftPreferences: ['flowers'], giftDislikes: ['junk'] });
    const liked = getGiftMultiplier(rel, 'flowers');
    const disliked = getGiftMultiplier(rel, 'junk');
    const neutral = getGiftMultiplier(rel, 'misc');
    expect(Number.isFinite(liked)).toBe(true);
    expect(Number.isFinite(disliked)).toBe(true);
    expect(Number.isFinite(neutral)).toBe(true);
    expect(liked).toBeGreaterThan(disliked); // like beats dislike
  });

  // ── generateNPCGoals ───────────────────────────────────────────────────
  it('generateNPCGoals: every type returns a goal array', () => {
    const types: Relationship['type'][] = ['spouse', 'partner', 'friend', 'child', 'parent'];
    // The roll is a required argument now (Program 14): this ran on
    // `Math.random()` from inside the weekly tick, which CLAUDE.md 4.3 forbids.
    // A fixed stream here also makes the assertions below deterministic.
    const roll = makeWeeklyRoll(100);
    for (const t of types) {
      const goals = generateNPCGoals(t, 'caring', roll);
      expect(Array.isArray(goals)).toBe(true);
      for (const g of goals) {
        expect(typeof g.id).toBe('string');
        expect(typeof g.label).toBe('string');
        expect(typeof g.fulfilled).toBe('boolean');
      }
    }
  });

  // ── processWeeklyNPCDepth ──────────────────────────────────────────────
  it('processWeeklyNPCDepth: initializes missing depth fields on first encounter', () => {
    const rels = [makeRel({ id: 'a', npcGoals: undefined, npcOpinion: undefined, npcMood: undefined, npcMemories: undefined })];
    const { relationships } = processWeeklyNPCDepth(rels, 100);
    const r = relationships[0];
    expect(r.npcGoals).toBeDefined();
    expect(r.npcOpinion).toBeDefined();
    expect(r.npcMood).toBeDefined();
    expect(r.npcMemories).toBeDefined();
    expect(r.giftPreferences).toBeDefined();
  });

  it('processWeeklyNPCDepth: opinion passively decays when no interaction this week', () => {
    const rel = makeRel({
      id: 'no-talk',
      npcOpinion: { trust: 80, attraction: 70, respect: 60 },
      lastInteractionWeek: 50, // not this week
    });
    const { relationships } = processWeeklyNPCDepth([rel], 100);
    const r = relationships[0];
    expect(r.npcOpinion!.trust).toBeLessThan(80);
    expect(r.npcOpinion!.attraction).toBeLessThan(70);
    // Respect doesn't decay.
    expect(r.npcOpinion!.respect).toBe(60);
  });

  it('processWeeklyNPCDepth: opinion does NOT decay when interaction happened this week', () => {
    const rel = makeRel({
      id: 'talked',
      npcOpinion: { trust: 80, attraction: 70, respect: 60 },
      lastInteractionWeek: 100, // THIS week
    });
    const { relationships } = processWeeklyNPCDepth([rel], 100);
    const r = relationships[0];
    expect(r.npcOpinion!.trust).toBe(80);
    expect(r.npcOpinion!.attraction).toBe(70);
  });

  it('processWeeklyNPCDepth: ages NPCs at exactly WEEKS_PER_YEAR intervals', async () => {
    const { WEEKS_PER_YEAR } = await import('@/lib/config/gameConstants');
    const rel = makeRel({ age: 30 });
    // Not at year boundary → no aging
    let { relationships } = processWeeklyNPCDepth([rel], WEEKS_PER_YEAR - 1);
    expect(relationships[0].age).toBe(30);
    // At year boundary → ages by 1
    ({ relationships } = processWeeklyNPCDepth([rel], WEEKS_PER_YEAR));
    expect(relationships[0].age).toBe(31);
  });

  it('processWeeklyNPCDepth: auto-fulfills "want_marriage" goal for spouses', () => {
    const spouse = makeRel({
      id: 'sp',
      type: 'spouse',
      npcGoals: [{ id: 'want_marriage', label: 'Get married', category: 'family', fulfilled: false } as never],
    });
    const { relationships, notifications } = processWeeklyNPCDepth([spouse], 200);
    const g = relationships[0].npcGoals?.find(x => x.id === 'want_marriage');
    expect(g?.fulfilled).toBe(true);
    expect(g?.fulfilledWeek).toBe(200);
    expect(notifications.some(n => /married|marriage/i.test(n))).toBe(true);
  });

  // ── HEAVY MEMORY INJECTION ─────────────────────────────────────────────
  it('Memory cap: 1000-week run with frequent events keeps npcMemories ≤ 20', () => {
    let rels = [makeRel({ id: 'busy', type: 'friend', age: 30 })];
    for (let week = 1; week <= 1000; week++) {
      ({ relationships: rels } = processWeeklyNPCDepth(rels, week));
    }
    expect((rels[0].npcMemories || []).length).toBeLessThanOrEqual(20);
  });

  // ── STATE INVARIANT UNDER HEAVY LOAD ───────────────────────────────────
  it('Long run: 500 ticks across 5 NPCs keeps state JSON-safe', () => {
    let rels: Relationship[] = Array.from({ length: 5 }, (_, i) =>
      makeRel({ id: `rel_${i}`, type: 'friend', age: 25 + i, relationshipScore: 40 + i * 10 })
    );
    for (let week = 1; week <= 500; week++) {
      const result = processWeeklyNPCDepth(rels, week);
      rels = result.relationships;
    }
    const issues = deepCheck(rels);
    expect(issues).toEqual([]);

    // Every NPC's opinion stays in range.
    for (const r of rels) {
      if (r.npcOpinion) {
        expect(r.npcOpinion.trust).toBeGreaterThanOrEqual(0);
        expect(r.npcOpinion.trust).toBeLessThanOrEqual(100);
        expect(r.npcOpinion.attraction).toBeGreaterThanOrEqual(0);
        expect(r.npcOpinion.attraction).toBeLessThanOrEqual(100);
        expect(r.npcOpinion.respect).toBeGreaterThanOrEqual(0);
        expect(r.npcOpinion.respect).toBeLessThanOrEqual(100);
      }
      expect(r.relationshipScore).toBeGreaterThanOrEqual(0);
      expect(r.relationshipScore).toBeLessThanOrEqual(100);
    }
  });

  // ── MOOD HELPERS ───────────────────────────────────────────────────────
  it('getMoodEmoji / getMoodLabel: return strings for every mood + undefined', () => {
    const moods: Relationship['npcMood'][] = ['happy', 'stressed', 'sad', 'angry', 'neutral', undefined];
    for (const m of moods) {
      expect(typeof getMoodEmoji(m)).toBe('string');
      expect(typeof getMoodLabel(m)).toBe('string');
    }
  });

  // ── PRESERVATION ───────────────────────────────────────────────────────
  it('processWeeklyNPCDepth: empty relationships array returns empty', () => {
    const { relationships, notifications } = processWeeklyNPCDepth([], 100);
    expect(relationships).toEqual([]);
    expect(notifications).toEqual([]);
  });

  it('processWeeklyNPCDepth: preserves id, name, type, gender across processing', () => {
    const rels = [makeRel({ id: 'preserve', name: 'P', type: 'friend', gender: 'male', age: 25 })];
    const { relationships } = processWeeklyNPCDepth(rels, 100);
    expect(relationships[0].id).toBe('preserve');
    expect(relationships[0].name).toBe('P');
    expect(relationships[0].type).toBe('friend');
    expect(relationships[0].gender).toBe('male');
  });
});
