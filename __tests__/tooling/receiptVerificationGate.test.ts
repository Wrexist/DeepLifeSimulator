/**
 * Preflight §9 — which receipt-verification path a production build has.
 *
 * Every other guard built on 2026-08-02 shipped with a regression suite; this
 * one did not, and its branches are the subtlest of the set. The cost of
 * getting one wrong is a release where every purchase is refused, so "it read
 * correctly when I wrote it" is not enough assurance.
 *
 * The decision matters because RevenueCat is an ALTERNATIVE path, not a bypass:
 * `IAPService.purchaseProduct` skips `verifyReceiptWithServer` entirely when RC
 * is live, so requiring a self-hosted URL blocks a release over a server that
 * would never be contacted.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveVerificationPath } = require('@/scripts/lib/receiptVerification');

type Verdict = { verdict: string; ok: boolean };
const prod = (env: Record<string, string | undefined>): Verdict =>
  resolveVerificationPath(env, { isProductionBuild: true });

describe('a production build needs ONE working verification path', () => {
  it('RevenueCat with a key is sufficient - no verify URL required', () => {
    // This is what `eas.json` production is configured for. Failing it was
    // blocking every production preflight over the legacy path.
    expect(prod({ EXPO_PUBLIC_USE_REVENUECAT: 'true', EXPO_PUBLIC_RC_IOS_KEY: 'appl_x' }))
      .toEqual({ verdict: 'revenuecat', ok: true });
  });

  it('any of the three RC key vars counts', () => {
    for (const key of ['EXPO_PUBLIC_RC_IOS_KEY', 'EXPO_PUBLIC_RC_ANDROID_KEY', 'EXPO_PUBLIC_RC_API_KEY']) {
      expect(prod({ EXPO_PUBLIC_USE_REVENUECAT: 'true', [key]: 'k' }).ok).toBe(true);
    }
  });

  it('a self-hosted URL alone is sufficient', () => {
    expect(prod({ EXPO_PUBLIC_IAP_VERIFY_URL: 'https://verify.example.com' }))
      .toEqual({ verdict: 'self-hosted', ok: true });
  });

  it('neither configured is a FAIL', () => {
    expect(prod({}).ok).toBe(false);
    expect(prod({}).verdict).toBe('none');
  });
});

describe('the trap: RC flag set without a key', () => {
  it('is its own failure, not silently treated as RevenueCat', () => {
    // `revenueCatService.isEnabled()` is `flag && !web && !!apiKey && !!sdk`.
    // Without a key it is FALSE, so the build falls back to the native path —
    // where a missing verify URL refuses every purchase. The flag alone looks
    // identical to "configured", which is why it gets its own verdict.
    expect(prod({ EXPO_PUBLIC_USE_REVENUECAT: 'true' }))
      .toEqual({ verdict: 'rc-flag-without-key', ok: false });
  });

  it('and a stale verify URL does NOT paper over the missing key', () => {
    // A project that set the flag intends to use RC. Accepting the URL here
    // would hide the missing key until the first real purchase — and RC would
    // not be doing the verifying anyone thinks it is.
    expect(prod({
      EXPO_PUBLIC_USE_REVENUECAT: 'true',
      EXPO_PUBLIC_IAP_VERIFY_URL: 'https://verify.example.com',
    }).verdict).toBe('rc-flag-without-key');
  });

  it('an empty or whitespace key is not a key', () => {
    expect(prod({ EXPO_PUBLIC_USE_REVENUECAT: 'true', EXPO_PUBLIC_RC_IOS_KEY: '   ' }).ok).toBe(false);
  });

  it('the flag must be exactly "true" (the control)', () => {
    // `isFeatureEnabled` treats native-SDK flags as opt-in via `=== 'true'`
    // (CLAUDE.md §4.6). A truthy-but-not-"true" value must not enable RC here
    // when it would not enable it at runtime.
    expect(prod({ EXPO_PUBLIC_USE_REVENUECAT: '1', EXPO_PUBLIC_RC_IOS_KEY: 'k' }).verdict).toBe('none');
  });
});

describe('non-production and disabled builds are skipped, not failed', () => {
  it('a dev build needs nothing', () => {
    expect(resolveVerificationPath({}, { isProductionBuild: false }))
      .toEqual({ verdict: 'skip-not-production', ok: true });
  });

  it('IAP disabled skips regardless of everything else', () => {
    expect(prod({ EXPO_PUBLIC_ENABLE_IAP: 'false' }))
      .toEqual({ verdict: 'skip-iap-disabled', ok: true });
  });

  it('IAP is ON by default - only the literal "false" disables it (the control)', () => {
    // A typo'd value must not silently skip the whole check.
    expect(prod({ EXPO_PUBLIC_ENABLE_IAP: 'no' }).verdict).toBe('none');
  });
});

describe('preflight uses this helper rather than its own copy', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts/preflight-check.js'), 'utf8',
  );

  it('§9 delegates the decision', () => {
    expect(SRC).toMatch(/require\('\.\/lib\/receiptVerification'\)/);
    // `buildEnv`, not `process.env`: the gate judges the env the BUILD will see
    // (eas.json profile env overlaid with process.env) — see H2 / preflightEnv.
    expect(SRC).toMatch(/resolveVerificationPath\(buildEnv, \{ isProductionBuild \}\)/);
  });

  it('and still fails the build on the two bad verdicts (the control)', () => {
    // A helper that returns `ok: false` is useless if preflight ignores it.
    const section = SRC.slice(SRC.indexOf("verdict === 'rc-flag-without-key'"));
    expect(section).toMatch(/hasErrors = true/);
  });
});
