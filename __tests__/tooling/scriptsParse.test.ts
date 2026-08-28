/**
 * Every tooling script must PARSE.
 *
 * This exists because of a real break on main (2026-08-28). Two PRs fixed the
 * same missing `Buffer` import in `scripts/notify-store-release.mjs`
 * concurrently; the lines sat eight rows apart, so git merged both cleanly and
 * `main` ended up with a duplicate `import { Buffer } from 'node:buffer'` —
 * a hard `SyntaxError: Identifier 'Buffer' has already been declared`. The
 * release notifier could no longer run at all.
 *
 * Nothing caught it. Lint passes (`import/no-duplicates` is a warning here,
 * and the repo carries 775 warnings, so one more is invisible), type-check
 * excludes `scripts/`, and no test imported the file. The script is run by a
 * scheduled workflow, so the first symptom would have been a silent watcher:
 * store releases never announced, and nobody looking at that log.
 *
 * A parse check is the cheapest possible floor — it says nothing about whether
 * a script is CORRECT, only that Node can load it. That is exactly the class of
 * failure a concurrent merge produces, and the class the other gates miss.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const SCRIPTS = path.join(ROOT, 'scripts');

/** Every .mjs/.cjs/.js under scripts/, recursively. */
function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(mjs|cjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = collect(SCRIPTS);

describe('scripts/ tooling files parse', () => {
  it('found a real set of scripts (the premise)', () => {
    // Guards against the glob silently going empty and the suite passing
    // vacuously forever.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith('.mjs'))).toBe(true);
  });

  it.each(files.map((f) => [path.relative(ROOT, f), f]))('%s parses', (_rel, full) => {
    // `node --check` is the same parser that will run the script, so this
    // catches duplicate bindings, stray merge markers and bad syntax alike.
    expect(() => execFileSync(process.execPath, ['--check', full as string], { stdio: 'pipe' })).not.toThrow();
  });

  it('the check can actually fail (the control)', () => {
    const probe = path.join(SCRIPTS, `.__parse_probe_${process.pid}.mjs`);
    // The exact shape that broke main: the same binding imported twice.
    fs.writeFileSync(probe, "import { Buffer } from 'node:buffer';\nimport { Buffer } from 'node:buffer';\n");
    try {
      expect(() => execFileSync(process.execPath, ['--check', probe], { stdio: 'pipe' })).toThrow();
    } finally {
      fs.unlinkSync(probe);
    }
  });
});
