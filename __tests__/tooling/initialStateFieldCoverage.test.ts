/**
 * The V11 ratchet in `scripts/audit/audit-save.cjs`: every top-level
 * `initialGameState` field with a CONCRETE stored default must be covered by a
 * migration or a `repairGameState` mirror.
 *
 * ── Why this direction needed a machine ───────────────────────────────────
 *
 * V8 already walked the MIGRATIONS and asked "is each backfill mirrored in
 * repair?". That only ever sees fields somebody already remembered to migrate.
 * CLAUDE.md §7's rule runs the other way — a field added to `initialState` ships
 * its migration and its mirror in the SAME change — and nothing checked it, so
 * the only thing between a forgotten pair and a player was the fact that the
 * primary load path reconstitutes a save as `{ ...initialGameState, ...parsed }`.
 * A save that arrives partial through a path that does NOT spread (a CloudSync
 * field-merge, a hand-edited or truncated blob) is healed by neither the version
 * ladder nor repair.
 *
 * ── Why a grandfather list and not a clean sweep ──────────────────────────
 *
 * 57 fields predate the discipline. They are not live bugs (the spread covers
 * them), so retro-fitting 57 migrations would be churn with no player-visible
 * change. The list is seeded with exactly those and may only SHRINK — same
 * shape as the coverage floors and the test-type baseline. The failure mode
 * this file guards against is the one a frozen list always has: it silently
 * stops describing reality, and then it is protecting nothing.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

// The analyzer is a plain CommonJS script (it runs under bare `node`), so a
// require is the only way in — same shape as `coverageRatchet.test.ts`.
const auditSave =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/scripts/audit/audit-save.cjs');
const { LEGACY_PRE_MIGRATION_FIELDS, topLevelInitialFields, uncoveredConcreteFields } = auditSave;

const initialSrc = read('contexts/game/initialState.ts');
const migSrc = read('utils/saveMigrations.ts');
const repairSrc = read('utils/saveValidation.ts');

const uncovered: string[] = uncoveredConcreteFields(initialSrc, migSrc, repairSrc);

describe('initialState field coverage (audit-save V11)', () => {
  it('parses the real initialGameState down to its top-level fields', () => {
    const fields = topLevelInitialFields(initialSrc);
    // Sanity anchors: a parser that silently returned [] would make the whole
    // ratchet vacuously green.
    expect(fields.length).toBeGreaterThan(100);
    expect(fields.map((f: { name: string }) => f.name)).toEqual(
      expect.arrayContaining(['version', 'stats', 'karma', 'legacyUpgrades']),
    );
    // Nested keys must NOT surface as top-level fields.
    expect(fields.map((f: { name: string }) => f.name)).not.toContain('happiness');
  });

  it('classifies an `undefined` default as a carve-out, not a concrete default', () => {
    const fields = topLevelInitialFields(initialSrc);
    const byName = new Map(
      fields.map((f: { name: string; concrete: boolean }) => [f.name, f.concrete]),
    );
    // §7's canonical carve-out example.
    expect(byName.get('ambitionId')).toBe(false);
    expect(byName.get('scenarioId')).toBe(false);
    // …versus a field with a real stored default.
    expect(byName.get('revivalPack')).toBe(true);
    expect(byName.get('legacyUpgrades')).toBe(true);
  });

  it('finds no uncovered field outside the grandfather list', () => {
    const undocumented = uncovered.filter((name) => !LEGACY_PRE_MIGRATION_FIELDS.has(name));
    // The message a future reader needs, printed with the failure.
    expect({ undocumented }).toEqual({ undocumented: [] });
  });

  it('has no stale grandfather entries - the list may only shrink', () => {
    const uncoveredSet = new Set(uncovered);
    const stale = [...LEGACY_PRE_MIGRATION_FIELDS].filter((name) => !uncoveredSet.has(name));
    // A field that gained its migration/mirror must leave the list, so the
    // ratchet holds the new ground instead of leaving room to slide back.
    expect({ stale }).toEqual({ stale: [] });
  });

  it('still bites: a new concrete-default field with no migration and no mirror is caught', () => {
    const withNewField = initialSrc.replace(
      'export const initialGameState: GameState = {',
      'export const initialGameState: GameState = {\n  brandNewUnmigratedField: [],',
    );
    expect(withNewField).not.toBe(initialSrc); // the anchor still exists

    const found = uncoveredConcreteFields(withNewField, migSrc, repairSrc);
    expect(found).toContain('brandNewUnmigratedField');
    expect(LEGACY_PRE_MIGRATION_FIELDS.has('brandNewUnmigratedField')).toBe(false);
  });

  it('does not fire for a new field whose default is `undefined` (a carve-out)', () => {
    const withCarveOut = initialSrc.replace(
      'export const initialGameState: GameState = {',
      'export const initialGameState: GameState = {\n  brandNewCarveOut: undefined,',
    );
    expect(uncoveredConcreteFields(withCarveOut, migSrc, repairSrc))
      .not.toContain('brandNewCarveOut');
  });

  it('accepts coverage from a migration OR from either repair shape', () => {
    const add = (decl: string) =>
      initialSrc.replace(
        'export const initialGameState: GameState = {',
        `export const initialGameState: GameState = {\n  ${decl}`,
      );

    // (a) BACKFILLED by a migration - a real assignment, not a mention. A word
    //     match used to be enough, and it ran over the UNSTRIPPED migration
    //     source, so a field was exempted by its name turning up in migration
    //     prose. The commented control below is the half that used to pass.
    expect(
      uncoveredConcreteFields(add('fieldA: [],'), `${migSrc}\nstate.fieldA = [];`, repairSrc),
    ).not.toContain('fieldA');
    expect(
      uncoveredConcreteFields(add('fieldA: [],'), `${migSrc}\n// state.fieldA = [];`, repairSrc),
    ).toContain('fieldA');

    // (b) reached on the STATE OBJECT inside repairGameState's body
    const repairWithBranch = repairSrc.replace(
      '  const repairs: string[] = [];',
      '  const repairs: string[] = [];\n  s.fieldB = [];',
    );
    expect(uncoveredConcreteFields(add('fieldB: [],'), migSrc, repairWithBranch))
      .not.toContain('fieldB');

    //     …and a same-named property on some OTHER object in the body is not
    //     coverage: `week` passed for years off a `week:` key in an unrelated
    //     socialMedia literal while repair never touched `state.week`.
    const repairWithForeignObject = repairSrc.replace(
      '  const repairs: string[] = [];',
      '  const repairs: string[] = [];\n  const seed: Record<string, unknown> = {}; seed.fieldC = [];',
    );
    expect(uncoveredConcreteFields(add('fieldC: [],'), migSrc, repairWithForeignObject))
      .toContain('fieldC');

    // (c) listed in one of repair's table-driven backfills — these live in
    //     STRING literals, which the body scan blanks, so they need their own read.
    expect(uncoveredConcreteFields(add('foods: [],'), migSrc, repairSrc)).not.toContain('foods');
  });
});

describe('the repair-coverage read is scoped to repairGameState', () => {
  it('does not count a field merely NAMED elsewhere in saveValidation.ts', () => {
    const withNewField = initialSrc.replace(
      'export const initialGameState: GameState = {',
      'export const initialGameState: GameState = {\n  mentionedButNeverRepaired: [],',
    );
    // Appended AFTER repairGameState closes: validateGameState and friends name
    // plenty of fields they never heal, and counting those would make V11 pass
    // on fields repair does not touch.
    const repairWithTrailingMention =
      `${repairSrc}\nexport const unrelated = ['mentionedButNeverRepaired'];\n`;

    expect(uncoveredConcreteFields(withNewField, migSrc, repairWithTrailingMention))
      .toContain('mentionedButNeverRepaired');
  });
});
