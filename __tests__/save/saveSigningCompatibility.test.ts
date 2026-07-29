/**
 * Signing: standards-compliant going forward, and nobody's save gets orphaned.
 *
 * SEC-8 — the hand-rolled SHA-256 appended its 64-bit length with
 * `for (let i = 56; i >= 0; i -= 8) push((bitLen >>> i) & 0xff)`. JS masks a
 * shift count to 5 bits, so `>>>56` is `>>>24` and the eight length bytes came
 * out [b3,b2,b1,b0,b3,b2,b1,b0] instead of [0,0,0,0,b3,b2,b1,b0]. Standard
 * SHA-256 requires that high word to be zero for any message under 2^32 bits,
 * so the digest diverged from real SHA-256 for EVERY message except the empty
 * string — not only large ones, as first reported. It was self-consistent, so
 * it signed and verified fine locally, but it is not HMAC-SHA256 and disagrees
 * with any standards-compliant server.
 *
 * SEC-2 — there was one key, compared with a single `!==`, and no key id. A
 * rotation invalidated every save on every device at once with no in-field way
 * back, and the same key signs paid entitlements. `leaked-key-rotation-runbook.md`
 * shows rotation is a live plan.
 *
 * Correcting the padding alone would have orphaned every existing save, so the
 * two land together: the legacy padding survives as a VERIFIER, verification
 * accepts every configured key, and new writes use the correct padding under
 * the first key. Existing saves keep loading and re-sign on their next write.
 */
import crypto from 'crypto';

const KEY_NEW = 'rotation-test-current-key';
const KEY_OLD = 'rotation-test-previous-key';

/** Load the save modules with a specific key configuration. */
function loadWithKeys(keys: string) {
  let mod: typeof import('@/utils/saveValidation');
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = keys;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/utils/saveValidation');
  });
  return mod!;
}

/** Reference HMAC-SHA256 over the same UTF-8 bytes the implementation hashes. */
function referenceHmac(data: string, key: string): string {
  return crypto.createHmac('sha256', Buffer.from(key, 'binary')).update(Buffer.from(data, 'utf8')).digest('hex');
}

const originalKey = process.env.EXPO_PUBLIC_SAVE_HMAC_KEY;
afterAll(() => {
  process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = originalKey;
});

describe('new signatures are real HMAC-SHA256', () => {
  it('matches node crypto across lengths that used to all diverge', () => {
    const mod = loadWithKeys(KEY_NEW);

    // Every one of these differed under the old padding — the "only >= 2 MiB"
    // reading of the bug was wrong.
    for (const length of [1, 10, 31, 32, 33, 55, 56, 64, 100, 1000]) {
      const data = 'x'.repeat(length);
      expect(mod.calculateHmacSignature(data)).toBe(referenceHmac(data, KEY_NEW));
    }
  });

  it('matches on a payload shaped like a real save envelope body', () => {
    const mod = loadWithKeys(KEY_NEW);
    const data = JSON.stringify({ userProfile: { firstName: 'Mara' }, weeksLived: 2231, version: 25 });

    expect(mod.calculateHmacSignature(data)).toBe(referenceHmac(data, KEY_NEW));
  });
});

describe('a save signed before the padding fix still loads', () => {
  /** The exact digest the OLD implementation produced, reconstructed here. */
  function legacyHmac(data: string, key: string): string {
    const legacySha = (message: string): string => {
      const bytes: number[] = [];
      for (let i = 0; i < message.length; i++) {
        const c = message.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) {
          bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
        } else {
          bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
      }
      const bitLen = bytes.length * 8;
      bytes.push(0x80);
      while (bytes.length % 64 !== 56) bytes.push(0);
      // The bug, verbatim.
      for (let i = 56; i >= 0; i -= 8) bytes.push((bitLen >>> i) & 0xff);
      return sha256Core(bytes);
    };

    const blockSize = 64;
    let keyBytes: number[] = [];
    for (let i = 0; i < key.length; i++) keyBytes.push(key.charCodeAt(i));
    if (keyBytes.length > blockSize) {
      const hashed = legacySha(key);
      keyBytes = [];
      for (let i = 0; i < hashed.length; i += 2) keyBytes.push(parseInt(hashed.substr(i, 2), 16));
    }
    while (keyBytes.length < blockSize) keyBytes.push(0);

    let ipad = '';
    let opad = '';
    for (let i = 0; i < blockSize; i++) {
      ipad += String.fromCharCode(keyBytes[i] ^ 0x36);
      opad += String.fromCharCode(keyBytes[i] ^ 0x5c);
    }
    const inner = legacySha(ipad + data);
    let innerBytes = '';
    for (let i = 0; i < inner.length; i += 2) innerBytes += String.fromCharCode(parseInt(inner.substr(i, 2), 16));
    return legacySha(opad + innerBytes);
  }

  it('verifies an envelope carrying a legacy-padding HMAC', () => {
    const mod = loadWithKeys(KEY_NEW);
    const data = JSON.stringify({ weeksLived: 900 });

    const legacy = legacyHmac(data, KEY_NEW);
    // It really is a different digest — otherwise this test proves nothing.
    expect(legacy).not.toBe(mod.calculateHmacSignature(data));

    expect(mod.verifySaveData(data, mod.calculateChecksum(data), undefined, legacy)).toBe(true);
  });

  it('rejects a tampered payload under either padding', () => {
    const mod = loadWithKeys(KEY_NEW);
    const data = JSON.stringify({ weeksLived: 900 });
    const tampered = JSON.stringify({ weeksLived: 99999 });

    expect(
      mod.verifySaveData(tampered, mod.calculateChecksum(tampered), undefined, legacyHmac(data, KEY_NEW)),
    ).toBe(false);
    expect(
      mod.verifySaveData(tampered, mod.calculateChecksum(tampered), undefined, referenceHmac(data, KEY_NEW)),
    ).toBe(false);
  });
});

describe('a key rotation does not orphan every save on the device', () => {
  it('verifies a save signed with the PREVIOUS key once it is listed', () => {
    const before = loadWithKeys(KEY_OLD);
    const data = JSON.stringify({ weeksLived: 2231 });
    const envelope = before.createSaveEnvelope(data);

    // The rotation: new key first, old key still accepted for verification.
    const after = loadWithKeys(`${KEY_NEW},${KEY_OLD}`);
    const decoded = after.decodePersistedSaveEnvelope(envelope, { allowLegacy: false });

    expect(decoded.valid).toBe(true);
    expect(decoded.data).toBe(data);
  });

  it('signs NEW writes with the first key in the list', () => {
    const mod = loadWithKeys(`${KEY_NEW},${KEY_OLD}`);
    const data = JSON.stringify({ weeksLived: 1 });

    expect(mod.calculateHmacSignature(data)).toBe(referenceHmac(data, KEY_NEW));
  });

  it('still refuses a save signed with a key that was never configured', () => {
    const mod = loadWithKeys(`${KEY_NEW},${KEY_OLD}`);
    const data = JSON.stringify({ weeksLived: 5 });

    expect(
      mod.verifySaveData(data, mod.calculateChecksum(data), undefined, referenceHmac(data, 'some-attacker-key')),
    ).toBe(false);
  });

  it('tolerates whitespace and duplicates in the configured list', () => {
    const mod = loadWithKeys(` ${KEY_NEW} , ${KEY_OLD} , ${KEY_NEW} `);
    const data = JSON.stringify({ weeksLived: 7 });

    expect(mod.calculateHmacSignature(data)).toBe(referenceHmac(data, KEY_NEW));
    expect(
      mod.verifySaveData(data, mod.calculateChecksum(data), undefined, referenceHmac(data, KEY_OLD)),
    ).toBe(true);
  });
});

/** Minimal reference SHA-256 core over a padded byte array (test-only). */
function sha256Core(bytes: number[]): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array<number>(64);
    for (let i = 0; i < 16; i++) {
      w[i] =
        (bytes[offset + i * 4] << 24) |
        (bytes[offset + i * 4 + 1] << 16) |
        (bytes[offset + i * 4 + 2] << 8) |
        bytes[offset + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('');
}
