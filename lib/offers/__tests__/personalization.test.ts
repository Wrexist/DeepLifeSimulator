import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { OFFER_ROTATION } from '@/lib/offers/catalogue';
import { audienceFor, rankOffersForPlayer } from '@/lib/offers/personalization';

describe('offer personalisation', () => {
  it('reads a brand-new life as a new player', () => {
    expect(audienceFor(createTestGameState({ weeksLived: 0, lifeStartWeek: 0 }))).toBe('new_player');
  });

  it('reads a company owner as a business owner', () => {
    const state = createTestGameState({
      weeksLived: 200,
      lifeStartWeek: 100,
      companies: [
        { id: 'c1', name: 'Acme', type: 'factory', weeklyIncome: 500, baseWeeklyIncome: 500 } as never,
      ],
    });
    expect(audienceFor(state)).toBe('business_owner');
  });

  it('reads a millionaire as wealthy, ahead of any other label', () => {
    const state = createTestGameState({
      weeksLived: 200,
      lifeStartWeek: 100,
      stats: { money: 5_000_000 },
      companies: [
        { id: 'c1', name: 'Acme', type: 'factory', weeklyIncome: 500, baseWeeklyIncome: 500 } as never,
      ],
    });
    expect(audienceFor(state)).toBe('wealthy');
  });

  it('degrades to everyone rather than throwing on a missing state', () => {
    expect(audienceFor(null)).toBe('everyone');
    expect(audienceFor(undefined)).toBe('everyone');
  });

  it('reorders without ever dropping or duplicating an offer', () => {
    // Personalisation must not become a filter — an offer that disappears for a
    // segment is an offer they can never buy.
    const ranked = rankOffersForPlayer(createTestGameState({ stats: { money: 9_000_000 } }));
    expect(ranked).toHaveLength(OFFER_ROTATION.length);
    expect(new Set(ranked.map((o) => o.id)).size).toBe(OFFER_ROTATION.length);
  });

  it('puts the matching audience first and is stable', () => {
    const state = createTestGameState({ weeksLived: 0, lifeStartWeek: 0 });
    const ranked = rankOffersForPlayer(state);
    expect(ranked[0].audience).toBe('new_player');
    expect(rankOffersForPlayer(state).map((o) => o.id)).toEqual(ranked.map((o) => o.id));
  });
});
