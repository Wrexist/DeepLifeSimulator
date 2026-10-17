/**
 * Pulse impression earnings pay the viral bonus for THIS week's viral posts.
 *
 * `processPulseWeeklyTick` passed the LIFETIME `socialMedia.viralPosts`
 * counter (monotonic - `PulseActions` only increments it) into
 * `calculateWeeklyImpressionEarnings`' `recentViralPosts * 50` bonus, so every
 * viral post a life had ever made paid $50 again every week for ever, with no
 * cap. A creator with 200 lifetime viral posts collected ~$10k/wk for posting
 * nothing at all.
 */
import { countViralPostsThisWeek, processPulseWeeklyTick } from '@/lib/social/pulseTick';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, PulseRecentPost } from '@/contexts/game/types';

const CLOSING_WEEK = 300;
const NEXT = CLOSING_WEEK + 1;

function post(id: string, gameWeek: number, isViral: boolean): PulseRecentPost {
  return {
    id, content: 'x', likes: 0, comments: 0, reposts: 0, views: 0, bookmarks: 0,
    timestamp: 0, gameWeek, isViral, contentType: 'text',
  };
}

function creator(lifetimeViral: number, recentPosts: PulseRecentPost[]): GameState {
  const s = createTestGameState({ weeksLived: CLOSING_WEEK });
  s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  const sm = s.socialMedia!;
  sm.followers = 20_000;
  sm.totalPosts = 400;
  sm.viralPosts = lifetimeViral;
  sm.lastPostWeek = CLOSING_WEEK;
  sm.recentPosts = recentPosts;
  sm.activeBrandDeals = [];
  sm.activeScandal = null;
  return s;
}

describe('countViralPostsThisWeek', () => {
  it('counts only viral posts stamped with the week this tick closes', () => {
    const posts = [
      post('a', CLOSING_WEEK, true),
      post('b', CLOSING_WEEK, true),
      post('c', CLOSING_WEEK, false),
      post('d', CLOSING_WEEK - 1, true), // last week's - already paid by the previous tick
      post('e', CLOSING_WEEK - 40, true),
    ];
    expect(countViralPostsThisWeek(posts, NEXT)).toBe(2);
    // A post is credited to exactly ONE tick.
    expect(countViralPostsThisWeek(posts, NEXT + 1)).toBe(0);
  });

  it('degrades to 0 on missing or malformed input', () => {
    expect(countViralPostsThisWeek(undefined, NEXT)).toBe(0);
    expect(countViralPostsThisWeek([], NEXT)).toBe(0);
    expect(countViralPostsThisWeek([post('a', CLOSING_WEEK, true)], NaN)).toBe(0);
  });
});

describe('impression earnings ignore the lifetime viral counter', () => {
  it('200 lifetime viral posts and none this week pays the same as a creator with none', () => {
    const fresh = processPulseWeeklyTick(creator(0, []), NEXT).pulseEarnings;
    const veteran = processPulseWeeklyTick(creator(200, []), NEXT).pulseEarnings;
    expect(veteran).toBe(fresh);
  });

  it('viral posts made this week still earn their bonus', () => {
    const none = processPulseWeeklyTick(creator(50, [post('a', CLOSING_WEEK, false)]), NEXT).pulseEarnings;
    const two = processPulseWeeklyTick(
      creator(50, [post('a', CLOSING_WEEK, true), post('b', CLOSING_WEEK, true)]),
      NEXT,
    ).pulseEarnings;
    // 2 x $50 inside the seeded ±20% band.
    expect(two - none).toBeGreaterThanOrEqual(Math.floor(2 * 50 * 0.8) - 1);
    expect(two - none).toBeLessThanOrEqual(Math.ceil(2 * 50 * 1.2 * 1.25) + 1);
  });
});
