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

const repoRoot = path.join(__dirname, '..', '..');

/**
 * Files where a field may appear without that counting as a READER.
 *
 * The save pipeline is in here deliberately. `saveMigrations` backfilling a
 * field and `repairGameState` mirroring it are not consumption — they are the
 * pipeline maintaining state on behalf of a consumer that may not exist. Three
 * of the sixteen fields deleted on 2026-08-02 were exactly that case, and they
 * were the worst of the group: every load paid for them and nothing read the
 * result.
 *
 * The cost of this choice: a legacy field being deliberately migrated AWAY
 * would flag here. That is the right trade — such a field should be named with
 * a reason, not invisible.
 */
const PLUMBING =
  /contexts[/\\]game[/\\]types\.ts|contexts[/\\]game[/\\]initialState\.ts|__tests__|tasks[/\\]|utils[/\\]saveMigrations\.ts|utils[/\\]saveValidation\.ts/;

/**
 * Known-dead fields. LOWER THIS LIST as they are deleted or wired; never add.
 *
 * It was EMPTY from 2026-08-02 — all sixteen were deleted rather than wired.
 * None had a consumer waiting: seven tutorial flags no tutorial read, three
 * counters nothing counted, three save-metadata fields that verified nothing
 * (`_checksum` in particular read as though saves were checked through it; the
 * real CRC32 and HMAC primitives never touched it), and three the save pipeline
 * backfilled and repaired on every load for no reader at all.
 *
 * ── The one entry, and why it is an exception rather than a slide ─────────
 * `gameMode` is dead ON PURPOSE. Story mode was removed after playtesting, so
 * nothing reads or writes it and no code path can set it.
 *
 * It is not deleted because a TestFlight build SHIPPED with story mode, so
 * saves carrying `gameMode: 'story'` and `version: 38` exist on real devices.
 * Deleting the field would make those saves parse into a shape these types call
 * impossible, and dropping STATE_VERSION to 37 would send every one of them
 * down the "save is newer than the app" branch in `runMigrations`.
 *
 * This is the ONLY justification that has ever earned an entry here: a field
 * kept for saves already in the wild. "A consumer is coming later" is not one —
 * that was the argument for all sixteen that got deleted instead. Delete this
 * entry once no supported save can still carry the key.
 */
const KNOWN_DEAD: string[] = ['gameMode'];

const SCAN_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'src', 'utils'];
const SKIP_DIR = /node_modules|\.git|\.expo|coverage|android|ios/;

/**
 * Identifier frequency across all NON-plumbing source, built in ONE pass.
 *
 * ── Why this does not shell out to ripgrep ────────────────────────────────
 *
 * It used to. `execFileSync('rg', …)` inside a `try { } catch { }` that treated
 * a failure as "no matches". Ripgrep is not installed on the CI runner, so
 * every call threw ENOENT, every field came back with zero references, and the
 * suite reported the entire GameState as dead.
 *
 * That is the same shape as the cold-container trap `scripts/check-test-types.js`
 * guards against — a run that never happened reading as a clean result — and I
 * reintroduced it here. A pure-Node scan has no tool to be missing.
 *
 * One pass over the tree, tokenised into a count map, rather than one search
 * per field: ~190 fields against ~800 files would otherwise mean scanning the
 * whole source tree 190 times.
 */
function buildIdentifierCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIR.test(entry.name)) walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const rel = path.relative(repoRoot, full);
      if (PLUMBING.test(rel)) continue;
      const src = fs.readFileSync(full, 'utf8');
      for (const m of src.matchAll(/[A-Za-z_$][\w$]*/g)) {
        counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
      }
    }
  };
  for (const d of SCAN_DIRS) walk(path.join(repoRoot, d));

  // A scan that found nothing must FAIL, not report a clean tree.
  //
  // This is the specific mistake that broke CI: the previous implementation
  // swallowed a missing-binary error and returned "no references", which reads
  // exactly like "every field is dead". Whatever replaces this scan, the
  // not-run case and the nothing-found case must never be the same value.
  if (counts.size < 1000) {
    throw new Error(
      `Source scan collected only ${counts.size} identifiers — it did not run properly. ` +
      'Do not read this as "no references found".',
    );
  }
  return counts;
}

const IDENTIFIERS = buildIdentifierCounts();

function gameStateFields(): string[] {
  const types = fs.readFileSync(path.join(repoRoot, 'contexts/game/types.ts'), 'utf8');
  const start = types.indexOf('export interface GameState {');
  expect(start).toBeGreaterThan(-1);
  const body = types.slice(start, types.indexOf('\n}', start));
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

/** How many times `field` appears as a whole word outside plumbing. */
function referenceCount(field: string): number {
  return IDENTIFIERS.get(field) ?? 0;
}

describe('GameState has no NEW dead field', () => {
  jest.setTimeout(120_000);

  const fields = gameStateFields();

  it('the interface was actually parsed (the control)', () => {
    // Without this, a rename of the interface makes every assertion below pass
    // by iterating an empty list.
    expect(fields.length).toBeGreaterThan(100);
    expect(fields).toContain('stats');
    expect(fields).toContain('weeksLived');
  });

  it('no field outside the known list is unreferenced', () => {
    const dead = fields.filter((f) => referenceCount(f) === 0);
    const unexpected = dead.filter((f) => !KNOWN_DEAD.includes(f));

    expect(unexpected).toEqual([]);
  });

  it('and the known list has not gone stale', () => {
    // The other half of the ratchet. A field that is no longer dead — deleted,
    // or finally wired — must leave the list, or the list starts protecting
    // fields that do not need it and the count stops meaning anything.
    const dead = fields.filter((f) => referenceCount(f) === 0);
    const noLongerDead = KNOWN_DEAD.filter((f) => !dead.includes(f));

    expect(noLongerDead).toEqual([]);
  });

  it('a field with a real reader is not flagged (the control)', () => {
    // Proves the detector can tell live from dead at all. `weeksLived` is read
    // everywhere; if this ever came back empty the sweep would be reporting
    // every field as dead and the assertions above would be meaningless.
    expect(referenceCount('weeksLived')).toBeGreaterThan(10);
  });
});
