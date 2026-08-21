/**
 * "Does anything actually CALL this?" — over the repo's own source.
 *
 * Written because three separate bugs this month shared one shape: a symbol
 * that LOOKS like the wiring and is not.
 *
 *   `getOperatingOverhead`   written to make the passive-income soft cap
 *                            visible; only its own tests ever called it, so the
 *                            cap stayed invisible and a player reported the
 *                            money as missing.
 *   `hasEarlyItemAccess`     the predicate behind a 4,000-point prestige bonus.
 *                            Zero callers, so the bonus does nothing.
 *   `shouldAutoCollectRent`  imported by `MoneyActionsContext` and never
 *                            called, behind a 5,000-point bonus.
 *
 * Every guard that looked for these counted a MENTION as a reader — an import,
 * a comment, the declaration itself. That is why all three passed. This counts
 * a mention as a caller only when it is neither the declaration, nor an import
 * statement, nor a comment.
 *
 * Deliberately textual rather than a real call graph: the repo has no TS
 * program available in the test environment, and the shapes that matter here
 * (`fn(`, `fn (`, passed as a value) are all visible in text. It over-reports
 * rather than under-reports on purpose — a false "it has a caller" would make
 * this guard useless, while a false "it has no caller" fails loudly and gets
 * looked at.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__tests__', 'tasks', 'docs', 'marketing', 'assets', 'android', 'ios',
]);

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

let cached: [string, string][] | null = null;

/** Every non-test source file in the repo, as `[relativePath, contents]`. */
export function sourceFiles(): [string, string][] {
  if (!cached) {
    cached = collect(repoRoot).map((f) => [path.relative(repoRoot, f), fs.readFileSync(f, 'utf8')]);
  }
  return cached;
}

/** Strip block and line comments, so a symbol named in prose is not a caller. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Places that reference `name` as CODE rather than as a mention.
 *
 * Excludes: the file that declares it, `import` statements (and the indented
 * member lines of a multi-line import list), and comments. Returns
 * `file: line` strings so a failure names where to look.
 */
export function realCallersOf(name: string): string[] {
  const declPattern = new RegExp(`(export )?(function|const|let|class) ${name}\\b`);
  const usePattern = new RegExp(`\\b${name}\\b`);
  const hits: string[] = [];

  for (const [file, raw] of sourceFiles()) {
    if (declPattern.test(raw)) continue; // the declaring file is never a caller

    let inImportList = false;
    for (const line of stripComments(raw).split('\n')) {
      // Track multi-line `import { … } from '…'` blocks so their member lines
      // are not mistaken for calls.
      if (inImportList) {
        if (/from\s+['"]/.test(line)) inImportList = false;
        continue;
      }
      if (/^\s*import\b/.test(line)) {
        if (!/from\s+['"]/.test(line)) inImportList = true;
        continue;
      }
      if (usePattern.test(line)) hits.push(`${file}: ${line.trim().slice(0, 90)}`);
    }
  }
  return hits;
}
