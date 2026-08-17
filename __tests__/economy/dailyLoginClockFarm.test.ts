/**
 * The daily login reward was farmable by changing the device clock.
 *
 * The whole gate in `app/(tabs)/home.tsx` was a raw string compare:
 *
 *     const today = new Date().toISOString().split('T')[0];
 *     if (gameState.lastLoginRewardDate === today) return undefined;
 *
 * Any other day key passes — FORWARD or BACK. So: claim, background the app,
 * move the device date, reopen the Home tab, claim again, repeat. The 48-hour
 * streak grace (`LOGIN_STREAK_GRACE_HOURS`) means stepping forward in small
 * increments also keeps the streak climbing, so `rewardIndex` cycles the whole
 * `DAILY_LOGIN_REWARDS` table (25 → 500) — about 157 gems per clock change, on
 * the premium currency that is otherwise sold as an IAP.
 *
 * CLAUDE.md 4.4 states the rule outright: "Anything gated on a device-clock
 * day-string is farmable; gate on game state." The app already had the fix —
 * `canClaimDailyGemsFor` guards the OTHER daily gem faucet — and this faucet
 * simply never adopted it. 2026-07-30 audit ECON-1.
 *
 * This pins the shared guard rather than the effect, because the effect is what
 * now delegates to it.
 */
import { canClaimDailyGemsFor } from '@/contexts/game/actions/SubscriptionActions';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000;

describe('a clock that only moves forward normally still works', () => {
  it('allows the very first claim', () => {
    expect(canClaimDailyGemsFor(undefined, undefined, '2026-07-30', T0)).toBe(true);
  });

  it('allows the next real day', () => {
    expect(canClaimDailyGemsFor('2026-07-30', T0, '2026-07-31', T0 + DAY)).toBe(true);
  });

  it('allows a player who skipped several days', () => {
    expect(canClaimDailyGemsFor('2026-07-30', T0, '2026-08-09', T0 + 10 * DAY)).toBe(true);
  });
});

describe('the same day cannot be claimed twice', () => {
  it('refuses a repeat on the current day key', () => {
    expect(canClaimDailyGemsFor('2026-07-30', T0, '2026-07-30', T0 + 60_000)).toBe(false);
  });
});

describe('a clock moved BACKWARD cannot re-arm the reward', () => {
  it('refuses yesterday', () => {
    // The exploit's easiest form: roll the date back one day.
    expect(canClaimDailyGemsFor('2026-07-30', T0, '2026-07-29', T0 - DAY)).toBe(false);
  });

  it('refuses a date far in the past', () => {
    expect(canClaimDailyGemsFor('2026-07-30', T0, '2020-01-01', T0 - 2000 * DAY)).toBe(false);
  });

  it('refuses even when only the epoch was rewound and the day key looks newer', () => {
    // Day key alone is not enough — a device can report a later date with an
    // earlier clock. The epoch high-water mark is the second half of the guard.
    expect(canClaimDailyGemsFor('2026-07-30', T0, '2026-07-31', T0 - 30 * DAY)).toBe(false);
  });

  it('crossing a month or year boundary backwards is still refused', () => {
    expect(canClaimDailyGemsFor('2026-08-01', T0, '2026-07-31', T0 - DAY)).toBe(false);
    expect(canClaimDailyGemsFor('2027-01-01', T0, '2026-12-31', T0 - DAY)).toBe(false);
  });
});

describe('the string compare the old gate used is not sufficient', () => {
  it('a bare `key !== today` test would have passed every one of these', () => {
    // Everything the old gate let through, enumerated. Each is now refused.
    const exploits: [string, number][] = [
      ['2026-07-29', T0 - DAY],
      ['2020-01-01', T0 - 2000 * DAY],
      ['2026-07-31', T0 - 30 * DAY],
    ];

    for (const [dayKey, nowMs] of exploits) {
      // The old gate: only equality with the stored key blocked a claim.
      expect(dayKey !== '2026-07-30').toBe(true);
      // The new gate refuses it.
      expect(canClaimDailyGemsFor('2026-07-30', T0, dayKey, nowMs)).toBe(false);
    }
  });
});

describe('an existing save with no stamp is not locked out', () => {
  it('lets a player who has never claimed claim, whatever the clock says', () => {
    // `lastLoginRewardAt` is a v27 carve-out field with no backfill, so every
    // pre-v27 save arrives with it undefined. That must not block a claim.
    expect(canClaimDailyGemsFor(undefined, undefined, '2026-07-30', T0)).toBe(true);
  });

  it('falls back to the day key alone when the epoch stamp is missing', () => {
    expect(canClaimDailyGemsFor('2026-07-29', undefined, '2026-07-30', T0)).toBe(true);
    expect(canClaimDailyGemsFor('2026-07-30', undefined, '2026-07-29', T0)).toBe(false);
  });
});
