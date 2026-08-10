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
 * The step decision, transcribed from the component. Kept as a local mirror so
 * the ORDER can be exercised directly — the component's own copy is inside a
 * `useMemo` and cannot be imported without a renderer.
 */
function step(o: {
  dismissed: boolean;
  weeksLived: number;
  baseline?: number | null;
  incomeEarned: number;
  hasJob: boolean;
  maxWeeks?: number;
}): string | null {
  const max = o.maxWeeks ?? 8;
  const baseline = o.baseline === undefined ? o.weeksLived : o.baseline;
  if (o.dismissed) return null;
  if (baseline !== null && o.weeksLived - baseline > max) return null;
  if (o.incomeEarned > 0) return 'paid';
  if (!o.hasJob) return 'find-work';
  return 'advance';
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
