/**
 * Preflight's effective-build-env layer (architecture audit 2026-08-16, H2).
 *
 * `scripts/preflight-check.js` used to validate `process.env` directly. The
 * production flags live in `eas.json` (`build.<profile>.env`) and the secrets
 * live in the EAS project env store, so a clean checkout failed sections 8/9 on
 * every run — and `npm run preflight` always passes `--platform ios`, so
 * `isProductionBuild` is always true and there was no way out. A mandatory gate
 * (Hard Rule #6) that cannot pass is the corrosive shape CLAUDE.md §8 already
 * documents for the old coverage threshold.
 *
 * These tests pin the two halves of the fix: the merge is correct and the
 * degradations are graceful, AND the relaxation did not become a blanket
 * "anything goes" — a value that is present and wrong must still fail.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('os') as typeof import('os');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as typeof import('path');
const {
  parseProfileArg,
  readEasProfileEnv,
  resolveEffectiveEnv,
  describeEnvSource,
  isUnverifiableLocally,
  DEFAULT_PROFILE,
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('@/scripts/lib/preflightEnv');

const REPO_ROOT = path.join(__dirname, '..', '..');

function tmpProject(easJson: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-env-'));
  if (easJson !== null) fs.writeFileSync(path.join(dir, 'eas.json'), easJson);
  return dir;
}

describe('--profile input', () => {
  it('defaults to production', () => {
    expect(parseProfileArg(['node', 'preflight-check.js', '--platform', 'ios']))
      .toBe(DEFAULT_PROFILE);
    expect(DEFAULT_PROFILE).toBe('production');
  });

  it('takes an explicit profile', () => {
    expect(parseProfileArg(['node', 'x', '--profile', 'preview'])).toBe('preview');
  });

  it('ignores a dangling --profile with no value', () => {
    expect(parseProfileArg(['node', 'x', '--profile', '--platform', 'ios']))
      .toBe(DEFAULT_PROFILE);
  });
});

describe('eas.json parse', () => {
  it('reads build.<profile>.env', () => {
    const dir = tmpProject(JSON.stringify({
      build: { production: { env: { EXPO_PUBLIC_USE_REVENUECAT: 'true' } } },
    }));
    const result = readEasProfileEnv(dir, 'production');
    expect(result.easJsonFound).toBe(true);
    expect(result.profileFound).toBe(true);
    expect(result.env).toEqual({ EXPO_PUBLIC_USE_REVENUECAT: 'true' });
    expect(result.warnings).toEqual([]);
  });

  it('a profile with no env block is found but contributes nothing', () => {
    const dir = tmpProject(JSON.stringify({ build: { development: { developmentClient: true } } }));
    const result = readEasProfileEnv(dir, 'development');
    expect(result.profileFound).toBe(true);
    expect(result.env).toEqual({});
  });
});

describe('degrades gracefully instead of throwing', () => {
  // A preflight that crashes because eas.json moved is worse than one that
  // tells you it fell back to the shell env — the whole point of H2 is that a
  // gate people cannot read stops being a gate.
  it('missing eas.json → pure process.env, with a warning', () => {
    const dir = tmpProject(null);
    const r = resolveEffectiveEnv({
      cwd: dir, profile: 'production', processEnv: { FOO: 'bar' },
    });
    expect(r.easJsonFound).toBe(false);
    expect(r.profileFound).toBe(false);
    expect(r.env).toEqual({ FOO: 'bar' });
    expect(r.warnings.join(' ')).toMatch(/eas\.json not found/);
  });

  it('unparseable eas.json → pure process.env, with a warning', () => {
    const dir = tmpProject('{ not json');
    const r = resolveEffectiveEnv({ cwd: dir, profile: 'production', processEnv: { FOO: 'bar' } });
    expect(r.env).toEqual({ FOO: 'bar' });
    expect(r.profileFound).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/could not be parsed/);
  });

  it('unknown profile → pure process.env, and the warning names the real ones', () => {
    const dir = tmpProject(JSON.stringify({ build: { production: {}, preview: {} } }));
    const r = resolveEffectiveEnv({ cwd: dir, profile: 'staging', processEnv: {} });
    expect(r.profileFound).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/no build profile "staging".*production, preview/);
  });
});

describe('merge precedence', () => {
  const dir = tmpProject(JSON.stringify({
    build: {
      production: {
        env: { EXPO_PUBLIC_ENABLE_ADMOB: 'true', EXPO_PUBLIC_ENABLE_FIREBASE: 'true' },
      },
    },
  }));

  it('eas.json supplies the baseline', () => {
    const r = resolveEffectiveEnv({ cwd: dir, profile: 'production', processEnv: {} });
    expect(r.env.EXPO_PUBLIC_ENABLE_ADMOB).toBe('true');
    expect(r.env.EXPO_PUBLIC_ENABLE_FIREBASE).toBe('true');
  });

  it('an explicit export wins — it stands in for the EAS server store, which EAS ranks above eas.json', () => {
    const r = resolveEffectiveEnv({
      cwd: dir, profile: 'production', processEnv: { EXPO_PUBLIC_ENABLE_ADMOB: 'false' },
    });
    expect(r.env.EXPO_PUBLIC_ENABLE_ADMOB).toBe('false');
  });

  it('and a disagreement is reported rather than swallowed', () => {
    // The second, unversioned source of truth is the failure mode H2 warns
    // about; it may win, but it may not do so silently.
    const r = resolveEffectiveEnv({
      cwd: dir, profile: 'production', processEnv: { EXPO_PUBLIC_ENABLE_ADMOB: 'false' },
    });
    expect(r.conflicts).toEqual(['EXPO_PUBLIC_ENABLE_ADMOB']);
  });

  it('an identical local export is not a conflict', () => {
    const r = resolveEffectiveEnv({
      cwd: dir, profile: 'production', processEnv: { EXPO_PUBLIC_ENABLE_ADMOB: 'true' },
    });
    expect(r.conflicts).toEqual([]);
  });
});

describe('"not verifiable locally" is narrower than "not set"', () => {
  const dir = tmpProject(JSON.stringify({
    build: { production: { env: { EXPO_PUBLIC_USE_REVENUECAT: 'true' } } },
  }));
  const r = resolveEffectiveEnv({
    cwd: dir, profile: 'production', processEnv: { EXPO_PUBLIC_RC_IOS_KEY: 'appl_x' },
  });

  it('classifies each source', () => {
    expect(describeEnvSource('EXPO_PUBLIC_USE_REVENUECAT', r)).toBe('eas.json');
    expect(describeEnvSource('EXPO_PUBLIC_RC_IOS_KEY', r)).toBe('process env');
    expect(describeEnvSource('EXPO_PUBLIC_IAP_VERIFY_URL', r)).toBe('absent');
  });

  it('only a name absent from BOTH layers is unverifiable', () => {
    expect(isUnverifiableLocally('EXPO_PUBLIC_RC_IOS_KEY', r)).toBe(false);
    expect(isUnverifiableLocally('EXPO_PUBLIC_USE_REVENUECAT', r)).toBe(false);
    expect(isUnverifiableLocally('EXPO_PUBLIC_IAP_VERIFY_URL', r)).toBe(true);
  });

  it('an exported-but-EMPTY value is DECLARED, so it keeps its hard failure', () => {
    // The control on the whole downgrade, and not hypothetical: GitHub Actions
    // substitutes an empty string for a `${secrets.X}` that was never
    // configured, and `.github/workflows/eas-build-local-ios.yml` is a hard gate
    // that injects every required name. If empty counted as "unknown", a missing
    // CI secret would silently downgrade to a warning.
    const r2 = resolveEffectiveEnv({
      cwd: dir, profile: 'production', processEnv: { EXPO_PUBLIC_ADMOB_BANNER_ANDROID: '' },
    });
    expect(describeEnvSource('EXPO_PUBLIC_ADMOB_BANNER_ANDROID', r2)).toBe('process env');
    expect(isUnverifiableLocally('EXPO_PUBLIC_ADMOB_BANNER_ANDROID', r2)).toBe(false);
  });
});

describe("the repo's own eas.json — the config the gate was failing on", () => {
  const r = resolveEffectiveEnv({ cwd: REPO_ROOT, profile: 'production', processEnv: {} });

  it('production profile is readable', () => {
    expect(r.easJsonFound).toBe(true);
    expect(r.profileFound).toBe(true);
  });

  it('supplies the flags §9 and §9b used to report as unset on a clean checkout', () => {
    expect(r.env.EXPO_PUBLIC_USE_REVENUECAT).toBe('true');
    expect(r.env.EXPO_PUBLIC_ENABLE_FIREBASE).toBe('true');
    expect(r.env.EXPO_PUBLIC_ENABLE_IAP).toBe('true');
    expect(r.env.EXPO_PUBLIC_ENABLE_ADMOB).toBe('true');
  });

  it('and the RC key / verify URL genuinely are store-only (hence WARN, not FAIL)', () => {
    for (const name of [
      'EXPO_PUBLIC_RC_IOS_KEY',
      'EXPO_PUBLIC_RC_ANDROID_KEY',
      'EXPO_PUBLIC_RC_API_KEY',
      'EXPO_PUBLIC_IAP_VERIFY_URL',
      'EXPO_PUBLIC_SAVE_HMAC_KEY',
    ]) {
      expect(describeEnvSource(name, r)).toBe('absent');
    }
  });
});

describe('preflight-check.js routes its config sections through the merged env', () => {
  const SRC = fs.readFileSync(path.join(REPO_ROOT, 'scripts/preflight-check.js'), 'utf8');

  it('resolves the effective env once, from eas.json + argv', () => {
    expect(SRC).toMatch(/resolveEffectiveEnv\(\{ cwd: process\.cwd\(\), argv: process\.argv \}\)/);
  });

  it('no EXPO_PUBLIC_* value is read from process.env any more (the regression guard)', () => {
    // `process.env` still appears legitimately — it is forwarded to child
    // processes (tsc, the ratchet) and is the overlay inside preflightEnv.
    // What must not come back is a *section* reading a build flag off the shell.
    const offenders = SRC.split('\n').filter((line) => /process\.env(\.|\[)/.test(line)
      && /EXPO_PUBLIC_|ADMOB_/.test(line));
    expect(offenders).toEqual([]);
  });

  it('still fails hard on Google TEST ad unit ids — present-but-wrong is not softened', () => {
    expect(SRC).toMatch(/ca-app-pub-3940256099942544/);
    const section = SRC.slice(SRC.indexOf('testUnits.length > 0'));
    expect(section).toMatch(/hasErrors = true/);
  });

  it('names the profile baseline in the affected sections', () => {
    expect(SRC).toMatch(/function logEnvBaseline\(\)/);
    // 5, 6, 8, 8b, 9, 9b, 10 — every section that judges build config.
    expect(SRC.match(/logEnvBaseline\(\);/g) || []).toHaveLength(7);
  });
});
