'use strict';
/**
 * The env a BUILD will actually see — not the env this shell happens to have.
 *
 * ── The bug this exists to fix (audit 2026-08-16, H2) ─────────────────────
 *
 * `preflight-check.js` read `process.env` directly. The production flag values
 * live in `eas.json` (`build.<profile>.env`) and the secrets live in the EAS
 * project env store, so on a clean checkout sections 9 / 9b / 10 failed on
 * every run — flags the build definitely sets (EXPO_PUBLIC_USE_REVENUECAT,
 * EXPO_PUBLIC_ENABLE_FIREBASE) read as unset, and secrets that only exist
 * server-side read as missing. `npm run preflight` passes `--platform ios`, so
 * `isProductionBuild` is always true and there was no escape. A mandatory gate
 * (CLAUDE.md Hard Rule #6) that cannot pass is the corrosive shape CLAUDE.md §8
 * already documents for the old coverage threshold: it trains you to skim the
 * failure, which is how a real one gets missed.
 *
 * ── Precedence, and why it is what it is ──────────────────────────────────
 *
 * Effective env = { ...eas.json profile env, ...process.env } — an explicitly
 * exported value wins.
 *
 * That matches how EAS resolves a real build. Expo documents the order as
 * EAS-server environment variables / secrets ABOVE `eas.json`'s `env`, which in
 * turn sits above `.env` files. A locally exported value is standing in for the
 * one layer this script cannot read (the server store), so giving it the same
 * priority the store has is the faithful model — and it is also what the CI
 * workflows depend on: `.github/workflows/eas-build*.yml` inject the real
 * secrets through the process env and expect them to be validated.
 *
 * The one thing this ordering can hide is a local export that DISAGREES with
 * eas.json, so those are surfaced as an explicit note rather than swallowed.
 *
 * ── What "not verifiable locally" means ───────────────────────────────────
 *
 * A name present in neither layer is unknown, not absent: it may well be set in
 * the EAS env store. Sections downgrade those to a WARN. A name that IS present
 * and WRONG (malformed ad unit, Google's test unit id, http:// verify URL) is
 * still a hard failure — this softens the gate's blind spot, not its teeth.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_PROFILE = 'production';

/** Read `--profile <name>` from argv, defaulting to the production profile. */
function parseProfileArg(argv = process.argv) {
  const i = argv.indexOf('--profile');
  if (i !== -1 && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--')) {
    return argv[i + 1];
  }
  return DEFAULT_PROFILE;
}

/**
 * Read `build.<profile>.env` out of eas.json.
 *
 * Every failure mode degrades to "no baseline, plus a warning" rather than
 * throwing — a preflight that crashes because eas.json moved is worse than one
 * that tells you it fell back to the shell env.
 *
 * @returns {{ env: Record<string,string>, easJsonPath: string, easJsonFound: boolean,
 *             profileFound: boolean, warnings: string[] }}
 */
function readEasProfileEnv(cwd = process.cwd(), profile = DEFAULT_PROFILE) {
  const easJsonPath = path.join(cwd, 'eas.json');
  const result = {
    env: {},
    easJsonPath,
    easJsonFound: false,
    profileFound: false,
    warnings: [],
  };

  if (!fs.existsSync(easJsonPath)) {
    result.warnings.push(
      `eas.json not found at ${easJsonPath} — falling back to the shell environment only. `
      + 'Flag values the build sets cannot be verified.'
    );
    return result;
  }
  result.easJsonFound = true;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
  } catch (error) {
    result.warnings.push(
      `eas.json could not be parsed (${error instanceof Error ? error.message : String(error)}) — `
      + 'falling back to the shell environment only.'
    );
    return result;
  }

  const profileConfig = parsed && parsed.build && parsed.build[profile];
  if (!profileConfig || typeof profileConfig !== 'object') {
    const available = parsed && parsed.build && typeof parsed.build === 'object'
      ? Object.keys(parsed.build).join(', ')
      : '(none)';
    result.warnings.push(
      `eas.json has no build profile "${profile}" (available: ${available}) — `
      + 'falling back to the shell environment only.'
    );
    return result;
  }
  result.profileFound = true;

  const profileEnv = profileConfig.env;
  if (profileEnv && typeof profileEnv === 'object') {
    for (const [key, value] of Object.entries(profileEnv)) {
      if (value === null || value === undefined) continue;
      result.env[key] = String(value);
    }
  }

  return result;
}

/**
 * Build the env a build of `profile` would see, from the two layers this script
 * can actually read.
 *
 * @param {{ cwd?: string, profile?: string, processEnv?: Record<string,string|undefined>, argv?: string[] }} [opts]
 */
function resolveEffectiveEnv(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const processEnv = opts.processEnv || process.env;
  const profile = opts.profile || parseProfileArg(opts.argv || process.argv);

  const eas = readEasProfileEnv(cwd, profile);
  const env = { ...eas.env, ...processEnv };

  // A local export that contradicts eas.json is not an error (the store layer
  // legitimately overrides), but it IS the second source of truth this fix was
  // meant to avoid creating, so it never passes silently.
  const conflicts = Object.keys(eas.env).filter(
    (key) => typeof processEnv[key] === 'string' && processEnv[key] !== eas.env[key]
  );

  return {
    env,
    profile,
    easEnv: eas.env,
    easJsonPath: eas.easJsonPath,
    easJsonFound: eas.easJsonFound,
    profileFound: eas.profileFound,
    warnings: eas.warnings,
    conflicts,
    processEnv,
  };
}

/**
 * Where a given name's value came from: 'eas.json' | 'process env' | 'both' |
 * 'absent'. 'absent' is the one that means "unknown, possibly in the EAS store".
 */
function describeEnvSource(name, resolution) {
  const inEas = Object.prototype.hasOwnProperty.call(resolution.easEnv, name);
  // DECLARED, not non-empty. An empty string is a value someone chose to pass —
  // and it is precisely what GitHub Actions substitutes for a `${{ secrets.X }}`
  // that was never configured. The CI workflows inject every required name
  // explicitly, so an empty one there means "misconfigured" and must keep its
  // hard failure; only a name nobody mentioned at all is "unknown".
  const inProc = typeof resolution.processEnv[name] === 'string';
  if (inEas && inProc) return 'both';
  if (inProc) return 'process env';
  if (inEas) return 'eas.json';
  return 'absent';
}

/**
 * True when a name has no value in either readable layer — so preflight cannot
 * tell a genuinely missing value from one held in the EAS project env store.
 */
function isUnverifiableLocally(name, resolution) {
  return describeEnvSource(name, resolution) === 'absent';
}

/** The standard wording for the downgrade, so every section says it the same way. */
function unverifiableNote(names) {
  const list = Array.isArray(names) ? names.join(', ') : String(names);
  return `${list} — not verifiable locally: set in the EAS project env store, or export it in `
    + 'your shell to verify here. A value that IS present but wrong still fails.';
}

module.exports = {
  DEFAULT_PROFILE,
  parseProfileArg,
  readEasProfileEnv,
  resolveEffectiveEnv,
  describeEnvSource,
  isUnverifiableLocally,
  unverifiableNote,
};
