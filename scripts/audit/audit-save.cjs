/**
 * AUDIT 3 — Save & State Integrity
 *
 * Guards the save schema against the two failure modes that lock players out of their
 * progress: version drift (docs/migrations out of sync with STATE_VERSION) and test
 * GameState drift (manual construction that hides real schema gaps).
 *
 * Invariants:
 *   V1  STATE_VERSION is parseable from the canonical source (initialState.ts).
 *   V2  CLAUDE.md and AGENTS.md document the same STATE_VERSION (no doc drift — lessons.md).
 *   V3  Every version in [2..STATE_VERSION] is migration-covered (registry or no-op set).
 *   V4  CURRENT_STATE_VERSION tracks STATE_VERSION (no hardcoded fork).
 *   V5  Checksum + tamper verification primitives exist in saveValidation.ts.
 *   V6  Tests don't construct GameState manually (`as GameState`) — must use the factory.
 *   V7  createTestGameState factory exists.
 */
'use strict';

const L = require('./_lib.cjs');

// Tests legitimately allowed to touch raw GameState shape (the factory + its own tests).
const FACTORY_ALLOWLIST = [
  '__tests__/helpers/createTestGameState.ts',
];

function build() {
  const a = new L.Audit(3, 'Save & State Integrity');

  const initial = L.read('contexts/game/initialState.ts');
  const stateVersion = initial ? L.extractNumber(initial, 'STATE_VERSION') : null;

  // --- V1 ------------------------------------------------------------------
  if (stateVersion == null) {
    a.high('STATE_VERSION not parseable', 'Cannot anchor save-integrity checks.', 'contexts/game/initialState.ts:6');
    return a;
  }
  a.pass(`STATE_VERSION = ${stateVersion} (canonical)`, '', 'contexts/game/initialState.ts:6');

  // --- V2: doc drift -------------------------------------------------------
  // The dev docs were renamed (CLAUDE.md → DEV.md, AGENTS.md → WORKFLOW.md). The
  // current tree ships DEV.md/WORKFLOW.md and each must state the canonical
  // STATE_VERSION so drift is visible. Legacy names are still cross-checked when
  // present (older trees/worktrees) but their absence is expected and silent —
  // not a warning. This block previously hard-coded only the legacy names, so
  // after the rename the STATE_VERSION cross-check silently went dark.
  const CURRENT_DOCS = ['DEV.md', 'WORKFLOW.md'];
  const LEGACY_DOCS = ['CLAUDE.md', 'AGENTS.md'];
  let docsChecked = 0;
  for (const doc of [...CURRENT_DOCS, ...LEGACY_DOCS]) {
    const src = L.read(doc);
    if (src == null) {
      // A missing current doc is worth an INFO note; a missing legacy doc is
      // fully expected on the current tree, so stay silent.
      if (CURRENT_DOCS.includes(doc)) a.info(`${doc} not found`, 'Skipping doc-version check.', doc);
      continue;
    }
    const m = src.match(/STATE_VERSION\s*=\s*(\d+)/);
    if (!m) {
      a.medium(`${doc} does not state STATE_VERSION`, 'Add the canonical version so drift is visible.', doc);
    } else {
      docsChecked++;
      a.assert(Number(m[1]) === stateVersion, 'medium',
        `${doc} STATE_VERSION matches code (${stateVersion})`,
        `${doc} STATE_VERSION drift: doc says ${m[1]}, code is ${stateVersion}`,
        'Documented save-version drift has bitten this repo before (lessons.md).', doc);
    }
  }
  if (docsChecked === 0) {
    a.medium('No dev doc states STATE_VERSION',
      'DEV.md/WORKFLOW.md must document the canonical save version so drift is visible.', 'DEV.md');
  }

  // --- V3/V4: migration coverage ------------------------------------------
  const mig = L.read('utils/saveMigrations.ts');
  if (mig == null) {
    a.high('utils/saveMigrations.ts missing', 'Cannot verify migration coverage.', 'utils/saveMigrations.ts');
  } else {
    const current = L.extractNumber(mig, 'CURRENT_STATE_VERSION');
    const hasCurrent = /\bCURRENT_STATE_VERSION\s*=/.test(mig);
    // CURRENT_STATE_VERSION = STATE_VERSION (alias) — extractNumber returns null for a
    // non-numeric RHS, which is the *correct* wiring, so only flag a numeric fork.
    // But null also means the symbol is entirely absent — that must NOT pass silently.
    if (!hasCurrent) {
      a.high('CURRENT_STATE_VERSION not defined in saveMigrations',
        'The migration loop has no version ceiling to drive from.', 'utils/saveMigrations.ts:15');
    } else if (current != null && current !== stateVersion) {
      a.high('CURRENT_STATE_VERSION forked from STATE_VERSION',
        `saveMigrations hardcodes ${current}, initialState is ${stateVersion}.`, 'utils/saveMigrations.ts:15');
    } else {
      a.pass('CURRENT_STATE_VERSION aliases STATE_VERSION (no fork)', '', 'utils/saveMigrations.ts:15');
    }

    const registered = parseMigrationKeys(mig);
    const noop = parseNoOpVersions(mig);
    const covered = new Set([...registered, ...noop]);
    const gaps = [];
    for (let v = 2; v <= stateVersion; v++) if (!covered.has(v)) gaps.push(v);

    a.assert(gaps.length === 0, 'critical',
      `All versions [2..${stateVersion}] migration-covered (${registered.length} migrations, ${noop.length} no-ops)`,
      `Migration gap: version(s) ${gaps.join(', ')} have no migration or no-op entry`,
      'runMigrations halts at the first uncovered version — saves built before then will not load.',
      'utils/saveMigrations.ts:32');
  }

  // --- V5: integrity primitives -------------------------------------------
  const sv = L.read('utils/saveValidation.ts');
  if (sv == null) {
    a.high('utils/saveValidation.ts missing', 'Cannot verify save integrity primitives.', 'utils/saveValidation.ts');
  } else {
    a.assert(/calculateChecksum|0xedb88320/.test(sv), 'medium',
      'CRC32 checksum primitive present', 'CRC32 checksum primitive missing',
      'Corruption detection on load relies on it.', 'utils/saveValidation.ts');
    a.assert(/hmac|HMAC|sha256|SHA-?256/i.test(sv), 'low',
      'Tamper-detection (HMAC/SHA-256) primitive present', 'No HMAC/SHA-256 tamper primitive found',
      'Checksums catch corruption, not tampering.', 'utils/saveValidation.ts');
    a.assert(/repairGameState/.test(sv), 'medium',
      'repairGameState present (backfills missing defaults)', 'repairGameState not found',
      'Partial/cloud-synced saves need default backfill on load.', 'utils/saveValidation.ts');
  }

  // --- V6/V7: test GameState drift ----------------------------------------
  const factory = '__tests__/helpers/createTestGameState.ts';
  a.assert(L.exists(factory), 'high', 'createTestGameState factory present',
    'createTestGameState factory missing', 'All suites must build state through one factory (Hard Rule #3).', factory);

  const testFiles = L.walk('__tests__', L.isTest)
    .filter((f) => !FACTORY_ALLOWLIST.includes(f));
  const drift = L.grep(testFiles, /\bas GameState\b/, { skipComments: true });
  a.assert(drift.length === 0, 'medium',
    'No manual `as GameState` construction in tests',
    `${drift.length} \`as GameState\` assertion(s) in tests bypass the factory`,
    drift.slice(0, 5).map((d) => `${d.file}:${d.line}`).join(', ') + (drift.length > 5 ? ' …' : ''),
    'No GameState Drift (Hard Rule #3)');

  return a;
}

// --- helpers ---------------------------------------------------------------
function parseMigrationKeys(src) {
  // Isolate ONLY the `migrations = { … }` object body via brace matching, so numeric
  // keys in unrelated objects later in the file aren't miscounted as covered versions
  // (which would hide a real migration gap).
  // Non-greedy to the first `= {`; this skips over the generic type annotation
  // `Record<number, (state: any) => any>` whose `=>` arrow would defeat a `[^>]*` match.
  const start = src.match(/const\s+migrations\b[\s\S]*?=\s*\{/);
  if (!start) return [];
  const open = start.index + start[0].length - 1; // index of the opening `{`
  let depth = 0;
  let end = src.length;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(open + 1, end);
  const keys = new Set();
  // Top-level keys only: `<digits>:` at the object's first indentation level. Matching
  // line-start keys within the object body is sufficient since nested handler bodies
  // don't define bare numeric keys.
  const re = /^\s*(\d+)\s*:/gm;
  let m;
  while ((m = re.exec(body))) keys.add(Number(m[1]));
  return [...keys];
}

function parseNoOpVersions(src) {
  const m = src.match(/NO_OP_MIGRATION_VERSIONS\s*=\s*new Set<number>\(\s*\[([0-9,\s]*)\]/);
  if (!m) return [];
  return m[1].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
}

module.exports = { build };
if (require.main === module) L.runStandalone(build);
