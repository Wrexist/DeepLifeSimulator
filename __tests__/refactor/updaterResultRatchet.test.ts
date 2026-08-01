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
 * Sweeping for that shape across `contexts/game/actions/` finds 86 functions,
 * not the ~15 the audit estimated. That is too many to fix blind: each needs
 * its own reading of which rejection paths are actually reachable from inside
 * the updater only, and each needs a regression test. Several are almost
 * certainly fine — an outer guard already returned a failure before the
 * updater ran, so the inner `return prev` is belt-and-braces.
 *
 * So this file does what the repo already does for the test-tree type errors:
 * it PINS the number, so the count can only go down. A new action written in
 * this shape fails here and gets the pessimistic-capture treatment at review
 * time, which is the cheap moment. Working the existing 86 down is separate,
 * deliberate work.
 *
 * The fixed shape, for anyone landing here from a failure — see
 * `buyCompanyUpgrade`, `openAccount` or `purchaseVehicleWithAutoLoan`:
 *
 *     let result = { success: false, message: 'Could not …' };   // PESSIMISTIC
 *     setGameState(prev => {
 *       if (…) { result = { success: false, message: '…' }; return prev; }
 *       result = { success: true, message: '…' };                // from INSIDE
 *       return next;
 *     });
 *     return result;
 *
 * The default must be failure, so an updater React discards — or never runs —
 * reports a rejection rather than a phantom success.
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
      if (body.includes('let result')) continue; // already uses the fixed shape
      if (!/\n\s*return \{\s*\n?\s*success: true/.test(body.slice(-800))) continue;

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
const RATCHET = 86;

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
