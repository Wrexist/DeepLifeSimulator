/**
 * The daily-login gem faucet must not be farmable on the device clock.
 *
 * Both existing guards in `canClaimDailyGemsFor` only refuse a claim when the
 * clock moves BACKWARD:
 *
 *   (1) `todayKey <= lastClaimKey`  → blocks same-day and earlier
 *   (2) `nowMs < lastClaimAt - skew` → blocks a rewound epoch
 *
 * Setting the device date FORWARD one day at a time passes both, every time.
 * With `LOGIN_STREAK_GRACE_HOURS = 48` the streak keeps climbing too, so the
 * 25→500 gem cycle (~157/day average) could be drained indefinitely on the
 * premium currency the game otherwise sells as an IAP.
 *
 * No day-key scheme fixes that: React Native has no monotonic wall clock without
 * a native module, so every device-time signal moves with the scrub. The gate
 * that holds is the GAME clock — `weeksLived` only advances by playing.
 *
 * These tests drive the guard the way the exploit does: with a cooperating
 * clock. If they can be made to pass while the week is frozen, the hole is open.
 */
import { canClaimDailyGemsFor } from '@/contexts/game/actions/SubscriptionActions';

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (n: number) => new Date(n * DAY).toISOString().split('T')[0];

describe('daily login reward - game-week gate', () => {
  it('lets a first-time player claim', () => {
    expect(
      canClaimDailyGemsFor(undefined, undefined, dayKey(100), 100 * DAY, {
        current: 3,
        lastClaim: undefined,
      }),
    ).toBe(true);
  });

  it('blocks a forward clock jump when no game week has been played', () => {
    // THE regression. Both clock guards are satisfied — the day key increased
    // and the epoch moved forward — and pre-fix this returned true.
    expect(
      canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(101), 101 * DAY, {
        current: 3,
        lastClaim: 3,
      }),
    ).toBe(false);
  });

  it('blocks a whole year of forward jumps on a frozen game week', () => {
    for (let day = 101; day < 466; day++) {
      const allowed = canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(day), day * DAY, {
        current: 3,
        lastClaim: 3,
      });
      expect(allowed).toBe(false);
    }
  });

  it('allows the claim once a week has actually been played', () => {
    expect(
      canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(101), 101 * DAY, {
        current: 4,
        lastClaim: 3,
      }),
    ).toBe(true);
  });

  it('still requires a new calendar day - playing ten weeks in one sitting pays once', () => {
    // The week gate is an ADDITIONAL condition, not a replacement. A player who
    // burns through ten weeks in an afternoon does not get ten daily rewards.
    expect(
      canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(100), 100 * DAY, {
        current: 13,
        lastClaim: 3,
      }),
    ).toBe(false);
  });

  it('still blocks a rewound clock, week gate satisfied or not', () => {
    expect(
      canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(99), 99 * DAY, {
        current: 40,
        lastClaim: 3,
      }),
    ).toBe(false);
  });

  it('leaves callers that pass no week gate exactly as they were', () => {
    // The DeepLife+ daily gem drop is a SUBSCRIBER benefit; gating it on play
    // would punish a paying member for a quiet day, so it opts out.
    expect(canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(101), 101 * DAY)).toBe(true);
  });

  it('treats a corrupt week counter as unplayed rather than as a free claim', () => {
    expect(
      canClaimDailyGemsFor(dayKey(100), 100 * DAY, dayKey(101), 101 * DAY, {
        current: Number.NaN,
        lastClaim: 3,
      }),
    ).toBe(false);
  });
});
