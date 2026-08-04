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
 * Sweeping for that shape across `contexts/game/actions/` finds **62**
 * functions, not the ~15 the audit estimated. That is too many to fix blind:
 * each needs its own reading of which rejection paths are actually reachable
 * from inside the updater only, and each needs a regression test. Several are
 * almost certainly fine — an outer guard already returned a failure before the
 * updater ran, so the inner `return prev` is belt-and-braces.
 *
 * (The first version of this file said 86. That was the detector, not the
 * codebase: it only recognised a capture literally named `result`, so ~16
 * functions already using the fixed shape under another name — `applied`,
 * `granted`, `didManage` — were counted as broken. Corrected below, and the
 * "not stale" check is what caught it.)
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
 * CLAUDE.md §4.1 has said this all along. The 62 below are the places that
 * work around it.
 *
 * ── HOW MUCH OF THIS IS ACTUALLY A BUG ────────────────────────────────────
 *
 * 62 reads alarming. A function-by-function survey says it mostly is not, and
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
 * So this ratchet counts a SHAPE worth not adding more of, not 62 live bugs.
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
      if (!/\n\s*return \{\s*\n?\s*success: true/.test(body.slice(-900))) continue;

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
 */
const RATCHET = 62;

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

  it('the functions already fixed are NOT in the list (the control)', () => {
    // If the detector flagged the fixed shape too, the ratchet would be
    // measuring noise and could never reach zero.
    const current = suspects();

    expect(current).not.toContain('CompanyActions.ts::buyCompanyUpgrade');
    expect(current).not.toContain('BankingActions.ts::openAccount');
  });

  it('and those really do use the pessimistic shape (the control)', () => {
    for (const [file, fn] of [
      ['CompanyActions.ts', 'buyCompanyUpgrade'],
      ['BankingActions.ts', 'openAccount'],
    ]) {
      const src = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
      const i = src.indexOf(fn);
      const body = src.slice(i, i + 6000);

      expect(`${file}::${fn}: ${/let result[^=]*=\s*\{\s*\n?\s*success: false/.test(body)}`)
        .toBe(`${file}::${fn}: true`);
    }
  });
});
