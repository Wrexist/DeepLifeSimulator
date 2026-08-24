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

const {
  FLOORS,
  GOALS,
  CURRENT,
  BIG_STAKES_THRESHOLD,
  TRIVIAL_THRESHOLD,
  INERT_EVENT_CEILING,
  measureContentQuality,
} = ratchet;

describe('content-quality ratchet', () => {
  const actual = measureContentQuality();

  it('measures a corpus that actually exists', () => {
    expect(actual.fileCount).toBeGreaterThan(10);
    expect(actual.effectCount).toBeGreaterThan(300);
  });

  it('every metric is at or above its floor', () => {
    expect(actual.soloHappinessMedian).toBeGreaterThanOrEqual(FLOORS.soloHappinessMedian);
    expect(actual.medianAbsHappiness).toBeGreaterThanOrEqual(FLOORS.medianAbsHappiness);
    expect(actual.bigStakesShare).toBeGreaterThanOrEqual(FLOORS.bigStakesShare);
    expect(actual.cliffhangerBadShare).toBeGreaterThanOrEqual(FLOORS.cliffhangerBadShare);
  });

  it('no floor has drifted slack - each stays close to what is measured', () => {
    // A floor far below reality would pass while the corpus quietly degraded.
    expect(actual.bigStakesShare - FLOORS.bigStakesShare).toBeLessThan(0.05);
    expect(actual.cliffhangerBadShare - FLOORS.cliffhangerBadShare).toBeLessThan(0.15);
    expect(actual.medianAbsHappiness - FLOORS.medianAbsHappiness).toBeLessThan(6);
  });

  it('records where the corpus actually stands, so CURRENT cannot go stale', () => {
    expect(actual.cliffhangerBadShare).toBeCloseTo(CURRENT.cliffhangerBadShare, 2);
    expect(actual.medianAbsHappiness).toBe(CURRENT.medianAbsHappiness);
  });

  it('keeps every goal above its floor - a goal at the floor is not a goal', () => {
    expect(GOALS.bigStakesShare).toBeGreaterThan(FLOORS.bigStakesShare);
    expect(GOALS.cliffhangerBadShare).toBeGreaterThanOrEqual(FLOORS.cliffhangerBadShare);
  });

  it('states NO target for the all-outcomes median, rather than a fake one', () => {
    // It was 15, and 15 was wrong: 78% of these outcomes also move money,
    // relationship or health, so driving happiness up would have inflated
    // events that already land hard. A metric kept only to catch regressions
    // must not carry an ambition it cannot justify.
    expect(GOALS.medianAbsHappiness).toBeNull();
  });

  it('states NO target for the happiness-only median either, for a sharper reason', () => {
    // This one carried a goal of 10 for a single day. Retired because it was
    // unreachable by the work it implied (see the next test) AND because the
    // population it targeted is mostly correct as authored: half of the trivial
    // happiness-only outcomes are the DECLINE branch of a real choice, where
    // small is the right number. The FLOOR is untouched — the regression
    // protection was never the problem.
    expect(GOALS.soloHappinessMedian).toBeNull();
    expect(FLOORS.soloHappinessMedian).toBe(CURRENT.soloHappinessMedian);
  });

  it('proves the retired goal of 10 was unreachable without overruling the flavour file', () => {
    // The claim in the ratchet header, checked rather than asserted. Simulate
    // the most thorough pass anyone could honestly make — every trivial
    // happiness-only outcome raised to 10, EXCEPT the ones `nearMissEvents.ts`
    // documents as deliberately consequence-free — and the median still lands
    // at 8, because the distribution's mass sits at exactly 5 and 8.
    //
    // Reaching 10 needs the flavour file retuned too, which is the whole
    // argument: the goal could only be met by overruling a documented authoring
    // decision to move a statistic. That is not content work, it is scoreboard
    // work, and it is what the ratchet exists to prevent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const files: string[] = ratchet.listContentFiles();
    const OTHER = /(money|moneyPct|relationship|health|energy|fitness|reputation|approvalRating):/;
    const perfect: number[] = [];
    for (const file of files) {
      const isFlavour = path.basename(file) === 'nearMissEvents.ts';
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(
        /effects:\s*\{([\s\S]{0,300}?)\}\s*,?\s*(?:karma|special|\}|\n\s*\})/g
      )) {
        const body = m[1];
        const h = body.match(/happiness:\s*(-?\d+)/);
        if (!h || OTHER.test(body)) continue;
        const v = Math.abs(Number(h[1]));
        perfect.push(!isFlavour && v < TRIVIAL_THRESHOLD ? 10 : v);
      }
    }
    expect(ratchet.median(perfect)).toBe(8);
  });

  it('measures the happiness-only subset separately, and it is the smaller set', () => {
    expect(actual.soloHappinessCount).toBeGreaterThan(0);
    expect(actual.soloHappinessCount).toBeLessThan(actual.effectCount);
  });
});

describe('inert events - the metric that replaced the happiness-only goal', () => {
  const actual = measureContentQuality();

  it('scans a real population of multi-choice events', () => {
    expect(actual.multiChoiceEventCount).toBeGreaterThan(100);
  });

  it('stays at or below the ceiling - this one ratchets DOWN', () => {
    expect(actual.inertEventShare).toBeLessThanOrEqual(INERT_EVENT_CEILING);
  });

  it('keeps the ceiling close to measured, so it cannot go slack', () => {
    // Symmetric to the floor-drift test above, inverted: a ceiling far ABOVE
    // reality would pass while inert events accumulated underneath it.
    expect(INERT_EVENT_CEILING - actual.inertEventShare).toBeLessThan(0.01);
  });

  it('names its offenders rather than reporting a bare percentage', () => {
    // A share with no ids is a number nobody can act on. Every inert event must
    // be nameable, which is also what makes the count auditable by hand.
    expect(actual.inertEventIds).toHaveLength(actual.inertEventCount);
  });

  it('finds the corpus overwhelmingly made of real decisions', () => {
    // The finding that retired the median goal: 233 of 235 multi-choice events
    // already have at least one branch that moves something. If this ever drops
    // sharply, the content genuinely regressed and the ceiling will say so.
    const withStakes = actual.multiChoiceEventCount - actual.inertEventCount;
    expect(withStakes / actual.multiChoiceEventCount).toBeGreaterThan(0.95);
  });

  it('targets zero, and zero is reachable - unlike the goal it replaced', () => {
    expect(GOALS.inertEventShare).toBe(0);
    // Both known offenders are in the file that documents itself as flavour, so
    // clearing them is a content decision someone can actually make.
    expect(actual.inertEventIds.every((id: string) => id.startsWith('near_miss_'))).toBe(true);
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
