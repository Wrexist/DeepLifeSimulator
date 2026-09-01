/**
 * Every priority in the table must have a claimant.
 *
 * WHAT THIS CAUGHT
 * ----------------
 * `INTERRUPTION_PRIORITY` carried `LIFE_MOMENT: 80` and `EVENT_INBOX: 70` from
 * the day it was written, and NOTHING ever claimed either. Both surfaces were
 * suppressed downward by a local `higherModalUp` boolean in
 * `app/(tabs)/_layout.tsx` — the exact hand-rolled, single-file chain the queue
 * exists to replace.
 *
 * That chain works in one direction only. The two surfaces hid everything in
 * their own file, while every surface in a DIFFERENT file was blind to them: an
 * open Life Moment could be covered by the daily reward (50), welcome back (45)
 * or community reward (42) from `home.tsx`, by the premium promo (20), or by
 * the ad orb (10). The modal the player was meant to read, under an upsell.
 *
 * A priority constant with no claimant is a declared intention that nothing
 * implements, and nothing else in the codebase can tell you it is missing —
 * the app compiles, renders, and quietly ignores the ordering. Hence a
 * source-level sweep.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { INTERRUPTION_PRIORITY } from '@/contexts/InterruptionContext';

const ROOT = join(__dirname, '..', '..');

/**
 * Files that claim slots. Listed rather than globbed so that ADDING a claiming
 * file is a deliberate edit here — the sweep should not silently start passing
 * because someone put a claim somewhere unexpected.
 */
const CLAIMANT_FILES = [
  'app/(tabs)/home.tsx',
  'app/(tabs)/_layout.tsx',
  'components/AdRewardOrb.tsx',
  'components/PremiumPassPromo.tsx',
];

/**
 * Priorities deliberately NOT claimed.
 *
 * Death and wedding are root-level modals in `app/_layout.tsx` that gate their
 * own dismissal; `InterruptionContext`'s own docs record that they
 * short-circuit locally, and every claiming surface excludes them by hand.
 * Adding a name here is a decision to be argued for in the comment, not a way
 * to make this test pass.
 */
const DELIBERATELY_UNCLAIMED = new Set(['DEATH', 'WEDDING']);

const claimedSource = CLAIMANT_FILES.map((f) =>
  readFileSync(join(ROOT, f), 'utf8'),
).join('\n');

describe('interruption priorities all have claimants', () => {
  it('reads real claim sites (the control)', () => {
    // Without this, a renamed helper would empty the haystack and every
    // assertion below would pass on a codebase that claims nothing.
    const claims = claimedSource.match(/useInterruptionSlot\(/g) ?? [];
    expect(claims.length).toBeGreaterThanOrEqual(6);
  });

  it('has no priority that nothing claims', () => {
    const unclaimed = Object.keys(INTERRUPTION_PRIORITY).filter(
      (name) =>
        !DELIBERATELY_UNCLAIMED.has(name) &&
        !claimedSource.includes(`INTERRUPTION_PRIORITY.${name}`),
    );
    expect(unclaimed).toEqual([]);
  });

  it('claims the life moment and the event inbox specifically', () => {
    // Named rather than left to the sweep, because these two are the regression
    // this file exists for and a future edit to the table must not quietly drop
    // them along with their constants.
    const tabsLayout = readFileSync(join(ROOT, 'app', '(tabs)', '_layout.tsx'), 'utf8');
    expect(tabsLayout).toContain('INTERRUPTION_PRIORITY.LIFE_MOMENT');
    expect(tabsLayout).toContain('INTERRUPTION_PRIORITY.EVENT_INBOX');
  });

  it('keeps both monetization surfaces below everything the player must act on', () => {
    const mustAct = [
      INTERRUPTION_PRIORITY.DEATH,
      INTERRUPTION_PRIORITY.WEDDING,
      INTERRUPTION_PRIORITY.LIFE_MOMENT,
      INTERRUPTION_PRIORITY.EVENT_INBOX,
      INTERRUPTION_PRIORITY.DAILY_REWARD,
      INTERRUPTION_PRIORITY.WELCOME_BACK,
      INTERRUPTION_PRIORITY.COMMUNITY_REWARD,
    ];
    for (const p of mustAct) {
      expect(INTERRUPTION_PRIORITY.PROMO).toBeLessThan(p);
      expect(INTERRUPTION_PRIORITY.AD_ORB).toBeLessThan(p);
    }
  });
});
