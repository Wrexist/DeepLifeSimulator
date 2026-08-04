/**
 * The lint ratchet's decision logic.
 *
 * `npm run lint:errors` runs with `--quiet`, so it has always passed regardless
 * of the 1 234 warnings behind it — including 255 violations of this project's
 * OWN hard rules (`no-restricted-syntax`, CLAUDE.md §5) and 102
 * `react-hooks/exhaustive-deps` in an app with documented stale-closure bugs.
 *
 * Tested here rather than by running eslint, for the same reason the coverage
 * ratchet is: a gate whose logic needs a two-minute lint pass to verify is a
 * gate nobody verifies.
 */
import { MAX_ERRORS, MAX_WARNINGS, evaluateLint } from '../lib/lintRatchet';

describe('evaluateLint', () => {
  it('passes at exactly the ceiling', () => {
    expect(evaluateLint({ errorCount: 0, warningCount: MAX_WARNINGS }).ok).toBe(true);
  });

  it('fails when warnings rise above the ceiling', () => {
    const r = evaluateLint({ errorCount: 0, warningCount: MAX_WARNINGS + 1 });
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/do not raise the ceiling/i);
  });

  it('fails on any error, ratchet or not', () => {
    expect(evaluateLint({ errorCount: 1, warningCount: 0 }).ok).toBe(false);
  });

  it('passes when the backlog shrinks, and says so', () => {
    const r = evaluateLint({ errorCount: 0, warningCount: MAX_WARNINGS - 500 });
    expect(r.ok).toBe(true);
    expect(r.improved).toBe(true);
  });

  it('treats an unreadable report as a failure, not a pass', () => {
    // A crashed lint run must never read like a clean one — the same reasoning
    // as the coverage runner's missing-summary branch.
    expect(evaluateLint({ errorCount: NaN, warningCount: 0 }).ok).toBe(false);
    expect(evaluateLint(undefined as never).ok).toBe(false);
  });

  it('keeps the error limit at zero', () => {
    // Guards against someone "ratcheting" errors the way warnings are ratcheted.
    // Warnings are a backlog; errors are a broken build.
    expect(MAX_ERRORS).toBe(0);
  });
});
