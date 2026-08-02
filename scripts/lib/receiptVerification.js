'use strict';
/**
 * Which receipt-verification path a production build is configured for.
 *
 * Extracted from `scripts/preflight-check.js` §9 so the decision can be tested.
 * The branches are subtle and the failure mode of getting one wrong is a
 * release that refuses every purchase, so "it looked right when I read it" is
 * not enough assurance.
 *
 * ── The two valid paths ───────────────────────────────────────────────────
 *
 * RevenueCat is an ALTERNATIVE, not a bypass. `IAPService.purchaseProduct`
 * says so at the branch: "RC verifies the receipt server-side and finishes the
 * transaction itself, so we skip the expo-iap purchase + self-hosted verify +
 * finishTransaction". When RC is live, `verifyReceiptWithServer` never runs, so
 * demanding a self-hosted URL blocks a release over a server that would never
 * be contacted — and `eas.json` sets EXPO_PUBLIC_USE_REVENUECAT=true for
 * production, so that was every production preflight.
 *
 * ── The trap this exists to catch ─────────────────────────────────────────
 *
 * `revenueCatService.isEnabled()` is `flag && !web && !!apiKey && !!sdk`. A
 * flag set WITHOUT a key silently falls back to the native path — where a
 * missing verify URL makes `verifyReceiptWithServer` return FALSE and every
 * purchase is refused. The player is charged nothing and receives nothing, but
 * they also cannot buy at all. That state looks identical to "correctly
 * configured" from the flag alone, which is exactly why it needs naming.
 */

/** @typedef {'revenuecat'|'self-hosted'|'rc-flag-without-key'|'none'|'skip-iap-disabled'|'skip-not-production'} VerificationVerdict */

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ isProductionBuild: boolean }} opts
 * @returns {{ verdict: VerificationVerdict, ok: boolean }}
 */
function resolveVerificationPath(env, opts) {
  const iapEnabled = env.EXPO_PUBLIC_ENABLE_IAP !== 'false';
  if (!iapEnabled) return { verdict: 'skip-iap-disabled', ok: true };
  if (!opts.isProductionBuild) return { verdict: 'skip-not-production', ok: true };

  const rcFlag = env.EXPO_PUBLIC_USE_REVENUECAT === 'true';
  const rcKey = (
    env.EXPO_PUBLIC_RC_IOS_KEY
    || env.EXPO_PUBLIC_RC_ANDROID_KEY
    || env.EXPO_PUBLIC_RC_API_KEY
    || ''
  ).trim();
  const verifyUrl = (env.EXPO_PUBLIC_IAP_VERIFY_URL || '').trim();

  if (rcFlag && rcKey) return { verdict: 'revenuecat', ok: true };
  // Checked BEFORE the URL fallback: a project that set the flag meant to use
  // RC, and silently accepting a stale verify URL would hide the missing key
  // until the first real purchase.
  if (rcFlag && !rcKey) return { verdict: 'rc-flag-without-key', ok: false };
  if (!verifyUrl) return { verdict: 'none', ok: false };
  return { verdict: 'self-hosted', ok: true };
}

module.exports = { resolveVerificationPath };
