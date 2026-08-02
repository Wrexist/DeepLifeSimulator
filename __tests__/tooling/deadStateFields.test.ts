/**
 * No NEW dead field on `GameState`.
 *
 * A dead field — declared, defaulted, sometimes even migrated, and read by
 * nothing — is not a tidiness problem. It is indistinguishable from a working
 * feature until someone looks, and this repo has now shipped two bugs that were
 * exactly that:
 *
 *   `company.money`   rendered as "Cash $0" on every company for its whole life
 *   `revivalPack`     the entire state of a $2.99 product, dead since day one
 *
 * Both were reported by players as broken features. Neither was broken; both
 * were empty. So this guards the shape rather than the instances.
 *
 * ── Why a ratchet, not a ban ──────────────────────────────────────────────
 *
 * Sixteen already exist. Failing on all of them would be switched off within a
 * week. Failing on the SEVENTEENTH is the check worth having, and the list
 * below doubles as the to-do: delete one, remove its line, the gate tightens.
 *
 * A field leaving the list is also a failure, for the same reason the type
 * ratchet fails on a drop — a stale baseline silently re-admits what it names.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.join(__dirname, '..', '..');

/**
 * Known-dead fields. LOWER THIS LIST as they are deleted or wired; never add.
 *
 * Grouped by why they are dead, because the fix differs:
 *   - tutorial flags: no tutorial ever read them
 *   - save metadata:  reads as though saves are verified through `_checksum`;
 *                     the real primitives (CRC32, HMAC) never touch it
 *   - pipeline-maintained: WORSE than the others — `saveMigrations` backfills
 *                     and `repairGameState` mirrors these, so every load pays
 *                     for state nothing consumes. `activeChapterId` is the
 *                     clearest: `getCurrentChapter()` derives the active
 *                     chapter from `completedChapters`, so the stored field was
 *                     superseded and never removed.
 */
/**
 * Known-dead fields. LOWER THIS LIST as they are deleted or wired; never add.
 *
 * EMPTY as of 2026-08-02 — all sixteen were deleted rather than wired. None had
 * a consumer waiting: seven tutorial flags no tutorial read, three counters
 * nothing counted, three save-metadata fields that verified nothing (`_checksum`
 * in particular read as though saves were checked through it; the real CRC32 and
 * HMAC primitives never touched it), and three the save pipeline backfilled and
 * repaired on every load for no reader at all.
 *
 * An empty list makes this a plain gate: GameState carries no dead field. If you
 * are adding one, wire it in the same change or do not add it.
 */
const KNOWN_DEAD: string[] = [].sort();

/**
 * Files where a field may appear without that counting as a READER.
 *
 * The save pipeline is in here deliberately. `saveMigrations` backfilling a
 * field and `repairGameState` mirroring it are not consumption — they are the
 * pipeline maintaining state on behalf of a consumer that may not exist. Three
 * of the sixteen below are exactly that case, and they are the worst of the
 * group: every load pays for them and nothing reads the result.
 *
 * The cost of this choice: a legacy field being deliberately migrated AWAY
 * would flag here. That is the right trade — such a field should be on the list
 * with a note, not invisible.
 */
const PLUMBING =
  /contexts\/game\/types\.ts|contexts\/game\/initialState\.ts|__tests__|tasks\/|utils\/saveMigrations\.ts|utils\/saveValidation\.ts/;

function gameStateFields(): string[] {
  const types = fs.readFileSync(path.join(repoRoot, 'contexts/game/types.ts'), 'utf8');
  const start = types.indexOf('export interface GameState {');
  expect(start).toBeGreaterThan(-1);
  const body = types.slice(start, types.indexOf('\n}', start));
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

/** Word-boundary search, so `money` does not match `moneyChange`. */
function referencesOutsidePlumbing(field: string): string[] {
  let out = '';
  try {
    out = execFileSync(
      'rg',
      ['-n', '--no-heading', '-g', '!node_modules', '-g', '*.ts', '-g', '*.tsx', '-w', field, '.'],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
  } catch {
    // rg exits 1 on no matches — that is the interesting case, not an error.
  }
  return out.split('\n').filter(Boolean).filter((l) => !PLUMBING.test(l));
}

describe('GameState has no NEW dead field', () => {
  // One rg per field over the whole repo; keep the suite's own budget honest.
  jest.setTimeout(180_000);

  const fields = gameStateFields();

  it('the interface was actually parsed (the control)', () => {
    // Without this, a rename of the interface makes every assertion below pass
    // by iterating an empty list.
    expect(fields.length).toBeGreaterThan(100);
    expect(fields).toContain('stats');
    expect(fields).toContain('weeksLived');
  });

  it('no field outside the known list is unreferenced', () => {
    const dead = fields.filter((f) => referencesOutsidePlumbing(f).length === 0);
    const unexpected = dead.filter((f) => !KNOWN_DEAD.includes(f));

    expect(unexpected).toEqual([]);
  });

  it('and the known list has not gone stale', () => {
    // The other half of the ratchet. A field that is no longer dead — deleted,
    // or finally wired — must leave the list, or the list starts protecting
    // fields that do not need it and the count stops meaning anything.
    const dead = fields.filter((f) => referencesOutsidePlumbing(f).length === 0);
    const noLongerDead = KNOWN_DEAD.filter((f) => !dead.includes(f));

    expect(noLongerDead).toEqual([]);
  });

  it('a field with a real reader is not flagged (the control)', () => {
    // Proves the detector can tell live from dead at all. `weeksLived` is read
    // everywhere; if this ever came back empty the sweep would be reporting
    // every field as dead and the assertions above would be meaningless.
    expect(referencesOutsidePlumbing('weeksLived').length).toBeGreaterThan(10);
  });
});
