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
      const stmt = /\n\s*return \{\s*\n?\s*success: true/.test(afterUpdater);
      const ternaryAt = afterUpdater.search(/\n\s*return [^;]*\?[\s\S]*?success:\s*true/);
      const ternary = ternaryAt !== -1 && !/success:\s*false/.test(afterUpdater.slice(ternaryAt));
      if (!stmt && !ternary) continue;

      /**
       * Exclude anything already using the fixed shape.
       *
       * The first version of this detector only recognised a capture literally
       * named `result`, so the first batch of fixes — which use `bought`,
       * `fed`, `played`, `treated`, `entered` — did not move the number at all.
       * A ratchet that cannot see its own progress is worse than none: it
       * would have sat at 86 forever while the work happened.
       *
       * The shape that counts as fixed is a captured flag or object that is
       * GUARDED before the success return: `if (!x)` or `return x;`. A `let`
       * assigned inside the updater and never checked is not a fix.
       */
      const captures = body.match(/let\s+(\w+)\s*(?::[^=]+)?=\s*(?:false|\{)/g) ?? [];
      const guarded = captures.some((c) => {
        const v = /let\s+(\w+)/.exec(c)![1];
        return new RegExp(`if\\s*\\(\\s*!${v}\\s*\\)`).test(body)
          || new RegExp(`return\\s+${v}\\s*;`).test(body);
      });
      if (guarded) continue;

      found.push(`${file}::${name}`);
    }
  }

  return found.sort();
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
 * written in this shape — and the `promoteMatchToFriend` control below is
 * there to prove a new action still has to use the fixed shape.
 */
const RATCHET = 65;

describe('C-9 / ARCH-1 — the read-out-of-updater ratchet', () => {
  it('the detector finds something (it is not silently matching nothing)', () => {
    // A ratchet on a broken detector passes forever and protects nothing.
    expect(suspects().length).toBeGreaterThan(0);
  });

  it('no NEW function reads its outcome out of an updater', () => {
    const current = suspects();

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
    expect(RATCHET - suspects().length).toBeLessThanOrEqual(5);
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
  const CONTROLS: [string, string][] = [
    ['CompanyActions.ts', 'buyCompanyUpgrade'],
    ['BankingActions.ts', 'openNewAccount'],
    // A capture written AFTER the detector was widened, so it also proves the
    // ternary/anchor changes did not start swallowing the fixed shape.
    ['SparkActions.ts', 'promoteMatchToFriend'],
  ];

  it('the functions already fixed are NOT in the list (the control)', () => {
    // If the detector flagged the fixed shape too, the ratchet would be
    // measuring noise and could never reach zero.
    const current = suspects();

    for (const [file, fn] of CONTROLS) {
      expect(current).not.toContain(`${file}::${fn}`);
    }
  });

  it('and those really do use the pessimistic shape (the control)', () => {
    for (const [file, fn] of CONTROLS) {
      const src = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
      const i = src.indexOf(`export const ${fn}`);

      // The declaration must exist. A renamed export would otherwise make
      // `indexOf` return -1, slice from the end, and pass on an empty string.
      expect(`${file}::${fn} declared: ${i !== -1}`).toBe(`${file}::${fn} declared: true`);

      const body = src.slice(i, i + 6000);
      expect(`${file}::${fn}: ${/let result[^=]*=\s*\{\s*\n?\s*success: false/.test(body)}`)
        .toBe(`${file}::${fn}: true`);
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
