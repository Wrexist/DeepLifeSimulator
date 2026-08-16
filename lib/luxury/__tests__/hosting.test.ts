/**
 * Hosting — the collection becomes a social life.
 *
 * The property that matters most: the REST of the collection decides who turns
 * up, so owning two trophies is worth more than owning them apart. That is the
 * first internal synergy in the whole feature, and these tests pin it.
 */

import {
  EVENT_TIERS,
  HOSTING_VENUES,
  HOSTING_COOLDOWN_WEEKS,
  getGuestList,
  getHostingAvailability,
  getHostingVenue,
  isHostingVenue,
  pickAttendees,
  quoteEvent,
  resolveEvent,
} from '../hosting';
import { getLuxuryBrandPull } from '@/lib/social/brandPartnerships';
import type { GameState, Relationship } from '@/contexts/game/types';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

const rel = (id: string, score: number, type: Relationship['type'] = 'friend'): Relationship =>
  ({ id, name: id, type, relationshipScore: score }) as unknown as Relationship;

function makeState(overrides: TestGameStateOverrides = {}): GameState {
  const { stats, ...rest } = overrides;
  return createTestGameState({
    weeksLived: 600,
    luxuryItems: ['private_island'],
    luxuryHoldings: {},
    relationships: [rel('a', 80), rel('b', 60), rel('c', 40)],
    ...rest,
    stats: { money: 100_000_000, happiness: 50, reputation: 30, ...(stats ?? {}) },
  });
}

describe('venues', () => {
  it('are all real catalog items and scale upward', () => {
    expect(isHostingVenue('private_island')).toBe(true);
    expect(isHostingVenue('rare_watch_collection')).toBe(false);

    const island = getHostingVenue('private_island')!;
    const yacht = getHostingVenue('luxury_yacht')!;
    // The island is the grandest venue and should cost and give the most.
    expect(island.scale).toBeGreaterThan(yacht.scale);
  });

  it('offers three escalating event sizes', () => {
    for (let i = 1; i < EVENT_TIERS.length; i += 1) {
      expect(EVENT_TIERS[i].baseCost).toBeGreaterThan(EVENT_TIERS[i - 1].baseCost);
      expect(EVENT_TIERS[i].baseReputation).toBeGreaterThan(EVENT_TIERS[i - 1].baseReputation);
      expect(EVENT_TIERS[i].guestsReached).toBeGreaterThan(EVENT_TIERS[i - 1].guestsReached);
    }
  });
});

describe('the guest list IS the collection', () => {
  it('is just your usual crowd with nothing else owned', () => {
    const guests = getGuestList(makeState({ luxuryItems: ['private_island'] }));
    expect(guests.circles).toHaveLength(0);
    expect(guests.multiplier).toBe(1);
  });

  it('brings the racing set when you own a racehorse', () => {
    const guests = getGuestList(makeState({ luxuryItems: ['private_island', 'racehorse'] }));
    expect(guests.circles.join(' ')).toContain('racing');
    expect(guests.multiplier).toBeGreaterThan(1);
  });

  it('makes a broad collection a better room', () => {
    const narrow = getGuestList(makeState({ luxuryItems: ['private_island', 'racehorse'] }));
    const broad = getGuestList(
      makeState({
        luxuryItems: ['private_island', 'racehorse', 'fine_art_collection', 'supercar', 'sports_team_stake'],
      }),
    );
    expect(broad.multiplier).toBeGreaterThan(narrow.multiplier);
  });

  it('caps the room so a full collection is great, not infinite', () => {
    const everything = getGuestList(
      makeState({
        luxuryItems: [
          'private_island', 'racehorse', 'fine_art_collection', 'supercar',
          'sports_team_stake', 'rare_watch_collection', 'museum_diamond',
          'vineyard_estate', 'private_jet',
        ],
      }),
    );
    expect(everything.multiplier).toBeLessThanOrEqual(1.6);
  });

  it('survives a state with no collection at all', () => {
    expect(() => getGuestList(null)).not.toThrow();
    expect(getGuestList(null).multiplier).toBe(1);
  });
});

describe('quotes', () => {
  it('scales cost and payoff with the venue', () => {
    const onYacht = quoteEvent(makeState({ luxuryItems: ['luxury_yacht'] }), 'luxury_yacht', 'party')!;
    const onIsland = quoteEvent(makeState(), 'private_island', 'party')!;

    expect(onIsland.cost).toBeGreaterThan(onYacht.cost);
    expect(onIsland.reputation).toBeGreaterThan(onYacht.reputation);
  });

  it('pays more reputation for a better guest list at the same venue', () => {
    const plain = quoteEvent(makeState({ luxuryItems: ['private_island'] }), 'private_island', 'gala')!;
    const connected = quoteEvent(
      makeState({ luxuryItems: ['private_island', 'fine_art_collection', 'racehorse', 'supercar'] }),
      'private_island',
      'gala',
    )!;

    // Same venue, same tier, same cost — a better room is the only difference.
    expect(connected.cost).toBe(plain.cost);
    expect(connected.reputation).toBeGreaterThan(plain.reputation);
  });

  it('returns null for a non-venue or unknown tier', () => {
    expect(quoteEvent(makeState(), 'rare_watch_collection', 'party')).toBeNull();
    expect(quoteEvent(makeState(), 'private_island', 'rave')).toBeNull();
  });
});

describe('availability', () => {
  it('needs the venue', () => {
    const result = getHostingAvailability(makeState({ luxuryItems: [] }), 'private_island', 'party');
    expect(result.available).toBe(false);
    expect(result.reason).toContain('do not own');
  });

  it('is available at a venue that has never hosted', () => {
    expect(getHostingAvailability(makeState(), 'private_island', 'party').available).toBe(true);
  });

  it('enforces a cooldown after an event', () => {
    const state = makeState({
      weeksLived: 601,
      luxuryHoldings: { private_island: { acquiredWeek: 1, lastHostedWeek: 600 } },
    });
    const result = getHostingAvailability(state, 'private_island', 'party');
    expect(result.available).toBe(false);
    expect(result.weeksRemaining).toBe(HOSTING_COOLDOWN_WEEKS - 1);
  });

  it('cools down PER VENUE, so two venues are two places to entertain', () => {
    // The reason to own both the island and the penthouse.
    const state = makeState({
      luxuryItems: ['private_island', 'trophy_penthouse'],
      luxuryHoldings: { private_island: { acquiredWeek: 1, lastHostedWeek: 600 } },
    });
    expect(getHostingAvailability(state, 'private_island', 'party').available).toBe(false);
    expect(getHostingAvailability(state, 'trophy_penthouse', 'party').available).toBe(true);
  });

  it('needs the money', () => {
    const broke = makeState({ stats: { money: 1_000 } as never });
    expect(getHostingAvailability(broke, 'private_island', 'gala').reason).toContain('costs');
  });
});

describe('attendees', () => {
  it('warms the people you are already closest to', () => {
    // A party is where your circle gets tighter, not how you meet an estranged
    // relative — so it picks the highest scores first.
    expect(pickAttendees(makeState(), 2)).toEqual(['a', 'b']);
  });

  it('never invites your own children', () => {
    const state = makeState({ relationships: [rel('kid', 99, 'child'), rel('pal', 10)] });
    expect(pickAttendees(state, 5)).toEqual(['pal']);
  });

  it('handles fewer relationships than seats, and none at all', () => {
    expect(pickAttendees(makeState(), 99)).toHaveLength(3);
    expect(pickAttendees(makeState({ relationships: [] }), 5)).toEqual([]);
    expect(pickAttendees(null, 5)).toEqual([]);
  });
});

describe('resolving an event', () => {
  it('gives more relationship warmth at a grander venue with a better room', () => {
    const quiet = resolveEvent(
      quoteEvent(makeState({ luxuryItems: ['luxury_yacht'] }), 'luxury_yacht', 'dinner')!,
      ['a'],
    );
    const grand = resolveEvent(
      quoteEvent(
        makeState({ luxuryItems: ['private_island', 'racehorse', 'supercar', 'fine_art_collection'] }),
        'private_island',
        'gala',
      )!,
      ['a', 'b'],
    );

    expect(grand.relationshipGain).toBeGreaterThan(quiet.relationshipGain);
    expect(grand.message).toContain('on the island');
  });

  it('always warms by at least one', () => {
    const outcome = resolveEvent(
      quoteEvent(makeState({ luxuryItems: ['luxury_yacht'] }), 'luxury_yacht', 'dinner')!,
      ['a'],
    );
    expect(outcome.relationshipGain).toBeGreaterThanOrEqual(1);
  });
});

describe('brand partnerships read the collection', () => {
  it('offers nothing to a player who owns nothing photogenic', () => {
    expect(getLuxuryBrandPull(makeState({ luxuryItems: [] })).qualifies).toBe(false);
    expect(getLuxuryBrandPull(makeState({ luxuryItems: ['vineyard_estate'] })).qualifies).toBe(false);
  });

  it('brings a car brand to a hypercar owner', () => {
    const pull = getLuxuryBrandPull(makeState({ luxuryItems: ['supercar'] }));
    expect(pull.qualifies).toBe(true);
    expect(pull.ratePerFollower).toBeGreaterThan(0);
    expect(pull.hook.length).toBeGreaterThan(5);
  });

  it('pays the most for the most photogenic asset when several are owned', () => {
    const both = getLuxuryBrandPull(makeState({ luxuryItems: ['rare_watch_collection', 'supercar'] }));
    const watchOnly = getLuxuryBrandPull(makeState({ luxuryItems: ['rare_watch_collection'] }));
    expect(both.ratePerFollower).toBeGreaterThan(watchOnly.ratePerFollower);
  });

  it('beats the generic premium rate — the collection is the differentiator', () => {
    // The premium follower-only tier pays $5/follower. A luxury house paying
    // less than that would make the collection worthless to a brand.
    for (const ids of [['supercar'], ['rare_watch_collection'], ['luxury_yacht']]) {
      expect(getLuxuryBrandPull(makeState({ luxuryItems: ids })).ratePerFollower).toBeGreaterThanOrEqual(5);
    }
  });
});
