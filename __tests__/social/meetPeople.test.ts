/**
 * The tier-1 way somebody new enters a life — Master Program 11.
 *
 * The gap, as the repository itself documented it before this shipped: the only
 * producers of a `Relationship` were `promoteMatchToRelationship` /
 * `promoteMatchToFriend` (Spark, tier 2) and the `intro` favour, which
 * `FAVOR_KIND_BY_CONTACT` offers only on a `business` contact (travel, tier 3).
 * A player below tier 2 could not meet anybody, and `ch2_make_friend` had to
 * count the seeded parents to avoid a deadlock — so the tutorial chapter's
 * social goal was complete on frame one and paid its reward for nothing.
 *
 * These tests pin the properties that make the door safe rather than the
 * numbers behind it: it is derived (no stored cooldown), it is deterministic
 * per life and week, it cannot be tapped twice, it charges before it grants,
 * and it is capped.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import type { GameState } from '@/contexts/game/types';
import {
  currentIntroduction,
  introducedCount,
  meetBlockedReason,
  pickVenue,
  MEET_WINDOW_WEEKS,
  MEET_MAX_INTRODUCED,
  MEET_ENERGY_COST,
  MET_STARTING_BOND,
} from '@/lib/social/meetPeople';
import { meetSomeone } from '@/contexts/game/actions/ContactsActions';
import { NEGLECT_THRESHOLD } from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import { unlockTier } from '@/lib/progress/featureUnlocks';

/** A life `n` weeks in. `lifeStartWeek` pins the baseline (CLAUDE.md §4.2). */
function lifeAt(n: number, patch: Partial<GameState> = {}): GameState {
  return {
    ...createTestGameState({ weeksLived: n }),
    lifeStartWeek: 0,
    ...patch,
  } as GameState;
}

describe('somebody is around, on a schedule the save does not store', () => {
  it('nobody in the first window — chapter 1 asks for one thing at a time', () => {
    for (let w = 0; w < MEET_WINDOW_WEEKS; w++) {
      expect(currentIntroduction(lifeAt(w))).toBeNull();
    }
  });

  it('and somebody from the first window onward', () => {
    expect(currentIntroduction(lifeAt(MEET_WINDOW_WEEKS))).not.toBeNull();
  });

  it('is reachable at tier 1 — the whole point', () => {
    const s = lifeAt(8, { completedChapters: ['ch1_fresh_start'] });
    expect(unlockTier(s)).toBeLessThanOrEqual(1);
    expect(currentIntroduction(s)).not.toBeNull();
  });

  it('the same person on every read of the same week — a reload cannot re-roll them', () => {
    const s = lifeAt(12);
    const a = currentIntroduction(s)!;
    const b = currentIntroduction({ ...s })!;
    expect(a).toEqual(b);
  });

  it('a different person in a different LIFE, in the same week', () => {
    const week = 12;
    const a = currentIntroduction(lifeAt(week, { lineageId: 'life-A', generationNumber: 1 }))!;
    const b = currentIntroduction(lifeAt(week, { lineageId: 'life-B', generationNumber: 1 }))!;
    expect(a.name).not.toBe(b.name);
  });

  it('the same person for every week inside one window, and a new one in the next', () => {
    const inWindow = currentIntroduction(lifeAt(MEET_WINDOW_WEEKS))!;
    const stillSame = currentIntroduction(lifeAt(MEET_WINDOW_WEEKS + 1))!;
    const next = currentIntroduction(lifeAt(MEET_WINDOW_WEEKS * 2))!;
    expect(stillSame.id).toBe(inWindow.id);
    expect(next.id).not.toBe(inWindow.id);
  });
});

describe('where people come from is where the player already is', () => {
  it('a student meets classmates', () => {
    const s = lifeAt(12, {
      educations: [{ id: 'business_degree', name: 'x', description: '', cost: 0, duration: 40, weeksRemaining: 30, completed: false }],
    } as Partial<GameState>);
    expect(pickVenue(s).id).toBe('class');
  });

  it('a worker meets colleagues', () => {
    expect(pickVenue(lifeAt(12, { currentJob: 'janitor' })).id).toBe('work');
  });

  it('somebody who actually trains meets people at the gym', () => {
    const s = lifeAt(12, { currentJob: undefined, stats: { ...createTestGameState().stats, fitness: 60 } });
    expect(pickVenue(s).id).toBe('gym');
  });

  it('and there is no life in which nobody is around', () => {
    const s = lifeAt(12, { currentJob: undefined });
    expect(pickVenue(s)).toBeDefined();
    expect(currentIntroduction(s)).not.toBeNull();
  });
});

describe('saying hello', () => {
  it('creates a real friend, at a bond clear of the neglect threshold', () => {
    const s = lifeAt(12, { currentJob: 'janitor' });
    const intro = currentIntroduction(s)!;
    const stub = createSetGameStateStub(s);

    const r = meetSomeone(s, stub.setGameState);
    expect(r.success).toBe(true);

    const rel = (stub.current().relationships ?? []).find((x) => x.id === intro.id)!;
    expect(rel.type).toBe('friend');
    expect(rel.name).toBe(intro.name);
    expect(rel.relationshipScore).toBe(MET_STARTING_BOND);
    expect(rel.relationshipScore).toBeGreaterThan(NEGLECT_THRESHOLD);
  });

  it('records WHERE and WHEN — the thing a bond number cannot say', () => {
    const s = lifeAt(12, { currentJob: 'janitor' });
    const stub = createSetGameStateStub(s);
    meetSomeone(s, stub.setGameState);

    const rel = (stub.current().relationships ?? []).find((x) => x.id.startsWith('met-'))!;
    expect(rel.metAt).toEqual({ venue: 'work', label: 'at work', week: 12 });
  });

  it('charges the energy inside the same updater that adds the person', () => {
    const s = lifeAt(12, { currentJob: 'janitor' });
    const before = s.stats.energy;
    const stub = createSetGameStateStub(s);
    meetSomeone(s, stub.setGameState);

    expect(stub.current().stats.energy).toBe(before - MEET_ENERGY_COST);
    expect(stub.calls()).toBe(1);
  });

  it('a same-batch double tap adds ONE person and charges once (§4.4)', () => {
    const s = lifeAt(12, { currentJob: 'janitor' });
    const before = s.stats.energy;
    const stub = createSetGameStateStub(s);

    meetSomeone(s, stub.setGameState);
    // Second tap dispatched from the SAME stale snapshot, as a double tap is.
    meetSomeone(s, stub.setGameState);

    const rels = (stub.current().relationships ?? []).filter((x) => x.id.startsWith('met-'));
    expect(rels).toHaveLength(1);
    expect(stub.current().stats.energy).toBe(before - MEET_ENERGY_COST);
  });

  it('is refused when there is not enough energy, and nothing is charged', () => {
    const base = lifeAt(12, { currentJob: 'janitor' });
    const s: GameState = { ...base, stats: { ...base.stats, energy: MEET_ENERGY_COST - 1 } };
    const stub = createSetGameStateStub(s);

    const r = meetSomeone(s, stub.setGameState);
    expect(r.success).toBe(false);
    expect(stub.current().relationships).toEqual(s.relationships);
    expect(stub.current().stats.energy).toBe(MEET_ENERGY_COST - 1);
  });

  it('is refused when the coffee is unaffordable at a venue that charges', () => {
    const base = lifeAt(12, { currentJob: 'janitor' });
    const s: GameState = { ...base, stats: { ...base.stats, money: 1 } };
    expect(pickVenue(s).cost).toBeGreaterThan(0);
    const stub = createSetGameStateStub(s);

    expect(meetSomeone(s, stub.setGameState).success).toBe(false);
    expect((stub.current().relationships ?? []).some((x) => x.id.startsWith('met-'))).toBe(false);
  });

  it('nobody new until the next window — meeting is not a weekly button', () => {
    const s = lifeAt(12, { currentJob: 'janitor' });
    const stub = createSetGameStateStub(s);
    meetSomeone(s, stub.setGameState);

    const after = stub.current();
    expect(currentIntroduction(after)).toBeNull();
    expect(meetSomeone(after, stub.setGameState).success).toBe(false);
    // …and the next window has somebody again.
    expect(currentIntroduction({ ...after, weeksLived: 12 + MEET_WINDOW_WEEKS })).not.toBeNull();
  });

  it('missing a window misses the person — nothing queues up', () => {
    // Never met anyone through twenty weeks: still exactly ONE person around,
    // the current window's, not a backlog of four.
    const s = lifeAt(20, { currentJob: 'janitor' });
    expect(introducedCount(s)).toBe(0);
    const intro = currentIntroduction(s)!;
    expect(intro.id).toBe(`met-work-${Math.floor(20 / MEET_WINDOW_WEEKS)}`);
  });
});

describe('it is capped, so a social life never becomes an inbox', () => {
  it('stops offering once the cap is reached, and says so', () => {
    const base = lifeAt(200, { currentJob: 'janitor' });
    const filled: GameState = {
      ...base,
      relationships: [
        ...(base.relationships ?? []),
        ...Array.from({ length: MEET_MAX_INTRODUCED }, (_, i) => ({
          id: `met-work-${i + 1}`,
          name: `Person ${i}`,
          type: 'friend' as const,
          relationshipScore: 50,
          personality: 'friendly',
          gender: 'female' as const,
          age: 30,
        })),
      ],
    };

    expect(introducedCount(filled)).toBe(MEET_MAX_INTRODUCED);
    expect(currentIntroduction(filled)).toBeNull();
    expect(meetBlockedReason(filled)).toMatch(/keep up with/);
  });
});

describe('the story can say where it started', () => {
  it('names where a partner was met, and the friends the life kept', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateLifeStory } = require('@/lib/lifeMoments/storyGenerator');
    const base = lifeAt(52 * 10, { date: { ...createTestGameState().date, age: 28 } } as Partial<GameState>);
    const s: GameState = {
      ...base,
      relationships: [
        {
          id: 'p1', name: 'Mia Hale', type: 'partner', relationshipScore: 80,
          personality: 'friendly', gender: 'female', age: 29,
          metAt: { venue: 'gym', label: 'at the gym', week: 30 },
        },
        {
          id: 'met-work-2', name: 'Owen Rivas', type: 'friend', relationshipScore: 72,
          personality: 'reserved', gender: 'male', age: 31,
          metAt: { venue: 'work', label: 'at work', week: 12 },
        },
      ],
    };

    const text = generateLifeStory(s).chapters.flatMap((c: { paragraphs: string[] }) => c.paragraphs).join(' ');
    expect(text).toContain('whom they met at the gym');
    expect(text).toContain('Owen Rivas');
    expect(text).toContain('They met at work.');
  });

  it('says nothing about an origin a save has no record of', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateLifeStory } = require('@/lib/lifeMoments/storyGenerator');
    const base = lifeAt(52 * 10, { date: { ...createTestGameState().date, age: 28 } } as Partial<GameState>);
    const s: GameState = {
      ...base,
      relationships: [
        {
          id: 'p1', name: 'Mia Hale', type: 'partner', relationshipScore: 80,
          personality: 'friendly', gender: 'female', age: 29,
        },
      ],
    };

    const text = generateLifeStory(s).chapters.flatMap((c: { paragraphs: string[] }) => c.paragraphs).join(' ');
    expect(text).toContain('Mia Hale');
    expect(text).not.toContain('whom they met');
  });
});
