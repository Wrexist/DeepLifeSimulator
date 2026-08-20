/**
 * The Beta Hub generates recruitment QR codes with its own encoder rather than
 * a CDN script (`support-site/android/qr.js`). A hand-written QR encoder either
 * works or produces a square of noise that scans as nothing — and you cannot
 * tell which by looking at it. So this suite DECODES what the encoder produced
 * and asserts the payload comes back out.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const HUB = path.join(__dirname, '..', '..', 'support-site', 'android');

interface QrMatrix { modules: number[][]; size: number; version: number; mask: number; }
interface QrApi {
  matrix(text: string): QrMatrix | null;
  svg(text: string, pixel?: number): string | null;
  versions: Array<{ total: number; ec: number; g1: number; g2: number } | null>;
  align: Array<number[] | null>;
}

function loadQr(): QrApi {
  const win: { QR?: QrApi } = {};
  const context = vm.createContext({
    window: win,
    crypto: { getRandomValues: (a: Uint8Array) => a },
    unescape,
    escape,
  });
  vm.runInContext(fs.readFileSync(path.join(HUB, 'qr.js'), 'utf8'), context, { filename: 'qr.js' });
  return win.QR as QrApi;
}

const QR = loadQr();

const MASKS: Array<(r: number, c: number) => boolean> = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Independently rebuilds the function-module map from the spec's rules. */
function functionModules(version: number, size: number): boolean[][] {
  const res: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r: number, c: number): void => {
    if (r >= 0 && r < size && c >= 0 && c < size) res[r][c] = true;
  };
  const finder = (row: number, col: number): void => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(row + r, col + c);
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let t = 8; t < size - 8; t++) { mark(6, t); mark(t, 6); }
  const centers = QR.align[version] as number[];
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      const corner = (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0);
      if (corner) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) mark(centers[i] + dr, centers[j] + dc);
      }
    }
  }
  mark(size - 8, 8);
  for (let f = 0; f < 9; f++) { if (f !== 6) { mark(8, f); mark(f, 8); } }
  for (let g = 0; g < 8; g++) { mark(8, size - 1 - g); mark(size - 1 - g, 8); }
  if (version >= 7) {
    for (let v = 0; v < 6; v++) {
      for (let w = 0; w < 3; w++) { mark(v, size - 11 + w); mark(size - 11 + w, v); }
    }
  }
  return res;
}

/** Unmask, read the zigzag, de-interleave the blocks and parse the payload. */
function decode(text: string): string {
  const out = QR.matrix(text);
  if (!out) throw new Error('encoder refused the payload');
  const { modules, size, version, mask } = out;
  const fn = functionModules(version, size);

  const unmasked = modules.map((row) => row.slice());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!fn[r][c] && MASKS[mask](r, c)) unmasked[r][c] ^= 1;
    }
  }

  const bits: number[] = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = up ? size - 1 - step : step;
      for (let d = 0; d < 2; d++) {
        const c2 = col - d;
        if (fn[row][c2]) continue;
        bits.push(unmasked[row][c2]);
      }
    }
    up = !up;
  }

  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  const spec = QR.versions[version] as { total: number; ec: number; g1: number; g2: number };
  const blocks = spec.g1 + spec.g2;
  const dataCodewords = spec.total - spec.ec * blocks;
  const perG1 = Math.floor(dataCodewords / blocks);
  const sizes: number[] = [];
  for (let b = 0; b < blocks; b++) sizes.push(perG1 + (b >= spec.g1 ? 1 : 0));

  const dataBlocks: number[][] = sizes.map(() => []);
  let idx = 0;
  const maxData = Math.max(...sizes);
  for (let c = 0; c < maxData; c++) {
    for (let k = 0; k < blocks; k++) if (c < sizes[k]) dataBlocks[k].push(codewords[idx++]);
  }
  const data = ([] as number[]).concat(...dataBlocks);

  let bit = 0;
  const readBits = (n: number): number => {
    let value = 0;
    for (let i = 0; i < n; i++) {
      value = (value << 1) | ((data[bit >> 3] >> (7 - (bit & 7))) & 1);
      bit++;
    }
    return value;
  };
  expect(readBits(4)).toBe(4); // byte mode
  const length = readBits(version < 10 ? 8 : 16);
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) bytes.push(readBits(8));
  return decodeURIComponent(escape(String.fromCharCode(...bytes)));
}

describe('Beta Hub QR encoder', () => {
  const cases: Array<[string, string]> = [
    ['short ASCII', 'HELLO'],
    ['a tracked recruitment link',
      'https://wrexist.github.io/DeepLifeSimulator/android/?source=reddit'],
    ['a link with a campaign',
      'https://wrexist.github.io/DeepLifeSimulator/android/?source=discord&campaign=android-beta-wave-1'],
    ['a referral link',
      'https://wrexist.github.io/DeepLifeSimulator/android/?source=friend&ref=M6JF3D'],
    ['non-ASCII text', 'åäö — Deep Life ✓'],
  ];

  it.each(cases)('round-trips %s', (_label, payload) => {
    expect(decode(payload)).toBe(payload);
  });

  it('round-trips a payload long enough to need multi-block interleaving', () => {
    // Version 10 splits into four blocks of two different sizes; a wrong
    // interleave still renders as a plausible-looking square.
    const long = 'https://wrexist.github.io/DeepLifeSimulator/android/?source=test-for-test&campaign=' +
      'a'.repeat(160);
    const encoded = QR.matrix(long) as QrMatrix;
    expect(encoded.version).toBe(10);
    expect(decode(long)).toBe(long);
  });

  it('refuses a payload it cannot encode instead of emitting a broken symbol', () => {
    expect(QR.matrix('x'.repeat(400))).toBeNull();
    expect(QR.svg('x'.repeat(400))).toBeNull();
  });

  it('places the three finder patterns', () => {
    const { modules, size } = QR.matrix('finder check') as QrMatrix;
    [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([row, col]) => {
      expect(modules[row][col]).toBe(1);
      expect(modules[row + 1][col + 1]).toBe(0);
      expect(modules[row + 3][col + 3]).toBe(1);
    });
  });

  it('keeps the timing pattern alternating and the dark module set', () => {
    const { modules, size } = QR.matrix('timing check') as QrMatrix;
    for (let t = 8; t < size - 8; t++) expect(modules[6][t]).toBe(t % 2 === 0 ? 1 : 0);
    expect(modules[size - 8][8]).toBe(1);
  });

  it('emits a self-contained SVG with a quiet zone and no external reference', () => {
    const svg = QR.svg('https://wrexist.github.io/DeepLifeSimulator/android/', 6) as string;
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label=');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    const dim = /width="(\d+)"/.exec(svg) as RegExpExecArray;
    const size = (QR.matrix('https://wrexist.github.io/DeepLifeSimulator/android/') as QrMatrix).size;
    expect(Number(dim[1])).toBe((size + 8) * 6); // 4-module quiet zone each side
  });
});
