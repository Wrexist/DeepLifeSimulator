/**
 * Proving a compressor by decompressing it with something else.
 *
 * A hand-written deflate can produce a stream that is the right length, has a
 * plausible bit pattern and inflates to garbage — packing Huffman codes
 * low-bit-first instead of high-bit-first does exactly that. So nothing here
 * checks the bytes this encoder emits. Everything checks what an INDEPENDENT
 * decoder makes of them: Node's zlib for the deflate stream, and the PNG spec's
 * own reconstruction filters, written here in the opposite direction from the
 * encoder's.
 *
 * The end-to-end assertion is pixel equality. If a single byte of the stream is
 * wrong the reconstruction diverges from that point on and the comparison fails
 * loudly, which is what a codec test is for.
 */
import { inflateRawSync, inflateSync } from 'zlib';
import { deflateRaw, encodePng, encodePngDataUri, type Bitmap } from '@/lib/identity/png';

/* ---------------------------------------------------------------- *
 * An independent PNG reader, spec-faithful and no faster than it has to be.
 * ---------------------------------------------------------------- */

interface Chunk { type: string; body: Uint8Array; crcOk: boolean }

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ -1) >>> 0;
}

function readChunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  let at = 8; // past the signature
  while (at < png.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7]);
    const body = png.subarray(at + 8, at + 8 + length);
    const stated = view.getUint32(at + 8 + length);
    chunks.push({ type, body, crcOk: crc32(png.subarray(at + 4, at + 8 + length)) === stated });
    at += length + 12;
  }
  return chunks;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decode a colour-type-6 PNG back to RGBA. Throws on anything unexpected. */
function decodePng(png: Uint8Array): Bitmap {
  expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = readChunks(png);
  for (const c of chunks) expect(`${c.type}:${c.crcOk}`).toBe(`${c.type}:true`);

  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('no IHDR');
  const head = new DataView(ihdr.body.buffer, ihdr.body.byteOffset, ihdr.body.byteLength);
  const width = head.getUint32(0);
  const height = head.getUint32(4);
  expect([ihdr.body[8], ihdr.body[9], ihdr.body[10], ihdr.body[11], ihdr.body[12]]).toEqual([8, 6, 0, 0, 0]);

  const idat = chunks.filter((c) => c.type === 'IDAT');
  expect(idat.length).toBeGreaterThan(0);
  const joined = Buffer.concat(idat.map((c) => Buffer.from(c.body)));
  // inflateSync, not inflateRawSync: this must also prove the zlib header and
  // the Adler-32 trailer are right, and only a framed inflate checks those.
  const raw = new Uint8Array(inflateSync(joined));

  const rowBytes = width * 4;
  expect(raw.length).toBe(height * (rowBytes + 1));

  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowBytes + 1)];
    const src = y * (rowBytes + 1) + 1;
    const dst = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const left = x >= 4 ? out[dst + x - 4] : 0;
      const above = y > 0 ? out[dst - rowBytes + x] : 0;
      const upLeft = y > 0 && x >= 4 ? out[dst - rowBytes + x - 4] : 0;
      const v = raw[src + x];
      let recovered: number;
      if (filter === 0) recovered = v;
      else if (filter === 1) recovered = v + left;
      else if (filter === 2) recovered = v + above;
      else if (filter === 3) recovered = v + ((left + above) >> 1);
      else if (filter === 4) recovered = v + paeth(left, above, upLeft);
      else throw new Error(`unknown filter ${filter}`);
      out[dst + x] = recovered & 0xff;
    }
  }
  return { data: out, width, height };
}

/* ---------------------------------------------------------------- *
 * Fixtures
 * ---------------------------------------------------------------- */

/** Deterministic pseudo-noise — the worst case for a compressor. */
function noise(seed: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let s = seed >>> 0;
  for (let i = 0; i < length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (s >>> 16) & 0xff;
  }
  return out;
}

/**
 * Something photograph-shaped: smooth gradients, a soft blob, and a cut-out's
 * hard alpha edge. Chosen because each of those exercises a different filter —
 * a flat run wants None, a horizontal ramp wants Sub, a vertical one wants Up,
 * and the blob's curvature wants Paeth.
 */
function portraitLike(size: number): Bitmap {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = (x - size / 2) / (size * 0.32);
      const dy = (y - size / 2) / (size * 0.4);
      const inside = dx * dx + dy * dy <= 1;
      data[i] = inside ? 210 - dy * 30 : 40 + (x * 60) / size;
      data[i + 1] = inside ? 168 - dx * 18 : 70 + (y * 40) / size;
      data[i + 2] = inside ? 140 : 120;
      data[i + 3] = inside ? 255 : 0;
    }
  }
  return { data, width: size, height: size };
}

/* ---------------------------------------------------------------- *
 * Deflate
 * ---------------------------------------------------------------- */

describe('deflateRaw produces a stream zlib agrees with', () => {
  const cases: [string, Uint8Array][] = [
    ['empty', new Uint8Array(0)],
    ['one byte', new Uint8Array([42])],
    ['two bytes, too short to match', new Uint8Array([1, 2])],
    ['a run', new Uint8Array(5000).fill(7)],
    ['every byte value', Uint8Array.from({ length: 256 }, (_, i) => i)],
    // 144 and 256 are the fixed alphabet's code-length boundaries; a wrong
    // boundary corrupts only the bytes on one side of it.
    ['literals across the 8/9-bit boundary', Uint8Array.from({ length: 4096 }, (_, i) => (i * 7) % 256)],
    ['incompressible noise', noise(99, 60_000)],
    ['long-range repeats', (() => {
      const a = noise(5, 40_000);
      const out = new Uint8Array(a.length * 2);
      out.set(a, 0);
      out.set(a, a.length); // a match at distance 40_000, past the 8 KB codes
      return out;
    })()],
    ['a 300-byte repeat, longer than MAX_MATCH', (() => {
      const unit = noise(11, 300);
      const out = new Uint8Array(1200);
      for (let i = 0; i < 4; i++) out.set(unit, i * 300);
      return out;
    })()],
  ];

  it.each(cases)('%s', (_name, input) => {
    const round = new Uint8Array(inflateRawSync(Buffer.from(deflateRaw(input))));
    expect(round.length).toBe(input.length);
    expect(Buffer.from(round).equals(Buffer.from(input))).toBe(true);
  });

  it('actually compresses repetitive input', () => {
    // Not just "runs without throwing". A deflate that emitted every byte as a
    // literal would pass every round-trip above and be useless here.
    const input = new Uint8Array(20_000).fill(3);
    expect(deflateRaw(input).length).toBeLessThan(200);
  });

  it('stays close to raw size on noise instead of exploding', () => {
    const input = noise(7, 30_000);
    expect(deflateRaw(input).length).toBeLessThan(input.length * 1.2);
  });
});

/* ---------------------------------------------------------------- *
 * PNG
 * ---------------------------------------------------------------- */

describe('encodePng round-trips pixel for pixel', () => {
  it('reproduces a portrait-shaped image exactly', () => {
    const src = portraitLike(96);
    const back = decodePng(encodePng(src));
    expect(back.width).toBe(96);
    expect(back.height).toBe(96);
    expect(Buffer.from(back.data.buffer, back.data.byteOffset, back.data.length)
      .equals(Buffer.from(src.data.buffer, src.data.byteOffset, src.data.length))).toBe(true);
  });

  it('reproduces pure noise exactly, alpha channel included', () => {
    // The filter heuristic has no useful prediction here, so this is the case
    // where a filter-selection bug shows: a row filtered as 3 and labelled 2
    // still decodes, just wrongly.
    const bytes = noise(31, 64 * 64 * 4);
    const back = decodePng(encodePng({ data: bytes, width: 64, height: 64 }));
    expect(Buffer.from(back.data.buffer, back.data.byteOffset, back.data.length)
      .equals(Buffer.from(bytes))).toBe(true);
  });

  it('handles a single-pixel image and a single-row image', () => {
    for (const [w, h] of [[1, 1], [17, 1], [1, 17]] as const) {
      const bytes = noise(w * 100 + h, w * h * 4);
      const back = decodePng(encodePng({ data: bytes, width: w, height: h }));
      expect(back.width).toBe(w);
      expect(back.height).toBe(h);
      expect(Buffer.from(back.data.buffer, back.data.byteOffset, back.data.length)
        .equals(Buffer.from(bytes))).toBe(true);
    }
  });

  it('uses more than one filter across a real image', () => {
    // Adaptive filtering is where a third of the file size comes from. Reading
    // the filter bytes back out is the only way to tell an adaptive encoder from
    // one that picked 0 every time and still decoded perfectly.
    const png = encodePng(portraitLike(96));
    const idat = readChunks(png).filter((c) => c.type === 'IDAT');
    const raw = new Uint8Array(inflateSync(Buffer.concat(idat.map((c) => Buffer.from(c.body)))));
    const used = new Set<number>();
    for (let y = 0; y < 96; y++) used.add(raw[y * (96 * 4 + 1)]);
    expect(used.size).toBeGreaterThan(1);
  });

  it('rejects an image whose buffer is short instead of reading past the end', () => {
    expect(() => encodePng({ data: new Uint8ClampedArray(10), width: 8, height: 8 })).toThrow();
    expect(() => encodePng({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toThrow();
  });
});

describe('encodePngDataUri', () => {
  it('produces a data URI whose payload is the PNG', () => {
    const src = portraitLike(48);
    const uri = encodePngDataUri(src);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    const bytes = new Uint8Array(Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64'));
    expect(Buffer.from(bytes).equals(Buffer.from(encodePng(src)))).toBe(true);
    // And the payload is a PNG that decodes to the original.
    const back = decodePng(bytes);
    expect(Buffer.from(back.data.buffer, back.data.byteOffset, back.data.length)
      .equals(Buffer.from(src.data.buffer, src.data.byteOffset, src.data.length))).toBe(true);
  });

  it('pads correctly at every remainder', () => {
    // 1, 2 and 0 bytes over a multiple of three are separate branches, and a
    // wrong pad is a URI that decodes short — which every image viewer reports
    // as a corrupt file and nothing here would otherwise notice.
    for (const w of [1, 2, 3]) {
      const bytes = noise(w, w * 4);
      const uri = encodePngDataUri({ data: bytes, width: w, height: 1 });
      const decoded = Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64');
      expect(decoded.equals(Buffer.from(encodePng({ data: bytes, width: w, height: 1 })))).toBe(true);
    }
  });

  it('fits a 320px portrait inside the save budget with room to spare', () => {
    // MAX_PORTRAIT_BYTES is 512 KB and the portrait is copied into every save
    // and every backup, so "under the cap" is not enough — it has to be a
    // rounding error against a 4 MB save. This is the number that decides
    // whether the cut-out can be stored at all.
    const uri = encodePngDataUri(portraitLike(320));
    expect(uri.length).toBeLessThan(220 * 1024);
  });
});
