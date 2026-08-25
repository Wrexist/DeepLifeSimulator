/**
 * The honest session clock (`refreshSessionClock`) and the "last played" label.
 *
 * `lastLogin` used to be written only at life creation and on welcome-back
 * grant — so for a player who kept returning INSIDE the 24h popup window it
 * went stale for as long as the habit lasted, and the next genuine day-plus
 * absence was both misreported ("Last played: 1 week ago") and OVERPAID
 * (`computeWelcomeBackBonus` pays `min(daysAway, 7)` half-weeks of salary off
 * that stale span). Retention program 2026-08-25 R1.
 *
 * The stamp is deliberately one-sided: it refreshes only within the 24h
 * window. A day-plus absence must survive untouched so the return summary can
 * still measure it before `applyWelcomeBackBonus` closes it on dismiss, and a
 * from-the-future stamp (rewound device clock) is never legitimised.
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { refreshSessionClock, computeWelcomeBackBonus } from '@/utils/welcomeBackBonus';
import { lastPlayedLabel } from '@/utils/lastPlayed';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

function stateWithLastLogin(lastLogin: number | undefined): GameState {
  const base = createTestGameState();
  return { ...base, lastLogin } as GameState;
}

describe('refreshSessionClock', () => {
  it('refreshes a stale stamp inside the 24h window', () => {
    const prev = stateWithLastLogin(NOW - 20 * HOUR);
    const next = refreshSessionClock(prev, NOW);
    expect(next.lastLogin).toBe(NOW);
    expect(next).not.toBe(prev);
  });

  it('leaves a day-plus absence untouched — that span belongs to the return summary', () => {
    const prev = stateWithLastLogin(NOW - 25 * HOUR);
    expect(refreshSessionClock(prev, NOW)).toBe(prev);
  });

  it('leaves a from-the-future stamp untouched (rewound device clock)', () => {
    const prev = stateWithLastLogin(NOW + 2 * HOUR);
    expect(refreshSessionClock(prev, NOW)).toBe(prev);
  });

  it('does nothing when there is no stamp at all', () => {
    const prev = stateWithLastLogin(undefined);
    expect(refreshSessionClock(prev, NOW)).toBe(prev);
  });

  it('exactly 24h refreshes; the popup threshold is strictly greater-than', () => {
    // home.tsx spawns the popup on hoursAway > 24, so <= 24 is stamp
    // territory: the two gates partition the axis with no dead band.
    const prev = stateWithLastLogin(NOW - 24 * HOUR);
    expect(refreshSessionClock(prev, NOW).lastLogin).toBe(NOW);
  });

  it('closes the stale-span overpayment: a daily habit no longer banks 7 days of bonus', () => {
    // Before R1: 6 daily sessions never stamped (all inside 24h), so the 7th
    // session — after ONE day away — computed daysAway against a week-old
    // stamp and paid the 7-day maximum. With the stamp refreshed each
    // session, the same absence pays for exactly what it was.
    let clock = NOW;
    let state = stateWithLastLogin(clock);
    for (let day = 1; day <= 8; day++) {
      clock += 20 * HOUR; // returns daily, always inside the window
      state = refreshSessionClock(state, clock);
    }
    clock += 30 * HOUR; // then one genuine day-plus absence
    const staleDaysAway = Math.floor((clock - NOW) / DAY); // the old basis
    const honestDaysAway = Math.floor((clock - (state.lastLogin as number)) / DAY);
    expect(staleDaysAway).toBeGreaterThanOrEqual(7);
    expect(honestDaysAway).toBe(1);
    const overpaid = computeWelcomeBackBonus(state, staleDaysAway);
    const honest = computeWelcomeBackBonus(state, honestDaysAway);
    expect(honest).toBeLessThanOrEqual(overpaid);
  });
});

describe('lastPlayedLabel', () => {
  it('returns null for a missing or non-finite stamp', () => {
    expect(lastPlayedLabel(undefined, NOW)).toBeNull();
    expect(lastPlayedLabel(Number.NaN, NOW)).toBeNull();
  });

  it('returns null for a stamp in the future (rewound clock — never guess)', () => {
    expect(lastPlayedLabel(NOW + HOUR, NOW)).toBeNull();
  });

  it('buckets the recent past sensibly', () => {
    expect(lastPlayedLabel(NOW - 5 * 60 * 1000, NOW)).toBe('JUST NOW');
    expect(lastPlayedLabel(NOW - 3 * HOUR, NOW)).toBe('3H AGO');
    expect(lastPlayedLabel(NOW - 30 * HOUR, NOW)).toBe('YESTERDAY');
    expect(lastPlayedLabel(NOW - 3 * DAY, NOW)).toBe('3D AGO');
    expect(lastPlayedLabel(NOW - 8 * DAY, NOW)).toBe('1W AGO');
    expect(lastPlayedLabel(NOW - 21 * DAY, NOW)).toBe('3W AGO');
  });
});
