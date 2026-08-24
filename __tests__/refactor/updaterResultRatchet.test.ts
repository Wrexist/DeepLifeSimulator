/**
 * C-9 / ARCH-1 — the read-out-of-updater class, ratcheted rather than
 * blind-fixed.
 *
 * C-8 was one instance: `buyCompanyUpgrade` had four rejection paths reachable
 * ONLY inside its `setGameState` updater, every one of them returning `prev`
 * correctly, and then an unconditional `return { success: true, … }` at the
 * bottom. The money was right; the player was told they had bought something
 * they had not.
 *
 * Sweeping for that shape across `contexts/game/actions/` finds **65**
 * functions, not the ~15 the audit estimated. That is too many to fix blind:
 * each needs its own reading of which rejection paths are actually reachable
 * from inside the updater only, and each needs a regression test. Several are
 * almost certainly fine — an outer guard already returned a failure before the
 * updater ran, so the inner `return prev` is belt-and-braces.
 *
 * (The count has moved twice, both times because the DETECTOR changed rather
 * than the code. It said 86 when it only recognised a capture literally named
 * `result`, so ~16 functions already using the fixed shape under other names —
 * `applied`, `granted`, `didManage` — were counted as broken: 86 → 62. It then
 * said 62 while blind to a success return written as an all-true ternary, and
 * to any success return sitting more than 900 characters from the end of the
 * extracted body: 62 → 65. See the note on RATCHET below.)
 *
 * So this file does what the repo already does for the test-tree type errors:
 * it PINS the number, so the count can only go down. A new action written in
 * this shape fails here and gets the pessimistic-capture treatment at review
 * time, which is the cheap moment. Working the existing 86 down is separate,
 * deliberate work.
 *
 * ── WHICH FIX TO APPLY ────────────────────────────────────────────────────
 *
 * NOT the pessimistic capture used by `buyCompanyUpgrade`, `openAccount` and
 * `purchaseVehicleWithAutoLoan`:
 *
 *     let result = { success: false, … };
 *     setGameState(prev => { …; result = { success: true, … }; return next; });
 *     return result;                       // ← only sometimes readable
 *
 * That shape is a strict improvement on `return { success: true }` and it is
 * why those three are excluded below, but it is NOT sound, and
 * `updaterTimingContract.test.tsx` measures exactly why: React runs the FIRST
 * functional update of a batch eagerly (so the capture reads) and DEFERS the
 * second (so it does not). Converting the nine `VehicleActions` functions to
 * capture broke `vehicleSystemFlow.stress.test.ts`, which drives real React
 * through `act()` — a successful refuel reported failure. That batch was
 * reverted. Do not expand the pattern.
 *
 * THE SOUND FIX is to make the outcome a PURE function of `prev` and call it
 * in both places, so no cross-updater variable exists to be stale. The worked
 * example is the C-10 fix in `SkillTreeModal`:
 *
 *     const preview = purchaseLifeSkill(state, { … });   // outcome, for the UI
 *     setGameState(prev => purchaseLifeSkill(prev, { … }).next);  // the state
 *
 * CLAUDE.md §4.1 has said this all along. The 65 below are the places that
 * work around it.
 *
 * ── HOW MUCH OF THIS IS ACTUALLY A BUG ────────────────────────────────────
 *
 * 65 reads alarming. A function-by-function survey says it mostly is not, and
 * `__tests__/actions/innerOnlyRejections.test.ts` pins the survey.
 *
 * For all but two, the inner `return prev` MIRRORS an outer guard that already
 * returns a real failure — `publishVideo`'s weekly cap, `buyAccessory`'s
 * already-owned check, `buyMinerUpgrade`'s max level, `claimStakingRewards`'
 * empty positions, `purchasePassport`'s ownership, `launchIPO`'s already-public
 * check. The inner copy is the same-batch race guard, reachable only by a
 * second tap in one React batch — where reporting failure is the right answer
 * anyway. So the unconditional success return is CORRECT on the single tap
 * that is almost all real play.
 *
 * The two that were not mirrored (`upgradeEnergySystem`, `buildRDLab`) are
 * fixed, with an outer guard rather than a capture.
 *
 * So this ratchet counts a SHAPE worth not adding more of, not 65 live bugs.
 * Anyone working it down should check for the outer guard FIRST — most entries
 * need no behavioural change at all, only the refactor to a pure reducer if
 * the shape itself is to be retired.
 *
 * 2026-08-01 audit round 4.
 *
 * ── WHAT THIS SCANS, AND WHY IT IS NOW THREE TREES ────────────────────────
 *
 * Until 2026-08-16 the scan read `contexts/game/actions/*.ts` — one directory,
 * NON-recursively, top-level `export` declarations only. Everything the class
 * can live in outside that one directory was invisible to it, and the class
 * was in fact alive there: `components/AdRewardOrb.tsx` read a `let allowed`
 * flag across the stamping updater and dropped a reward a player had just
 * watched a full ad for; `contexts/game/company.ts` reported "Unknown error"
 * for purchases that committed. Those were found by hand, fixed in 2d99a22,
 * and would have gone on being invisible here.
 *
 * The scan now walks `contexts/game/` (so `actions/weekly/`, the `*Context.tsx`
 * providers and `company.ts` are all in), `components/` and `app/`, recursively,
 * over every `.ts`/`.tsx` that is not a test. Entries are keyed by REPO-RELATIVE
 * PATH rather than bare filename, because two `index.ts` files are no longer a
 * hypothetical.
 *
 * Two extraction passes, unioned, and the split is deliberate:
 *
 *   (A) the ORIGINAL top-level `^export (const|function)` slice-to-next-export.
 *       Kept byte-for-byte so that the 93 entries this file has been counting
 *       still mean exactly what they meant yesterday. A re-extraction that
 *       "improved" them would have silently re-based the ratchet.
 *   (B) a structural pass over EVERY function head at any indentation, with
 *       brace-matched extents. This is what reaches a `useCallback` handler
 *       inside a component — the AdRewardOrb shape, which pass (A) cannot see
 *       because a component is one export and its handlers' `let`s are indented
 *       past the detector's two-space anchor.
 *
 * Pass (B) counts only the INNERMOST function holding a dispatch, so a provider
 * is not counted for its own handlers' shapes; pass (A) drops a match for the
 * same reason. Bodies from (B) are re-indented so the function's own statements
 * sit at two spaces — `GameActionsContext.tsx` is written with ONE-space
 * indentation, and without normalising it the capture detector would be blind
 * to a 4,100-line file while reporting zero.
 *
 * The DETECTORS themselves (`reportsUnconditionalSuccess`,
 * `bodyHasCrossUpdaterCapture`) are untouched: they were widened on 2026-08-15
 * and are proved on the fixtures below. Only what gets fed to them changed.
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
/** Relative prefix of the original scope — the CONTROLS below live here. */
const ACTIONS_REL = 'contexts/game/actions';
const ACTIONS_DIR = path.join(REPO_ROOT, ACTIONS_REL);

/**
 * The three trees. `lib/` is deliberately NOT here: it is pure game logic and
 * takes no `setGameState`, so a scan of it would be a scan of nothing. If a
 * `lib/` module ever grows a dispatch, add the root — the walker needs no
 * other change.
 */
const ROOTS = ['contexts/game', 'components', 'app'];

const SKIP_DIRS = new Set(['node_modules', '__tests__', '__mocks__', '__fixtures__']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every scanned source file, repo-relative, sorted. Read once. */
const SOURCE_FILES: string[] = ROOTS.flatMap((r) => walk(path.join(REPO_ROOT, r)))
  .map((f) => path.relative(REPO_ROOT, f))
  .sort();

const SOURCES = new Map<string, string>(
  SOURCE_FILES.map((rel) => [rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')]),
);

/**
 * Blank out comments and string/template TEXT, keeping every byte offset (and
 * every newline) so the offsets computed here index the RAW source unchanged.
 * Lifted from `__tests__/stress/weeklyTickGuards.test.ts`, for the same reason:
 * brace matching must not be confused by a `{` inside a docblock, and this repo
 * writes code samples in its docblocks constantly.
 *
 * Note what is masked and what is not: the mask is used ONLY to locate function
 * heads and extents. Every body handed to a detector is sliced from the RAW
 * text, so the detectors see exactly the bytes they saw before.
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

interface FnExtent {
  name: string;
  indent: number;
  start: number;
  end: number;
}

/**
 * Anything that could open a function body: `function f(`, `const f = … => {`,
 * `const f = useCallback((…) => {`, at ANY indentation. Deliberately loose on
 * the right-hand side — the head is only a candidate; what makes it a function
 * is that a body brace is found below.
 */
const FN_HEAD =
  /^([ \t]*)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*(?::[^=\n]*)?=)/gm;

/**
 * Every function in `code` (which must be MASKED source), with brace-matched
 * extents.
 *
 * The body brace is the first `{` at paren depth 0, or one immediately after an
 * arrow — the second case is what makes `useCallback((x) => {` work, where the
 * body opens while still inside `useCallback(`'s parenthesis. A `;` at depth 0
 * before any brace means this was an ordinary declaration, not a function.
 */
function findFunctions(code: string): FnExtent[] {
  const heads: FnExtent[] = [];
  FN_HEAD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FN_HEAD.exec(code)) !== null) {
    const start = m.index;
    const name = m[2] || m[3];
    const indent = m[1].length;
    let depth = 0;
    let open = -1;
    for (let i = start + m[0].length; i < code.length; i++) {
      const ch = code[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === '{') {
        if (depth === 0 || code.slice(Math.max(0, i - 3), i).trimEnd().endsWith('=>')) {
          open = i;
          break;
        }
      } else if (ch === ';' && depth === 0) break;
    }
    if (open === -1) continue;
    let d = 0;
    let end = code.length;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '{') d++;
      else if (code[i] === '}') {
        d--;
        if (!d) {
          end = i + 1;
          break;
        }
      }
    }
    heads.push({ name, indent, start, end });
  }
  return heads;
}

/**
 * Re-indent an extracted body so the function's OWN statements sit at two
 * spaces, which is where `bodyHasCrossUpdaterCapture` looks for a capture.
 *
 * Without this the detector's anchor means "two spaces from the left margin"
 * rather than "this function's top level", which is only the same thing for a
 * top-level function in a two-space-indented file. `GameActionsContext.tsx` is
 * written with ONE-space indentation and every handler in it is nested, so the
 * anchor would have missed the whole file — silently, which is the failure mode
 * this file's history keeps recording.
 */
export function normalizeIndent(body: string, headIndent: number): string {
  const lines = body.split('\n');
  let base = Infinity;
  // Skip the head line and the closing brace line: both sit at the head's own
  // indent and would drag the base down to it.
  for (let i = 1; i < lines.length - 1; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const ind = l.length - l.replace(/^ */, '').length;
    if (ind > headIndent && ind < base) base = ind;
  }
  if (!isFinite(base)) return body;
  const shift = 2 - base;
  if (shift === 0 && headIndent === 0) return body;
  return lines
    .map((l, i) => {
      if (i === 0) return l.replace(/^ +/, '');
      if (!l.trim()) return l;
      if (shift >= 0) return ' '.repeat(shift) + l;
      return l.startsWith(' '.repeat(-shift)) ? l.slice(-shift) : l.replace(/^ +/, '');
    })
    .join('\n');
}

/**
 * The two extraction passes, unioned, for one file. See the header for why
 * there are two and why (A) is preserved verbatim.
 *
 * Exported so the fixtures below can prove the component-shaped case really is
 * reached — a scan whose new scope finds nothing is indistinguishable from a
 * scan that never ran.
 */
export function functionBodies(raw: string): { name: string; body: string }[] {
  const code = maskCommentsAndStrings(raw);
  const fns = findFunctions(code);
  const holdsDispatch = (f: FnExtent) => code.slice(f.start, f.end).includes('setGameState(');
  const out: { name: string; body: string }[] = [];

  // (A) the original pass: top-level exports, sliced to the next top-level
  // export. Unchanged, except that a declaration whose shape actually belongs
  // to a nested function is left to pass (B) to report under the real name.
  const decl = /^export (?:const|function) (\w+)/gm;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(raw)) !== null) {
    const start = m.index;
    const next = /^export (?:const|function) /m.exec(raw.slice(start + 10));
    const end = next ? start + 10 + next.index : raw.length;
    const nestedOwnsIt = fns.some((f) => f.indent > 0 && f.start > start && f.end <= end && holdsDispatch(f));
    if (nestedOwnsIt) continue;
    out.push({ name: m[1], body: raw.slice(start, end) });
  }

  // (B) the structural pass: innermost function holding the dispatch, body
  // re-indented to the detector's frame of reference.
  for (const fn of fns) {
    if (fns.some((o) => o !== fn && o.start > fn.start && o.end <= fn.end && holdsDispatch(o))) continue;
    out.push({ name: fn.name, body: normalizeIndent(raw.slice(fn.start, fn.end), fn.indent) });
  }

  return out;
}

/**
 * Functions that BOTH reject from inside a `setGameState` updater AND end with
 * an unconditional success return, without capturing a result.
 *
 * Deliberately coarse — it is an upper bound, and it is stable, which is what a
 * ratchet needs. A function that captures into `let result` is excluded because
 * that is the fixed shape.
 */
/**
 * Does this post-updater tail report success no matter what happened inside?
 *
 * Two spellings. The statement form is what the detector always saw. The
 * ternary form is what it could not:
 *
 *     return cond ? { success: true, … } : { success: true, … };
 *
 * an unconditional success wearing a conditional's clothes (`buyMarketListing`,
 * BBQ report M-1).
 *
 * Each ternary is judged on its OWN statement, cut at its terminating `;`. An
 * earlier version tested `success: false` across the whole remaining tail,
 * which cut both ways: an unrelated failure return AFTER an all-success ternary
 * suppressed a real detection, and a failure branch belonging to a LATER
 * ternary could mask an earlier all-success one. A detector whose answer
 * depends on unrelated code further down the file is the same disease as the
 * fixed byte window it replaced.
 */
export function reportsUnconditionalSuccess(afterUpdater: string): boolean {
  if (/\n\s*return \{\s*\n?\s*success: true/.test(afterUpdater)) return true;
  return [...afterUpdater.matchAll(/\n\s*return [^;]*\?[\s\S]*?;/g)].some((m) => {
    const statement = m[0];
    return /success:\s*true/.test(statement) && !/success:\s*false/.test(statement);
  });
}

function suspects(): string[] {
  const found: string[] = [];

  for (const [file, src] of SOURCES) {
    for (const { name, body } of functionBodies(src)) {
      if (!body.includes('setGameState')) continue;
      if (!/return prev(?:State)?;/.test(body)) continue;

      /**
       * The success return, found by MEANING rather than byte distance.
       *
       * This was `body.slice(-900)` — an arbitrary window that missed two real
       * members (`investInBusinessOpportunity`, `promoteMatchToRelationship`)
       * purely because a long trailing comment pushed their success return more
       * than 900 characters from the end of the extracted body. A ratchet whose
       * membership depends on how much prose follows a function is not stable,
       * which is the one property a ratchet has to have.
       *
       * The region that matters is everything AFTER the last `setGameState(`
       * call — that is precisely "what this function returns once the updater
       * has been handed off", which is the shape being counted.
       */
      const afterUpdater = body.slice(body.lastIndexOf('setGameState('));

      /**
       * Two spellings of the same defect.
       *
       * `SUCCESS_STMT` is the statement form the detector always saw.
       * `SUCCESS_TERNARY` is the one it could not: a tail written as
       *
       *     return cond ? { success: true, … } : { success: true, … };
       *
       * which is an unconditional success wearing a conditional's clothes.
       * `buyMarketListing` is exactly that and had always belonged to this
       * class, invisibly (BBQ report M-1).
       *
       * The `success: false` exclusion is what keeps the ternary check honest:
       * a ternary with a false branch — `claimAdCashBonus`'s
       * `granted > 0 ? success : failure` — is a REAL conditional outcome, i.e.
       * the fixed shape, and must not be counted.
       */
      if (!reportsUnconditionalSuccess(afterUpdater)) continue;

      /**
       * The capture EXCLUSION that used to sit here was deleted on 2026-08-15.
       *
       * It skipped any function holding a `let` flag or result object assigned
       * inside the updater and read after it, on the theory that this was "the
       * fixed shape". It is not — see `captureSuspects` below and the header.
       * Those functions are counted there instead, so the shape is measured
       * rather than certified.
       */
      found.push(`${file}::${name}`);
    }
  }

  return Array.from(new Set(found)).sort();
}

/**
 * The OTHER half of the class: a variable assigned INSIDE a `setGameState`
 * updater and read AFTER it.
 *
 * This was the detector's exclusion until 2026-08-15, when a player report
 * disproved the premise - a $40.25M player told they needed $10,000 for a
 * $10,000 action that had in fact succeeded. React runs only the FIRST
 * functional update of a batch eagerly, so a capture reads its initial value
 * for any dispatch that is not first, and the function reports failure for work
 * that landed.
 *
 * Both spellings count, because both fail the same way:
 *   - a boolean flag  - `let applied = false; … if (!applied) return failure;`
 *   - a result object - `let result = { success: false }; … return result;`
 *
 * A ratchet that treats a broken shape as the fix cannot reach zero, and worse,
 * its own failure message recommends adopting it.
 */
/**
 * Does this function body assign a top-level `let` from INSIDE a `setGameState`
 * updater and read it back afterwards?
 *
 * Extracted so it can be exercised on fixtures. The real count is 0 as of
 * 2026-08-15, and a detector that only ever returns an empty list is
 * indistinguishable from a broken one - the fixtures below are what tell the
 * difference.
 */
export function bodyHasCrossUpdaterCapture(body: string): boolean {
  const ranges = dispatchRanges(body);
  if (!ranges.length) return false;
  const firstDispatch = ranges[0][0];
  const tail = body.slice(ranges[ranges.length - 1][1]);

  // ANY top-level `let`, not just `= false` / `= {}`. The first version of this
  // detector matched only those two initialisers AND only two read forms
  // (`if (!x)` / `return x;`), and so reported ZERO while nine functions still
  // carried the shape - `let lost = 0` read as `onResolved({ lost })`,
  // `let mutualFollow = false` read inside a ternary, and so on. A detector
  // that is narrower than the defect is worse than none, because its zero is
  // read as proof.
  for (const c of body.matchAll(/\n {2}let\s+(\w+)\s*(?::[^=\n]+)?=\s*[^;]+;/g)) {
    const v = c[1];
    if (c.index! > firstDispatch) continue; // declared after the dispatch → not a capture

    // The assignment must sit INSIDE a dispatch, by byte range. Indentation
    // alone is not enough: `let matched = false` reassigned in an ordinary
    // `if` block before the dispatch is not a capture, and an earlier version
    // of this check flagged `swipeOnProfile` for exactly that.
    const assignedInside = [...body.matchAll(new RegExp(`\\b${v}\\s*=[^=]`, 'g'))]
      .map((a) => a.index!)
      .filter((idx) => idx > c.index! + c[0].length)
      .some((idx) => ranges.some(([a, b]) => idx > a && idx < b));
    if (!assignedInside) continue;

    // Read ANYWHERE after the last dispatch - a bare reference is enough.
    if (new RegExp(`\\b${v}\\b`).test(tail)) return true;
  }
  return false;
}

/** Byte ranges of every `setGameState(...)` call in `body`, by brace matching. */
function dispatchRanges(body: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  while ((i = body.indexOf('setGameState(', i)) !== -1) {
    let depth = 0;
    let j = body.indexOf('(', i);
    for (; j < body.length; j++) {
      if (body[j] === '(') depth++;
      else if (body[j] === ')') {
        depth--;
        if (!depth) break;
      }
    }
    if (j === -1 || j >= body.length) break;
    out.push([i, j]);
    i = j;
  }
  return out;
}

export function captureSuspects(): string[] {
  const found: string[] = [];

  for (const [file, src] of SOURCES) {
    for (const { name, body } of functionBodies(src)) {
      if (body.indexOf('setGameState(') === -1) continue;

      /**
       * Only declarations at the FUNCTION's top level (two-space indent) can be
       * read across the updater boundary. A `let` inside the updater body is
       * indented further and is an ordinary local - that is the false-positive
       * class (`let next: GameState = …`, `let working = …`) which makes a
       * naive sweep for this shape unusable. `normalizeIndent` is what makes
       * "two-space indent" mean "this function's top level" for a nested
       * handler, or in a file that is not indented in twos.
       */
      if (bodyHasCrossUpdaterCapture(body)) found.push(`${file}::${name}`);
    }
  }

  return Array.from(new Set(found)).sort();
}

/** Everything whose REPORT is not a pure function of the caller's snapshot. */
function allSuspects(): string[] {
  return Array.from(new Set([...suspects(), ...captureSuspects()])).sort();
}

/**
 * The ratchet. LOWER THIS when you fix one - never raise it.
 *
 * If you are here because you added an action and this failed: use the
 * pessimistic-capture shape in the header comment. Do not raise the number.
 *
 * ── 62 → 65, and why that is not a regression ─────────────────────────────
 *
 * Three members were always in this class and the DETECTOR could not see them.
 * No production code got worse; the count got honest:
 *
 *   - `CrimeActions::buyMarketListing` - success return written as a ternary
 *     whose branches are BOTH `success: true`. The old regex only matched the
 *     statement form (BBQ report M-1).
 *   - `TravelActions::investInBusinessOpportunity` and
 *     `SparkActions::promoteMatchToRelationship` - statement form, but more
 *     than 900 characters from the end of the extracted body, so the old fixed
 *     window never reached them.
 *
 * This is the same correction the header records going the other way: the
 * count moved 86 → 62 when the detector learned to see captures under names
 * other than `result`. A number that moves when the detector improves is the
 * system working. What must never happen is raising it to admit NEW code
 * written in this shape.
 *
 * ── 65 → the honest total, 2026-08-15 ─────────────────────────────────────
 *
 * The 86 → 62 correction above was WRONG, and this is the entry that says so.
 * It "found" 24 fixes by teaching the detector that a captured flag counts as
 * fixed. A capture is not a fix: it is only readable for the FIRST functional
 * update of a React batch, and a player report proved it in production - a
 * $40.25M player told they needed $10,000 for an action that had succeeded.
 *
 * So the number was never 62 or 65; those were 65 plus a pile the detector had
 * been told to ignore. The count now covers BOTH shapes (`suspects` for an
 * unconditional-success tail, `captureSuspects` for a cross-updater read) and
 * the baseline is set to the honest total. The 22 boolean captures were
 * converted to outer-guard reporting in the same change, which moves them from
 * one bucket to the other rather than out of the count - the ratchet measures
 * a SHAPE, and the shape they now have is the one the repo's own
 * `innerOnlyRejections.test.ts` prescribes.
 *
 * What is left to work down is real: the object-capture sites listed by
 * `captureSuspects`, which need a state snapshot to report from (several take
 * only `setGameState` today, so they cannot answer their caller at all).
 *
 * ── 93 → 101, and why that is a SCOPE change, not a regression ────────────
 *
 * 2026-08-16 (WP-G): the scan grew from one non-recursive directory to three
 * trees (see the header). Not one line of production code changed for this
 * bump, and every one of the 93 previous members is still a member - the
 * original extraction pass is preserved verbatim precisely so that claim is
 * checkable. The 8 additions are all code that existed all along, in files the
 * scan simply never opened:
 *
 *   contexts/game/company.ts::sellCompany, ::sellMiner, ::upgradeWarehouse
 *   contexts/game/GameActionsContext.tsx::proposeToPartner, ::moveInTogether
 *   contexts/game/ItemActionsContext.tsx::performHack
 *   contexts/game/MoneyActionsContext.tsx::purchasePrestigeBonus
 *   contexts/game/SocialActionsContext.tsx::haveChild
 *
 * Seven are the same benign shape as the bulk of the 92 - every inner
 * `return prev` mirrors an outer guard that already reported the failure, so
 * the unconditional success tail is correct on the single tap that is nearly
 * all real play. `performHack` and `haveChild` say so in their own comments.
 * The eighth, `upgradeWarehouse`, was a live cross-updater capture when the
 * widened scope first found it; it was converted to the same
 * preview/commit resolver as its three siblings in the same commit that
 * landed this scope, so it now counts as an ordinary resolver-shaped member.
 *
 * `components/` and `app/` contributed ZERO, which is the expected answer and
 * not a broken scan: the shapes that lived there (`AdRewardOrb`,
 * `SkillTreeModal`) were fixed in 2d99a22, and the fixtures below prove the
 * extraction still reaches a component-shaped handler.
 */
const RATCHET = 101;

describe('C-9 / ARCH-1 - the read-out-of-updater ratchet', () => {
  it('the detector finds something (it is not silently matching nothing)', () => {
    // A ratchet on a broken detector passes forever and protects nothing.
    expect(suspects().length).toBeGreaterThan(0);
  });

  it('the cross-updater capture survives in exactly ONE pinned site', () => {
    /**
     * It was the detector's exclusion until 2026-08-15, then its own bucket.
     * All 43 live members were converted to outer-guard reporting or to a pure
     * preview/commit resolver.
     *
     * `processVehicleWeekly` has NO production caller - the live weekly path is
     * `weekly/applyVehicles.ts`, whose own comment calls this "the
     * pre-WeekContext version". Only the stress and insurance suites reach it,
     * through a synchronous stub. It is pinned here by name rather than deleted
     * so that wiring it into the tick trips this assertion first; the function
     * itself carries the same warning.
     *
     * `company.ts::upgradeWarehouse` was the one live capture the widened
     * 2026-08-16 scope found - the Mining app's warehouse upgrade button. It
     * was briefly pinned here, then converted to `resolveUpgradeWarehouse`,
     * the same preview/commit pair as its three siblings in the file, in the
     * same change that landed this scope. Nothing capture-shaped remains on a
     * player path.
     *
     * ── Why this list was briefly, wrongly, empty ──────────────────────────
     *
     * The first version of the detector matched only `let x = false` / `= {}`
     * initialisers and only two read forms (`if (!x)`, `return x;`). It
     * reported ZERO while nine functions still carried the shape - `let lost =
     * 0` read as `onResolved({ lost })`, `let mutualFollow = false` read inside
     * a ternary, `let totalRewardsOut = 0` read in a template string. A
     * detector narrower than the defect is worse than none, because its zero
     * gets quoted as proof.
     */
    expect(captureSuspects()).toEqual([
      'contexts/game/actions/VehicleActions.ts::processVehicleWeekly',
    ]);
  });

  describe('the capture detector still works at zero (fixtures)', () => {
    const wrap = (inner: string) => `export const act = () => {\n${inner}\n};`;

    it('sees the boolean-flag form', () => {
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let applied = false;',
        '  setGameState((prev) => {',
        '    if (!ok) return prev;',
        '    applied = true;',
        '    return next;',
        '  });',
        '  if (!applied) return fail;',
        '  return ok;',
      ].join('\n')))).toBe(true);
    });

    it('sees the result-object form', () => {
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let result = { success: false };',
        '  setGameState((prev) => {',
        '    result = { success: true };',
        '    return next;',
        '  });',
        '  return result;',
      ].join('\n')))).toBe(true);
    });

    it('does NOT flag a local declared INSIDE the updater', () => {
      // `let next: GameState = { ...prev }` and friends - the false-positive
      // class that makes a naive sweep for this shape unusable.
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  setGameState((prev) => {',
        '    let next = { ...prev };',
        '    next = { ...next, a: 1 };',
        '    return next;',
        '  });',
        '  return ok;',
      ].join('\n')))).toBe(false);
    });

    it('does NOT flag a capture that is never read back', () => {
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let seen = false;',
        '  setGameState((prev) => {',
        '    seen = true;',
        '    return prev;',
        '  });',
        '  return ok;',
      ].join('\n')))).toBe(false);
    });

    it('sees a capture read as an EXPRESSION, not just `if (!x)` / `return x`', () => {
      // The nine sites the first detector missed all read the capture this way.
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let lost = 0;',
        '  setGameState((prev) => {',
        '    lost = amount;',
        '    return next;',
        '  });',
        '  onResolved({ lost });',
      ].join('\n')))).toBe(true);
    });

    it('sees a capture read inside a ternary', () => {
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let mutualFollow = false;',
        '  setGameState((prev) => {',
        '    mutualFollow = true;',
        '    return next;',
        '  });',
        '  return { message: mutualFollow ? "a" : "b" };',
      ].join('\n')))).toBe(true);
    });

    it('does NOT flag a let reassigned BEFORE the dispatch (byte range, not indent)', () => {
      // `swipeOnProfile` computes `matched` in an ordinary `if` block above the
      // dispatch. An indentation-only check flagged it; a range check does not.
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let matched = false;',
        '  if (isLike) {',
        '    matched = rollMatch(gameState);',
        '  }',
        '  setGameState((prev) => next);',
        '  return { matched };',
      ].join('\n')))).toBe(false);
    });

    it('does NOT flag a function with no dispatch at all', () => {
      expect(bodyHasCrossUpdaterCapture(wrap([
        '  let result = { success: false };',
        '  return result;',
      ].join('\n')))).toBe(false);
    });
  });

  /**
   * The SCOPE, checked the same way the detector is: on fixtures.
   *
   * `components/` and `app/` currently contribute nothing to the count, which is
   * the correct answer - and also exactly what a scan that silently reads no
   * files would report. These fixtures are what tells the two apart. They feed
   * `functionBodies` the shapes the widened scope exists for and require the
   * real detector to fire on the extracted body.
   */
  describe('the extraction reaches the shapes the old scope could not', () => {
    /** AdRewardOrb's pre-2d99a22 shape: a capture inside a nested handler. */
    const COMPONENT = [
      'function AdRewardOrb() {',
      '  const setGameState = useSetGameState();',
      '',
      '  const grant = useCallback(async () => {',
      '    let allowed = false;',
      '    setGameState((prev) => {',
      '      if (claimed(prev)) return prev;',
      '      allowed = true;',
      '      return { ...prev, settings: stamp(prev) };',
      '    });',
      '    if (!allowed) return;',
      '    updateMoney(reward);',
      '  }, [setGameState]);',
      '',
      '  return <View onPress={grant} />;',
      '}',
      '',
      'export default React.memo(AdRewardOrb);',
      '',
    ].join('\n');

    const bodyOf = (src: string, name: string) =>
      functionBodies(src).filter((f) => f.name === name);

    it('finds a `useCallback` handler nested inside a component', () => {
      expect(bodyOf(COMPONENT, 'grant')).toHaveLength(1);
    });

    it('and the capture detector fires on that handler', () => {
      // The whole point of the 2026-08-16 scope change. If this ever goes false
      // the scan is walking components/ and seeing through them.
      expect(bodyHasCrossUpdaterCapture(bodyOf(COMPONENT, 'grant')[0].body)).toBe(true);
    });

    it('but NOT on the component that merely contains it (innermost wins)', () => {
      // Otherwise every provider and screen would be counted for its handlers'
      // shapes, and the failure message would name the wrong function.
      expect(bodyOf(COMPONENT, 'AdRewardOrb')).toHaveLength(0);
    });

    it('sees a capture in a ONE-space-indented file (GameActionsContext.tsx)', () => {
      // Not hypothetical: `contexts/game/GameActionsContext.tsx` - 4,100 lines,
      // the week loop and ~40 actions - is indented in ones. Without
      // `normalizeIndent` the detector's two-space anchor lands on nothing there
      // and the whole file reports clean.
      const oneSpace = [
        'export function Provider() {',
        ' const doThing = useCallback(() => {',
        '  let applied = false;',
        '  setGameState(prev => {',
        '   applied = true;',
        '   return next;',
        '  });',
        '  return { success: applied };',
        ' }, []);',
        ' return null;',
        '}',
        '',
      ].join('\n');
      const doThing = functionBodies(oneSpace).filter((f) => f.name === 'doThing');
      expect(doThing).toHaveLength(1);
      expect(bodyHasCrossUpdaterCapture(doThing[0].body)).toBe(true);
    });

    it('the walker actually opened the new trees', () => {
      // A path-shaped assertion, because "0 suspects in components/" is only
      // meaningful if components/ was read at all.
      const roots = (prefix: string) => SOURCE_FILES.filter((f) => f.startsWith(prefix)).length;
      expect(roots('components/')).toBeGreaterThan(200);
      expect(roots('app/')).toBeGreaterThan(20);
      expect(roots('contexts/game/actions/weekly/')).toBeGreaterThan(30);
      expect(SOURCE_FILES).toContain('contexts/game/company.ts');
      expect(SOURCE_FILES).toContain('contexts/game/JobActionsContext.tsx');
      expect(SOURCE_FILES).toContain('components/AdRewardOrb.tsx');
      // …and no test files, which would count their own fixtures.
      expect(SOURCE_FILES.filter((f) => /\.test\.tsx?$/.test(f))).toEqual([]);
    });
  });

  it('no NEW function reads its outcome out of an updater', () => {
    const current = allSuspects();

    expect(
      `${current.length} suspects (ratchet ${RATCHET})\n${current.join('\n')}`,
    ).toBe(
      `${current.length <= RATCHET ? current.length : RATCHET} suspects (ratchet ${RATCHET})\n${current.join('\n')}`,
    );
    expect(current.length).toBeLessThanOrEqual(RATCHET);
  });

  it('the ratchet is not stale by more than a rounding error', () => {
    // If someone fixes twenty of these and forgets to lower the number, the
    // guard stops catching the twenty-first. Nudges the count down with the
    // work rather than letting slack accumulate.
    expect(RATCHET - allSuspects().length).toBeLessThanOrEqual(5);
  });

  /**
   * The control pair. Both entries name the EXPORTED function, and both are
   * located by their `export const` declaration.
   *
   * Previously the second entry read `openAccount`, which is the imported PURE
   * op from `lib/banking/operations`, not the action. Two things followed:
   *
   *  - `not.toContain('BankingActions.ts::openAccount')` could never fail - the
   *    detector keys on exported action names, so that string is not a possible
   *    member of the list. The assertion tested nothing.
   *  - The shape check did `src.indexOf('openAccount')`, which matched the
   *    IMPORT at offset ~763 and then read a fixed 6,000-character window. The
   *    real `openNewAccount` declaration sits at ~8,300, so the check was only
   *    passing because the intervening code happened to be short enough to drag
   *    the declaration inside the window. Adding ~1.7k of unrelated code above
   *    it pushed the declaration out and the control failed - reporting a
   *    regression in a function nobody had touched.
   *
   * Anchoring to the declaration makes both assertions real and removes the
   * dependency on byte distance from an unrelated import.
   */
  const CONTROLS: [string, string, 'resolver' | 'outer-guard'][] = [
    ['CompanyActions.ts', 'buyCompanyUpgrade', 'resolver'],
    ['BankingActions.ts', 'openNewAccount', 'resolver'],
    // Fixed the OTHER sound way: every inner rejection mirrors an outer guard,
    // so the report needs no resolver and has no timing dependency either.
    ['SparkActions.ts', 'promoteMatchToFriend', 'outer-guard'],
  ];

  it('the three former capture-shape exemplars are genuinely fixed now', () => {
    /**
     * This assertion has been through three states, which is the whole story of
     * this file. It first read `not.toContain` because a pessimistic capture
     * was believed to be the fix. On 2026-08-15 it was inverted to `toContain`,
     * because that premise was disproved by a player report. Now all three have
     * been converted to pure preview/commit resolvers, so they are out of the
     * capture bucket for a real reason rather than a definitional one - and the
     * source check below is what tells those two apart.
     */
    for (const [file, fn] of CONTROLS) {
      // Keyed by repo-relative path since the 2026-08-16 scope change - a bare
      // filename can no longer be a member, so it could not fail.
      expect(captureSuspects()).not.toContain(`${ACTIONS_REL}/${file}::${fn}`);
    }
  });

  it('and each really carries one of the two sound shapes (the control)', () => {
    /**
     * The source-level proof that the line above is not passing by definition.
     * There are exactly two sound fixes for this class and both are represented:
     *
     *   resolver    - a pure `resolve*` called once for the outcome and once for
     *                 the state, for functions whose result carries data.
     *   outer-guard - every inner rejection mirrors a check against the caller's
     *                 snapshot, so no resolver is needed. This is what
     *                 `innerOnlyRejections.test.ts` prescribes.
     */
    for (const [file, fn, shape] of CONTROLS) {
      const src = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
      const i = src.indexOf(`export const ${fn}`);

      // The declaration must exist. A renamed export would otherwise make
      // `indexOf` return -1, slice from the end, and pass on an empty string.
      expect(`${file}::${fn} declared: ${i !== -1}`).toBe(`${file}::${fn} declared: true`);

      // Slice to the function's REAL extent (next top-level export), not a
      // fixed byte window - the mistake this file's own history records twice.
      const after = src.indexOf('\nexport ', i + 10);
      const body = src.slice(i, after === -1 ? src.length : after);
      // Use the real predicate, not a prose-sensitive regex: these functions
      // now DOCUMENT the capture they used to carry, and a naive text match
      // finds the comment describing it.
      expect(`${file}::${fn} has no capture: ${!bodyHasCrossUpdaterCapture(body)}`)
        .toBe(`${file}::${fn} has no capture: true`);
      if (shape === 'resolver') {
        expect(`${file}::${fn} previews: ${/const preview = resolve\w+\(/.test(body)}`)
          .toBe(`${file}::${fn} previews: true`);
      } else {
        // No capture and no resolver → it must report from its own prelude.
        expect(`${file}::${fn} returns before dispatching: ${/return \{ success: false[\s\S]*setGameState\(/.test(body)}`)
          .toBe(`${file}::${fn} returns before dispatching: true`);
      }
    }
  });

  /**
   * The ternary detector, checked in BOTH directions on real code.
   *
   * A widened regex that matches everything is as useless as one that matches
   * nothing, and this one has to split a hair: an all-true ternary is the
   * defect, a true/false ternary is the FIX. Both live in the tree today, so
   * both are asserted against the real files rather than a fixture.
   */
  it('sees an all-success ternary tail (the defect it was blind to)', () => {
    expect(suspects()).toContain(`${ACTIONS_REL}/CrimeActions.ts::buyMarketListing`);

    // And that really is the shape - both branches report success.
    const src = fs.readFileSync(path.join(ACTIONS_DIR, 'CrimeActions.ts'), 'utf8');
    const i = src.indexOf('export const buyMarketListing');
    expect(`declared: ${i !== -1}`).toBe('declared: true');
    const tail = src.slice(i, src.indexOf('\nexport const', i + 10));
    const afterUpdater = tail.slice(tail.lastIndexOf('setGameState('));
    const branches = afterUpdater.match(/success:\s*(true|false)/g) ?? [];
    expect(branches.length).toBeGreaterThan(1);
    expect(`any false branch: ${branches.some((b) => b.includes('false'))}`).toBe(
      'any false branch: false',
    );
  });

  /**
   * The scoping, tested on synthetic tails.
   *
   * The real-file tests above cannot reach the interesting case - a tree that
   * happens not to contain an all-success ternary NEXT TO an unrelated failure
   * return proves nothing about whether the two interfere.
   */
  describe('each ternary is judged on its own statement', () => {
    it('an all-success ternary still counts when an unrelated failure follows it', () => {
      const tail = [
        'setGameState((prev) => prev);',
        '',
        '  return ok ? { success: true, a: 1 } : { success: true, a: 2 };',
        '',
        '  return { success: false, message: "unrelated" };',
      ].join('\n');
      expect(reportsUnconditionalSuccess(tail)).toBe(true);
    });

    it('and still counts when an unrelated failure PRECEDES it', () => {
      const tail = [
        'setGameState((prev) => prev);',
        '',
        '  return { success: false, message: "unrelated" };',
        '',
        '  return ok ? { success: true, a: 1 } : { success: true, a: 2 };',
      ].join('\n');
      expect(reportsUnconditionalSuccess(tail)).toBe(true);
    });

    it('a ternary with a real failure branch never counts', () => {
      const tail = [
        'setGameState((prev) => prev);',
        '',
        '  return granted > 0 ? { success: true, a: 1 } : { success: false, a: 0 };',
      ].join('\n');
      expect(reportsUnconditionalSuccess(tail)).toBe(false);
    });

    it('a tail with no success return at all does not count', () => {
      expect(reportsUnconditionalSuccess('setGameState((prev) => prev);\n  return next;')).toBe(false);
    });
  });

  it('does NOT flag a ternary that can actually report failure (the control)', () => {
    // `claimAdCashBonus` ends with `granted > 0 ? success : failure`. That is a
    // real conditional outcome - the fixed shape - and counting it would make
    // the ratchet punish the very pattern it is trying to encourage.
    expect(suspects()).not.toContain(`${ACTIONS_REL}/BankingActions.ts::claimAdCashBonus`);

    const src = fs.readFileSync(path.join(ACTIONS_DIR, 'BankingActions.ts'), 'utf8');
    const i = src.indexOf('export const claimAdCashBonus');
    expect(`declared: ${i !== -1}`).toBe('declared: true');
    const body = src.slice(i, i + 6000);
    expect(`has a false branch: ${/\?[\s\S]{0,400}success: true[\s\S]{0,400}success: false/.test(body)}`)
      .toBe('has a false branch: true');
  });
});
