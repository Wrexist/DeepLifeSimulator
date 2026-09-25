/**
 * A missing repo secret must not erase a value the EAS store holds.
 *
 * The local-build workflows pass `EXPO_PUBLIC_*` values from repo secrets in
 * each build step's `env:` block. A secret that does not exist still arrives,
 * as an EMPTY variable. For `eas build --local`, eas-cli merges
 * `{ ...easStoreEnv, ...process.env }` (src/build/local.ts), so the shell wins,
 * and the local build plugin then drops empty values. Net effect: an empty
 * secret silently deletes the store's value from the build.
 *
 * That is not hypothetical. The Android ad units exist only in the EAS
 * production store (added 2026-09-20), with no repo secret, so the Android
 * workflow would have built an .aab with no ad units at all. Its preflight
 * gate stayed green meanwhile, because preflight runs under `eas env:exec`,
 * which merges the other way round (`{ ...process.env, ...store }`).
 *
 * The fix is a guard at the top of every local build step that unsets empty
 * `EXPO_PUBLIC_*` variables before `eas build` runs. This file pins it. Like
 * submitWorkflowInvariants.test.ts, it reads the workflows as text.
 */

import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW_DIR = path.join(__dirname, '../../.github/workflows');

const workflows = fs
  .readdirSync(WORKFLOW_DIR)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => ({
    name,
    text: fs.readFileSync(path.join(WORKFLOW_DIR, name), 'utf8').replace(/\r\n/g, '\n'),
  }));

/** Each step's text, comment lines removed, split on `- name:` step headers. */
function stepsOf(text: string): string[] {
  const lines = text.split('\n').filter((line) => !/^\s*#/.test(line));
  const steps: string[][] = [];
  for (const line of lines) {
    if (/^\s*- name:/.test(line)) steps.push([]);
    steps[steps.length - 1]?.push(line);
  }
  return steps.map((step) => step.join('\n'));
}

const localBuildSteps = workflows.flatMap(({ name, text }) =>
  stepsOf(text)
    .filter((step) => /\beas build\b/.test(step) && /--local\b/.test(step))
    .map((step) => ({ workflow: name, step })),
);

const GUARD_LOOP = /for name in \$\(compgen -e \| grep '\^EXPO_PUBLIC_'\); do/;
const GUARD_UNSET = /if \[ -z "\$\{!name\}" \]; then unset "\$name"; fi/;

describe('local build steps keep the EAS store values', () => {
  it('finds the local build steps it is meant to guard', () => {
    const names = localBuildSteps.map((s) => s.workflow).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        'eas-build-local-android.yml',
        'eas-build-local-ios.yml',
        'eas-build-local-ios_diagnostics.yml',
      ]),
    );
  });

  it.each(localBuildSteps.map((s) => [s.workflow, s.step]))(
    '%s unsets empty EXPO_PUBLIC_* values before `eas build`',
    (_workflow, step) => {
      const loop = step.search(GUARD_LOOP);
      const unset = step.search(GUARD_UNSET);
      const build = step.search(/\beas build\b/);
      expect(loop).toBeGreaterThan(-1);
      expect(unset).toBeGreaterThan(loop);
      expect(build).toBeGreaterThan(unset);
    },
  );
});

/**
 * The merge, modelled, so the reason for the guard is executable rather than
 * only a comment: eas-cli spreads the store first and the shell second, and
 * the build plugin keeps only truthy values.
 */
describe('why an empty secret deletes a store value', () => {
  const store = { EXPO_PUBLIC_ADMOB_BANNER_ANDROID: 'ca-app-pub-1/2' };
  const build = (shell: Record<string, string>) =>
    Object.fromEntries(
      Object.entries({ ...store, ...shell }).filter(([, value]) => Boolean(value)),
    );

  it('an empty shell value wins the merge and is then dropped', () => {
    expect(build({ EXPO_PUBLIC_ADMOB_BANNER_ANDROID: '' })).toEqual({});
  });

  it('with the empty value unset, the store value reaches the build', () => {
    expect(build({})).toEqual(store);
  });

  it('a real repo secret still overrides the store, as intended', () => {
    expect(build({ EXPO_PUBLIC_ADMOB_BANNER_ANDROID: 'ca-app-pub-9/9' })).toEqual({
      EXPO_PUBLIC_ADMOB_BANNER_ANDROID: 'ca-app-pub-9/9',
    });
  });
});
