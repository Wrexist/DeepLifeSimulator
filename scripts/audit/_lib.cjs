/**
 * Shared toolkit for the DeepLife weekly audit suite.
 *
 * Every audit module (`audit-*.cjs`) is a deterministic static analyzer that reads the
 * real source/constants of the repo and returns a normalized result. This file is the
 * only place that knows about colors, file walking, constant extraction, severity, and
 * Markdown rendering — keep the individual audits focused on *what* to check.
 *
 * Severity model (higher = worse):
 *   critical  — ships a broken build or a money/save-destroying exploit. CI must fail.
 *   high      — a real defect or a documented-exploit regression. CI must fail.
 *   medium    — a likely defect or drift that needs human eyes. CI warns (does not fail).
 *   low       — a smell / cleanup opportunity. CI warns.
 *   info      — context only.
 *   pass      — an invariant was verified green.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Severity
// ---------------------------------------------------------------------------
const LEVELS = ['pass', 'info', 'low', 'medium', 'high', 'critical'];
const FAILING_LEVELS = new Set(['high', 'critical']);

function levelRank(level) {
  const i = LEVELS.indexOf(level);
  return i === -1 ? 0 : i;
}

// ---------------------------------------------------------------------------
// Colors (no dependency; respects NO_COLOR / non-TTY)
// ---------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  red: (s) => paint('31', s),
  green: (s) => paint('32', s),
  yellow: (s) => paint('33', s),
  blue: (s) => paint('34', s),
  magenta: (s) => paint('35', s),
  cyan: (s) => paint('36', s),
  gray: (s) => paint('90', s),
  bold: (s) => paint('1', s),
};

const LEVEL_TAG = {
  critical: () => c.red(c.bold('[FAIL]')),
  high: () => c.red('[FAIL]'),
  medium: () => c.yellow('[WARN]'),
  low: () => c.yellow('[WARN]'),
  info: () => c.gray('[INFO]'),
  pass: () => c.green('[PASS]'),
};
const LEVEL_EMOJI = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
  info: 'ℹ️',
  pass: '✅',
};

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.expo', 'ios', 'android', 'dist', 'build',
  'coverage', '.idea', '.vscode', '.cursor', '.bolt', 'output', 'screenshots',
  'assets', 'marketing', '.playwright-cli',
]);

function read(rel) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

/** Recursively collect files under `rel` dirs whose name matches `filter(name)`. */
function walk(relDirs, filter) {
  const out = [];
  const roots = Array.isArray(relDirs) ? relDirs : [relDirs];
  for (const relDir of roots) {
    const abs = path.join(REPO_ROOT, relDir);
    if (!fs.existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.isDirectory()) {
          if (!IGNORED_DIRS.has(e.name)) stack.push(path.join(dir, e.name));
        } else if (filter(e.name)) {
          out.push(path.relative(REPO_ROOT, path.join(dir, e.name)));
        }
      }
    }
  }
  return out.sort();
}

const isSource = (name) => /\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name);
const isTest = (name) => /\.(test|spec|stress)\.(ts|tsx)$/.test(name);
const isProductionSource = (name) => isSource(name) && !isTest(name);

/** Scan files for a regex, returning [{ file, line, text }] matches (excludes commented lines optionally). */
function grep(files, regex, { skipComments = false } = {}) {
  const hits = [];
  for (const file of files) {
    const src = read(file);
    if (src == null) continue;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (skipComments) {
        const trimmed = text.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      }
      // Reset global regex state per line.
      regex.lastIndex = 0;
      if (regex.test(text)) hits.push({ file, line: i + 1, text: text.trim() });
    }
  }
  return hits;
}

/**
 * Strip comments and string/template literals from source so brace-matching and
 * keyword scans don't trip over `{`/`try`/`require` that live inside them.
 */
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => '`' + ' '.repeat(Math.max(0, m.length - 2)) + '`')
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => "'" + ' '.repeat(Math.max(0, m.length - 2)) + "'")
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => '"' + ' '.repeat(Math.max(0, m.length - 2)) + '"');
}

/**
 * Return the [start, end) character ranges of every `try { … }` block body in
 * `src` (brace-matched, comment/string-aware). Lets callers verify that a given
 * match index is *actually* guarded, not merely that a try exists in the file.
 */
function tryRanges(src) {
  const clean = stripNoise(src);
  const ranges = [];
  const re = /\btry\s*\{/g;
  let m;
  while ((m = re.exec(clean))) {
    const open = m.index + m[0].length - 1; // index of the `{`
    let depth = 0;
    let i = open;
    for (; i < clean.length; i++) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    ranges.push([open, i]);
    re.lastIndex = open + 1;
  }
  return ranges;
}

/** True if `index` falls within any of the given [start, end) ranges. */
function inAnyRange(ranges, index) {
  return ranges.some(([s, e]) => index > s && index < e);
}

// ---------------------------------------------------------------------------
// Constant extraction (parse `export const NAME = <number>` from TS sources)
// ---------------------------------------------------------------------------
/** Read a numeric `export const NAME = 123_456.7` (underscores tolerated). null if absent. */
function extractNumber(src, name) {
  if (src == null) return null;
  const re = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*([0-9_]*\\.?[0-9_]+)`);
  const m = src.match(re);
  if (!m) return null;
  const n = Number(m[1].replace(/_/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Audit result builder
// ---------------------------------------------------------------------------
class Audit {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.findings = [];
  }

  add(level, title, detail, ref) {
    this.findings.push({ level, title, detail: detail || '', ref: ref || '' });
    return this;
  }
  critical(t, d, r) { return this.add('critical', t, d, r); }
  high(t, d, r) { return this.add('high', t, d, r); }
  medium(t, d, r) { return this.add('medium', t, d, r); }
  low(t, d, r) { return this.add('low', t, d, r); }
  info(t, d, r) { return this.add('info', t, d, r); }
  pass(t, d, r) { return this.add('pass', t, d, r); }

  /** Convenience: pass when `ok`, otherwise `level`. */
  assert(ok, level, passTitle, failTitle, detail, ref) {
    return ok ? this.pass(passTitle, detail, ref) : this.add(level, failTitle, detail, ref);
  }

  get worst() {
    return this.findings.reduce((w, f) => (levelRank(f.level) > levelRank(w) ? f.level : w), 'pass');
  }
  count(level) {
    return this.findings.filter((f) => f.level === level).length;
  }
  get failed() {
    return this.findings.some((f) => FAILING_LEVELS.has(f.level));
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function printConsole(audit) {
  console.log('');
  console.log(c.bold(c.cyan(`━━ ${audit.id}. ${audit.title} ━━`)));
  for (const f of audit.findings) {
    if (f.level === 'pass' && process.env.AUDIT_QUIET) continue;
    const tag = (LEVEL_TAG[f.level] || (() => `[${f.level}]`))();
    let line = `  ${tag} ${f.title}`;
    if (f.ref) line += c.gray(`  (${f.ref})`);
    console.log(line);
    if (f.detail && f.level !== 'pass') console.log(c.gray(`         ${f.detail}`));
  }
}

function toMarkdown(audit) {
  const lines = [];
  lines.push(`### ${audit.id}. ${audit.title}`);
  lines.push('');
  const summary = ['critical', 'high', 'medium', 'low', 'pass']
    .map((lvl) => `${LEVEL_EMOJI[lvl]} ${audit.count(lvl)}`)
    .join(' · ');
  lines.push(`**Summary:** ${summary}`);
  lines.push('');
  // Non-pass findings first, as a table.
  const issues = audit.findings.filter((f) => f.level !== 'pass');
  if (issues.length) {
    lines.push('| Sev | Finding | Detail | Ref |');
    lines.push('|-----|---------|--------|-----|');
    for (const f of issues) {
      const detail = (f.detail || '').replace(/\|/g, '\\|');
      const ref = (f.ref || '').replace(/\|/g, '\\|');
      lines.push(`| ${LEVEL_EMOJI[f.level]} | ${f.title.replace(/\|/g, '\\|')} | ${detail} | ${ref} |`);
    }
  } else {
    lines.push('_No issues — all invariants green._');
  }
  lines.push('');
  const passes = audit.findings.filter((f) => f.level === 'pass');
  if (passes.length) {
    lines.push('<details><summary>✅ Passing invariants (' + passes.length + ')</summary>');
    lines.push('');
    for (const f of passes) lines.push(`- ${f.title}${f.ref ? ` _(${f.ref})_` : ''}`);
    lines.push('');
    lines.push('</details>');
  }
  lines.push('');
  return lines.join('\n');
}

/** Standalone runner for an individual `audit-*.cjs` module. */
function runStandalone(buildFn) {
  const audit = buildFn();
  printConsole(audit);
  console.log('');
  if (audit.failed) {
    console.log(c.red(c.bold(`✗ ${audit.title}: ${audit.count('critical')} critical, ${audit.count('high')} high`)));
    process.exitCode = 1;
  } else {
    const warns = audit.count('medium') + audit.count('low');
    console.log(warns
      ? c.yellow(`⚠ ${audit.title}: ${warns} warning(s), no blockers`)
      : c.green(`✓ ${audit.title}: all clear`));
  }
}

module.exports = {
  REPO_ROOT,
  LEVELS,
  FAILING_LEVELS,
  LEVEL_EMOJI,
  levelRank,
  c,
  read,
  exists,
  walk,
  grep,
  isSource,
  isTest,
  isProductionSource,
  stripNoise,
  tryRanges,
  inAnyRange,
  extractNumber,
  Audit,
  printConsole,
  toMarkdown,
  runStandalone,
};
