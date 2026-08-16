/**
 * No weekly subsystem may cost the player their week.
 *
 * `nextWeek()` runs ~37 `apply*` subsystems inside ONE `setGameState` updater
 * wrapped in a single outer try/catch that returns `prevState`. So a subsystem
 * that throws does not degrade — it silently rolls the whole tick back. The
 * player taps "Next Week" and nothing happens: no error, no advance, no income,
 * no aging. A soft-lock that presents as a dead button. `CLAUDE.md` §4.3 names
 * this class and `tasks/lessons.md` records it five times.
 *
 * Two kinds of test here, on purpose:
 *
 *  1. BEHAVIOUR — `guardTick` really does swallow and fall back. That is the
 *     contract, and it is executable.
 *  2. COVERAGE — every subsystem call in the tick is inside SOME guard. That one
 *     has to read the caller: there is no way to prove "nothing is unguarded" by
 *     running code, because the whole point is the case nobody thought to write.
 *     It is the same reason a lint rule beats a code review.
 *
 * ── Why (2) is a SCAN and no longer a list ────────────────────────────────
 *
 * This file used to assert a hard-coded allowlist of the fourteen subsystems
 * that were known to have been bare. A list proves nothing about the fifteenth.
 * It went green for a year while `applyEducationProgression` (money-bearing),
 * `applyLifetimeStatistics` and `calcWeeklyPassiveIncome` sat unguarded — the
 * exact failure the file exists to prevent, invisible because none of the three
 * was on the list. So the pinned names are gone: the test now finds every
 * subsystem call site in the updater itself and requires each to be guarded.
 * Adding a new bare `apply*` call to the tick fails this test.
 */
import fs from 'fs';
import path from 'path';
import { guardTick } from '@/contexts/game/actions/weekly/guardTick';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TICK = path.join(REPO_ROOT, 'contexts/game/GameActionsContext.tsx');

describe('guardTick', () => {
  it('returns the subsystem result when it works', () => {
    expect(guardTick('ok', () => 42, 0)).toBe(42);
  });

  it('returns the fallback when the subsystem throws', () => {
    expect(
      guardTick(
        'boom',
        () => {
          throw new Error('subsystem exploded');
        },
        'fallback',
      ),
    ).toBe('fallback');
  });

  it('does not rethrow, so the rest of the tick still runs', () => {
    let reachedNextStep = false;
    expect(() => {
      guardTick('boom', () => {
        throw new Error('x');
      }, null);
      reachedNextStep = true;
    }).not.toThrow();
    expect(reachedNextStep).toBe(true);
  });

  it('survives a thrown non-Error, which a bad save can produce', () => {
    expect(guardTick('weird', () => { throw 'a string'; }, 'safe')).toBe('safe');
    expect(guardTick('nullish', () => { throw null; }, 'safe')).toBe('safe');
  });
});

// ---------------------------------------------------------------------------
// The scanner
// ---------------------------------------------------------------------------

/**
 * Blank out comments and string/template TEXT, keeping every byte offset (and
 * every newline) so reported line numbers stay true and brace matching is not
 * confused by a `{` inside a comment or a message string. Template `${…}`
 * expressions are deliberately KEPT — they contain real code, including calls.
 */
function maskCommentsAndStrings(src: string): string {
  const out = src.split('');
  const n = src.length;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && c2 === '*') {
      let j = src.indexOf('*/', i);
      j = j < 0 ? n : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      let textStart = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') {
          blank(textStart, j);
          let depth = 1;
          let k = j + 2;
          while (k < n && depth > 0) {
            if (src[k] === '{') depth++;
            else if (src[k] === '}') depth--;
            else if (src[k] === '`') {
              let m = k + 1;
              while (m < n && src[m] !== '`') {
                if (src[m] === '\\') m++;
                m++;
              }
              k = m;
            }
            k++;
          }
          j = k;
          textStart = k;
          continue;
        }
        j++;
      }
      blank(textStart, j);
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join('');
}

const rawSource = fs.readFileSync(TICK, 'utf8');
const code = maskCommentsAndStrings(rawSource);

const lineOf = (index: number) => code.slice(0, index).split('\n').length;

/** Index of the `{` that opens the block starting at/after `from`. */
function matchingClose(open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return code.length;
}

/**
 * The week loop's own updater: `setGameState(prevState => { … try { … } … })`
 * inside `const nextWeek = useCallback`. Everything asserted below is scoped to
 * the OUTER TRY inside it — that try is the thing whose catch returns
 * `prevState`, i.e. the thing that turns a subsystem throw into a lost week.
 */
const nextWeekIndex = code.indexOf('const nextWeek = useCallback');
const updaterIndex = code.indexOf('setGameState(prevState => {', nextWeekIndex);
const outerTryOffset = code.slice(updaterIndex).search(/\btry\s*\{/);
const outerTryBrace = code.indexOf('{', updaterIndex + outerTryOffset);
const outerTryEnd = matchingClose(outerTryBrace);

/** Open braces enclosing `index`, outermost first. */
function enclosingBraces(index: number): number[] {
  const stack: number[] = [];
  for (let i = 0; i < index; i++) {
    if (code[i] === '{') stack.push(i);
    else if (code[i] === '}') stack.pop();
  }
  return stack;
}

/**
 * Subsystem-shaped calls. `apply*` is the tick's naming convention; the two
 * other shapes are the subsystems that predate it and would otherwise be
 * invisible to a convention-based scan.
 */
const CALL_RE = /\b(apply[A-Z]\w*|process[A-Z]\w*Tick|calcWeeklyPassiveIncome)\s*\(/g;

/**
 * Modules that carry their OWN try/catch and are therefore allowed to be called
 * bare. The exemption is self-checking: each entry names the module file, and
 * the test below asserts (a) the tick really imports the symbol from that path
 * and (b) that file really contains a try/catch. Delete the try from one of
 * these modules and this test goes red rather than quietly excusing it.
 */
const SELF_GUARDED: Record<string, string> = {
  applyConsequenceProgression: 'contexts/game/actions/weekly/applyConsequenceProgression.ts',
  applyCliffhangerResolution: 'contexts/game/actions/weekly/applyCliffhangerResolution.ts',
  applyCliffhangerRoll: 'contexts/game/actions/weekly/applyCliffhangerRoll.ts',
  applyDeathRibbon: 'contexts/game/actions/weekly/applyDeathRibbon.ts',
  applyAutoCheckpoint: 'contexts/game/actions/weekly/applyAutoCheckpoint.ts',
};

/**
 * Helpers DEFINED INSIDE the tick file itself. These are not subsystems — they
 * are the tick's own code, which is exactly what the outer catch is the right
 * guard for (see the guardTick docblock). The exemption is self-checking too:
 * the test asserts each is actually declared locally, so moving one out into a
 * module drops it back under the guard requirement.
 */
const LOCAL_HELPERS = ['applyCashAndRecord'];

interface CallSite {
  name: string;
  index: number;
  line: number;
  guardTickWrapped: boolean;
  insideInnerTry: boolean;
}

function collectCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  CALL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CALL_RE.exec(code))) {
    const index = match.index;
    if (index < outerTryBrace || index > outerTryEnd) continue;

    // `guardTick('name', () => subsystem(` puts the wrapper immediately before
    // the call — with an optional `x = ` for the guarded-assignment form.
    const before = code.slice(Math.max(0, index - 200), index).replace(/\s+/g, ' ');
    const guardTickWrapped =
      /guardTick\s*\(\s*['"][^'"]*['"]\s*,\s*\(\s*\)\s*=>\s*(?:[\w.]+\s*=\s*)?$/.test(before);

    // Any try INSIDE the updater's outer try counts. Braces at or before the
    // outer try are the outer try itself and the enclosing callback/provider —
    // those are the guards whose failure mode is "lose the week".
    const insideInnerTry = enclosingBraces(index).some(
      (b) => b > outerTryBrace && /\btry\s*$/.test(code.slice(Math.max(0, b - 24), b).replace(/\s+/g, ' ').trimEnd()),
    );

    sites.push({
      name: match[1],
      index,
      line: lineOf(index),
      guardTickWrapped,
      insideInnerTry,
    });
  }
  return sites;
}

const callSites = collectCallSites();

describe('every subsystem call in the weekly tick is guarded', () => {
  it('found the updater and a plausible number of subsystem calls', () => {
    // If the scan silently matched nothing (a rename, a refactor, a broken
    // mask), every assertion below would vacuously pass. Anchor it.
    expect(nextWeekIndex).toBeGreaterThan(-1);
    expect(outerTryBrace).toBeGreaterThan(updaterIndex);
    expect(outerTryEnd).toBeGreaterThan(outerTryBrace);
    expect(callSites.length).toBeGreaterThanOrEqual(45);
  });

  it('still wraps the whole updater, so guardTick is defence in depth', () => {
    // The outer catch is the reason an unguarded throw is so expensive. It stays
    // — it is the last line against a bug in the tick's OWN code — but it must
    // never again be the only thing standing between one subsystem and the week.
    expect(/\bcatch\b/.test(code.slice(outerTryEnd, outerTryEnd + 200))).toBe(true);
  });

  it('no subsystem runs bare under the outer catch', () => {
    const bare = callSites
      .filter(
        (s) =>
          !s.guardTickWrapped &&
          !s.insideInnerTry &&
          !LOCAL_HELPERS.includes(s.name) &&
          !(s.name in SELF_GUARDED),
      )
      .map((s) => `${s.name} (GameActionsContext.tsx:${s.line})`);

    // Printed as a list, not a count: the failure message has to name the call
    // the author just added, or they will not know where to put the guard.
    expect(bare).toEqual([]);
  });

  it('the guarded subsystems are the ones that actually run in the tick', () => {
    const guarded = callSites.filter((s) => s.guardTickWrapped).map((s) => s.name);
    // The three that were bare until the 2026-08-16 pass — pinned by name
    // because each one is a documented regression, not because the list is the
    // mechanism. The scan above is the mechanism.
    expect(guarded).toEqual(expect.arrayContaining([
      'applyEducationProgression',
      'applyLifetimeStatistics',
      'calcWeeklyPassiveIncome',
    ]));
  });
});

describe('the guard exemptions are self-checking', () => {
  it.each(Object.entries(SELF_GUARDED))(
    '%s is imported from its module and that module has its own try/catch',
    (name, modulePath) => {
      // The exemption must describe THIS tick, not a stale memory of it.
      expect(callSites.some((s) => s.name === name)).toBe(true);

      // Resolve the tick's own import for this symbol and check it points at the
      // file the exemption names — so the exemption cannot drift onto a
      // different (unguarded) module of the same name. Read from the UNMASKED
      // source: the scanner blanks string contents, and the path is a string.
      const importMatch = new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`,
      ).exec(rawSource);
      expect(importMatch).not.toBeNull();
      const resolved = path.relative(
        REPO_ROOT,
        path.resolve(path.dirname(TICK), `${importMatch![1]}.ts`),
      );
      expect(resolved).toBe(modulePath);

      const moduleSource = fs.readFileSync(path.join(REPO_ROOT, modulePath), 'utf8');
      expect(moduleSource).toMatch(/\btry\s*\{/);
      expect(moduleSource).toMatch(/\bcatch\s*\(/);
    },
  );

  it.each(LOCAL_HELPERS)('%s is declared inside the tick file itself', (name) => {
    expect(callSites.some((s) => s.name === name)).toBe(true);
    const declared = new RegExp(`(const|let|function)\\s+${name}\\s*[=(]`).test(code);
    expect(declared).toBe(true);
  });
});
