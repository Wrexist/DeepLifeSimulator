/**
 * Somebody shows up — Master Program 12, and its red team.
 *
 * The events only exist where two things are true at once: the player is in
 * real trouble, and there is somebody they built something with. These pin both
 * halves of that gate, the tradeoff that stops it being free, and the reasons it
 * cannot be farmed.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';
import {
  friendSupportEventTemplates,
  SUPPORT_BOND_COST,
  SUPPORT_CASH_CAP,
} from '@/lib/events/friendSupportEvents';
import { eventTemplates } from '@/lib/events/engine';
import { BOND } from '@/lib/social/closeness';

const byId = (id: string) => friendSupportEventTemplates.find((t) => t.id === id)!;

const friend = (score: number): Relationship => ({
  id: 'best-mate',
  name: 'Owen Rivas',
  type: 'friend',
  relationshipScore: score,
  personality: 'reserved',
  gender: 'male',
  age: 31,
});

/** Ill, broke, and with somebody close. */
function illAndBroke(bond = 85): GameState {
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, health: 30, money: 40 },
    bankSavings: 0,
    diseases: [{ id: 'flu', name: 'Flu' }] as GameState['diseases'],
    relationships: [friend(bond)],
  };
}

const weightOf = (t: { weight: number | ((s: GameState) => number) }, s: GameState) =>
  typeof t.weight === 'function' ? t.weight(s) : t.weight;

describe('they are registered where the engine can pick them', () => {
  it('every template is in the pool', () => {
    for (const t of friendSupportEventTemplates) {
      expect(eventTemplates.some((e) => e.id === t.id)).toBe(true);
    }
  });
});

describe('both halves of the gate are required', () => {
  const t = byId('friend_gets_you_seen');

  it('fires for somebody ill, broke and close to somebody', () => {
    const s = illAndBroke();
    expect(t.condition!(s)).toBe(true);
    expect(weightOf(t, s)).toBeGreaterThan(0);
  });

  it('never fires for a LONER in exactly the same trouble', () => {
    const s: GameState = { ...illAndBroke(), relationships: [] };
    expect(t.condition!(s)).toBe(false);
    expect(weightOf(t, s)).toBe(0);
  });

  it('never fires for somebody with only ACQUAINTANCES in the same trouble', () => {
    const s = illAndBroke(BOND.close - 1);
    expect(t.condition!(s)).toBe(false);
    expect(weightOf(t, s)).toBe(0);
  });

  it('nor for a merely CLOSE friend — turning up is what 80 buys that 60 does not', () => {
    const s = illAndBroke(BOND.close);
    expect(t.condition!(s)).toBe(false);
    expect(weightOf(t, s)).toBe(0);
    // …and one point over the line, they are there.
    expect(t.condition!(illAndBroke(BOND.trusted))).toBe(true);
  });

  it('and never fires for a close friend when there is no crisis', () => {
    const base = createTestGameState();
    const fine: GameState = { ...base, diseases: [], relationships: [friend(90)] };
    expect(t.condition!(fine)).toBe(false);
    expect(weightOf(t, fine)).toBe(0);
  });

  it('fires for somebody ill with money too — a friend is not means-tested', () => {
    // An earlier cut also required the player to be broke. Measured across the
    // twelve personas, `ill && broke` happened in 0 weeks for ten of them, so
    // the event would have been decoration. `ill && health < 45` happens 3-10
    // weeks in every life.
    const rich: GameState = { ...illAndBroke(), stats: { ...illAndBroke().stats, money: 5_000 } };
    expect(t.condition!(rich)).toBe(true);
  });

  it('but not for somebody merely under the weather', () => {
    const base = illAndBroke();
    const mild: GameState = { ...base, stats: { ...base.stats, health: 60 } };
    expect(t.condition!(mild)).toBe(false);
  });
});

describe('the help is bound to the actual person, and costs the bond', () => {
  it('names them and targets them', () => {
    const s = illAndBroke();
    const ev = byId('friend_gets_you_seen').generate(s);
    expect(ev.relationId).toBe('best-mate');
    expect(ev.description).toContain('Owen Rivas');
  });

  it('leaning on somebody spends the bond; not leaning on them earns a little', () => {
    const ev = byId('friend_gets_you_seen').generate(illAndBroke());
    const accept = ev.choices.find((c) => c.id === 'go')!;
    const refuse = ev.choices.find((c) => c.id === 'refuse')!;
    expect(accept.effects.relationship).toBe(SUPPORT_BOND_COST);
    expect(refuse.effects.relationship).toBeGreaterThan(0);
  });

  it('pays in HEALTH, never in cash — it cannot be converted to money', () => {
    const ev = byId('friend_gets_you_seen').generate(illAndBroke());
    const accept = ev.choices.find((c) => c.id === 'go')!;
    expect(accept.effects.stats?.health).toBeGreaterThan(0);
    expect(accept.effects.money ?? 0).toBe(0);
  });

  it('the job lead pays reputation, not cash', () => {
    const base = createTestGameState();
    const s: GameState = {
      ...base,
      currentJob: undefined,
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalWeeksWorked: 30 },
      relationships: [friend(80)],
    };
    expect(byId('friend_has_a_lead').condition!(s)).toBe(true);
    const accept = byId('friend_has_a_lead').generate(s).choices.find((c) => c.id === 'call')!;
    expect(accept.effects.stats?.reputation).toBeGreaterThan(0);
    expect(accept.effects.money ?? 0).toBe(0);
  });

  it('somebody who has never worked is not "out of work"', () => {
    const base = createTestGameState();
    const s: GameState = {
      ...base,
      currentJob: undefined,
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalWeeksWorked: 0, careerHistory: [] },
      relationships: [friend(80)],
    };
    expect(byId('friend_has_a_lead').condition!(s)).toBe(false);
  });
});

describe('red team: the cash branch cannot become a faucet', () => {
  function inArrears(overdue: number, bond = 80): GameState {
    const base = createTestGameState();
    return {
      ...base,
      stats: { ...base.stats, money: 10 },
      bankSavings: 0,
      overdueBalance: overdue,
      relationships: [friend(bond)],
    };
  }

  it('is capped however deep the arrears go', () => {
    const ev = byId('friend_covers_a_bill').generate(inArrears(9_999_999));
    const accept = ev.choices.find((c) => c.id === 'accept')!;
    expect(accept.effects.money).toBeLessThanOrEqual(SUPPORT_CASH_CAP);
  });

  it('pays no more than what is actually owed', () => {
    const ev = byId('friend_covers_a_bill').generate(inArrears(150));
    const accept = ev.choices.find((c) => c.id === 'accept')!;
    expect(accept.effects.money).toBeLessThanOrEqual(SUPPORT_CASH_CAP);
    expect(accept.effects.money).toBeGreaterThan(0);
  });

  it('does not fire for a player who has money — arrears alone are not enough', () => {
    const base = createTestGameState();
    const solvent: GameState = {
      ...base,
      stats: { ...base.stats, money: 50_000 },
      overdueBalance: 500,
      relationships: [friend(80)],
    };
    expect(byId('friend_covers_a_bill').condition!(solvent)).toBe(false);
  });

  it('taking it twice drops the friend OUT of the close circle, which closes the door', () => {
    // The anti-farm guard, stated as the arithmetic: the event needs a bond at
    // BOND.close, and each acceptance spends SUPPORT_BOND_COST. Two helps from
    // a bond of 80 land under 60, and the event stops existing until the
    // friendship is genuinely rebuilt.
    const start = 95;
    const afterTwo = start + SUPPORT_BOND_COST * 2;
    expect(afterTwo).toBeLessThan(BOND.trusted);

    const s = inArrears(400, afterTwo);
    expect(byId('friend_covers_a_bill').condition!(s)).toBe(false);
  });

  it('the total a single friendship can ever be worth is bounded and small', () => {
    // From a perfect bond, how many times can this fire before the friend is no
    // longer close? That number times the cap is the lifetime ceiling on cash
    // from one relationship.
    const helps = Math.floor((100 - BOND.trusted) / Math.abs(SUPPORT_BOND_COST)) + 1;
    expect(helps * SUPPORT_CASH_CAP).toBeLessThan(2_000);
  });
});

describe('support runs both ways', () => {
  it('the player is also asked to show up, and refusing costs the bond', () => {
    const base = createTestGameState();
    const s: GameState = {
      ...base,
      stats: { ...base.stats, money: 2_000 },
      relationships: [friend(80)],
    };
    const ev = byId('close_friend_needs_you').generate(s);
    expect(ev.relationId).toBe('best-mate');
    const help = ev.choices.find((c) => c.id === 'help')!;
    const busy = ev.choices.find((c) => c.id === 'busy')!;
    expect(help.effects.money).toBeLessThan(0);
    expect(help.effects.relationship).toBeGreaterThan(0);
    expect(busy.effects.relationship).toBeLessThan(0);
  });

  it('and a player with nobody trusted is never asked', () => {
    const base = createTestGameState();
    const s: GameState = { ...base, relationships: [friend(40)] };
    expect(byId('close_friend_needs_you').condition!(s)).toBe(false);
    // Nor a merely close one - the same 80 gate, both directions.
    expect(byId('close_friend_needs_you').condition!({ ...base, relationships: [friend(BOND.close)] })).toBe(false);
  });
});

describe('the states these are gated on are ones a life actually reaches', () => {
  /**
   * The `networking_opportunity` lesson from Program 11: an event gated on a
   * state nothing produces is decoration. Each assertion below builds the state
   * from the fields the TICK writes, so if a gate ever drifts away from what the
   * game can produce, it fails here rather than silently never firing.
   *
   * Measured frequencies over 250 weeks across twelve personas, recorded so the
   * next reader knows which of these is common and which is rare:
   *   ill && health < 45 ....... 3-10 weeks in EVERY life
   *   homeless ................. 4 weeks in every life (the opening weeks)
   *   overdueBalance > 0 ....... 0 weeks in all twelve - reachable only for a
   *                              player who cannot pay their bills, which none
   *                              of these competent personas ever is
   *   jobless after employment . 0 weeks in all twelve, but `fire_from_job` is
   *                              a real event special used by four career
   *                              templates, so the state is produced by the game
   */
  it('illness deep enough to matter is produced by the disease tick', () => {
    const base = createTestGameState();
    const s: GameState = {
      ...base,
      stats: { ...base.stats, health: 40 },
      diseases: [{ id: 'flu', name: 'Flu' }] as GameState['diseases'],
      relationships: [friend(85)],
    };
    expect(byId('friend_gets_you_seen').condition!(s)).toBe(true);
  });

  it('arrears are produced by applyArrears, and the event reads that field', () => {
    const base = createTestGameState();
    const s: GameState = {
      ...base,
      stats: { ...base.stats, money: 5 },
      bankSavings: 0,
      overdueBalance: 320,
      relationships: [friend(85)],
    };
    expect(byId('friend_covers_a_bill').condition!(s)).toBe(true);
  });

  it('joblessness after a career is produced by the fire_from_job special', () => {
    const base = createTestGameState();
    const s: GameState = {
      ...base,
      currentJob: undefined,
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalWeeksWorked: 60 },
      relationships: [friend(85)],
    };
    expect(byId('friend_has_a_lead').condition!(s)).toBe(true);
  });
});
