/**
 * Spark Actions — smoke tests for the dating app's action layer.
 */
import {
  updateMyProfile,
  swipeOnProfile,
  rewindLastSwipe,
  unmatch,
  sendSparkMessage,
  promoteMatchToRelationship,
  subscribeSparkPremium,
  cancelSparkPremium,
  boostProfile,
  reportProfile,
  exposeCatfish,
  resolveJealousy,
  likeBackFromLikedYou,
  dismissLikedYou,
} from '@/contexts/game/actions/SparkActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';
import { calculateMatchProbability } from '@/lib/dating/sparkLogic';

function freshState(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState(overrides);
  if (s.sparkApp) s.sparkApp = JSON.parse(JSON.stringify(s.sparkApp));
  if (s.stats) s.stats = { ...s.stats };
  if (s.relationships) s.relationships = s.relationships.map((r) => ({ ...r }));
  return s;
}

function makeHarness(initial: GameState) {
  let current = initial;
  const setGameState = (updater: any) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  };
  return { setGameState, getState: () => current };
}

const SAMPLE_ID = DATING_PROFILES[0].id;

describe('updateMyProfile', () => {
  it('merges patches into sparkApp.profile', () => {
    const state = freshState({ weeksLived: 1 });
    const { setGameState, getState } = makeHarness(state);
    updateMyProfile(setGameState, { bio: 'hello world', interests: ['art', 'cycling'] });
    expect(getState().sparkApp!.profile.bio).toBe('hello world');
    expect(getState().sparkApp!.profile.interests).toEqual(['art', 'cycling']);
  });
});

describe('swipeOnProfile', () => {
  it('decrements quota on every swipe', () => {
    const state = freshState({ weeksLived: 1 });
    const { setGameState, getState } = makeHarness(state);
    swipeOnProfile(setGameState, state, SAMPLE_ID, 'left');
    expect(getState().sparkApp!.swipesUsedThisWeek).toBe(1);
    swipeOnProfile(setGameState, getState(), SAMPLE_ID, 'left');
    expect(getState().sparkApp!.swipesUsedThisWeek).toBe(2);
  });

  it('fails when out of swipes (free tier, 30/week)', () => {
    const state = freshState({ weeksLived: 1 });
    state.sparkApp!.swipesUsedThisWeek = 30;
    const { setGameState } = makeHarness(state);
    const r = swipeOnProfile(setGameState, state, SAMPLE_ID, 'left');
    expect(r.success).toBe(false);
  });

  it('appends a match on right-swipe when probability lands', () => {
    const state = freshState({ weeksLived: 1 });
    // Crank reputation way up so most swipes match
    state.stats.reputation = 100;
    state.userProfile.handle = 'lucky-seed';
    const { setGameState, getState } = makeHarness(state);
    // Try several swipes until one matches (deterministic per profile/week, but
    // different profiles have different odds)
    let anyMatched = false;
    for (let i = 0; i < 5; i++) {
      const result = swipeOnProfile(setGameState, getState(), DATING_PROFILES[i].id, 'right');
      if (result.matched) {
        anyMatched = true;
        break;
      }
    }
    expect(anyMatched).toBe(true);
    expect(getState().sparkApp!.matches.length).toBeGreaterThan(0);
    expect(getState().sparkApp!.lifetimeStats.totalMatches).toBeGreaterThan(0);
  });

  it('super-likes are gated by quota', () => {
    const state = freshState({ weeksLived: 1 });
    state.sparkApp!.superLikesUsedThisWeek = 1; // free tier cap
    const { setGameState } = makeHarness(state);
    const r = swipeOnProfile(setGameState, state, SAMPLE_ID, 'super');
    expect(r.success).toBe(false);
  });
});

describe('rewindLastSwipe', () => {
  it('costs 20 gems on free tier', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.gems = 50;
    const { setGameState, getState } = makeHarness(state);
    swipeOnProfile(setGameState, getState(), SAMPLE_ID, 'left');
    const r = rewindLastSwipe(setGameState, getState());
    expect(r.success).toBe(true);
    expect(getState().stats.gems).toBe(30);
    expect(getState().sparkApp!.swipes.length).toBe(0);
  });

  it('fails when no swipes to undo', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.gems = 100;
    const { setGameState } = makeHarness(state);
    const r = rewindLastSwipe(setGameState, state);
    expect(r.success).toBe(false);
  });
});

describe('unmatch / sendSparkMessage', () => {
  it('unmatch removes the match and its message thread', () => {
    const state = freshState({ weeksLived: 1 });
    state.sparkApp!.matches = [{ id: 'm1', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: false }];
    state.sparkApp!.messages = { m1: [{ id: 'x', matchId: 'm1', from: 'player', text: 'hi', timestamp: 0, gameWeek: 1 }] };
    const { setGameState, getState } = makeHarness(state);
    unmatch(setGameState, 'm1');
    expect(getState().sparkApp!.matches).toHaveLength(0);
    expect(getState().sparkApp!.messages['m1']).toBeUndefined();
  });

  it('sendSparkMessage appends to the thread and spends energy', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 100;
    state.sparkApp!.matches = [{ id: 'm1', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: false }];
    const { setGameState, getState } = makeHarness(state);
    const r = sendSparkMessage(setGameState, state, 'm1', 'hey there');
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.messages['m1']).toHaveLength(1);
    expect(getState().sparkApp!.messages['m1'][0].text).toBe('hey there');
    expect(getState().stats.energy).toBe(98);
  });

  it('sendSparkMessage rejects empty content', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 100;
    state.sparkApp!.matches = [{ id: 'm1', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: false }];
    const { setGameState } = makeHarness(state);
    expect(sendSparkMessage(setGameState, state, 'm1', '   ').success).toBe(false);
  });
});

describe('promoteMatchToRelationship', () => {
  it('adds a partner relationship and flips match.promoted', () => {
    const state = freshState({ weeksLived: 1 });
    state.sparkApp!.matches = [{ id: 'm1', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: false }];
    const { setGameState, getState } = makeHarness(state);
    const r = promoteMatchToRelationship(setGameState, state, 'm1');
    expect(r.success).toBe(true);
    expect(getState().relationships!.some((rel) => rel.id === 'm1' && rel.type === 'partner')).toBe(true);
    expect(getState().sparkApp!.matches[0].promoted).toBe(true);
  });

  it('fails if already promoted', () => {
    const state = freshState({ weeksLived: 1 });
    state.sparkApp!.matches = [{ id: 'm1', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: true }];
    const { setGameState } = makeHarness(state);
    const r = promoteMatchToRelationship(setGameState, state, 'm1');
    expect(r.success).toBe(false);
  });
});

describe('premium subscription', () => {
  it('subscribeSparkPremium debits in-game cash, activates tier and perks', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 1000;
    const { setGameState, getState } = makeHarness(state);
    const r = subscribeSparkPremium(setGameState, state, 'ultra', 'weekly');
    expect(r.success).toBe(true);
    const sp = getState().sparkApp!;
    expect(sp.premium.active).toBe(true);
    expect(sp.premium.tier).toBe('ultra');
    expect(sp.premium.plan).toBe('weekly');
    expect(sp.premium.weeklyPrice).toBe(24);
    expect(sp.premium.perks.unlimitedSwipes).toBe(true);
    expect(sp.premium.perks.seeWhoLikedYou).toBe(true);
    expect(sp.premium.perks.boostMultiplier).toBe(2.5);
    expect(sp.lifetimeStats.peakPremiumTier).toBe('ultra');
    // $24 Ultra weekly fee debited from stats.money.
    expect(getState().stats.money).toBe(976);
  });

  it('subscribeSparkPremium rejects (no perks, no debit) when the player cannot afford it', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 5;
    const { setGameState, getState } = makeHarness(state);
    const r = subscribeSparkPremium(setGameState, state, 'ultra', 'weekly');
    expect(r.success).toBe(false);
    expect(getState().sparkApp!.premium.active).toBe(false);
    expect(getState().stats.money).toBe(5); // untouched
  });

  it('cancel reverts perks to free', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 1000;
    const { setGameState, getState } = makeHarness(state);
    subscribeSparkPremium(setGameState, state, 'plus', 'weekly');
    cancelSparkPremium(setGameState);
    expect(getState().sparkApp!.premium.active).toBe(false);
    expect(getState().sparkApp!.premium.tier).toBe('free');
    expect(getState().sparkApp!.premium.perks.unlimitedSwipes).toBe(false);
  });
});

describe('boost / catfish / jealousy', () => {
  it('boostProfile spends 50 gems and activates boost', () => {
    const state = freshState({ weeksLived: 5 });
    state.stats.gems = 200;
    const { setGameState, getState } = makeHarness(state);
    const r = boostProfile(setGameState, state);
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.boost!.active).toBe(true);
    expect(getState().sparkApp!.boost!.expiresWeek).toBe(6);
    expect(getState().stats.gems).toBe(150);
  });

  it('boostProfile grants immediate "liked you" entries so free players see a payoff', () => {
    const state = freshState({ weeksLived: 5 });
    state.stats.gems = 200;
    state.sparkApp!.likedYou = [];
    const before = state.sparkApp!.likedYou.length;
    const { setGameState, getState } = makeHarness(state);
    boostProfile(setGameState, state);
    expect(getState().sparkApp!.likedYou.length).toBe(before + 3);
  });

  it('an active boost lifts match probability for a free-tier player (not a no-op)', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.reputation = 40;
    const profile = DATING_PROFILES[0];
    // Free tier: perks.boostMultiplier is 1.0, so a naive `?? 1.5` no-op'd.
    const withoutBoost = calculateMatchProbability(state, profile);
    const boosted = { ...state, sparkApp: { ...state.sparkApp!, boost: { active: true, expiresWeek: 2 } } };
    const withBoost = calculateMatchProbability(boosted, profile);
    expect(withBoost).toBeGreaterThan(withoutBoost);
  });

  it('reportProfile adds id and unmatches', () => {
    const state = freshState({ weeksLived: 1 });
    state.sparkApp!.matches = [{ id: 'm1', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: false }];
    const { setGameState, getState } = makeHarness(state);
    reportProfile(setGameState, SAMPLE_ID);
    expect(getState().sparkApp!.reportedIds).toContain(SAMPLE_ID);
    expect(getState().sparkApp!.matches).toHaveLength(0);
  });

  it('exposeCatfish grants reputation', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.reputation = 20;
    const { setGameState, getState } = makeHarness(state);
    const r = exposeCatfish(setGameState, state, SAMPLE_ID);
    expect(r.success).toBe(true);
    expect(getState().stats.reputation).toBe(25);
    expect(getState().sparkApp!.lifetimeStats.totalCatfishExposed).toBe(1);
  });

  it('exposeCatfish is idempotent under a same-batch double-tap (no duplicate record / double rep)', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.reputation = 20;
    const { setGameState, getState } = makeHarness(state);
    // Two taps in one React batch both hand the SAME stale `state` snapshot.
    // The in-updater dedup must reject the second so reputation rises +5 once
    // (not +10) and exactly one catfishRecord is written.
    const r1 = exposeCatfish(setGameState, state, SAMPLE_ID);
    const r2 = exposeCatfish(setGameState, state, SAMPLE_ID);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(false);
    expect(getState().stats.reputation).toBe(25);
    expect(getState().sparkApp!.lifetimeStats.totalCatfishExposed).toBe(1);
    expect(
      getState().sparkApp!.catfishRecords.filter((c) => c.profileId === SAMPLE_ID),
    ).toHaveLength(1);
  });

  it('resolveJealousy applies effects and clears the event (unblocks future spawns)', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.reputation = 50;
    state.relationships = [{ id: 'p1', name: 'Alex', type: 'partner', relationshipScore: 60 } as any];
    state.sparkApp!.activeJealousy = {
      id: 'j1',
      partnerId: 'p1',
      triggerType: 'spotted_swiping',
      severity: 60,
      startedWeek: 1,
      resolved: false,
    };
    const { setGameState, getState } = makeHarness(state);
    const r = resolveJealousy(setGameState, state, 'admitted');
    expect(r.success).toBe(true);
    expect(getState().sparkApp!.activeJealousy).toBeNull();
    expect(getState().sparkApp!.jealousyHistory).toHaveLength(1);
    expect(getState().relationships![0].relationshipScore).toBe(40); // -20
    expect(getState().stats.reputation).toBe(47);                    // -3
  });
});

describe('Likes-You inbox', () => {
  function ultraStateWithLike(profileId = SAMPLE_ID): GameState {
    const state = freshState({ weeksLived: 3 });
    state.sparkApp!.premium.active = true;
    state.sparkApp!.premium.tier = 'ultra';
    state.sparkApp!.premium.perks.seeWhoLikedYou = true;
    state.sparkApp!.likedYou = [{ profileId, likedAtWeek: 2, superLiked: false }];
    return state;
  }

  it('likeBackFromLikedYou (Ultra) creates a match, consumes the entry, and dedupes datingMatches', () => {
    const state = ultraStateWithLike();
    const { setGameState, getState } = makeHarness(state);
    const r = likeBackFromLikedYou(setGameState, state, SAMPLE_ID);
    expect(r.success).toBe(true);
    expect(r.matchId).toBeDefined();
    const sp = getState().sparkApp!;
    expect(sp.matches.some((m) => m.profileId === SAMPLE_ID)).toBe(true);
    expect(sp.likedYou.find((l) => l.profileId === SAMPLE_ID)).toBeUndefined();
    expect(getState().datingMatches).toContain(SAMPLE_ID);
    // datingMatches is deduped — only one entry for the profile.
    expect(getState().datingMatches!.filter((id) => id === SAMPLE_ID)).toHaveLength(1);
  });

  it('is gated: free / Plus tiers cannot see-and-like-back', () => {
    const state = freshState({ weeksLived: 3 });
    state.sparkApp!.premium.perks.seeWhoLikedYou = false; // free/plus
    state.sparkApp!.likedYou = [{ profileId: SAMPLE_ID, likedAtWeek: 2, superLiked: false }];
    const { setGameState, getState } = makeHarness(state);
    const r = likeBackFromLikedYou(setGameState, state, SAMPLE_ID);
    expect(r.success).toBe(false);
    // Entry stays — nothing consumed, no match created.
    expect(getState().sparkApp!.likedYou).toHaveLength(1);
    expect(getState().sparkApp!.matches).toHaveLength(0);
  });

  it('does not create a duplicate match when one already exists (returns existing id)', () => {
    const state = ultraStateWithLike();
    state.sparkApp!.matches = [{ id: 'existing', profileId: SAMPLE_ID, matchedWeek: 1, superLiked: false, promoted: false }];
    const beforeMatches = state.sparkApp!.lifetimeStats.totalMatches;
    const { setGameState, getState } = makeHarness(state);
    const r = likeBackFromLikedYou(setGameState, state, SAMPLE_ID);
    expect(r.success).toBe(true);
    expect(r.matchId).toBe('existing');
    expect(getState().sparkApp!.matches.filter((m) => m.profileId === SAMPLE_ID)).toHaveLength(1);
    // No phantom match counted when reusing an existing match.
    expect(getState().sparkApp!.lifetimeStats.totalMatches).toBe(beforeMatches);
    expect(getState().sparkApp!.likedYou).toHaveLength(0);
  });

  it('dismissLikedYou removes the entry without matching', () => {
    const state = ultraStateWithLike();
    const { setGameState, getState } = makeHarness(state);
    dismissLikedYou(setGameState, SAMPLE_ID);
    expect(getState().sparkApp!.likedYou).toHaveLength(0);
    expect(getState().sparkApp!.matches).toHaveLength(0);
  });
});
