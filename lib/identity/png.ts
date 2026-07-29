/**
 * A PNG encoder, in JavaScript, with no native module behind it.
 *
 * ## Why this exists
 *
 * The portrait pipeline needs to turn pixels into `data:image/png;base64,...`,
 * because that is the only form `identity.portraitUri` accepts — a `file://`
 * path does not survive an app reinstall and renders as a permanently blank
 * circle with no way to recover, so `normalizeIdentity` drops one.
 *
 * The obvious tool for that is `GLView.takeSnapshotAsync`, and it cannot do it.
 * On iOS it writes the image with `[imageData writeToFile:]` and resolves
 * `[[NSURL fileURLWithPath:] absoluteString]`; on Android it writes with a
 * `FileOutputStream` and resolves `Uri.fromFile(...).toString()`. Both return a
 * file URI on every platform and every format. There is no option that makes it
 * return bytes.
 *
 * That is not a theoretical limit — it was a live bug. `FaceCanvas.capture()`
 * called `takeSnapshotAsync`, checked `uri.startsWith('data:image')` and
 * returned null when it did not, which is ALWAYS on a device. Every slider
 * worked, the head responded, the player tapped Use this face, and the portrait
 * was silently discarded. The feature was reachable, reviewed and tested, and
 * dead in production — this repo's most repeated defect class.
 *
 * Reading the file back would fix it and costs a new native dependency on a path
 * that already has to degrade gracefully without one. Encoding here costs about
 * three hundred lines of very well-specified arithmetic that runs anywhere, is
 * testable headless, and is verified in CI by inflating its own output with
 * Node's zlib and comparing the pixels back.
 *
 * ## What is implemented
 *
 * RFC 1951 deflate with FIXED Huffman codes and a hash-chain LZ77 matcher, RFC
 * 1950 zlib framing, and the PNG chunk layout with adaptive per-scanline
 * filtering. Fixed codes rather than dynamic: a dynamic-Huffman encoder needs a
 * code-length code, a package-merge length limiter and a second pass, for around
 * a tenth off the size of a photograph. The portrait is bounded by re-encoding
 * smaller when it comes out too big, which handles the size question directly
 * and is the check that actually matters.
 */

export interface Bitmap {
  /** RGBA, 4 bytes per pixel, no stride padding. */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ *
 * Bit writer
 * ------------------------------------------------------------------ */

/**
 * Deflate packs bits least-significant-first WITHIN a byte, but Huffman codes
 * most-significant-bit-first. Getting those two the same way round produces a
 * stream that looks plausible, has a valid length, and inflates to garbage — so
 * they are two separate methods and never one with a flag.
 */
class BitWriter {
  private buf: Uint8Array;
  private len = 0;
  private acc = 0;
  private accBits = 0;

  constructor(capacity: number) {
    this.buf = new Uint8Array(Math.max(1024, capacity | 0));
  }

  private push(byte: number): void {
    if (this.len === this.buf.length) {
      const grown = new Uint8Array(this.buf.length * 2);
      grown.set(this.buf);
      this.buf = grown;
    }
    this.buf[this.len++] = byte;
  }

  /** `count` bits of `value`, low bit first. For headers and extra bits. */
  bits(value: number, count: number): void {
    this.acc |= (value << this.accBits) >>> 0;
    this.accBits += count;
    while (this.accBits >= 8) {
      this.push(this.acc & 0xff);
      this.acc >>>= 8;
      this.accBits -= 8;
    }
  }

  /** A Huffman code: `count` bits of `code`, HIGH bit first. */
  code(code: number, count: number): void {
    let reversed = 0;
    for (let i = 0; i < count; i++) reversed |= ((code >>> (count - 1 - i)) & 1) << i;
    this.bits(reversed, count);
  }

  finish(): Uint8Array {
    if (this.accBits > 0) this.push(this.acc & 0xff);
    this.acc = 0;
    this.accBits = 0;
    return this.buf.slice(0, this.len);
  }
}

/* ------------------------------------------------------------------ *
 * Deflate
 * ------------------------------------------------------------------ */

// RFC 1951 §3.2.5. Index 0 is code 257.
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

function lengthCode(length: number): number {
  // Short, and called once per match; a linear scan from the top finds the
  // common short lengths in a couple of steps.
  for (let i = LENGTH_BASE.length - 1; i >= 0; i--) if (length >= LENGTH_BASE[i]) return i;
  return 0;
}

function distanceCode(distance: number): number {
  for (let i = DIST_BASE.length - 1; i >= 0; i--) if (distance >= DIST_BASE[i]) return i;
  return 0;
}

/** RFC 1951 §3.2.6 — the fixed literal/length alphabet. */
function writeSymbol(w: BitWriter, symbol: number): void {
  if (symbol < 144) w.code(0x30 + symbol, 8);
  else if (symbol < 256) w.code(0x190 + symbol - 144, 9);
  else if (symbol < 280) w.code(symbol - 256, 7);
  else w.code(0xc0 + symbol - 280, 8);
}

const MIN_MATCH = 3;
const MAX_MATCH = 258;
const WINDOW = 32768;
/**
 * How many candidates at one hash to try, and when to stop looking.
 *
 * This runs on a phone, on the better part of a megabyte, while the player
 * watches a progress screen. Unbounded chain walking is where a deflate
 * implementation goes from "a moment" to "did it freeze". 24 and 32 cost a few
 * percent of ratio against zlib's default and turn the worst case from
 * quadratic into linear.
 */
const MAX_CHAIN = 24;
const GOOD_MATCH = 32;

/**
 * Raw deflate stream, fixed Huffman, single final block.
 *
 * Exported for the round-trip test, which inflates it with Node's zlib — the
 * only way to prove a compressor is correct is to decompress it with something
 * that did not come from the same head.
 */
export function deflateRaw(data: Uint8Array): Uint8Array {
  const n = data.length;
  const w = new BitWriter(Math.max(1024, n >> 1));
  w.bits(1, 1); // BFINAL
  w.bits(1, 2); // BTYPE = 01, fixed Huffman

  const HASH_SIZE = 1 << 15;
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(n > 0 ? n : 1).fill(-1);
  const hashAt = (p: number): number =>
    (((data[p] << 10) ^ (data[p + 1] << 5) ^ data[p + 2]) & (HASH_SIZE - 1));

  let i = 0;
  while (i < n) {
    let bestLen = 0;
    let bestDist = 0;

    if (i + MIN_MATCH <= n) {
      const h = hashAt(i);
      let candidate = head[h];
      let chain = MAX_CHAIN;
      const limit = Math.min(MAX_MATCH, n - i);
      while (candidate >= 0 && chain-- > 0) {
        const dist = i - candidate;
        // The chain is in decreasing position order, so the first candidate out
        // of the window means every later one is too.
        if (dist > WINDOW) break;
        let len = 0;
        while (len < limit && data[candidate + len] === data[i + len]) len++;
        if (len > bestLen) {
          bestLen = len;
          bestDist = dist;
          if (len >= GOOD_MATCH) break;
        }
        candidate = prev[candidate];
      }
      prev[i] = head[h];
      head[h] = i;
    }

    if (bestLen >= MIN_MATCH) {
      const lc = lengthCode(bestLen);
      writeSymbol(w, 257 + lc);
      if (LENGTH_EXTRA[lc] > 0) w.bits(bestLen - LENGTH_BASE[lc], LENGTH_EXTRA[lc]);
      const dc = distanceCode(bestDist);
      w.code(dc, 5); // fixed distance codes are 5-bit, high bit first
      if (DIST_EXTRA[dc] > 0) w.bits(bestDist - DIST_BASE[dc], DIST_EXTRA[dc]);
      // Every position inside the match still has to enter the chain, or the
      // next match can only ever start where this one ended.
      for (let k = 1; k < bestLen; k++) {
        const p = i + k;
        if (p + MIN_MATCH > n) break;
        const h2 = hashAt(p);
        prev[p] = head[h2];
        head[h2] = p;
      }
      i += bestLen;
    } else {
      writeSymbol(w, data[i]);
      i++;
    }
  }

  writeSymbol(w, 256); // end of block
  return w.finish();
}

/* ------------------------------------------------------------------ *
 * Checksums
 * ------------------------------------------------------------------ */

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  // 5552 is the largest run that cannot overflow the 32-bit accumulator.
  for (let i = 0; i < data.length;) {
    const end = Math.min(i + 5552, data.length);
    for (; i < end; i++) {
      a += data[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

let crcTable: Int32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/** zlib framing (RFC 1950): 0x78 0x01 chosen so the header is divisible by 31. */
function zlib(raw: Uint8Array, source: Uint8Array): Uint8Array {
  const out = new Uint8Array(raw.length + 6);
  out[0] = 0x78;
  out[1] = 0x01;
  out.set(raw, 2);
  const sum = adler32(source);
  out[raw.length + 2] = (sum >>> 24) & 0xff;
  out[raw.length + 3] = (sum >>> 16) & 0xff;
  out[raw.length + 4] = (sum >>> 8) & 0xff;
  out[raw.length + 5] = sum & 0xff;
  return out;
}

/* ------------------------------------------------------------------ *
 * PNG
 * ------------------------------------------------------------------ */

const BYTES_PER_PIXEL = 4; // colour type 6, 8-bit: RGBA

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Filter every scanline, choosing the filter per row.
 *
 * The heuristic is libpng's: pick the filter whose output has the smallest sum
 * of absolute signed byte values, because deflate spends fewer bits on symbols
 * near zero. On a photograph this is worth roughly a third of the file against
 * filter 0 everywhere, which is the difference between a portrait that fits in
 * the save and one that does not.
 */
function filterScanlines(img: Bitmap): Uint8Array {
  const { width, height, data } = img;
  const rowBytes = width * BYTES_PER_PIXEL;
  const out = new Uint8Array(height * (rowBytes + 1));
  const candidate = new Uint8Array(rowBytes);
  const best = new Uint8Array(rowBytes);

  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    const up = row - rowBytes;
    let bestFilter = 0;
    let bestScore = Infinity;

    for (let f = 0; f <= 4; f++) {
      let score = 0;
      for (let x = 0; x < rowBytes; x++) {
        const raw = data[row + x];
        const left = x >= BYTES_PER_PIXEL ? data[row + x - BYTES_PER_PIXEL] : 0;
        const above = y > 0 ? data[up + x] : 0;
        const upLeft = y > 0 && x >= BYTES_PER_PIXEL ? data[up + x - BYTES_PER_PIXEL] : 0;
        let v: number;
        if (f === 0) v = raw;
        else if (f === 1) v = raw - left;
        else if (f === 2) v = raw - above;
        else if (f === 3) v = raw - ((left + above) >> 1);
        else v = raw - paeth(left, above, upLeft);
        v &= 0xff;
        candidate[x] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = f;
        best.set(candidate);
      }
    }

    out[y * (rowBytes + 1)] = bestFilter;
    out.set(best, y * (rowBytes + 1) + 1);
  }
  return out;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(body.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(body.length + 8, crc32(out.subarray(4, body.length + 8)));
  return out;
}

/** A complete PNG file as bytes. */
export function encodePng(img: Bitmap): Uint8Array {
  const { width, height } = img;
  if (width <= 0 || height <= 0) throw new Error('encodePng: empty image');
  if (img.data.length < width * height * BYTES_PER_PIXEL) {
    throw new Error('encodePng: buffer smaller than width * height * 4');
  }

  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width);
  header.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const filtered = filterScanlines(img);
  const idat = zlib(deflateRaw(filtered), filtered);

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const png = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64, without `Buffer` or `btoa`.
 *
 * Neither is reliably present in a React Native runtime, and the one polyfill
 * this app does load is for URL. Built in chunks rather than by `+=` because
 * appending to a megabyte-long string a character at a time is quadratic in
 * Hermes and shows up as a visible stall.
 */
function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let piece = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    piece += B64[(v >>> 18) & 63] + B64[(v >>> 12) & 63] + B64[(v >>> 6) & 63] + B64[v & 63];
    if (piece.length >= 16384) {
      chunks.push(piece);
      piece = '';
    }
  }
  const left = bytes.length - i;
  if (left === 1) {
    const v = bytes[i] << 16;
    piece += B64[(v >>> 18) & 63] + B64[(v >>> 12) & 63] + '==';
  } else if (left === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    piece += B64[(v >>> 18) & 63] + B64[(v >>> 12) & 63] + B64[(v >>> 6) & 63] + '=';
  }
  chunks.push(piece);
  return chunks.join('');
}

/** The form `identity.portraitUri` accepts. */
export function encodePngDataUri(img: Bitmap): string {
  return `data:image/png;base64,${base64(encodePng(img))}`;
}
