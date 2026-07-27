/**
 * Every morph the rig drives must be reachable by a control.
 *
 * ## The gap this exists to catch
 *
 * Six morphs — `faceLength`, `chinProtrusion`, `cheekFullness`,
 * `browProtrusion`, `mouthHeight`, `neckThickness` — were bound to the rig,
 * baked into the shipped asset, and set by both the randomiser and the photo
 * fitter, while `FaceStudio` offered no slider for any of them. So a player
 * could be handed a face with a jutting chin and a heavy brow and have no way
 * to change either. Nothing failed: the morphs worked, the sliders worked, and
 * the set of sliders was simply smaller than the set of morphs.
 *
 * That is not a bug any single-file test can see, which is why this reads the
 * screens' own group tables and compares them against `FACE_MORPH_KEYS`.
 *
 * The tables are parsed out of the source rather than imported, because both are
 * module-private constants inside React components — exporting them purely for a
 * test would put a seam in the screen for the test's convenience, and the thing
 * worth pinning is what the screen actually renders.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FACE_MORPH_KEYS } from '@/lib/identity';

const SCREENS = [
  { name: 'FaceStudio', file: 'components/identity/FaceStudio.tsx', table: 'GROUPS' },
  { name: 'FaceCreator', file: 'components/identity/FaceCreator.tsx', table: 'MORPH_GROUPS' },
];

/** Every `key: 'morphName'` inside the named group table. */
function groupedMorphs(file: string, table: string): string[] {
  const source = readFileSync(join(__dirname, '../../../', file), 'utf8');
  const start = source.indexOf(`const ${table}:`);
  if (start < 0) throw new Error(`${table} not found in ${file}`);
  // The table ends at the first line that closes an array at column zero.
  const end = source.indexOf('\n];', start);
  if (end < 0) throw new Error(`${table} is not terminated in ${file}`);
  const body = source.slice(start, end);
  return [...body.matchAll(/key:\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
}

describe.each(SCREENS)('$name slider groups', ({ file, table }) => {
  const keys = groupedMorphs(file, table);

  it('covers every morph — no control-less axis', () => {
    expect([...keys].sort()).toEqual([...FACE_MORPH_KEYS].sort());
  });

  it('offers each morph exactly once', () => {
    // A morph in two groups gives two sliders that fight over one value: moving
    // either leaves the other visibly stale, which reads as a broken control.
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('names only morphs that exist', () => {
    for (const key of keys) expect(FACE_MORPH_KEYS).toContain(key);
  });
});
