/**
 * The first-session coach must never be out of step with the life.
 *
 * ── What it replaced ──────────────────────────────────────────────────────
 * Driven end to end against the shipped web build, a brand-new player's first
 * three taps produced health 100 → 93 → 86 → 80, happiness 100 → 90 → 79 → 69,
 * and money unchanged at $1,500. Nothing else happened: no income (unemployed),
 * no event, no reward, and no weekly recap — that sheet is gated on something
 * "meaningful" having occurred, and for an unemployed week nothing does.
 *
 * The core loop, as first presented, was "tap to watch numbers fall".
 *
 * The coach fixes that by walking the player into their first wage. Its steps
 * are DERIVED FROM STATE rather than counted, and this suite pins that choice,
 * because a step counter is what allows a tutorial to tell someone to get a job
 * they already have.
 */

import { resolveCoachStep, MAX_COACH_WEEKS } from '@/src/features/onboarding/coachStep';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const src = fs.readFileSync(
  path.join(process.cwd(), 'components', 'FirstSessionCoach.tsx'),
  'utf8'
);
const homeSrc = fs.readFileSync(
  path.join(process.cwd(), 'app', '(tabs)', 'home.tsx'),
  'utf8'
);

/**
 * Thin adapter over the PRODUCTION selector, supplying the defaults each case
 * does not care about.
 *
 * The first version of this file transcribed the decision into a local copy,
 * because the logic lived inside the component's `useMemo` and could not be
 * imported without a renderer. That is a test that pins a copy: the component
 * was free to drift while every assertion here stayed green. The logic now
 * lives in `coachStep.ts` and the component calls the same function.
 */
function step(o: {
  dismissed: boolean;
  weeksLived: number;
  baseline?: number | null;
  incomeEarned: number;
  hasJob: boolean;
  establishedLife?: boolean;
}): string | null {
  return resolveCoachStep({
    dismissed: o.dismissed,
    establishedLife: o.establishedLife ?? false,
    baseline: o.baseline === undefined ? o.weeksLived : o.baseline,
    weeksLived: o.weeksLived,
    incomeEarned: o.incomeEarned,
    hasJob: o.hasJob,
  });
}

describe('the coach always asks for the RIGHT next thing', () => {
  const base = { dismissed: false, weeksLived: 0, incomeEarned: 0, hasJob: false };

  it('opens by pointing an unemployed player at work', () => {
    expect(step(base)).toBe('find-work');
  });

  it('switches to "live a week" the moment they are hired', () => {
    expect(step({ ...base, hasJob: true })).toBe('advance');
  });

  it('never tells a hired player to find a job', () => {
    // The failure a step COUNTER would produce: the player finds the Work tab
    // unaided, gets hired, and the tutorial still says "you need work".
    for (let w = 0; w <= 8; w++) {
      expect(step({ ...base, hasJob: true, weeksLived: w })).not.toBe('find-work');
    }
  });

  it('pays off as soon as money actually arrives', () => {
    expect(step({ ...base, hasJob: true, weeksLived: 2, incomeEarned: 110 })).toBe('paid');
  });

  it('shows the payoff even for a player who never used the coach', () => {
    // Someone who found work on their own still deserves the "that's the loop"
    // moment — it is the reward, not a reward for obedience.
    expect(step({ ...base, hasJob: false, incomeEarned: 60 })).toBe('paid');
  });
});

describe('the coach knows when to leave', () => {
  const base = { dismissed: false, weeksLived: 0, incomeEarned: 0, hasJob: false };

  it('stays silent once dismissed', () => {
    expect(step({ ...base, dismissed: true })).toBeNull();
  });

  it('shows by DEFAULT while the stored flag is still loading', () => {
    // Deliberately the opposite of the first version, which started at
    // "unknown" and hid until storage answered. That shipped broken — the
    // coach never appeared in the running app, because a promise that does not
    // settle leaves the state at unknown forever and unknown meant hide.
    //
    // Optimistic is safe because the week cap below independently stops this
    // reaching any long-running save.
    expect(step({ ...base })).toBe('find-work');
  });

  it('gives up after the week cap rather than nagging for a whole life', () => {
    expect(step({ ...base, baseline: 0, weeksLived: 9 })).toBeNull();
    expect(step({ ...base, baseline: 0, weeksLived: 400 })).toBeNull();
  });

  it('still helps right up to the cap', () => {
    expect(step({ ...base, baseline: 0, weeksLived: 8 })).toBe('find-work');
  });

  it('counts from FIRST SIGHT, not from the absolute life clock', () => {
    // THE BUG THIS EXISTS FOR. `weeksLived` is the absolute counter
    // (CLAUDE.md §4.2) and an age-20 character starts at 104 — so a naive
    // `weeksLived > 8` retired the coach before it ever rendered. It was
    // invisible in the running app while every test here passed, because the
    // tests fed it the small numbers the implementation assumed.
    const age20Start = 104;
    expect(step({ ...base, baseline: age20Start, weeksLived: age20Start })).toBe('find-work');
    expect(step({ ...base, baseline: age20Start, weeksLived: age20Start + 8 })).toBe('find-work');
    expect(step({ ...base, baseline: age20Start, weeksLived: age20Start + 9 })).toBeNull();
  });

  it('shows while the baseline has not been anchored yet', () => {
    // A null baseline means storage has not answered. It must not hide the card
    // — same failure direction as the dismissal flag.
    expect(step({ ...base, baseline: null, weeksLived: 104 })).toBe('find-work');
  });

  it('uses the same cap the component imports', () => {
    // Pins the constant to the shared module rather than to a literal 8, so the
    // window cannot be changed in one place and asserted in another.
    expect(step({ ...base, baseline: 0, weeksLived: MAX_COACH_WEEKS })).not.toBeNull();
    expect(step({ ...base, baseline: 0, weeksLived: MAX_COACH_WEEKS + 1 })).toBeNull();
  });
});

describe('the coach never greets an established player', () => {
  const base = { dismissed: false, weeksLived: 0, incomeEarned: 0, hasJob: false };

  it('stays silent for a life that has already worked', () => {
    // THE UPGRADE BUG. An existing save carries NEITHER coach key, so the
    // dismissal flag is false and the baseline anchors on the current week —
    // which handed eight weeks of first-session guidance to every established
    // player who merely updated the app.
    expect(step({ ...base, establishedLife: true, weeksLived: 400 })).toBeNull();
  });

  it('stays silent even when that player is between jobs', () => {
    // The worst version of it: a retired millionaire told to find their first
    // job. `hasJob: false` is true of a brand-new life AND of a long career
    // that ended, so employment alone cannot tell them apart.
    expect(step({ ...base, establishedLife: true, hasJob: false })).toBeNull();
    expect(step({ ...base, establishedLife: true, hasJob: true, incomeEarned: 5000 })).toBeNull();
  });

  it('still pays off a NEW player the week they are first paid', () => {
    // Why the flag is snapshotted at mount instead of read live: the signal is
    // `totalWeeksWorked`, which flips from 0 the instant the first wage lands.
    // Reading it live would delete the reward for reaching the goal — the one
    // moment the whole card exists to deliver.
    expect(step({ ...base, establishedLife: false, hasJob: true, incomeEarned: 110 })).toBe('paid');
  });
});

describe('it is mounted where it can actually run', () => {
  it('mounts unconditionally, not behind the tutorial flag', () => {
    // `FirstWeekGuide` is gated on `!hasCompletedTutorial`, and driving the
    // shipped build showed it never rendered. The coach must not inherit that.
    expect(homeSrc).toMatch(/<FirstSessionCoach \/>/);
    const at = homeSrc.indexOf('<FirstSessionCoach />');
    const line = homeSrc.slice(homeSrc.lastIndexOf('\n', at), at);
    expect(line).not.toMatch(/hasCompletedTutorial|&&/);
  });
});

describe('animation stays on the native driver', () => {
  it('never animates a property the native driver cannot take', () => {
    // Only opacity and transform are safe. Animating width/height/colour would
    // silently fall back to the JS driver and stutter behind a week tick.
    //
    // COUNTED rather than sliced: the first version tried to grab each
    // `Animated.timing(...)` block with a non-greedy regex, which stopped at
    // the closing paren of `Easing.bezier(...)` and never reached the flag it
    // was checking. It failed against correct code — a check that cannot pass
    // is worse than no check, so this counts declarations instead of parsing.
    const timings = (src.match(/Animated\.timing\(/g) ?? []).length;
    const nativeFlags = (src.match(/useNativeDriver:\s*true/g) ?? []).length;
    expect(timings).toBeGreaterThan(0);
    expect(nativeFlags).toBe(timings);
    expect(src).not.toMatch(/useNativeDriver:\s*false/);
  });

  it('honours reduced motion by SKIPPING, not by shortening', () => {
    // A vestibular trigger is not fixed by making the motion faster.
    expect(src).toMatch(/if \(reduced\)/);
    expect(src).toMatch(/enter\.setValue\(1\)/);
    expect(src).toMatch(/pulse\.setValue\(0\)/);
  });

  it('stops the pulse loop on unmount so it cannot leak', () => {
    expect(src).toMatch(/return \(\) => loop\.stop\(\)/);
  });
});

describe('the component wires the shared selector, not a second copy', () => {
  it('imports the production selector', () => {
    expect(src).toMatch(/resolveCoachStep/);
    expect(src).toMatch(/from '@\/src\/features\/onboarding\/coachStep'/);
  });

  it('snapshots the established-life flag at MOUNT', () => {
    // A lazy `useState` initializer, not a live read — see the payoff test
    // above for why the difference is load-bearing rather than stylistic.
    expect(src).toMatch(/useState\(\(\) => weeksWorked > 0\)/);
  });

  it('logs storage failures instead of swallowing them', () => {
    // Empty catches made "the coach came back" undiagnosable. The fail-OPEN
    // behaviour is deliberate and unchanged; only the silence is gone.
    expect(src).not.toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(src).toMatch(/log\.warn\(/);
  });
});
