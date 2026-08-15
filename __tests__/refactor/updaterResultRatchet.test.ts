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
 */
import fs from 'fs';
import path from 'path';

const ACTIONS_DIR = path.join(__dirname, '..', '..', 'contexts/game/actions');

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

  for (const file of fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
    const decl = /^export (?:const|function) (\w+)/gm;

    let m: RegExpExecArray | null;
    while ((m = decl.exec(src)) !== null) {
      const name = m[1];
      const start = m.index;
      const next = /^export (?:const|function) /m.exec(src.slice(start + 10));
      const body = src.slice(start, next ? start + 10 + next.index : src.length);

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

  return found.sort();
}

/**
 * The OTHER half of the class: a variable assigned INSIDE a `setGameState`
 * updater and read AFTER it.
 *
 * This was the detector's exclusion until 2026-08-15, when a player report
 * disproved the premise — a $40.25M player told they needed $10,000 for a
 * $10,000 action that had in fact succeeded. React runs only the FIRST
 * functional update of a batch eagerly, so a capture reads its initial value
 * for any dispatch that is not first, and the function reports failure for work
 * that landed.
 *
 * Both spellings count, because both fail the same way:
 *   - a boolean flag  — `let applied = false; … if (!applied) return failure;`
 *   - a result object — `let result = { success: false }; … return result;`
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
 * indistinguishable from a broken one — the fixtures below are what tell the
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
  // carried the shape — `let lost = 0` read as `onResolved({ lost })`,
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

    // Read ANYWHERE after the last dispatch — a bare reference is enough.
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

  for (const file of fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
    const decl = /^export (?:const|function) (\w+)/gm;

    let m: RegExpExecArray | null;
    while ((m = decl.exec(src)) !== null) {
      const name = m[1];
      const start = m.index;
      const next = /^export (?:const|function) /m.exec(src.slice(start + 10));
      const body = src.slice(start, next ? start + 10 + next.index : src.length);

      const dispatch = body.indexOf('setGameState(');
      if (dispatch === -1) continue;

      /**
       * Only declarations at the FUNCTION's top level (two-space indent) can be
       * read across the updater boundary. A `let` inside the updater body is
       * indented further and is an ordinary local — that is the false-positive
       * class (`let next: GameState = …`, `let working = …`) which makes a
       * naive sweep for this shape unusable.
       */
      if (bodyHasCrossUpdaterCapture(body)) found.push(`${file}::${name}`);
    }
  }

  return found.sort();
}

/** Everything whose REPORT is not a pure function of the caller's snapshot. */
function allSuspects(): string[] {
  return Array.from(new Set([...suspects(), ...captureSuspects()])).sort();
}

/**
 * The ratchet. LOWER THIS when you fix one — never raise it.
 *
 * If you are here because you added an action and this failed: use the
 * pessimistic-capture shape in the header comment. Do not raise the number.
 *
 * ── 62 → 65, and why that is not a regression ─────────────────────────────
 *
 * Three members were always in this class and the DETECTOR could not see them.
 * No production code got worse; the count got honest:
 *
 *   - `CrimeActions::buyMarketListing` — success return written as a ternary
 *     whose branches are BOTH `success: true`. The old regex only matched the
 *     statement form (BBQ report M-1).
 *   - `TravelActions::investInBusinessOpportunity` and
 *     `SparkActions::promoteMatchToRelationship` — statement form, but more
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
 * update of a React batch, and a player report proved it in production — a
 * $40.25M player told they needed $10,000 for an action that had succeeded.
 *
 * So the number was never 62 or 65; those were 65 plus a pile the detector had
 * been told to ignore. The count now covers BOTH shapes (`suspects` for an
 * unconditional-success tail, `captureSuspects` for a cross-updater read) and
 * the baseline is set to the honest total. The 22 boolean captures were
 * converted to outer-guard reporting in the same change, which moves them from
 * one bucket to the other rather than out of the count — the ratchet measures
 * a SHAPE, and the shape they now have is the one the repo's own
 * `innerOnlyRejections.test.ts` prescribes.
 *
 * What is left to work down is real: the object-capture sites listed by
 * `captureSuspects`, which need a state snapshot to report from (several take
 * only `setGameState` today, so they cannot answer their caller at all).
 */
const RATCHET = 93;

describe('C-9 / ARCH-1 — the read-out-of-updater ratchet', () => {
  it('the detector finds something (it is not silently matching nothing)', () => {
    // A ratchet on a broken detector passes forever and protects nothing.
    expect(suspects().length).toBeGreaterThan(0);
  });

  it('the cross-updater capture survives in exactly ONE dead-code site', () => {
    /**
     * It was the detector's exclusion until 2026-08-15, then its own bucket.
     * All 43 live members were converted to outer-guard reporting or to a pure
     * preview/commit resolver.
     *
     * The single survivor is `processVehicleWeekly`, which has NO production
     * caller — the live weekly path is `weekly/applyVehicles.ts`, whose own
     * comment calls this "the pre-WeekContext version". Only the stress and
     * insurance suites reach it, through a synchronous stub. It is pinned here
     * by name rather than deleted so that wiring it into the tick trips this
     * assertion first; the function itself carries the same warning.
     *
     * ── Why this list was briefly, wrongly, empty ──────────────────────────
     *
     * The first version of the detector matched only `let x = false` / `= {}`
     * initialisers and only two read forms (`if (!x)`, `return x;`). It
     * reported ZERO while nine functions still carried the shape — `let lost =
     * 0` read as `onResolved({ lost })`, `let mutualFollow = false` read inside
     * a ternary, `let totalRewardsOut = 0` read in a template string. A
     * detector narrower than the defect is worse than none, because its zero
     * gets quoted as proof.
     */
    expect(captureSuspects()).toEqual(['VehicleActions.ts::processVehicleWeekly']);
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
      // `let next: GameState = { ...prev }` and friends — the false-positive
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
   *  - `not.toContain('BankingActions.ts::openAccount')` could never fail — the
   *    detector keys on exported action names, so that string is not a possible
   *    member of the list. The assertion tested nothing.
   *  - The shape check did `src.indexOf('openAccount')`, which matched the
   *    IMPORT at offset ~763 and then read a fixed 6,000-character window. The
   *    real `openNewAccount` declaration sits at ~8,300, so the check was only
   *    passing because the intervening code happened to be short enough to drag
   *    the declaration inside the window. Adding ~1.7k of unrelated code above
   *    it pushed the declaration out and the control failed — reporting a
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
     * capture bucket for a real reason rather than a definitional one — and the
     * source check below is what tells those two apart.
     */
    for (const [file, fn] of CONTROLS) {
      expect(captureSuspects()).not.toContain(`${file}::${fn}`);
    }
  });

  it('and each really carries one of the two sound shapes (the control)', () => {
    /**
     * The source-level proof that the line above is not passing by definition.
     * There are exactly two sound fixes for this class and both are represented:
     *
     *   resolver    — a pure `resolve*` called once for the outcome and once for
     *                 the state, for functions whose result carries data.
     *   outer-guard — every inner rejection mirrors a check against the caller's
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
      // fixed byte window — the mistake this file's own history records twice.
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
    expect(suspects()).toContain('CrimeActions.ts::buyMarketListing');

    // And that really is the shape — both branches report success.
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
   * The real-file tests above cannot reach the interesting case — a tree that
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
    // real conditional outcome — the fixed shape — and counting it would make
    // the ratchet punish the very pattern it is trying to encourage.
    expect(suspects()).not.toContain('BankingActions.ts::claimAdCashBonus');

    const src = fs.readFileSync(path.join(ACTIONS_DIR, 'BankingActions.ts'), 'utf8');
    const i = src.indexOf('export const claimAdCashBonus');
    expect(`declared: ${i !== -1}`).toBe('declared: true');
    const body = src.slice(i, i + 6000);
    expect(`has a false branch: ${/\?[\s\S]{0,400}success: true[\s\S]{0,400}success: false/.test(body)}`)
      .toBe('has a false branch: true');
  });
});
