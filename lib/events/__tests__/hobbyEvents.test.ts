/**
 * Hobby event pack (v38) — eligibility ("roll") gating + reward shape.
 *
 * These templates should only be eligible when the player is actively
 * practicing a matching hobby, and the "lean in" choice should grant a small
 * reward scaled by that hobby's mastery level. They must also be wired into the
 * master event pool so they roll through the normal pipeline.
 */
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { hobbyEventTemplates } from '@/lib/events/hobbyEvents';
import { eventTemplates } from '@/lib/events/engine';

function withPursuits(pursuits: GameState['pursuits'], weeksLived = 40): GameState {
  return createTestGameState({ pursuits, weeksLived });
}

const byId = (id: string) => {
  const t = hobbyEventTemplates.find((e) => e.id === id);
  if (!t) throw new Error(`missing hobby event ${id}`);
  return t;
};

describe('hobby events — wiring', () => {
  it('every hobby template is registered in the master event pool', () => {
    for (const t of hobbyEventTemplates) {
      expect(eventTemplates.some((e) => e.id === t.id)).toBe(true);
    }
  });

  it('provides a meaningful set of hobby moments', () => {
    expect(hobbyEventTemplates.length).toBeGreaterThanOrEqual(5);
    const ids = hobbyEventTemplates.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('hobby events — eligibility (roll gate)', () => {
  it('are NOT eligible with no active hobbies', () => {
    const state = withPursuits({});
    for (const t of hobbyEventTemplates) {
      expect(t.condition ? t.condition(state) : true).toBe(false);
    }
  });

  it('a creative-show event becomes eligible once a creative hobby is practiced', () => {
    const show = byId('hobby_local_show');
    // painting is a creative pursuit; level 3 (practiced) makes it eligible.
    const state = withPursuits({ painting: { xp: 350, level: 3 } });
    expect(show.condition!(state)).toBe(true);
    // A non-creative hobby alone must NOT make the creative event eligible.
    const nonCreative = withPursuits({ running: { xp: 350, level: 3 } });
    expect(show.condition!(nonCreative)).toBe(false);
  });

  it('the "teach a class" event requires Expert-tier (level 6+) mastery', () => {
    const teach = byId('hobby_invited_to_teach');
    expect(teach.condition!(withPursuits({ guitar: { xp: 400, level: 4 } }))).toBe(false);
    expect(teach.condition!(withPursuits({ guitar: { xp: 650, level: 6 } }))).toBe(true);
  });
});

describe('hobby events — reward scales with mastery', () => {
  it('the local-show payout scales with the creative hobby level', () => {
    const show = byId('hobby_local_show');
    const state = withPursuits({ painting: { xp: 550, level: 5 } });
    const ev = show.generate(state);

    expect(ev.id).toBe('hobby_local_show');
    expect(ev.choices.length).toBeGreaterThanOrEqual(2);

    const leanIn = ev.choices[0];
    // moneyReward(5, 30, 12) = 30 + 60 = 90
    expect(leanIn.effects.money).toBe(90);
    // repReward(5) = 2 + floor(5/3) = 3; happyReward(5) = 5 + floor(5/2) = 7
    expect(leanIn.effects.stats?.reputation).toBe(3);
    expect(leanIn.effects.stats?.happiness).toBe(7);

    // The alternate choice is a modest consolation, never larger than the payout.
    const alt = ev.choices[1];
    expect(alt.effects.money ?? 0).toBeLessThan(leanIn.effects.money!);
  });

  it('a higher-level hobby pays more than a lower-level one', () => {
    const show = byId('hobby_local_show');
    const low = show.generate(withPursuits({ painting: { xp: 150, level: 1 } })).choices[0].effects.money!;
    const high = show.generate(withPursuits({ painting: { xp: 950, level: 9 } })).choices[0].effects.money!;
    expect(high).toBeGreaterThan(low);
  });

  it('generate never throws and always yields choices, even at the tier edges', () => {
    for (const t of hobbyEventTemplates) {
      // Give one active hobby at a high level so every template has something to pick.
      const state = withPursuits({
        painting: { xp: 999, level: 9 },
        running: { xp: 999, level: 9 },
        guitar: { xp: 999, level: 9 },
        cooking: { xp: 999, level: 9 },
        volunteering: { xp: 999, level: 9 },
      });
      const ev = t.generate(state);
      expect(ev.choices.length).toBeGreaterThan(0);
    }
  });
});
