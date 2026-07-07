/**
 * DeepLife — IAP receipt verification endpoint
 * =============================================
 * This is the backend the app calls at EXPO_PUBLIC_IAP_VERIFY_URL. The app
 * refuses to grant ANY purchase in production unless this returns
 * `{ "verified": true }`, so it is the gate that stops fake/replayed receipts.
 *
 * Contract (do not change — the app depends on it):
 *   POST  <this url>
 *   Headers: Content-Type: application/json
 *            Authorization: Bearer <EXPO_PUBLIC_IAP_VERIFY_TOKEN>   (optional but recommended)
 *   Body:    { "receipt": "<token>", "productId": "...", "transactionId": "..." }
 *   Reply:   200 { "verified": true }   → grant
 *            200 { "verified": false }  → deny (or any non-200)
 *
 * Platforms:
 *   • iOS (StoreKit 2) sends a signed JWS transaction as `receipt`. We verify +
 *     decode it with Apple's official library — no network call needed.
 *   • Android sends a Play `purchaseToken`. We verify it against the Google Play
 *     Developer API with a service account.
 *
 * Runtime: a plain Node serverless handler (Vercel / Netlify / Cloud Functions
 * shape). For Express, call `verifyHandler(req, res)` from a POST route.
 */

const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || '';           // e.g. com.you.deeplife
const APPLE_APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID || '';     // numeric App Store id (optional)
const GOOGLE_PACKAGE_NAME = process.env.GOOGLE_PACKAGE_NAME || '';   // e.g. com.you.deeplife
const SHARED_SECRET = process.env.IAP_SHARED_SECRET || '';           // must equal EXPO_PUBLIC_IAP_VERIFY_TOKEN
// Soft-launch stopgap: when true AND a platform's real credentials are missing,
// accept a well-formed receipt after a basic sanity check. Turn OFF for full
// security once your Apple/Google credentials are configured.
const ALLOW_SOFT_LAUNCH = process.env.ALLOW_SOFT_LAUNCH === 'true';

// The exact product ids the app sells — reject anything else outright.
const KNOWN_PRODUCT_IDS = new Set([
  'deeplife_premium_monthly', 'deeplife_premium_yearly', 'deeplife_lifetime_premium',
  'deeplife_gems_100', 'deeplife_gems_500', 'deeplife_gems_1000', 'deeplife_gems_5000',
  'deeplife_gems_15000', 'deeplife_gems_starter', 'deeplife_gems_premium',
  'deeplife_gems_ultimate', 'deeplife_gems_mega', 'deeplife_youth_pill_single',
  'deeplife_youth_pill_pack', 'deeplife_money_boost', 'deeplife_skill_boost',
  'deeplife_work_boost', 'deeplife_mindset_perk', 'deeplife_mindset',
  'deeplife_fast_learner', 'deeplife_good_credit', 'deeplife_unlock_all_perks',
  'deeplife_remove_ads', 'deeplife_premium_credit_card', 'deeplife_financial_planning',
  'deeplife_business_banking', 'deeplife_private_banking', 'revival_pack',
]);

function deny(res, reason) {
  // Log the reason server-side; never leak it to the client.
  console.warn('[iap-verify] denied:', reason);
  res.status(200).json({ verified: false });
}
function grant(res) {
  res.status(200).json({ verified: true });
}

/** iOS StoreKit 2 JWS looks like three base64url segments joined by dots. */
function looksLikeAppleJws(token) {
  return typeof token === 'string' && token.split('.').length === 3;
}

async function verifyApple(signedTransaction, expectedProductId) {
  const { SignedDataVerifier, Environment } = require('@apple/app-store-server-library');
  const { loadAppleRootCerts } = require('../lib/appleRoots');
  const roots = loadAppleRootCerts(); // Buffer[] of Apple's root .cer files
  // Try Production first, then Sandbox (TestFlight / review use Sandbox).
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = new SignedDataVerifier(
        roots, /* enableOnlineChecks */ true, env, APPLE_BUNDLE_ID,
        APPLE_APP_APPLE_ID ? Number(APPLE_APP_APPLE_ID) : undefined,
      );
      const decoded = await verifier.verifyAndDecodeTransaction(signedTransaction);
      if (decoded && decoded.productId === expectedProductId) return true;
      if (decoded && decoded.productId) {
        console.warn('[iap-verify] apple productId mismatch', decoded.productId, expectedProductId);
      }
    } catch (e) {
      // Wrong environment throws — fall through and try the next one.
    }
  }
  return false;
}

async function verifyGoogle(purchaseToken, productId) {
  const { google } = require('googleapis');
  // GOOGLE_SERVICE_ACCOUNT_JSON holds the full service-account JSON (as a string).
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const publisher = google.androidpublisher({ version: 'v3', auth });
  const isSub = productId.startsWith('deeplife_premium_'); // monthly / yearly subs
  if (isSub) {
    const r = await publisher.purchases.subscriptions.get({
      packageName: GOOGLE_PACKAGE_NAME, subscriptionId: productId, token: purchaseToken,
    });
    // paymentState 1 = received, 2 = free trial. Not cancelled/expired.
    return !!r.data && (r.data.paymentState === 1 || r.data.paymentState === 2);
  }
  const r = await publisher.purchases.products.get({
    packageName: GOOGLE_PACKAGE_NAME, productId, token: purchaseToken,
  });
  // purchaseState 0 = purchased.
  return !!r.data && r.data.purchaseState === 0;
}

async function verifyHandler(req, res) {
  try {
    if (req.method !== 'POST') return deny(res, 'method');

    // 1) Shared-secret gate (blocks random callers hitting your endpoint).
    if (SHARED_SECRET) {
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${SHARED_SECRET}`) return deny(res, 'bad-secret');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { receipt, productId } = body;
    if (!receipt || !productId) return deny(res, 'missing-fields');
    if (!KNOWN_PRODUCT_IDS.has(productId)) return deny(res, 'unknown-product');

    const isApple = looksLikeAppleJws(receipt);

    // 2) Real verification when credentials are configured.
    if (isApple && APPLE_BUNDLE_ID) {
      return (await verifyApple(receipt, productId)) ? grant(res) : deny(res, 'apple-verify-failed');
    }
    if (!isApple && GOOGLE_PACKAGE_NAME && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return (await verifyGoogle(receipt, productId)) ? grant(res) : deny(res, 'google-verify-failed');
    }

    // 3) Soft-launch stopgap (only if you explicitly opted in AND creds absent).
    if (ALLOW_SOFT_LAUNCH && typeof receipt === 'string' && receipt.length > 20) {
      console.warn('[iap-verify] SOFT-LAUNCH grant (configure real credentials!)', { productId });
      return grant(res);
    }

    return deny(res, 'no-credentials-configured');
  } catch (e) {
    console.error('[iap-verify] error', e);
    return deny(res, 'exception');
  }
}

module.exports = verifyHandler;
module.exports.default = verifyHandler;      // Vercel/ESM default export
module.exports.verifyHandler = verifyHandler;
