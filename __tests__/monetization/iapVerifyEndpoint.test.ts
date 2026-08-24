/**
 * IAP receipt-verification endpoint hardening (weekly-audit 2026-07-10, save/IAP domain)
 *
 * Covers the two HIGH findings against `server/iap-verify/api/verify.js`:
 *
 *   F2 — a stray ALLOW_SOFT_LAUNCH must NOT hand out paid content on a production
 *        deployment. The soft-launch stopgap now fails closed when
 *        NODE_ENV==='production' unless the operator sets a second explicit flag
 *        (ALLOW_SOFT_LAUNCH_IN_PROD).
 *
 * (F1 — sandbox-receipt gating — is the environment-list selection in
 * `verifyApple`; exercising it needs @apple/app-store-server-library, which is
 * only installed under server/iap-verify. It is covered by the deny-by-default
 * env selection there.)
 *
 * The flags are read once at module load, so each case re-requires the handler
 * with a fresh env via jest.resetModules().
 */

const HANDLER_PATH = '../../server/iap-verify/api/verify.js';

function makeRes() {
  const res: any = {
    statusCode: 0,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

async function callVerify(env: Record<string, string | undefined>, body: any) {
  jest.resetModules();
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {

    const handler = require(HANDLER_PATH);
    const res = makeRes();
    await handler({ method: 'POST', headers: {}, body }, res);
    return res;
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const VALID_RECEIPT = 'a'.repeat(40); // > 20 chars, not an Apple JWS (no dots)
const KNOWN_PRODUCT = 'deeplife_lifetime_premium';

describe('iap-verify endpoint - hardening', () => {
  describe('soft-launch (F2) fails closed in production', () => {
    it('grants under soft-launch when NOT production (creds absent)', async () => {
      const res = await callVerify(
        { NODE_ENV: 'development', ALLOW_SOFT_LAUNCH: 'true', APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { receipt: VALID_RECEIPT, productId: KNOWN_PRODUCT }
      );
      expect(res.body).toEqual({ verified: true });
    });

    it('DENIES under soft-launch in production without the explicit prod override', async () => {
      const res = await callVerify(
        { NODE_ENV: 'production', ALLOW_SOFT_LAUNCH: 'true', ALLOW_SOFT_LAUNCH_IN_PROD: undefined, APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { receipt: VALID_RECEIPT, productId: KNOWN_PRODUCT }
      );
      expect(res.body).toEqual({ verified: false });
    });

    it('grants under soft-launch in production ONLY with the explicit second flag', async () => {
      const res = await callVerify(
        { NODE_ENV: 'production', ALLOW_SOFT_LAUNCH: 'true', ALLOW_SOFT_LAUNCH_IN_PROD: 'true', APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { receipt: VALID_RECEIPT, productId: KNOWN_PRODUCT }
      );
      expect(res.body).toEqual({ verified: true });
    });

    it('denies when soft-launch is off entirely and no creds are configured', async () => {
      const res = await callVerify(
        { NODE_ENV: 'development', ALLOW_SOFT_LAUNCH: undefined, APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { receipt: VALID_RECEIPT, productId: KNOWN_PRODUCT }
      );
      expect(res.body).toEqual({ verified: false });
    });
  });

  describe('basic input validation still holds', () => {
    it('denies unknown product ids', async () => {
      const res = await callVerify(
        { NODE_ENV: 'development', ALLOW_SOFT_LAUNCH: 'true', APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { receipt: VALID_RECEIPT, productId: 'deeplife_not_a_real_product' }
      );
      expect(res.body).toEqual({ verified: false });
    });

    it('denies missing fields', async () => {
      const res = await callVerify(
        { NODE_ENV: 'development', ALLOW_SOFT_LAUNCH: 'true', APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { productId: KNOWN_PRODUCT }
      );
      expect(res.body).toEqual({ verified: false });
    });

    it('denies a too-short soft-launch receipt', async () => {
      const res = await callVerify(
        { NODE_ENV: 'development', ALLOW_SOFT_LAUNCH: 'true', APPLE_BUNDLE_ID: '', GOOGLE_PACKAGE_NAME: '', IAP_SHARED_SECRET: '' },
        { receipt: 'short', productId: KNOWN_PRODUCT }
      );
      expect(res.body).toEqual({ verified: false });
    });
  });
});
