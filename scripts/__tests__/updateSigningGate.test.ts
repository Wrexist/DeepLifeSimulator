/**
 * The OTA publish gate.
 *
 * `eas update` ships a fresh JS bundle to every installed device with no App
 * Store review and no preflight. `EXPO_PUBLIC_SAVE_HMAC_KEY` signs both saves
 * and permanent IAP entitlements through one envelope, so an update published
 * without it makes every save unreadable and presents every paying player as
 * never having purchased — in the field, immediately, with the data intact but
 * unverifiable.
 *
 * preflight §8 guards `eas build`. This guards the faster path.
 */
import { execFileSync } from 'child_process';
import path from 'path';

const SCRIPT = path.join(__dirname, '..', 'check-update-signing.js');
const WORKFLOW = path.join(__dirname, '..', '..', '.github', 'workflows', 'eas-update.yml');

/** Run the gate with a fake `eas` on PATH that prints `stdout` (or fails). */
function runWithFakeEas(
  args: string[],
  fake: { stdout?: string; exitCode?: number },
): { status: number; output: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os') as typeof import('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eas-gate-'));
  const easPath = path.join(dir, 'eas');
  const body = fake.exitCode
    ? `#!/bin/sh\necho "boom" >&2\nexit ${fake.exitCode}\n`
    : `#!/bin/sh\ncat <<'EOF'\n${fake.stdout ?? ''}\nEOF\n`;
  fs.writeFileSync(easPath, body, { mode: 0o755 });

  try {
    const output = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('the gate passes only when the key is really configured', () => {
  it('passes when the variable is listed', () => {
    const run = runWithFakeEas(['production'], {
      stdout: 'EXPO_PUBLIC_SAVE_HMAC_KEY  sensitive  production',
    });
    expect(run.status).toBe(0);
    expect(run.output).toMatch(/OK/);
  });

  it('accepts the legacy variable name the runtime also reads', () => {
    // `resolveSaveSigningRuntimeConfig` falls back to SAVE_SIGNATURE_KEY, so a
    // project still on that name is correctly signed and must not be blocked.
    const run = runWithFakeEas(['production'], {
      stdout: 'EXPO_PUBLIC_SAVE_SIGNATURE_KEY  sensitive  production',
    });
    expect(run.status).toBe(0);
  });

  it('FAILS when the key is absent', () => {
    const run = runWithFakeEas(['production'], {
      stdout: 'EXPO_PUBLIC_ADMOB_APP_ID  plain  production',
    });
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/not configured/i);
  });

  it('names the consequence, not just the missing variable', () => {
    const run = runWithFakeEas(['production'], { stdout: 'NOTHING_RELEVANT' });
    expect(run.output).toMatch(/entitlements/i);
    expect(run.output).toMatch(/eas env:create/);
    // And tells you to KEEP the old keys, which is the part that saves saves.
    expect(run.output).toMatch(/previous-key|previously shipped/i);
  });

  it('FAILS when it cannot ask, rather than assuming the best', () => {
    // A failure to check is not a pass. Publishing anyway is the silent path
    // this gate exists to close.
    const run = runWithFakeEas(['production'], { exitCode: 3 });
    expect(run.status).toBe(1);
    expect(run.output).toMatch(/could not read EAS environment/i);
  });

  it('requires an environment argument', () => {
    const run = runWithFakeEas([], { stdout: 'EXPO_PUBLIC_SAVE_HMAC_KEY' });
    expect(run.status).toBe(1);
  });
});

describe('the workflow actually runs the gate, and injects the environment', () => {
  const workflow = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    return fs.readFileSync(WORKFLOW, 'utf8');
  };

  it('gates both channels', () => {
    const yml = workflow();
    expect(yml).toMatch(/check-update-signing\.js preview/);
    expect(yml).toMatch(/check-update-signing\.js production/);
  });

  it('passes --environment to eas update', () => {
    // Without it, `eas update` bundles from the CI shell's environment — which
    // holds none of the EAS project variables — so the key inlines as
    // `undefined` even when it IS correctly configured in EAS. The gate would
    // pass and the bundle would still ship unsigned.
    const yml = workflow();
    expect(yml).toMatch(/eas update --channel=preview --environment preview/);
    expect(yml).toMatch(/eas update --channel=production --environment production/);
  });

  it('gates before it publishes', () => {
    const yml = workflow();
    expect(yml.indexOf('check-update-signing.js production')).toBeLessThan(
      yml.indexOf('eas update --channel=production'),
    );
  });
});
