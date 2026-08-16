import { createTestGameState } from '../helpers/createTestGameState';
import {
  applyDeepLifePlusBenefits,
  reconcileSubscriptionBenefits,
  claimDailyGems,
  canClaimDailyGems,
  canClaimDailyGemsFor,
  isPlayBackedGemClaim,
} from '@/contexts/game/actions/SubscriptionActions';
import {
  DEEP_LIFE_PLUS_PLANS,
  DEEP_LIFE_PLUS_BENEFITS,
  DEEP_LIFE_PLUS_WELCOME_GEMS,
  DEEP_LIFE_PLUS_DAILY_GEMS,
  DAILY_GEMS_BASE,
  DEEP_LIFE_PLUS_UPGRADE_DISCOUNT,
  dailyGemMemberMultiple,
  dailyGemExtraPerYear,
  memberUpgradeCost,
  deepLifePlusWeekKeys,
  weekKeysForDayKey,
  isPerfectDeepLifePlusWeek,
  getDeepLifePlusPlan,
  isDeepLifePlusProduct,
  buildDeepLifePlusWeekStatus,
  utcDayKey,
} from '@/lib/subscription/deepLifePlus';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';
import type { GameSettings, GameState } from '@/contexts/game/types';

describe('DeepLife+ config', () => {
  it('exposes a monthly and a yearly plan with prices', () => {
    expect(DEEP_LIFE_PLUS_PLANS).toHaveLength(2);
    const monthly = getDeepLifePlusPlan('monthly');
    const yearly = getDeepLifePlusPlan('yearly');
    expect(monthly?.productId).toBe(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY);
    expect(yearly?.productId).toBe(SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY);
    expect(monthly?.price).toMatch(/^\$/);
    expect(yearly?.price).toMatch(/^\$/);
    expect(yearly?.badge).toBeTruthy();
  });

  it('recognises DeepLife+ product ids', () => {
    expect(isDeepLifePlusProduct(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY)).toBe(true);
    expect(isDeepLifePlusProduct(SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY)).toBe(true);
    expect(isDeepLifePlusProduct('deeplife_gems_100')).toBe(false);
  });

  it('lists only deliverable benefits', () => {
    // Every id here maps to functionality the game actually grants:
    //   no_ads/welcome_gems/legacy_premium/cosmetics → applyDeepLifePlusBenefits + tier
    //   income_boost → +25% career salary in applyCareerSalaryAndPenalty
    //   vip_support  → priority-flagged support in HelpModal
    const ids = DEEP_LIFE_PLUS_BENEFITS.map((b) => b.id).sort();
    expect(ids).toEqual(
      ['cosmetics', 'daily_gems', 'income_boost', 'legacy_premium', 'no_ads', 'vip_support', 'welcome_gems'].sort(),
    );
  });
});

describe('applyDeepLifePlusBenefits', () => {
  it('removes ads and grants the welcome gems on first activation', () => {
    const s = createTestGameState({ stats: { gems: 10 } });
    const next = applyDeepLifePlusBenefits(s);
    expect(next.settings.adsRemoved).toBe(true);
    expect(next.settings.deepLifePlusActivated).toBe(true);
    expect(next.settings.adsRemovedDate).toBeTruthy();
    expect(next.stats.gems).toBe(10 + DEEP_LIFE_PLUS_WELCOME_GEMS);
  });

  it('is idempotent — welcome gems are granted only once', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const once = applyDeepLifePlusBenefits(s);
    const twice = applyDeepLifePlusBenefits(once);
    expect(twice.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // not doubled
    expect(twice.settings.adsRemoved).toBe(true);
  });

  it('preserves an existing adsRemovedDate (e.g. prior Remove Ads IAP)', () => {
    const s = createTestGameState({
      settings: { adsRemoved: true, adsRemovedDate: '2025-01-01T00:00:00.000Z' },
    });
    const next = applyDeepLifePlusBenefits(s);
    expect(next.settings.adsRemovedDate).toBe('2025-01-01T00:00:00.000Z');
  });

  it('does not mutate the input state', () => {
    const s = createTestGameState({ stats: { gems: 5 } });
    applyDeepLifePlusBenefits(s);
    expect(s.stats.gems).toBe(5);
    expect(s.settings.deepLifePlusActivated).toBeUndefined();
  });
});

describe('claimDailyGems (tiered daily gem drop)', () => {
  const TODAY = '2026-07-23';
  const YESTERDAY = '2026-07-22';
  const member = (over: Partial<GameSettings> = {}): GameState =>
    createTestGameState({ stats: { gems: 0 }, settings: { deepLifePlusActivated: true, ...over } });
  const free = (over: Partial<GameSettings> = {}): GameState =>
    createTestGameState({ stats: { gems: 0 }, settings: { ...over } });

  it('grants a member the DeepLife+ daily amount (250)', () => {
    const next = claimDailyGems(member(), TODAY);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(next.settings.deepLifePlusLastGemClaim).toBe(TODAY);
    expect(next.settings.deepLifePlusGemClaimDays).toContain(TODAY); // recorded for the streak strip
  });

  it('grants a free player the base daily amount (20)', () => {
    expect(claimDailyGems(free(), TODAY).stats.gems).toBe(DAILY_GEMS_BASE);
  });

  it('is a no-op on a repeat same-day claim (returns the same state)', () => {
    const claimed = member({ deepLifePlusLastGemClaim: TODAY });
    expect(claimDailyGems(claimed, TODAY)).toBe(claimed);
  });

  it('is claimable again on a new day', () => {
    const claimedYesterday = free({ deepLifePlusLastGemClaim: YESTERDAY });
    expect(claimDailyGems(claimedYesterday, TODAY).stats.gems).toBe(DAILY_GEMS_BASE);
  });

  it('a lifetime-premium owner gets the member amount', () => {
    const lifer = createTestGameState({ stats: { gems: 0 }, settings: { lifetimePremium: true } });
    expect(claimDailyGems(lifer, TODAY).stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
  });

  it('canClaim is only the same-day guard (everyone can claim)', () => {
    expect(canClaimDailyGems(free(), TODAY)).toBe(true);
    expect(canClaimDailyGems(member(), TODAY)).toBe(true);
    expect(canClaimDailyGems(member({ deepLifePlusLastGemClaim: TODAY }), TODAY)).toBe(false);
  });

  it('sells the difference truthfully: member multiple is floored, never overstated', () => {
    // 250 vs 20 → 12.5, floored to 12 so "12× the free daily" is never a lie.
    expect(dailyGemMemberMultiple()).toBe(Math.floor(DEEP_LIFE_PLUS_DAILY_GEMS / DAILY_GEMS_BASE));
    expect(dailyGemMemberMultiple() * DAILY_GEMS_BASE).toBeLessThanOrEqual(DEEP_LIFE_PLUS_DAILY_GEMS);
  });

  it('per-year gap is the daily surplus times 365', () => {
    expect(dailyGemExtraPerYear()).toBe((DEEP_LIFE_PLUS_DAILY_GEMS - DAILY_GEMS_BASE) * 365);
  });

  it('pays a perfect-week bonus (2× on the day that completes Mon→Sun)', () => {
    // Seed the first six days of the current week as already claimed, then claim
    // the seventh — that claim should pay the daily amount PLUS a bonus daily.
    const keys = weekKeysForDayKey(TODAY);
    const seventh = keys[keys.length - 1];
    const firstSix = keys.slice(0, 6);
    const s = free({ deepLifePlusGemClaimDays: firstSix });
    const next = claimDailyGems(s, seventh);
    expect(next.stats.gems).toBe(DAILY_GEMS_BASE * 2); // daily + perfect-week bonus
  });

  it('a normal mid-week claim pays only the daily amount (no bonus)', () => {
    const keys = weekKeysForDayKey(TODAY);
    const s = free({ deepLifePlusGemClaimDays: [keys[0]] });
    expect(claimDailyGems(s, keys[2]).stats.gems).toBe(DAILY_GEMS_BASE); // just the daily
  });
});

describe('claimDailyGems — free-tier game-week gate (forward-clock farm)', () => {
  const TODAY = '2026-07-23';
  const YESTERDAY = '2026-07-22';
  // A free player who already claimed yesterday, at game-week `week`, with the
  // marker recorded. The two clock guards below only refuse a REWIND; the game
  // week is what a forward-scrub cannot beat.
  const freeClaimed = (week: number, lastClaimWeek: number): GameState =>
    createTestGameState({
      stats: { gems: 0 },
      weeksLived: week,
      settings: { deepLifePlusLastGemClaim: YESTERDAY, deepLifePlusLastGemClaimWeek: lastClaimWeek },
    });

  it('BLOCKS a free player who scrubs the clock forward without playing a week', () => {
    // Same game week as the last claim → no play happened → refuse, no gems mint.
    const s = freeClaimed(10, 10);
    expect(canClaimDailyGems(s, TODAY)).toBe(false);
    expect(claimDailyGems(s, TODAY)).toBe(s);
  });

  it('ALLOWS a free player once a game week has actually passed', () => {
    const s = freeClaimed(11, 10); // one week played since the last claim
    expect(canClaimDailyGems(s, TODAY)).toBe(true);
    const next = claimDailyGems(s, TODAY);
    expect(next.stats.gems).toBe(DAILY_GEMS_BASE);
    expect(next.settings.deepLifePlusLastGemClaimWeek).toBe(11); // marker re-stamped to now
  });

  it('never blocks a free player\'s FIRST claim (no marker yet)', () => {
    const s = createTestGameState({ stats: { gems: 0 }, weeksLived: 5, settings: {} });
    expect(canClaimDailyGems(s, TODAY)).toBe(true);
    const next = claimDailyGems(s, TODAY);
    expect(next.stats.gems).toBe(DAILY_GEMS_BASE);
    expect(next.settings.deepLifePlusLastGemClaimWeek).toBe(5);
  });

  it('does NOT gate a DeepLife+ member — the daily-check-in grace is preserved', () => {
    // Same frozen game week as the last claim, but a member: still claimable on a
    // new calendar day (the deliberate subscriber grace, guarded here so a future
    // change to gate members is a conscious one).
    const m = createTestGameState({
      stats: { gems: 0 },
      weeksLived: 10,
      settings: {
        deepLifePlusActivated: true,
        deepLifePlusLastGemClaim: YESTERDAY,
        deepLifePlusLastGemClaimWeek: 10,
      },
    });
    expect(canClaimDailyGems(m, TODAY)).toBe(true);
    expect(claimDailyGems(m, TODAY).stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
  });
});

/**
 * v45 — the DeepLife+ MEMBER grace is capped at ONE unplayed claim per played
 * game week. The perk (claim on a quiet day without playing) stays; what it
 * lacked was a cap, so a forward clock scrub compounded it into an unbounded
 * 250-gems/day faucet on the premium currency.
 *
 * Truth table (day-key/epoch guards already passed): a claim BACKED BY PLAY
 * (`weeksLived` > `deepLifePlusLastGemClaimWeek`) always claims and never spends
 * the grace; an unplayed claim spends it (stamping
 * `deepLifePlusLastMemberClaimWeek`); a second unplayed claim at the same
 * `weeksLived` is refused.
 */
describe('claimDailyGems — DeepLife+ member grace cap (v45)', () => {
  const D1 = '2026-07-21';
  const D2 = '2026-07-22';
  const D3 = '2026-07-23';
  const member = (weeksLived: number, over: Partial<GameSettings> = {}): GameState =>
    createTestGameState({
      stats: { gems: 0 },
      weeksLived,
      settings: { deepLifePlusActivated: true, ...over },
    });

  it('(a) a member who plays a week between claims claims every day — grace untouched', () => {
    // Day 1 (first ever claim): allowed, and it spends the grace (nothing was
    // played to earn it).
    let s = member(100);
    expect(canClaimDailyGems(s, D1)).toBe(true);
    s = claimDailyGems(s, D1);
    expect(s.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(s.settings.deepLifePlusLastGemClaimWeek).toBe(100);
    expect(s.settings.deepLifePlusLastMemberClaimWeek).toBe(100);

    // Day 2 after playing a week: play-backed → claims, and the grace marker is
    // NOT re-stamped (the perk is not consumed by a claim that was earned).
    s = { ...s, weeksLived: 101 };
    expect(canClaimDailyGems(s, D2)).toBe(true);
    s = claimDailyGems(s, D2);
    expect(s.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS * 2);
    expect(s.settings.deepLifePlusLastGemClaimWeek).toBe(101);
    expect(s.settings.deepLifePlusLastMemberClaimWeek).toBe(100); // still day 1's

    // Day 3 after playing again: still claiming daily, exactly as before v45.
    s = { ...s, weeksLived: 102 };
    s = claimDailyGems(s, D3);
    expect(s.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS * 3);
    expect(s.settings.deepLifePlusLastMemberClaimWeek).toBe(100);
  });

  it('(b) the ONE banked grace claim works, and the second unplayed day is refused', () => {
    let s = member(100);
    s = claimDailyGems(s, D1); // banked grace spent here
    expect(s.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(s.settings.deepLifePlusLastMemberClaimWeek).toBe(100);

    // New calendar day, no game week played → the grace is already spent at 100.
    expect(canClaimDailyGems(s, D2)).toBe(false);
    expect(claimDailyGems(s, D2)).toBe(s); // no-op, no gems minted
  });

  it('(c) plays a week, claims, then a quiet day still claims — that is the perk', () => {
    // Claimed at week 100, then a week is played (weeksLived 101) and claimed
    // (play-backed). The NEXT quiet day still claims out of the banked grace.
    let s = member(101, { deepLifePlusLastGemClaim: D1, deepLifePlusLastGemClaimWeek: 100 });
    s = claimDailyGems(s, D2); // play-backed
    expect(s.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(s.settings.deepLifePlusLastMemberClaimWeek).toBeUndefined();

    expect(canClaimDailyGems(s, D3)).toBe(true); // quiet day: the banked claim
    const quiet = claimDailyGems(s, D3);
    expect(quiet.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS * 2);
    expect(quiet.settings.deepLifePlusLastMemberClaimWeek).toBe(101);

    // And the day after that, still without playing, is refused.
    expect(canClaimDailyGems(quiet, '2026-07-24')).toBe(false);
  });

  it('(d) a FORWARD clock scrub cannot compound the grace once it is spent', () => {
    const spent = member(101, {
      deepLifePlusLastGemClaim: D1,
      deepLifePlusLastGemClaimWeek: 101,
      deepLifePlusLastMemberClaimWeek: 101,
    });
    // Every future calendar day passes the day-key and epoch guards (a scrub only
    // moves them forward); the game-week gate is what refuses.
    for (const day of ['2026-07-22', '2026-08-01', '2027-01-01']) {
      expect(canClaimDailyGems(spent, day)).toBe(false);
      expect(claimDailyGems(spent, day)).toBe(spent);
    }
  });

  it('claims again once a game week is actually played', () => {
    const spent = member(101, {
      deepLifePlusLastGemClaim: D1,
      deepLifePlusLastGemClaimWeek: 101,
      deepLifePlusLastMemberClaimWeek: 101,
    });
    const played = { ...spent, weeksLived: 102 };
    expect(canClaimDailyGems(played, D2)).toBe(true);
    const next = claimDailyGems(played, D2);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(next.settings.deepLifePlusLastGemClaimWeek).toBe(102);
    // Play-backed → the grace is re-armed at the new week, not spent.
    expect(next.settings.deepLifePlusLastMemberClaimWeek).toBe(101);
    // …and it can then be spent once on the next quiet day.
    expect(canClaimDailyGems(next, D3)).toBe(true);
    expect(canClaimDailyGems(claimDailyGems(next, D3), '2026-07-24')).toBe(false);
  });

  it('a REWOUND clock is still refused by the existing day-key / epoch guards', () => {
    const claimed = member(105, {
      deepLifePlusLastGemClaim: D3,
      deepLifePlusLastGemClaimAt: Date.parse('2026-07-23T12:00:00Z'),
      deepLifePlusLastGemClaimWeek: 100, // a week HAS been played — not the blocker
    });
    // Same day, and an earlier day: both refused regardless of the grace.
    expect(canClaimDailyGems(claimed, D3, Date.parse('2026-07-23T13:00:00Z'))).toBe(false);
    expect(canClaimDailyGems(claimed, D2, Date.parse('2026-07-22T12:00:00Z'))).toBe(false);
  });

  it('the FREE tier is untouched by the grace — every claim must be play-backed', () => {
    const free = createTestGameState({
      stats: { gems: 0 },
      weeksLived: 100,
      settings: { deepLifePlusLastGemClaim: D1, deepLifePlusLastGemClaimWeek: 100 },
    });
    expect(canClaimDailyGems(free, D2)).toBe(false); // no grace for free players
    expect(claimDailyGems(free, D2)).toBe(free);
    // A free claim never writes the member marker.
    const played = claimDailyGems({ ...free, weeksLived: 101 }, D2);
    expect(played.stats.gems).toBe(DAILY_GEMS_BASE);
    expect(played.settings.deepLifePlusLastMemberClaimWeek).toBeUndefined();
  });

  it('isPlayBackedGemClaim: undefined marker is NOT play-backed (first claim spends the grace)', () => {
    expect(isPlayBackedGemClaim(100, undefined)).toBe(false);
    expect(isPlayBackedGemClaim(100, 100)).toBe(false);
    expect(isPlayBackedGemClaim(101, 100)).toBe(true);
    expect(isPlayBackedGemClaim(undefined, 0)).toBe(false);
    expect(isPlayBackedGemClaim(100, NaN)).toBe(false); // garbage marker never blocks
  });
});

describe('claimDailyGems — anti-clock-manipulation (monotonic high-water mark)', () => {
  const TODAY = '2026-07-23';
  const YESTERDAY = '2026-07-22';
  const DAY_MS = 86_400_000;
  const NOW = Date.parse(`${TODAY}T09:00:00.000Z`); // a plausible claim time today
  const member = (over: Partial<GameSettings> = {}): GameState =>
    createTestGameState({ stats: { gems: 0 }, settings: { deepLifePlusActivated: true, ...over } });

  it('stamps a monotonic epoch high-water mark on claim', () => {
    const next = claimDailyGems(member(), TODAY, NOW);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(next.settings.deepLifePlusLastGemClaimAt).toBe(NOW);
  });

  it('REJECTS a claim when the clock is rolled backward below the last-claim mark', () => {
    // Claimed today at NOW; attacker sets the device clock back a full day and
    // uses the (now different) yesterday key to try to reclaim.
    const claimed = member({ deepLifePlusLastGemClaim: TODAY, deepLifePlusLastGemClaimAt: NOW });
    const rewound = NOW - DAY_MS;
    expect(canClaimDailyGems(claimed, YESTERDAY, rewound)).toBe(false);
    expect(claimDailyGems(claimed, YESTERDAY, rewound)).toBe(claimed); // no gems minted
  });

  it('does not move the mark backward — max(previous, now) wins', () => {
    // A legit new-day claim whose wall clock is (implausibly) a touch behind the
    // stored mark must not lower the high-water mark.
    const s = member({ deepLifePlusLastGemClaim: YESTERDAY, deepLifePlusLastGemClaimAt: NOW });
    const slightlyBack = NOW - 60_000; // 1 min behind, inside the skew tolerance
    const next = claimDailyGems(s, TODAY, slightlyBack);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS); // tolerated, still claimable
    expect(next.settings.deepLifePlusLastGemClaimAt).toBe(NOW); // mark never decreases
  });

  it('allows the next legit claim once real time passes the mark', () => {
    const s = member({ deepLifePlusLastGemClaim: YESTERDAY, deepLifePlusLastGemClaimAt: NOW });
    const tomorrow = NOW + DAY_MS;
    expect(canClaimDailyGems(s, TODAY, tomorrow)).toBe(true);
    expect(claimDailyGems(s, TODAY, tomorrow).settings.deepLifePlusLastGemClaimAt).toBe(tomorrow);
  });

  it('stays backward-compatible with legacy 2-arg callers (guard skipped, no mark written)', () => {
    const next = claimDailyGems(member(), TODAY); // no nowMs
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    expect(next.settings.deepLifePlusLastGemClaimAt).toBeUndefined();
  });

  it('BLOCKS the alternating-adjacent-day farm across a midnight boundary', () => {
    // The gap a pure epoch+tolerance guard missed: claim 23:59, cross midnight and
    // claim 00:02 (3 min later — inside the 5-min skew tolerance), then rewind to
    // 23:59 and reclaim yesterday's key, forever. Strict day-key monotonicity must
    // refuse any key that isn't strictly later than the last claimed day.
    const d23_2359 = Date.parse(`${YESTERDAY}T23:59:00.000Z`);
    const d24_0002 = Date.parse(`${TODAY}T00:02:00.000Z`);
    // Claim yesterday 23:59, then today 00:02 — both legit, strictly increasing.
    const afterY = claimDailyGems(member(), YESTERDAY, d23_2359);
    expect(afterY.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
    // Play a game week between the two days: this test is about the DAY-KEY
    // guard, and the v45 member grace allows only ONE claim not backed by play
    // (the first one, above), which would otherwise settle day two here.
    const afterT = claimDailyGems({ ...afterY, weeksLived: afterY.weeksLived + 1 }, TODAY, d24_0002);
    expect(afterT.stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS * 2); // two legit days
    expect(afterT.settings.deepLifePlusLastGemClaim).toBe(TODAY);
    // Now rewind to 23:59 and try to reclaim YESTERDAY's key — must be refused
    // (YESTERDAY is not strictly later than the stored TODAY), so no gems mint.
    expect(canClaimDailyGems(afterT, YESTERDAY, d23_2359)).toBe(false);
    expect(claimDailyGems(afterT, YESTERDAY, d23_2359)).toBe(afterT);
    // And re-claiming TODAY is still the same-day no-op.
    expect(canClaimDailyGems(afterT, TODAY, d24_0002)).toBe(false);
  });

  it('CTA tolerance matches the reducer: a sub-tolerance rewind on a new day still claimable', () => {
    // A benign 1-min NTP backward nudge on an otherwise-new day must NOT be
    // treated as settled by the UI predicate (shared with the reducer).
    const s = member({ deepLifePlusLastGemClaim: YESTERDAY, deepLifePlusLastGemClaimAt: NOW });
    const oneMinBack = NOW - 60_000;
    expect(canClaimDailyGemsFor(YESTERDAY, NOW, TODAY, oneMinBack)).toBe(true);
    expect(claimDailyGems(s, TODAY, oneMinBack).stats.gems).toBe(DEEP_LIFE_PLUS_DAILY_GEMS);
  });
});

describe('memberUpgradeCost (DeepLife+ discount on gem-spend upgrades)', () => {
  const member = { deepLifePlusActivated: true };
  const lifer = { lifetimePremium: true };

  it('charges free players the full price', () => {
    expect(memberUpgradeCost(5000, {})).toBe(5000);
    expect(memberUpgradeCost(5000, undefined)).toBe(5000);
  });

  it('gives members the configured discount', () => {
    const expected = Math.round(5000 * (1 - DEEP_LIFE_PLUS_UPGRADE_DISCOUNT));
    expect(memberUpgradeCost(5000, member)).toBe(expected);
    expect(memberUpgradeCost(5000, lifer)).toBe(expected);
    expect(expected).toBeLessThan(5000);
  });

  it('never returns below 1 and sanitizes a garbage base', () => {
    expect(memberUpgradeCost(0, member)).toBe(0);
    expect(memberUpgradeCost(-100, member)).toBe(0);
    expect(memberUpgradeCost(Number.NaN, member)).toBe(0);
  });
});

describe('deepLifePlusWeekKeys / weekKeysForDayKey', () => {
  it('returns 7 Mon→Sun keys and agrees with the day-key variant', () => {
    const now = new Date('2026-07-23T12:00:00Z'); // a Thursday
    const fromDate = deepLifePlusWeekKeys(now);
    expect(fromDate).toHaveLength(7);
    expect(fromDate[0] < fromDate[6]).toBe(true); // Monday first, sorted ascending
    expect(weekKeysForDayKey('2026-07-23')).toEqual(fromDate);
  });

  it('returns [] for a malformed day key', () => {
    expect(weekKeysForDayKey('not-a-date')).toEqual([]);
  });

  it('isPerfectDeepLifePlusWeek is true only when all 7 days are claimed', () => {
    const now = new Date('2026-07-23T12:00:00Z');
    const keys = deepLifePlusWeekKeys(now);
    expect(isPerfectDeepLifePlusWeek(keys, now)).toBe(true);
    expect(isPerfectDeepLifePlusWeek(keys.slice(0, 6), now)).toBe(false);
    expect(isPerfectDeepLifePlusWeek([], now)).toBe(false);
  });
});

describe('buildDeepLifePlusWeekStatus (Mon→Sun streak strip)', () => {
  // Weekday-independent: derive the actual week keys from the function's own
  // output so the assertions hold whatever calendar day `now` lands on.
  const now = new Date('2026-07-26T12:00:00Z');
  const today = utcDayKey(now);
  const weekKeys = buildDeepLifePlusWeekStatus([], now).map((c) => c.key);
  const pastKeys = weekKeys.filter((k) => k < today);
  const futureKeys = weekKeys.filter((k) => k > today);

  it('returns Mon→Sun cells', () => {
    const cells = buildDeepLifePlusWeekStatus([], now);
    expect(cells).toHaveLength(7);
    expect(cells.map((c) => c.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('with no claims: today is "today", past days are "inactive", future is "future"', () => {
    const s = Object.fromEntries(buildDeepLifePlusWeekStatus([], now).map((c) => [c.key, c.status]));
    expect(s[today]).toBe('today');
    pastKeys.forEach((k) => expect(s[k]).toBe('inactive'));
    futureKeys.forEach((k) => expect(s[k]).toBe('future'));
  });

  it('marks claimed days green and skipped days (after the first claim) as missed', () => {
    if (pastKeys.length < 2) return; // guard: needs at least two past days
    const claim = [pastKeys[0], today];
    const s = Object.fromEntries(buildDeepLifePlusWeekStatus(claim, now).map((c) => [c.key, c.status]));
    expect(s[pastKeys[0]]).toBe('claimed');
    expect(s[today]).toBe('claimed');
    pastKeys.slice(1).forEach((k) => expect(s[k]).toBe('missed'));
  });

  it('never shows a red cross before the first-ever claim (inactive, not missed)', () => {
    if (pastKeys.length < 2) return;
    // First claim is the LAST past day → every earlier past day is pre-membership.
    const s = Object.fromEntries(
      buildDeepLifePlusWeekStatus([pastKeys[pastKeys.length - 1]], now).map((c) => [c.key, c.status]),
    );
    pastKeys.slice(0, -1).forEach((k) => expect(s[k]).toBe('inactive'));
  });
});

describe('reconcileSubscriptionBenefits', () => {
  it('applies benefits while the subscription is active', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const next = reconcileSubscriptionBenefits(s, /*plusActive*/ true, /*ownsRemoveAds*/ false);
    expect(next.settings.adsRemoved).toBe(true);
    expect(next.settings.deepLifePlusActivated).toBe(true);
    expect(next.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS);
  });

  it('reverts DeepLife+ ad-free when the subscription lapses', () => {
    // Simulate a previously-active subscriber.
    const active = applyDeepLifePlusBenefits(createTestGameState());
    expect(active.settings.adsRemoved).toBe(true);

    const lapsed = reconcileSubscriptionBenefits(active, /*plusActive*/ false, /*ownsRemoveAds*/ false);
    expect(lapsed.settings.adsRemoved).toBe(false);
    expect(lapsed.settings.deepLifePlusActivated).toBe(false);
  });

  it('KEEPS ad-free on lapse if the permanent Remove Ads IAP is owned', () => {
    const active = applyDeepLifePlusBenefits(createTestGameState());
    const lapsed = reconcileSubscriptionBenefits(active, /*plusActive*/ false, /*ownsRemoveAds*/ true);
    expect(lapsed.settings.adsRemoved).toBe(true); // protected by the permanent IAP
    expect(lapsed.settings.deepLifePlusActivated).toBe(false);
  });

  it('is a no-op for a free user who never had DeepLife+', () => {
    const s = createTestGameState();
    const next = reconcileSubscriptionBenefits(s, false, false);
    expect(next).toBe(s);
  });

  it('does not re-grant welcome gems on repeated active reconciles', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const once = reconcileSubscriptionBenefits(s, true, false);
    const twice = reconcileSubscriptionBenefits(once, true, false);
    expect(twice.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // not doubled
  });

  it('does NOT re-grant welcome gems across a lapse + resubscribe (sticky flag)', () => {
    const s = createTestGameState({ stats: { gems: 0 } });
    const subscribed = reconcileSubscriptionBenefits(s, true, false); // +500, welcomeClaimed
    const lapsed = reconcileSubscriptionBenefits(subscribed, false, false); // ads back, activated cleared
    expect(lapsed.settings.deepLifePlusWelcomeClaimed).toBe(true); // sticky persists
    const resubscribed = reconcileSubscriptionBenefits(lapsed, true, false);
    expect(resubscribed.stats.gems).toBe(DEEP_LIFE_PLUS_WELCOME_GEMS); // still a single grant
    expect(resubscribed.settings.adsRemoved).toBe(true);
  });
});
