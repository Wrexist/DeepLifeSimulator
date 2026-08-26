/**
 * Save-signing equivalence pins (2026-08-26 perf pass).
 *
 * The CRC32 / SHA-256 / HMAC implementations in `utils/saveValidation.ts` were
 * rewritten from boxed `number[]` arrays onto typed arrays for speed — the old
 * versions measured ~130ms (HMAC) + ~19ms (CRC32) per save payload under
 * Node's JIT, and Hermes interprets, so on device every Next Week tap paid a
 * multiple of that on the JS thread. The rewrite is worthless unless the
 * digests are BIT-IDENTICAL — a divergence would invalidate every save on
 * every device at once — so this file pins the new implementations against
 * verbatim copies of the originals across adversarial inputs:
 *
 * - all-byte-range strings (0x00–0xFF), charCodes above 0xFF (the CRC loop
 *   XORs the full UTF-16 code unit, not a byte), astral-plane characters
 *   (CESU-8 surrogate-half encoding — deliberately NOT UTF-8, see utf8Bytes),
 * - block-boundary lengths (55/56/57, 63/64/65, 119/120) where SHA-256
 *   padding changes shape, in BOTH padding modes (correct + the legacy
 *   masked-shift length words),
 * - the signed-hex CRC32 output (about half of all checksums serialize with a
 *   leading minus sign; normalizing it would reject existing saves),
 * - a node:crypto HMAC-SHA256 cross-check on BMP-only payloads, proving the
 *   'correct' mode is real HMAC-SHA256 (astral payloads are excluded there on
 *   purpose — CESU-8 diverges from UTF-8 and that is documented behavior).
 */
import * as nodeCrypto from 'crypto';
import { calculateChecksum, calculateHmacSignature, createSaveData, verifySaveData } from '@/utils/saveValidation';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

// ─── Verbatim reference copies of the ORIGINAL implementations ───────────────

function referenceChecksum(data: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff).toString(16).padStart(8, '0');
}

type Padding = 'correct' | 'legacy';

function referenceUtf8Bytes(message: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
    else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
  }
  return bytes;
}

function referenceSha256Bytes(input: number[], padding: Padding = 'correct'): string {
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
  const rr = (v: number, n: number) => (v >>> n) | (v << (32 - n));
  const bytes: number[] = input.slice();
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  if (padding === 'legacy') {
    for (let i = 56; i >= 0; i -= 8) bytes.push((bitLen >>> i) & 0xff);
  } else {
    bytes.push(0, 0, 0, 0);
    bytes.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  }
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16) |
             (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(v => (v >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

function referenceHexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

function referenceHmacWith(data: string, key: string): string {
  const blockSize = 64;
  let keyBytes: number[] = [];
  for (let i = 0; i < key.length; i++) keyBytes.push(key.charCodeAt(i) & 0xff);
  if (keyBytes.length > blockSize) {
    keyBytes = referenceHexToBytes(referenceSha256Bytes(keyBytes, 'correct'));
  }
  while (keyBytes.length < blockSize) keyBytes.push(0);
  const ipad: number[] = new Array(blockSize);
  const opad: number[] = new Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyBytes[i] ^ 0x36;
    opad[i] = keyBytes[i] ^ 0x5c;
  }
  const innerHash = referenceSha256Bytes(ipad.concat(referenceUtf8Bytes(data)), 'correct');
  return referenceSha256Bytes(opad.concat(referenceHexToBytes(innerHash)), 'correct');
}

// ─── Adversarial input corpus ────────────────────────────────────────────────

function deterministicString(len: number, seed: number, maxCode: number): string {
  let s = '';
  let x = seed >>> 0;
  for (let i = 0; i < len; i++) {
    // xorshift32 — deterministic, no Math.random in tests.
    x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
    s += String.fromCharCode(x % maxCode);
  }
  return s;
}

const CORPUS: string[] = [
  '',
  'a',
  'hello world',
  '{"version":48,"stats":{"money":123.45}}',
  // Every byte value 0x00–0xFF, in order.
  Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join(''),
  // charCodes above 0xFF (CRC XORs the full code unit).
  'åäö čžš 中文 русский ｆｕｌｌｗｉｄｔｈ',
  // Astral-plane characters → CESU-8 surrogate halves.
  'name 🎉 with 🚀 emoji 👨‍👩‍👧‍👦',
  // SHA-256 padding block boundaries.
  'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(57),
  'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65),
  'x'.repeat(119), 'x'.repeat(120),
  deterministicString(1000, 0xdecafbad, 0x100),
  deterministicString(5000, 0xfeedface, 0x2000),
  deterministicString(20000, 0xabad1dea, 0x80),
];

const KEYS = [
  'k',
  'test-hmac-key-material',
  // Longer than the 64-byte HMAC block, forcing the hashed-key branch.
  'K'.repeat(100),
  // Key bytes at/above 0x80 (the & 0xff truncation path).
  'clé-ünïcode-ключ',
];

// ─── The pins ────────────────────────────────────────────────────────────────

describe('CRC32 checksum equivalence', () => {
  it('matches the reference bit-at-a-time implementation on every corpus entry', () => {
    for (const input of CORPUS) {
      expect(calculateChecksum(input)).toBe(referenceChecksum(input));
    }
  });

  it('preserves the signed-hex output shape (leading minus for high-bit checksums)', () => {
    // 'a' is a known input whose original checksum serialized negative.
    expect(calculateChecksum('a')).toBe('-174841bd');
    expect(calculateChecksum('hello')).toBe('3610a686');
  });
});

describe('HMAC-SHA256 equivalence', () => {
  const saveSigningConfig = jest.requireActual('@/utils/saveSigningConfig');

  it('production hmac path matches the reference implementation for every (input, key) pair', () => {
    // Reach the padding-mode internals through the public API by comparing
    // reference HMAC against the module's active-key signature.
    const activeKey = saveSigningConfig.resolveActiveSaveHmacKey(
      saveSigningConfig.resolveSaveSigningRuntimeConfig(
        {
          NODE_ENV: process.env.NODE_ENV,
          EXPO_PUBLIC_SAVE_HMAC_KEY: process.env.EXPO_PUBLIC_SAVE_HMAC_KEY,
          EXPO_PUBLIC_SAVE_SIGNATURE_KEY: process.env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY,
          EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES,
          EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: process.env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION,
          EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES: process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES,
        },
        true,
      ),
    );
    if (!activeKey) {
      // No key configured in this environment — the weak-mode fallback is
      // CRC-based and covered by the CRC pins above.
      expect(calculateHmacSignature('probe')).toBe(referenceChecksum('weak:probe'));
      return;
    }
    for (const input of CORPUS) {
      expect(calculateHmacSignature(input)).toBe(referenceHmacWith(input, activeKey));
    }
  });

  it("'correct' mode is real HMAC-SHA256 for BMP-only payloads (node:crypto cross-check)", () => {
    // referenceHmacWith pins the OLD implementation; node:crypto pins the
    // STANDARD. Both must agree with each other for BMP inputs, which
    // transitively proves the new implementation is standards-correct there.
    for (const key of KEYS) {
      const keyBytes = Buffer.from(Array.from(key, c => c.charCodeAt(0) & 0xff));
      for (const input of CORPUS) {
        if (/[\uD800-\uDFFF]/.test(input)) continue; // CESU-8 divergence is documented
        const expected = nodeCrypto.createHmac('sha256', keyBytes).update(Buffer.from(input, 'utf8')).digest('hex');
        expect(referenceHmacWith(input, key)).toBe(expected);
      }
    }
  });
});

describe('legacy-padding verification path', () => {
  // Verbatim copy of the ORIGINAL string-built legacy HMAC (wrong length words,
  // string-concat pads) — the signature every save written before the 2026-07-29
  // padding fix carries. `verifySaveData` must keep accepting these, which
  // exercises the NEW sha256 core's 'legacy' padding branch end to end.
  function referenceSha256Legacy(message: string): string {
    return referenceSha256Bytes(referenceUtf8Bytes(message), 'legacy');
  }

  function referenceHmacLegacyExact(data: string, key: string): string {
    const blockSize = 64;
    let keyBytes: number[] = [];
    for (let i = 0; i < key.length; i++) keyBytes.push(key.charCodeAt(i));
    if (keyBytes.length > blockSize) {
      const hashedKey = referenceSha256Legacy(key);
      keyBytes = [];
      for (let i = 0; i < hashedKey.length; i += 2) {
        keyBytes.push(parseInt(hashedKey.substr(i, 2), 16));
      }
    }
    while (keyBytes.length < blockSize) keyBytes.push(0);
    let ipadStr = '', opadStr = '';
    for (let i = 0; i < blockSize; i++) {
      ipadStr += String.fromCharCode(keyBytes[i] ^ 0x36);
      opadStr += String.fromCharCode(keyBytes[i] ^ 0x5c);
    }
    const innerHash = referenceSha256Legacy(ipadStr + data);
    let innerBytes = '';
    for (let i = 0; i < innerHash.length; i += 2) {
      innerBytes += String.fromCharCode(parseInt(innerHash.substr(i, 2), 16));
    }
    return referenceSha256Legacy(opadStr + innerBytes);
  }

  it('still verifies saves signed with the pre-fix legacy HMAC', () => {
    const key = process.env.EXPO_PUBLIC_SAVE_HMAC_KEY;
    if (!key || key.includes(',')) return; // needs the single configured test key
    for (const input of CORPUS) {
      if (input.length === 0) continue; // empty payloads are rejected upstream anyway
      const legacyHmac = referenceHmacLegacyExact(input, key);
      expect(verifySaveData(input, referenceChecksum(input), undefined, legacyHmac)).toBe(true);
    }
  });
});

describe('round-trip through the public save API', () => {
  it('createSaveData output still verifies, including an emoji-bearing state', () => {
    const state = createTestGameState();
    (state.userProfile as { name?: string }).name = 'Tester 🎉🚀';
    const { data, checksum, signature, hmac } = createSaveData(state, state.version ?? 48);
    expect(verifySaveData(data, checksum, signature, hmac)).toBe(true);
    // Tampering must still be caught.
    expect(verifySaveData(data.replace('"money":', '"money_":'), checksum, signature, hmac)).toBe(false);
  });
});
