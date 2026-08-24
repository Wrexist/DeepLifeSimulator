/**
 * Owner rule (2026-08-24): NO em dashes anywhere in the game, ever.
 *
 * This ratchet walks every runtime source file with a small string-aware
 * lexer and fails on an em dash inside any string or template literal - the
 * text a player can actually see. Comments are exempt on purpose: they are
 * not game copy, and churning ~7k comment dashes would bury real diffs.
 * Player-facing markdown (RELEASE_NOTES, WHATS_NEW) is checked whole-file.
 */
import fs from 'fs';
import path from 'path';

// Built from the code point so the sweep that enforces this rule can never
// rewrite the needle itself (v1 of this file used a literal and the sweep
// turned it into a hyphen, making the guard count hyphens).
const EM = String.fromCharCode(0x2014);
const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'services', 'src', 'utils'];
const WHOLE_FILE = ['RELEASE_NOTES.md', 'WHATS_NEW.md'];

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield full;
  }
}

/**
 * Count em dashes inside string/template literals (the player-visible text).
 * Template interpolations are tracked with an explicit stack so text AFTER a
 * ${...} is still template text - the v1 lexer lost state there and let 198
 * post-interpolation em dashes through.
 */
function emDashesInStrings(src: string): number {
  let count = 0;
  let state: 'code' | 'line' | 'block' | 'single' | 'double' = 'code';
  // 'tpl' = template text; a number = brace depth inside an interpolation.
  const stack: ('tpl' | number)[] = [];
  const inTemplate = () => stack.length > 0 && stack[stack.length - 1] === 'tpl';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1] ?? '';
    if (inTemplate() && state === 'code') {
      if (c === '\\') i++;
      else if (c === EM) count++;
      else if (c === '$' && n === '{') { i++; stack.push(0); }
      else if (c === '`') stack.pop();
      continue;
    }
    switch (state) {
      case 'code': {
        const top = stack[stack.length - 1];
        if (c === '/' && n === '/') state = 'line';
        else if (c === '/' && n === '*') state = 'block';
        else if (c === "'") state = 'single';
        else if (c === '"') state = 'double';
        else if (c === '`') stack.push('tpl');
        else if (c === '{' && typeof top === 'number') stack[stack.length - 1] = top + 1;
        else if (c === '}' && typeof top === 'number') {
          if (top === 0) stack.pop();
          else stack[stack.length - 1] = top - 1;
        }
        break;
      }
      case 'line':
        if (c === '\n') state = 'code';
        break;
      case 'block':
        if (c === '*' && n === '/') { i++; state = 'code'; }
        break;
      case 'single':
      case 'double': {
        const q = state === 'single' ? "'" : '"';
        if (c === '\\') i++;
        else if (c === EM) count++;
        else if (c === q || c === '\n') state = 'code';
        break;
      }
    }
  }
  return count;
}

describe('no em dash in game copy (owner rule, ratcheted at zero)', () => {
  it('runtime source is clean', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const dir of RUNTIME_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        scanned++;
        const src = fs.readFileSync(file, 'utf-8');
        // .tsx: ZERO anywhere - JSX text children are player-visible and no
        // lexer reliably separates them from comments, so comments pay the
        // price of the stricter rule (they were swept clean once already).
        // .ts: strings only - comments are not game copy and churning ~7k of
        // them would bury real diffs.
        const hits = file.endsWith('.tsx')
          ? (src.split(EM).length - 1)
          : emDashesInStrings(src);
        if (hits > 0) offenders.push(`${path.relative(ROOT, file)} (${hits})`);
      }
    }
    expect(scanned).toBeGreaterThan(500); // the walk actually walked
    expect(offenders).toEqual([]);
  });

  it('player-facing release copy is clean', () => {
    for (const name of WHOLE_FILE) {
      const text = fs.readFileSync(path.join(ROOT, name), 'utf-8');
      expect(`${name}: ${text.includes(EM) ? 'HAS EM DASH' : 'clean'}`).toBe(`${name}: clean`);
    }
  });
});
