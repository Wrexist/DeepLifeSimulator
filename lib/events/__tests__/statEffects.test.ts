/**
 * The currency fence on event stat effects (2026-08-24 gameplay audit).
 *
 * `GameStats` carries two currencies (`money`, `gems`) beside the 0-100 stats.
 * The old inline loop in `resolveEvent` clamped every delivered key to 0-100,
 * so a template that mis-filed money inside `stats` OVERWROTE the player's
 * cash with at most $100 — `policy_voting`'s Vote Yes did exactly that on
 * every passing bill (even its `money: 0` destroyed cash, because
 * clamp(0,100, cash+0) is 100 for anyone holding more), and
 * `tech_startup_success`'s Invest charged $50,000 and then set the remaining
 * balance to $100.
 *
 * Three layers pinned here: the pure helper skips currencies; the two fixed
 * producers stay fixed; and a pool-wide scan keeps the whole template
 * catalogue clean so the mistake cannot ship again.
 */
import { applyEventStatDeltas } from '../statEffects';
import { eventTemplates } from '../engine';
import { CLIFFHANGERS } from '../cliffhangerEvents';
import { FOLLOW_UP_EVENTS } from '../lifeEvents';
import type { GameState, GameStats } from '@/contexts/game/types';
import type { WeeklyEvent } from '../engine';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const baseStats = (): GameStats => ({
  health: 70,
  happiness: 60,
  energy: 50,
  fitness: 40,
  money: 250_000,
  reputation: 55,
  gems: 900,
});

describe('applyEventStatDeltas — the currency fence', () => {
  it('never touches money: a mis-filed stats.money cannot overwrite the balance', () => {
    const stats = baseStats();
    applyEventStatDeltas(stats, { money: 200 } as Partial<GameStats>);
    expect(stats.money).toBe(250_000); // NOT 100 — the old clamp behavior
  });

  it('never touches gems', () => {
    const stats = baseStats();
    applyEventStatDeltas(stats, { gems: 500 } as Partial<GameStats>);
    expect(stats.gems).toBe(900);
  });

  it('applies and clamps the real stats to 0-100', () => {
    const stats = baseStats();
    applyEventStatDeltas(stats, { health: 50, happiness: -80, reputation: 10 });
    expect(stats.health).toBe(100); // 70 + 50, clamped
    expect(stats.happiness).toBe(0); // 60 - 80, clamped
    expect(stats.reputation).toBe(65);
  });

  it('ignores non-numeric and unknown keys without throwing', () => {
    const stats = baseStats();
    applyEventStatDeltas(stats, {
      health: Number.NaN,
      // Unknown key smuggled through the loose author-side type.
      charisma: 10,
    } as unknown as Partial<GameStats>);
    expect(stats).toEqual(baseStats());
  });

  it('handles an absent deltas object', () => {
    const stats = baseStats();
    expect(() => applyEventStatDeltas(stats, undefined)).not.toThrow();
    expect(() => applyEventStatDeltas(stats, null)).not.toThrow();
  });
});

describe('the fixed producers', () => {
  /** A state rich enough that condition-heavy generators have data to draw on. */
  const richState = (): GameState =>
    createTestGameState({
      weeksLived: 120,
      lifeStartWeek: 0,
      stats: { health: 80, happiness: 70, energy: 60, fitness: 50, money: 500_000, reputation: 70, gems: 100 },
      politics: {
        ...createTestGameState({}).politics!,
        careerLevel: 3,
        party: 'democratic',
        approvalRating: 55,
        policiesEnacted: [],
        alliances: [],
      },
      relationships: [
        { id: 'f1', name: 'Alex', type: 'friend', relationshipScore: 60, personality: 'kind', gender: 'male', age: 30 },
        { id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 80, personality: 'warm', gender: 'female', age: 29 },
      ] as GameState['relationships'],
    });

  it('policy_voting delivers the policy money on the money path, never inside stats', () => {
    const template = eventTemplates.find((t) => t.id === 'policy_voting');
    expect(template).toBeDefined();
    const event = template!.generate(richState());
    const voteYes = event.choices.find((c) => c.id === 'vote_yes');
    expect(voteYes).toBeDefined();
    expect((voteYes!.effects.stats as Record<string, unknown> | undefined)?.money).toBeUndefined();
    // When a money figure exists it must be top-level (the affordability-gated
    // path); when the rolled policy has none, the key must be absent entirely.
    if (voteYes!.effects.money !== undefined) {
      expect(typeof voteYes!.effects.money).toBe('number');
    }
  });

  it('tech_startup_success charges once, flat, with no stats.money', () => {
    const template = eventTemplates.find((t) => t.id === 'tech_startup_success');
    expect(template).toBeDefined();
    const event = template!.generate(richState());
    const invest = event.choices.find((c) => c.id === 'invest');
    expect(invest).toBeDefined();
    expect(invest!.effects.money).toBe(-49_800);
    expect((invest!.effects.stats as Record<string, unknown> | undefined)?.money).toBeUndefined();
  });

  it('POOL RATCHET: no authored template puts money or gems inside effects.stats', () => {
    const offenders: string[] = [];
    let generated = 0;
    const state = richState();

    const checkEvent = (source: string, event: WeeklyEvent | undefined | null) => {
      if (!event) return;
      generated++;
      for (const choice of event.choices ?? []) {
        const stats = choice.effects?.stats as Record<string, unknown> | undefined;
        if (!stats) continue;
        if ('money' in stats || 'gems' in stats) {
          offenders.push(`${source}:${event.id}:${choice.id}`);
        }
      }
    };

    for (const template of eventTemplates) {
      try {
        checkEvent('pool', template.generate(state));
      } catch {
        // A generator needing state this fixture lacks is fine to skip: the
        // scan is a ratchet over everything generatable, not a completeness
        // proof. The count assertion below keeps it from going vacuous.
      }
    }
    for (const cliff of CLIFFHANGERS) {
      try {
        checkEvent('cliffhanger', cliff.resolveEvent(state));
      } catch {
        // same reasoning
      }
    }
    for (const followUp of Object.values(FOLLOW_UP_EVENTS)) {
      checkEvent('follow-up', followUp as WeeklyEvent);
    }

    expect(offenders).toEqual([]);
    expect(generated).toBeGreaterThan(250);
  });
});
