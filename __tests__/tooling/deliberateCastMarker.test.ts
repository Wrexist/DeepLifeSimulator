/**
 * The `DELIBERATE-CORRUPTION` opt-out must authorise ONE cast, not a region.
 *
 * `audit:save` enforces Hard Rule #3 by counting `as GameState` in tests. Real
 * corruption fixtures legitimately need that cast — `null` is not assignable to
 * `string[]`, which is exactly what a truncated save carries — so they carry a
 * marker the audit honours.
 *
 * The first implementation scanned a flat 12-line window above the cast. Review
 * on PR #106 caught that this is strictly broader than the per-line opt-out the
 * surrounding comments advertised: one fixture's marker could authorise an
 * unrelated cast that merely sat within twelve lines of it, and the audit would
 * report PASS with an unmarked cast present. A guard quietly weaker than it
 * claims is worse than no guard, because it is trusted.
 *
 * These cases exist so that hole cannot come back. The load-bearing one is
 * "a marker cannot vouch for a cast further down" — it is red against the
 * window implementation and green against the contiguous-block one.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DELIBERATE_MARKER, isDeliberateCast } = require('@/scripts/lib/deliberateCast');

/** 1-based line number of the first line whose text contains `needle`. */
const lineOf = (src: string, needle: string): number =>
  src.split('\n').findIndex((l) => l.includes(needle)) + 1;

describe('a marker authorises the cast it belongs to', () => {
  it('on the cast line itself', () => {
    const src = [
      'const a = 1;',
      `const bad = {} as GameState; // ${DELIBERATE_MARKER}`,
    ].join('\n');

    expect(isDeliberateCast(src, lineOf(src, 'const bad'))).toBe(true);
  });

  it('in the comment block directly above it', () => {
    const src = [
      'const a = 1;',
      `// ${DELIBERATE_MARKER} — a truncated save really carries this.`,
      '// Second line of the same block.',
      'const bad = {} as GameState;',
    ].join('\n');

    expect(isDeliberateCast(src, lineOf(src, 'const bad'))).toBe(true);
  });

  it('inside a JSDoc block directly above it', () => {
    const src = [
      '/**',
      ` * ${DELIBERATE_MARKER} — the reasoning belongs with the fixture.`,
      ' */',
      'const bad = {} as GameState;',
    ].join('\n');

    expect(isDeliberateCast(src, lineOf(src, 'const bad'))).toBe(true);
  });
});

describe('and CANNOT authorise anything else', () => {
  it('does not vouch for a later cast once real code intervenes', () => {
    // THE REGRESSION. Both casts sit within twelve lines of one marker; only the
    // first is marked. The flat-window implementation returned true for both.
    const src = [
      `// ${DELIBERATE_MARKER} — this one is intentional.`,
      'const marked = {} as GameState;',
      'doSomething(marked);',
      'const sneaky = { weeksLived: 1 } as GameState;',
    ].join('\n');

    expect(isDeliberateCast(src, lineOf(src, 'const marked'))).toBe(true);
    expect(isDeliberateCast(src, lineOf(src, 'const sneaky'))).toBe(false);
  });

  it('does not reach across a blank line', () => {
    // A blank breaks the block on purpose: it is the difference between "this
    // comment explains the next statement" and "this comment is up there
    // somewhere".
    const src = [
      `// ${DELIBERATE_MARKER}`,
      '',
      'const bad = {} as GameState;',
    ].join('\n');

    expect(isDeliberateCast(src, lineOf(src, 'const bad'))).toBe(false);
  });

  it('does not reach a marker BELOW the cast (the control)', () => {
    const src = [
      'const bad = {} as GameState;',
      `// ${DELIBERATE_MARKER}`,
    ].join('\n');

    expect(isDeliberateCast(src, 1)).toBe(false);
  });

  it('says no when there is no marker at all (the control)', () => {
    const src = ['// just a normal comment', 'const bad = {} as GameState;'].join('\n');

    expect(isDeliberateCast(src, 2)).toBe(false);
  });

  it('handles garbage input without throwing', () => {
    expect(isDeliberateCast('', 1)).toBe(false);
    expect(isDeliberateCast('x', 0)).toBe(false);
    expect(isDeliberateCast('x', 99)).toBe(false);
    expect(isDeliberateCast(null as unknown as string, 1)).toBe(false);
  });
});

describe('the audit consumes this helper rather than its own copy', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts/audit/audit-save.cjs'), 'utf8',
  );

  it('audit-save requires it', () => {
    expect(SRC).toMatch(/require\('\.\.\/lib\/deliberateCast'\)/);
    expect(SRC).toMatch(/isDeliberateCast\(/);
  });

  it('and keeps no flat-window scan of its own (the control)', () => {
    // The implementation this replaced. Its return would silence the regression
    // case above without this file ever failing.
    expect(SRC).not.toMatch(/DELIBERATE_LOOKBACK/);
  });
});
