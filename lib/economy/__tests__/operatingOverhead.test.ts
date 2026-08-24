/**
 * Operating overhead — the passive-income soft cap, made legible.
 *
 * Above $10M net worth, total passive income is silently multiplied by
 * `0.9^floor((netWorth - 10M) / 10M)`, floored at 25%. At $150M a $238k/wk
 * empire pays $59.5k/wk. The mechanic is defensible; being invisible is not —
 * and $10M is also the PRESTIGE THRESHOLD, so the economy starts throttling at
 * exactly the number where the game congratulates the player.
 *
 * This suite pins two things: the reporting helper agrees with the math that is
 * actually charged (they now share one implementation, which is the point), and
 * the refactor that unified them changed no behaviour.
 */

import {
  passiveIncomeEfficiency,
  getOperatingOverhead,
  PASSIVE_SOFT_CAP_THRESHOLD,
  PASSIVE_SOFT_CAP_FLOOR,
  managementLevels,
  MAX_MANAGEMENT_FLOOR_GAIN,
} from '@/lib/economy/passiveIncome';

/** The original inline implementation, kept as the behavioural oracle. */
function legacyEfficiency(netWorth: number): number {
  if (netWorth <= 10_000_000) return 1;
  const increments = Math.floor((netWorth - 10_000_000) / 10_000_000);
  const raw = Math.pow(0.9, increments);
  return Math.max(0.25, raw);
}

describe('efficiency curve', () => {
  it('is a no-op at or below the threshold', () => {
    for (const worth of [0, 1_000, 9_999_999, PASSIVE_SOFT_CAP_THRESHOLD]) {
      expect(`${worth}:${passiveIncomeEfficiency(worth)}`).toBe(`${worth}:1`);
    }
  });

  it('matches the documented steps', () => {
    expect(passiveIncomeEfficiency(20_000_000)).toBeCloseTo(0.9, 5);
    expect(passiveIncomeEfficiency(30_000_000)).toBeCloseTo(0.81, 5);
    expect(passiveIncomeEfficiency(40_000_000)).toBeCloseTo(0.729, 5);
  });

  it('never falls below the floor, however rich', () => {
    for (const worth of [1e9, 1e12, 1e15]) {
      expect(passiveIncomeEfficiency(worth)).toBe(PASSIVE_SOFT_CAP_FLOOR);
    }
  });

  it('is monotonically non-increasing in net worth', () => {
    let prev = Infinity;
    for (let worth = 0; worth <= 300_000_000; worth += 5_000_000) {
      const e = passiveIncomeEfficiency(worth);
      expect(`${worth}:${e <= prev}`).toBe(`${worth}:true`);
      prev = e;
    }
  });

  it('reproduces the ORIGINAL inline math exactly - the refactor is behaviour-preserving', () => {
    // This is the assertion that made the refactor safe to land: the helper the
    // readout uses and the multiplier that is charged are now one function, and
    // that function still does what the inline code did.
    for (let worth = 0; worth <= 500_000_000; worth += 2_500_000) {
      expect(`${worth}:${passiveIncomeEfficiency(worth)}`)
        .toBe(`${worth}:${legacyEfficiency(worth)}`);
    }
  });

  it('treats corrupt net worth as zero rather than NaN', () => {
    for (const bad of [NaN, Infinity, -5, undefined, null]) {
      const e = passiveIncomeEfficiency(bad as number);
      expect(`${String(bad)}:${Number.isFinite(e) && e > 0}`).toBe(`${String(bad)}:true`);
    }
  });
});

describe('reporting the drag as a weekly cost', () => {
  it('reports nothing below the threshold', () => {
    const o = getOperatingOverhead(50_000, 5_000_000);
    expect(o.active).toBe(false);
    expect(o.weeklyCost).toBe(0);
    expect(o.efficiency).toBe(1);
  });

  it('reports the dollars actually lost', () => {
    // 90% efficiency at $20M, so a $100k gross loses $10k.
    const o = getOperatingOverhead(100_000, 20_000_000);
    expect(o.active).toBe(true);
    expect(o.weeklyCost).toBe(10_000);
  });

  it('the reported cost reconciles with the applied multiplier', () => {
    // gross - cost must equal gross * efficiency, or the readout is lying.
    for (const worth of [15_000_000, 50_000_000, 150_000_000, 1_000_000_000]) {
      const gross = 238_000;
      const o = getOperatingOverhead(gross, worth);
      expect(`${worth}:${gross - o.weeklyCost}`).toBe(`${worth}:${Math.round(gross * o.efficiency)}`);
    }
  });

  it('is inactive when there is no passive income to drag', () => {
    const o = getOperatingOverhead(0, 500_000_000);
    expect(o.active).toBe(false);
    expect(o.weeklyCost).toBe(0);
  });

  it('handles corrupt gross figures without producing NaN', () => {
    for (const bad of [NaN, Infinity, -100, undefined, null]) {
      const o = getOperatingOverhead(bad as number, 50_000_000);
      expect(`${String(bad)}:${Number.isFinite(o.weeklyCost)}`).toBe(`${String(bad)}:true`);
    }
  });

  it('shows the audit example: a $238k empire at $150M', () => {
    // The figure from the economy audit, now something a player could be told.
    const o = getOperatingOverhead(238_000, 150_000_000);
    expect(o.active).toBe(true);
    expect(o.weeklyCost).toBeGreaterThan(150_000);
  });
});

describe('the management ladder - the drag becomes a decision', () => {
  it('changes nothing for a player who has bought none', () => {
    // The property that made this safe to land: default 0 managers reproduces
    // the previous curve exactly.
    for (let worth = 0; worth <= 300_000_000; worth += 10_000_000) {
      expect(`${worth}:${passiveIncomeEfficiency(worth, 0)}`)
        .toBe(`${worth}:${passiveIncomeEfficiency(worth)}`);
    }
  });

  it('raises the floor, not the whole curve', () => {
    // Just above the threshold the decay has not reached the floor, so
    // management must NOT help there - otherwise it is a flat income buff.
    expect(passiveIncomeEfficiency(20_000_000, 10)).toBeCloseTo(
      passiveIncomeEfficiency(20_000_000, 0), 5
    );
    // Deep in the floor it does help.
    expect(passiveIncomeEfficiency(500_000_000, 10)).toBeGreaterThan(
      passiveIncomeEfficiency(500_000_000, 0)
    );
  });

  it('is bounded - full management never removes the cap', () => {
    const best = passiveIncomeEfficiency(1e12, 999);
    expect(best).toBe(PASSIVE_SOFT_CAP_FLOOR + MAX_MANAGEMENT_FLOOR_GAIN);
    // A whale with everything still loses more than half their passive income.
    expect(best).toBeLessThan(0.5);
  });

  it('reads levels off the existing upgrades array - no new stored field', () => {
    const companies = [
      { upgrades: [{ id: 'ops_management', level: 3 }, { id: 'machinery', level: 5 }] },
      { upgrades: [{ id: 'ops_management', level: 2 }] },
      { upgrades: [] },
    ];
    expect(managementLevels(companies)).toBe(5);
  });

  it('does not confuse the pre-existing realestate `management` upgrade', () => {
    // realestate already shipped an income upgrade with id 'management'.
    // Counting it would hand overhead relief to a player who bought a
    // completely different thing.
    expect(managementLevels([{ upgrades: [{ id: 'management', level: 3 }] }])).toBe(0);
  });

  it('survives missing or corrupt company data', () => {
    for (const bad of [undefined, null, [], [null], [{}], [{ upgrades: null }]]) {
      expect(`${JSON.stringify(bad)}:${managementLevels(bad as never)}`)
        .toBe(`${JSON.stringify(bad)}:0`);
    }
    expect(managementLevels([{ upgrades: [{ id: 'ops_management', level: NaN }] }])).toBe(0);
  });

  it('the reported cost still reconciles once management is owned', () => {
    const o = getOperatingOverhead(238_000, 500_000_000, 10);
    expect(238_000 - o.weeklyCost).toBe(Math.round(238_000 * o.efficiency));
  });
});
