/**
 * Wealth-scaled event money.
 *
 * ~400 event templates, every money effect a flat figure capped at ±$150,000,
 * so a "$200 unexpected bill" fires unchanged at $200M net worth. The best
 * content volume in the repo becomes rounding noise exactly when the player has
 * the most time to read it.
 *
 * The two properties that matter: it is a NO-OP for every template that has not
 * opted in, and a mis-authored percentage cannot wipe a player out.
 */

import fs from 'fs';
import path from 'path';
import {
  resolveEventMoney,
  isScaledMoneyEffect,
  MAX_EVENT_NET_WORTH_FRACTION,
  MAX_EVENT_MONEY,
} from '@/lib/events/moneyScaling';

describe('backwards compatibility — the property that lets this ship', () => {
  it('returns the flat figure unchanged when no moneyPct is declared', () => {
    for (const money of [200, -75, 150_000, -150_000, 0]) {
      expect(`${money}:${resolveEventMoney({ money }, 250_000_000)}`).toBe(`${money}:${money}`);
    }
  });

  it('is unaffected by net worth for a flat effect', () => {
    for (const worth of [0, 1_000, 200_000_000]) {
      expect(resolveEventMoney({ money: -200 }, worth)).toBe(-200);
    }
  });

  it('treats a missing, null or empty effect as zero rather than NaN', () => {
    for (const bad of [undefined, null, {}]) {
      expect(`${JSON.stringify(bad)}:${resolveEventMoney(bad, 1_000)}`)
        .toBe(`${JSON.stringify(bad)}:0`);
    }
  });

  it('no shipped template declares moneyPct yet, so nothing changes today', () => {
    // The claim the rest of this change rests on. If a template opts in later
    // this test is simply updated — but it must be a deliberate act.
    const engine = fs.readFileSync(
      path.join(__dirname, '../engine.ts'),
      'utf8'
    );
    // The type definition mentions it; no template literal should.
    const templateUses = engine.match(/moneyPct:\s*-?[0-9.]/g) ?? [];
    expect(templateUses).toEqual([]);
  });
});

describe('scaling', () => {
  it('uses the percentage once it exceeds the flat floor', () => {
    // 1% of $10M = $100,000, which beats the $200 floor.
    expect(resolveEventMoney({ money: -200, moneyPct: -0.01 }, 10_000_000)).toBe(-100_000);
  });

  it('keeps the flat figure when it is larger — money is a FLOOR', () => {
    // 1% of $1,000 = $10, so the authored $200 wins.
    expect(resolveEventMoney({ money: -200, moneyPct: -0.01 }, 1_000)).toBe(-200);
  });

  it('takes its sign from the flat figure', () => {
    expect(resolveEventMoney({ money: -200, moneyPct: 0.01 }, 10_000_000)).toBeLessThan(0);
    expect(resolveEventMoney({ money: 200, moneyPct: 0.01 }, 10_000_000)).toBeGreaterThan(0);
  });

  it('takes its sign from moneyPct for a purely proportional effect', () => {
    expect(resolveEventMoney({ moneyPct: -0.01 }, 10_000_000)).toBe(-100_000);
    expect(resolveEventMoney({ moneyPct: 0.01 }, 10_000_000)).toBe(100_000);
  });

  it('scales with the player rather than staying flat', () => {
    const poor = Math.abs(resolveEventMoney({ money: -200, moneyPct: -0.01 }, 100_000));
    const rich = Math.abs(resolveEventMoney({ money: -200, moneyPct: -0.01 }, 100_000_000));
    expect(rich).toBeGreaterThan(poor * 100);
  });
});

describe('the caps — how a wealth event stops feeling like a bug', () => {
  it('bounds any single event to a fraction of net worth', () => {
    const worth = 100_000_000;
    // A mis-authored 90% must not wipe the player out.
    const resolved = Math.abs(resolveEventMoney({ moneyPct: -0.9 }, worth));
    expect(resolved).toBeLessThanOrEqual(worth * MAX_EVENT_NET_WORTH_FRACTION);
  });

  it('bounds the absolute figure however rich the player is', () => {
    const resolved = Math.abs(resolveEventMoney({ moneyPct: -0.05 }, 10_000_000_000));
    expect(resolved).toBeLessThanOrEqual(MAX_EVENT_MONEY);
  });

  it('the absolute cap sits well above every authored flat figure', () => {
    // Otherwise the cap would start clamping ordinary events.
    expect(MAX_EVENT_MONEY).toBeGreaterThan(150_000 * 10);
  });

  it('survives corrupt inputs rather than returning NaN or Infinity', () => {
    for (const worth of [NaN, Infinity, -5, undefined, null]) {
      const r = resolveEventMoney({ money: -200, moneyPct: -0.01 }, worth as number);
      expect(`${String(worth)}:${Number.isFinite(r)}`).toBe(`${String(worth)}:true`);
    }
    for (const pct of [NaN, Infinity]) {
      const r = resolveEventMoney({ money: -200, moneyPct: pct }, 1_000_000);
      expect(`${String(pct)}:${Number.isFinite(r)}`).toBe(`${String(pct)}:true`);
    }
  });

  it('always returns a whole number of dollars', () => {
    const r = resolveEventMoney({ moneyPct: -0.0333 }, 1_234_567);
    expect(Number.isInteger(r)).toBe(true);
  });
});

describe('isScaledMoneyEffect', () => {
  it('is false for a flat or absent effect', () => {
    expect(isScaledMoneyEffect({ money: -200 })).toBe(false);
    expect(isScaledMoneyEffect({})).toBe(false);
    expect(isScaledMoneyEffect(undefined)).toBe(false);
  });

  it('is true once a percentage is declared', () => {
    expect(isScaledMoneyEffect({ moneyPct: 0.01 })).toBe(true);
  });
});

describe('the week loop actually uses it', () => {
  // Reachability, again: a scaling helper nothing calls is decoration.
  it('resolveEvent resolves money through the helper', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../../contexts/game/GameActionsContext.tsx'),
      'utf8'
    );
    expect(source).toMatch(/resolveEventMoney\s*\(/);
    // And it must feed the helper real net worth, not the raw cash stat.
    expect(source).toMatch(/resolveEventMoney\(effects, netWorth\(/);
  });
});
