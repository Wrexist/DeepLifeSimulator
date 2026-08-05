#!/usr/bin/env node
/**
 * Refuse to publish an OTA update that would ship WITHOUT a save-signing key.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * `EXPO_PUBLIC_SAVE_HMAC_KEY` signs two things that share one envelope: every
 * save, and every permanent IAP entitlement. If a bundle ships without it — or
 * with a different value — then on every device at once:
 *
 *   - saves stop verifying, and the menu reports them as missing;
 *   - `loadPermanentPerks` fails closed to `[]`, so a paying player presents as
 *     never having purchased.
 *
 * `scripts/preflight-check.js` §8 guards this for `eas build`. Nothing guarded
 * `eas update`, which publishes a fresh JS bundle straight to the production
 * channel on every push to `main` — no review, no preflight, every installed
 * device. That is a strictly faster path to the same outage, and it was open.
 *
 * The second half of the hole is that `eas update` only injects EAS project
 * environment variables when it is told which environment to use. Without
 * `--environment`, the bundle is built with whatever the CI shell happens to
 * have — which is nothing — so the key inlines as `undefined` even though it is
 * correctly configured in EAS. The workflow now passes `--environment`, and
 * this script proves the variable is actually there before the publish runs.
 *
 * It checks only that the NAME is configured. The value is a secret and stays
 * one; presence is the whole question.
 *
 * Usage: node scripts/check-update-signing.js <environment>
 */
'use strict';

const { execFileSync } = require('child_process');

const REQUIRED = 'EXPO_PUBLIC_SAVE_HMAC_KEY';
/** Accepted as an equivalent, matching `resolveSaveSigningRuntimeConfig`. */
const ALTERNATIVE = 'EXPO_PUBLIC_SAVE_SIGNATURE_KEY';

function fail(message) {
  console.error(`\n[update-signing] FAIL — ${message}\n`);
  process.exit(1);
}

function main() {
  const environment = process.argv[2];
  if (!environment) fail('no environment given (usage: check-update-signing.js <environment>)');

  let output;
  try {
    output = execFileSync('eas', ['env:list', '--environment', environment, '--non-interactive'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // A failure to ASK is not a pass. Publishing anyway is exactly the silent
    // path this guard exists to close.
    const detail = (error && (error.stderr || error.message)) || String(error);
    fail(`could not read EAS environment "${environment}": ${String(detail).trim()}`);
    return;
  }

  const hasKey = output.includes(REQUIRED) || output.includes(ALTERNATIVE);
  if (!hasKey) {
    fail(
      `${REQUIRED} is not configured for the "${environment}" environment.\n\n` +
        '  Publishing this update would ship a bundle that cannot verify EXISTING saves\n' +
        '  or permanent IAP entitlements — every player would lose access to both at once,\n' +
        '  with the data still intact on disk but unreadable.\n\n' +
        `  Fix: eas env:create --scope project --name ${REQUIRED} \\\n` +
        `         --value "<current-key>,<previous-key>" --environment ${environment} --visibility sensitive\n\n` +
        '  Keep every previously shipped key in the comma-separated list. The first entry\n' +
        '  signs new writes; all of them verify, so old saves keep loading and re-sign\n' +
        '  onto the current key the next time they are written.'
    );
  }

  console.log(`[update-signing] OK — ${REQUIRED} is configured for "${environment}".`);
}

main();

module.exports = { REQUIRED, ALTERNATIVE };
