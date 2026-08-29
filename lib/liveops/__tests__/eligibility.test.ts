import { DEFAULT_COOLDOWN_WEEKS, ineligibleReason, isEligible, isInRollout, type EligibilityContext } from '../eligibility';
import type { LiveEventDefinition } from '../types';

const def = (o: Partial<LiveEventDefinition> = {}): LiveEventDefinition => ({
  id: 'e',
  schemaVersion: 1,
  kind: 'challenge',
  title: 't',
  summary: 's',
  brief: 'b',
  startsAt: '2026-06-01T00:00:00Z',
  endsAt: '2026-07-01T00:00:00Z',
  objectives: [{ objectiveId: 'reputation', target: 1 }],
  rewards: [{ kind: 'gems', amount: 100 }],
  ...o,
});

const ctx = (o: Partial<EligibilityContext> = {}): EligibilityContext => ({
  weeksThisLife: 40,
  totalPrestiges: 0,
  isSubscriber: false,
  daysAway: 0,
  installId: 'install-1',
  ...o,
});

describe('staged rollout', () => {
  it('is stable for one install, so an event never appears then vanishes', () => {
    const first = isInRollout('e', 'install-1', 30);
    for (let i = 0; i < 20; i++) expect(isInRollout('e', 'install-1', 30)).toBe(first);
  });

  it('is MONOTONIC in the percentage', () => {
    // The property staged rollout actually needs: going 10 -> 50 must never
    // take the event away from someone who already has it and may already have
    // made progress.
    for (let i = 0; i < 300; i++) {
      const install = `install-${i}`;
      if (isInRollout('e', install, 10)) {
        expect(isInRollout('e', install, 50)).toBe(true);
        expect(isInRollout('e', install, 100)).toBe(true);
      }
    }
  });

  it('splits roughly according to the percentage', () => {
    let inRollout = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) if (isInRollout('e', `install-${i}`, 25)) inRollout += 1;
    expect(inRollout / N).toBeGreaterThan(0.2);
    expect(inRollout / N).toBeLessThan(0.3);
  });

  it('salts by event id, so two rollouts do not land on the same installs', () => {
    let same = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (isInRollout('a', `i${i}`, 50) === isInRollout('b', `i${i}`, 50)) same += 1;
    }
    expect(same / N).toBeGreaterThan(0.4);
    expect(same / N).toBeLessThan(0.6);
  });

  it('absent or 100 means everyone; 0 means nobody', () => {
    expect(isInRollout('e', 'i', undefined)).toBe(true);
    expect(isInRollout('e', 'i', 100)).toBe(true);
    expect(isInRollout('e', 'i', 0)).toBe(false);
  });
});

describe('eligibility rules', () => {
  it('an event with no eligibility is for everyone', () => {
    expect(isEligible(def(), ctx(), undefined)).toBe(true);
  });

  it('targets progression stages', () => {
    expect(isEligible(def({ eligibility: { stages: ['new'] } }), ctx({ weeksThisLife: 1 }), undefined)).toBe(true);
    expect(isEligible(def({ eligibility: { stages: ['new'] } }), ctx({ weeksThisLife: 300 }), undefined)).toBe(false);
  });

  it('measures life length in THIS life, never the raw counter', () => {
    // `weeksLived` is seeded from the starting age, so an age-25 character
    // begins at 364 and every small threshold is met before the first frame.
    const e = def({ eligibility: { minWeeksThisLife: 10 } });
    expect(isEligible(e, ctx({ weeksThisLife: 4 }), undefined)).toBe(false);
    expect(isEligible(e, ctx({ weeksThisLife: 12 }), undefined)).toBe(true);
  });

  it('gates subscription in BOTH directions', () => {
    // A member perk, and a win-back that must NOT reach an existing subscriber.
    const memberOnly = def({ eligibility: { requiresSubscription: true } });
    const nonMemberOnly = def({ eligibility: { requiresSubscription: false } });
    expect(isEligible(memberOnly, ctx({ isSubscriber: true }), undefined)).toBe(true);
    expect(isEligible(memberOnly, ctx({ isSubscriber: false }), undefined)).toBe(false);
    expect(isEligible(nonMemberOnly, ctx({ isSubscriber: true }), undefined)).toBe(false);
    expect(isEligible(nonMemberOnly, ctx({ isSubscriber: false }), undefined)).toBe(true);
  });

  it('holds a returning-player event back until the player has been away', () => {
    const e = def({ eligibility: { minDaysAway: 7 } });
    expect(isEligible(e, ctx({ daysAway: 2 }), undefined)).toBe(false);
    expect(isEligible(e, ctx({ daysAway: 9 }), undefined)).toBe(true);
  });
});

describe('cooldowns', () => {
  it('holds a repeat back for the cooldown, measured in GAME weeks', () => {
    // Real time would silently cool down a player who has not played.
    const seen = { lastSeenWeek: { e: 40 } };
    expect(isEligible(def(), ctx({ weeksThisLife: 42 }), seen)).toBe(false);
    expect(isEligible(def(), ctx({ weeksThisLife: 40 + DEFAULT_COOLDOWN_WEEKS }), seen)).toBe(true);
  });

  it('a life reset clears the cooldown rather than freezing it', () => {
    // Otherwise every recurring event would be hidden from every player who
    // prestiges, because the life clock goes backwards.
    const seen = { lastSeenWeek: { e: 300 } };
    expect(isEligible(def(), ctx({ weeksThisLife: 2 }), seen)).toBe(true);
  });
});

describe('reasons', () => {
  it('names why, for the debug surface', () => {
    expect(ineligibleReason(def(), ctx(), undefined)).toBeNull();
    expect(ineligibleReason(def({ eligibility: { minDaysAway: 7 } }), ctx(), undefined)).toMatch(/away/);
    expect(ineligibleReason(def({ rolloutPercent: 0 }), ctx(), undefined)).toMatch(/rollout/);
  });
});
