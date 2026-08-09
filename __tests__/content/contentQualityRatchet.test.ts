/**
 * Guards the content-quality ratchet itself.
 *
 * Same shape as the coverage-ratchet suite: a ratchet whose floors drift away
 * from reality stops being a gate. If the floors sit far BELOW the measured
 * corpus, the gate has quietly gone slack and would not catch a real slide; if
 * one sits above, the gate is broken and someone will be tempted to "fix" it by
 * lowering it, which is the exact move the ratchet exists to prevent.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ratchet = require('@/scripts/lib/contentQualityRatchet');

const { FLOORS, GOALS, CURRENT, BIG_STAKES_THRESHOLD, measureContentQuality } = ratchet;

describe('content-quality ratchet', () => {
  const actual = measureContentQuality();

  it('measures a corpus that actually exists', () => {
    expect(actual.fileCount).toBeGreaterThan(10);
    expect(actual.effectCount).toBeGreaterThan(300);
  });

  it('every metric is at or above its floor', () => {
    expect(actual.medianAbsHappiness).toBeGreaterThanOrEqual(FLOORS.medianAbsHappiness);
    expect(actual.bigStakesShare).toBeGreaterThanOrEqual(FLOORS.bigStakesShare);
    expect(actual.cliffhangerBadShare).toBeGreaterThanOrEqual(FLOORS.cliffhangerBadShare);
  });

  it('no floor has drifted slack — each stays close to what is measured', () => {
    // A floor far below reality would pass while the corpus quietly degraded.
    expect(actual.bigStakesShare - FLOORS.bigStakesShare).toBeLessThan(0.05);
    expect(actual.cliffhangerBadShare - FLOORS.cliffhangerBadShare).toBeLessThan(0.15);
    expect(actual.medianAbsHappiness - FLOORS.medianAbsHappiness).toBeLessThan(6);
  });

  it('records where the corpus actually stands, so CURRENT cannot go stale', () => {
    expect(actual.cliffhangerBadShare).toBeCloseTo(CURRENT.cliffhangerBadShare, 2);
    expect(actual.medianAbsHappiness).toBe(CURRENT.medianAbsHappiness);
  });

  it('keeps every goal above its floor — a goal at the floor is not a goal', () => {
    expect(GOALS.medianAbsHappiness).toBeGreaterThan(FLOORS.medianAbsHappiness);
    expect(GOALS.bigStakesShare).toBeGreaterThan(FLOORS.bigStakesShare);
    expect(GOALS.cliffhangerBadShare).toBeGreaterThanOrEqual(FLOORS.cliffhangerBadShare);
  });

  it('counts a "big" outcome as one a player could still feel a year later', () => {
    // 20 points on a 0-100 stat, against a tick that decays a few points a week.
    expect(BIG_STAKES_THRESHOLD).toBeGreaterThanOrEqual(15);
  });
});

describe('the cliffhangers that were rewritten stay rewritten', () => {
  // These two were the audit's headline example: a teased affair resolving into
  // an anniversary gift. They are pinned by name because the failure mode is
  // someone "softening" them back rather than deleting them outright.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const src = fs.readFileSync(
    path.join(process.cwd(), 'lib', 'events', 'cliffhangerEvents.ts'),
    'utf8'
  );

  it('no longer resolves the suspicious-phone teaser into a jewellery-store gift', () => {
    expect(src).not.toMatch(/jewelry store about a gift/i);
  });

  it('no longer resolves the distant-partner teaser into a surprise getaway', () => {
    expect(src).not.toMatch(/surprise weekend getaway/i);
  });
});
