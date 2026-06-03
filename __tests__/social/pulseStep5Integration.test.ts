/**
 * Pulse Step 5 integration tests — achievements, prestige follower carry,
 * and fame event surfacing into Pulse.
 *
 * These exercise the wiring that connects the Pulse subsystem to the wider
 * game: achievement progressSpec reading Pulse state, dynasty carry across
 * prestige resets, and applyFameEventToPulse staging entries that the next
 * pulseTick consumes.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { applyFameEventToPulse } from '@/lib/events/fameEvents';
import { updateDynastyOnDeath } from '@/lib/legacy/dynasty';
import { processPulseWeeklyTick } from '@/lib/social/pulseTick';
import type { EventTemplate } from '@/lib/events/engine';
import type { GameState, DynastyStats } from '@/contexts/game/types';
import { achievements } from '@/src/features/onboarding/achievementsData';

function freshState(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState(overrides);
  if (s.socialMedia) s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  return s;
}

// ──────────────────────────────────────────────────────────────────────────
// Achievements — all 11 Pulse entries evaluate against the v13 state shape.
// ──────────────────────────────────────────────────────────────────────────

describe('Pulse achievements (v13)', () => {
  const PULSE_IDS = [
    'pulse_first_viral_post',
    'pulse_rising_star',
    'pulse_popular',
    'pulse_influencer',
    'pulse_celebrity',
    'pulse_scandal_survivor',
    'pulse_unbreakable',
    'pulse_brand_ambassador',
    'pulse_verified_pro_member',
    'pulse_live_streamer',
    'pulse_viral_century',
  ];

  it('all 11 Pulse achievements are registered', () => {
    for (const id of PULSE_IDS) {
      expect(achievements.find((a: any) => a.id === id)).toBeDefined();
    }
  });

  it('progressSpec for follower-tier achievements reads from socialMedia.followers', () => {
    const ach = achievements.find((a: any) => a.id === 'pulse_popular');
    expect(ach).toBeDefined();
    const state = freshState();
    state.socialMedia!.followers = 12_000;
    const current = ach!.progressSpec.kind === 'counter'
      ? ach!.progressSpec.current(state)
      : 0;
    expect(current).toBe(12_000);
    expect(ach!.progressSpec.kind === 'counter' && current >= ach!.progressSpec.goal).toBe(true);
  });

  it('verified_pro_member is a boolean spec keyed on verifiedPro.active', () => {
    const ach = achievements.find((a: any) => a.id === 'pulse_verified_pro_member');
    expect(ach?.progressSpec.kind).toBe('boolean');
    const state = freshState();
    state.socialMedia!.verifiedPro = {
      active: true,
      perksUnlocked: {
        blueCheckmark: true,
        postBoostMultiplier: 1.25,
        analyticsUnlocked: true,
        noAdsInFeed: true,
        longerPosts: true,
      },
    };
    expect(ach!.progressSpec.kind === 'boolean' && ach!.progressSpec.met(state)).toBe(true);
  });

  it('scandal_survivor reads lifetimeStats.totalScandalsSurvived', () => {
    const ach = achievements.find((a: any) => a.id === 'pulse_scandal_survivor');
    const state = freshState();
    state.socialMedia!.lifetimeStats = {
      peakFollowers: 0,
      peakInfluenceLevel: 'novice',
      totalScandalsSurvived: 1,
      totalBrandDealsCompleted: 0,
      totalGemsBoostsUsed: 0,
      totalVerifiedProWeeks: 0,
    };
    const current = ach!.progressSpec.kind === 'counter'
      ? ach!.progressSpec.current(state)
      : 0;
    expect(current).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Prestige follower carry — DynastyStats.pulseLifetimeFollowersCarry.
// ──────────────────────────────────────────────────────────────────────────

describe('prestige follower carry (DynastyStats.pulseLifetimeFollowersCarry)', () => {
  const baseDynasty: DynastyStats = {
    totalGenerations: 0,
    totalWealth: 0,
    familyReputation: 0,
    heirlooms: [],
    familyAchievements: [],
    longestLivingMember: { name: '', age: 0 },
    wealthiestMember: { name: '', netWorth: 0 },
    totalChildrenAllGenerations: 0,
    dynastyFoundedYear: 2025,
  };

  it('updateDynastyOnDeath accumulates peak followers into carry', () => {
    const out = updateDynastyOnDeath(
      baseDynasty,
      'Player One',
      80,
      100_000,
      2,
      [],
      50_000, // peak followers this life
    );
    expect(out.pulseLifetimeFollowersCarry).toBe(50_000);
  });

  it('carry accumulates across generations', () => {
    const gen1 = updateDynastyOnDeath(baseDynasty, 'P1', 80, 0, 0, [], 100_000);
    const gen2 = updateDynastyOnDeath(gen1, 'P2', 80, 0, 0, [], 250_000);
    expect(gen2.pulseLifetimeFollowersCarry).toBe(350_000);
  });

  it('updateDynastyOnDeath without peak is back-compatible (carry stays undefined or unchanged)', () => {
    const out = updateDynastyOnDeath(baseDynasty, 'P', 80, 0, 0, []);
    expect(out.pulseLifetimeFollowersCarry).toBeUndefined();
  });

  it('zero peak does not initialize the field', () => {
    const out = updateDynastyOnDeath(baseDynasty, 'P', 80, 0, 0, [], 0);
    expect(out.pulseLifetimeFollowersCarry).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Fame event surfacing — applyFameEventToPulse stages tick-consumable state.
// ──────────────────────────────────────────────────────────────────────────

describe('applyFameEventToPulse', () => {
  const baseTemplate: Pick<EventTemplate, 'category' | 'weight' | 'generate'> = {
    category: 'general',
    weight: 1,
    generate: () => ({ id: 'x', description: '', choices: [] }) as any,
  };

  it('no-op when template lacks a surface flag', () => {
    const state = freshState();
    const before = JSON.stringify(state.socialMedia);
    const after = applyFameEventToPulse(state, { id: 'x', ...baseTemplate } as EventTemplate, 5);
    expect(JSON.stringify(after)).toBe(before);
  });

  it('pulse_notification: pushes a system notification dated weeksLived', () => {
    const state = freshState({ weeksLived: 7 });
    state.socialMedia!.notifications = [];
    const out = applyFameEventToPulse(
      state,
      { id: 'paparazzi_ambush', surface: 'pulse_notification', ...baseTemplate } as EventTemplate,
      7,
    );
    expect(out!.notifications!.length).toBe(1);
    expect(out!.notifications![0].gameWeek).toBe(7);
    expect(out!.notifications![0].type).toBe('system');
  });

  it('pulse_hashtag: injects a trending entry with source=event and proper decay window', () => {
    const state = freshState({ weeksLived: 3 });
    state.socialMedia!.trendingHashtags = [];
    const out = applyFameEventToPulse(
      state,
      {
        id: 'talk_show_invitation',
        surface: 'pulse_hashtag',
        pulseHashtag: '#talkshow',
        ...baseTemplate,
      } as EventTemplate,
      3,
    );
    const tag = out!.trendingHashtags!.find(t => t.tag === '#talkshow');
    expect(tag).toBeDefined();
    expect(tag!.source).toBe('event');
    expect(tag!.decayWeek).toBe(6);
  });

  it('pulse_scandal: seeds activeScandal when none active', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.activeScandal = null;
    const out = applyFameEventToPulse(
      state,
      { id: 'tabloid_scandal', surface: 'pulse_scandal', ...baseTemplate } as EventTemplate,
      5,
    );
    expect(out!.activeScandal).toBeDefined();
    expect(out!.activeScandal!.startedWeek).toBe(5);
    expect(out!.activeScandal!.severity).toBeGreaterThan(0);
  });

  it('pulse_scandal: does NOT overwrite an existing active scandal', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.activeScandal = {
      id: 'existing',
      type: 'cancel',
      severity: 30,
      weeksRemaining: 2,
      startedWeek: 3,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'existing',
    };
    const out = applyFameEventToPulse(
      state,
      { id: 'tabloid_scandal', surface: 'pulse_scandal', ...baseTemplate } as EventTemplate,
      5,
    );
    expect(out!.activeScandal!.id).toBe('existing');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// End-to-end: surface a fame-scandal then tick → scandal cascade applies.
// ──────────────────────────────────────────────────────────────────────────

describe('fame event → pulseTick integration', () => {
  it('staged scandal is processed by the next tick', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.followers = 50_000;

    // Stage the scandal via fame event surfacing.
    const sm = applyFameEventToPulse(
      state,
      {
        id: 'tabloid_scandal',
        category: 'general',
        weight: 1,
        surface: 'pulse_scandal',
        generate: () => ({ id: 'x', description: '', choices: [] }) as any,
      } as EventTemplate,
      5,
    );
    state.socialMedia = sm;

    // Run the next weekly tick.
    const tick = processPulseWeeklyTick(state, 6);
    expect(tick.reputationDelta).toBeLessThan(0);
    expect(tick.socialMedia.activeScandal!.severity).toBeLessThan(50);
  });
});
