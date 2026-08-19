/**
 * Minimal QR encoder — byte mode, error-correction level L, versions 1–10
 * (URLs up to 271 characters, which every link this hub generates fits inside).
 *
 * Written from the ISO/IEC 18004 spec rather than pulled from a CDN on purpose:
 * the hub is a static GitHub Pages site with no build step, and a third-party
 * script tag would add a network dependency, a supply-chain surface and a
 * tracking vector to a page whose whole point is a printable link.
 *
 * window.QR.svg(text) -> an <svg> string, or null if the text is too long.
 */
(function () {
  'use strict';

  // total codewords, EC codewords per block, [blocks in group 1, blocks in group 2]
  let VERSIONS = [
    null,
    { total: 26,  ec: 7,  g1: 1, g2: 0 },
    { total: 44,  ec: 10, g1: 1, g2: 0 },
    { total: 70,  ec: 15, g1: 1, g2: 0 },
    { total: 100, ec: 20, g1: 1, g2: 0 },
    { total: 134, ec: 26, g1: 1, g2: 0 },
    { total: 172, ec: 18, g1: 2, g2: 0 },
    { total: 196, ec: 20, g1: 2, g2: 0 },
    { total: 242, ec: 24, g1: 2, g2: 0 },
    { total: 292, ec: 30, g1: 2, g2: 0 },
    { total: 346, ec: 18, g1: 2, g2: 2 },
  ];

  let ALIGN = [
    null, [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  ];

  // ── GF(256) ────────────────────────────────────────────────────────────
  let EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function generatorPoly(degree) {
    let poly = [1];
    for (let d = 0; d < degree; d++) {
      let next = new Array(poly.length + 1).fill(0);
      for (let i = 0; i < poly.length; i++) {
        next[i] ^= poly[i];
        next[i + 1] ^= gfMul(poly[i], EXP[d]);
      }
      poly = next;
    }
    return poly;
  }

  function ecBytes(data, ecLen) {
    let gen = generatorPoly(ecLen);
    let rem = data.slice().concat(new Array(ecLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      let lead = rem[i];
      if (!lead) continue;
      for (let j = 0; j < gen.length; j++) rem[i + j] ^= gfMul(gen[j], lead);
    }
    return rem.slice(data.length);
  }

  // ── data encoding ──────────────────────────────────────────────────────
  function utf8Bytes(text) {
    let encoded = unescape(encodeURIComponent(text));
    let out = [];
    for (let i = 0; i < encoded.length; i++) out.push(encoded.charCodeAt(i) & 0xff);
    return out;
  }

  function pickVersion(byteCount) {
    for (let v = 1; v <= 10; v++) {
      let spec = VERSIONS[v];
      let blocks = spec.g1 + spec.g2;
      let dataCodewords = spec.total - spec.ec * blocks;
      let countBits = v < 10 ? 8 : 16;
      let capacity = Math.floor((dataCodewords * 8 - 4 - countBits) / 8);
      if (byteCount <= capacity) return v;
    }
    return 0;
  }

  function buildCodewords(bytes, version) {
    let spec = VERSIONS[version];
    let blocks = spec.g1 + spec.g2;
    let dataCodewords = spec.total - spec.ec * blocks;
    let countBits = version < 10 ? 8 : 16;

    let bits = [];
    function push(value, length) {
      for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }
    push(0x4, 4);                 // byte mode
    push(bytes.length, countBits);
    bytes.forEach(function (b) { push(b, 8); });

    let terminator = Math.min(4, dataCodewords * 8 - bits.length);
    push(0, terminator);
    while (bits.length % 8) bits.push(0);

    let data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    let pad = [0xEC, 0x11], p = 0;
    while (data.length < dataCodewords) data.push(pad[p++ % 2]);

    // Split into blocks. Group 2 blocks hold one more data codeword each.
    let perG1 = Math.floor(dataCodewords / blocks);
    let dataBlocks = [], ecBlocks = [], at = 0;
    for (let b = 0; b < blocks; b++) {
      let size = perG1 + (b >= spec.g1 ? 1 : 0);
      let block = data.slice(at, at + size);
      at += size;
      dataBlocks.push(block);
      ecBlocks.push(ecBytes(block, spec.ec));
    }

    // Interleave, which is what makes a burst of damage survivable.
    let out = [], maxData = Math.max.apply(null, dataBlocks.map(function (d) { return d.length; }));
    for (let c = 0; c < maxData; c++) {
      for (let k = 0; k < dataBlocks.length; k++) {
        if (c < dataBlocks[k].length) out.push(dataBlocks[k][c]);
      }
    }
    for (let e = 0; e < spec.ec; e++) {
      for (let m = 0; m < ecBlocks.length; m++) out.push(ecBlocks[m][e]);
    }
    return out;
  }

  // ── matrix ─────────────────────────────────────────────────────────────
  function buildMatrix(version, codewords) {
    let size = 17 + version * 4;
    let modules = [], reserved = [];
    for (let i = 0; i < size; i++) {
      modules.push(new Array(size).fill(0));
      reserved.push(new Array(size).fill(false));
    }

    function finder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          let rr = row + r, cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          let on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          modules[rr][cc] = on ? 1 : 0;
          reserved[rr][cc] = true;
        }
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    for (let t = 8; t < size - 8; t++) {
      let bit = t % 2 === 0 ? 1 : 0;
      if (!reserved[6][t]) { modules[6][t] = bit; reserved[6][t] = true; }
      if (!reserved[t][6]) { modules[t][6] = bit; reserved[t][6] = true; }
    }

    // Alignment patterns sit at every pair of coordinates EXCEPT the three that
    // would land on a finder. The exclusion is by INDEX, not by "is this module
    // already reserved" — the timing row is reserved too, and testing against
    // that would wrongly drop the alignment patterns that legitimately overlap
    // it (every (6, n) and (n, 6) pattern from version 7 up).
    let centers = ALIGN[version], n = centers.length;
    for (let ai = 0; ai < n; ai++) {
      for (let aj = 0; aj < n; aj++) {
        let corner = (ai === 0 && aj === 0) ||
                     (ai === 0 && aj === n - 1) ||
                     (ai === n - 1 && aj === 0);
        if (corner) continue;
        let ar = centers[ai], ac = centers[aj];
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            let on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            modules[ar + dr][ac + dc] = on ? 1 : 0;
            reserved[ar + dr][ac + dc] = true;
          }
        }
      }
    }

    modules[size - 8][8] = 1;                             // dark module
    reserved[size - 8][8] = true;

    // Reserve the format-info strips before data placement.
    for (let f = 0; f < 9; f++) {
      if (f !== 6) { reserved[8][f] = true; reserved[f][8] = true; }
    }
    for (let g = 0; g < 8; g++) {
      reserved[8][size - 1 - g] = true;
      reserved[size - 1 - g][8] = true;
    }
    if (version >= 7) {
      for (let v = 0; v < 6; v++) {
        for (let w = 0; w < 3; w++) {
          reserved[v][size - 11 + w] = true;
          reserved[size - 11 + w][v] = true;
        }
      }
    }

    // Zigzag data placement, upward then downward, two columns at a time.
    let bitIndex = 0, total = codewords.length * 8;
    function nextBit() {
      if (bitIndex >= total) return 0;
      let bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
      bitIndex++;
      return bit;
    }
    let up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                               // skip the timing column
      for (let step = 0; step < size; step++) {
        let row = up ? size - 1 - step : step;
        for (let d = 0; d < 2; d++) {
          let c2 = col - d;
          if (reserved[row][c2]) continue;
          modules[row][c2] = nextBit();
        }
      }
      up = !up;
    }

    return { modules: modules, reserved: reserved, size: size };
  }

  let MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; },
  ];

  function penalty(m, size) {
    let score = 0, r, c, run, dark = 0;
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) { run++; } else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) { run++; } else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        let s = m[r][c] + m[r][c + 1] + m[r + 1][c] + m[r + 1][c + 1];
        if (s === 0 || s === 4) score += 3;
      }
    }
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += m[r][c];
    score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return score;
  }

  function formatBits(mask) {
    let value = (0x01 << 3) | mask;                       // EC level L = 01
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((value << 10) | (rem & 0x3FF)) ^ 0x5412;
  }

  function versionBits(version) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    return (version << 12) | (rem & 0xFFF);
  }

  function place(text) {
    let bytes = utf8Bytes(text);
    let version = pickVersion(bytes.length);
    if (!version) return null;
    let chosenMask = 0;
    let built = buildMatrix(version, buildCodewords(bytes, version));
    let size = built.size, reserved = built.reserved;

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      let m = built.modules.map(function (row) { return row.slice(); });
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!reserved[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
        }
      }
      // Format info is written twice: once wrapping the top-left finder, once
      // split across the bottom-left column and the top-right row.
      let fmt = formatBits(mask);
      for (let i = 0; i < 15; i++) {
        let bit = (fmt >> i) & 1;
        if (i < 6) m[i][8] = bit;
        else if (i === 6) m[7][8] = bit;
        else if (i === 7) m[8][8] = bit;
        else if (i === 8) m[8][7] = bit;
        else m[8][14 - i] = bit;

        if (i < 8) m[size - 1 - i][8] = bit;
        else m[8][size - 15 + i] = bit;
      }
      m[size - 8][8] = 1;                                 // always dark
      if (version >= 7) {
        let vb = versionBits(version);
        for (let k = 0; k < 18; k++) {
          let vbit = (vb >> k) & 1;
          m[Math.floor(k / 3)][size - 11 + (k % 3)] = vbit;
          m[size - 11 + (k % 3)][Math.floor(k / 3)] = vbit;
        }
      }
      let score = penalty(m, size);
      if (score < bestScore) { bestScore = score; best = m; chosenMask = mask; }
    }
    return { modules: best, size: size, version: version, mask: chosenMask };
  }

  window.QR = {
    /** Exposed so the test suite can unmask and read the symbol back. */
    matrix: place,
    versions: VERSIONS,
    align: ALIGN,
    svg: function (text, pixel) {
      let result = place(String(text || ''));
      if (!result) return null;
      let quiet = 4, scale = pixel || 6;
      let dim = (result.size + quiet * 2) * scale;
      let path = '';
      for (let r = 0; r < result.size; r++) {
        for (let c = 0; c < result.size; c++) {
          if (result.modules[r][c]) {
            path += 'M' + ((c + quiet) * scale) + ' ' + ((r + quiet) * scale) +
              'h' + scale + 'v' + scale + 'h-' + scale + 'z';
          }
        }
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim +
        '" viewBox="0 0 ' + dim + ' ' + dim + '" role="img" aria-label="QR code for the recruitment link">' +
        '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/>' +
        '<path d="' + path + '" fill="#000"/></svg>';
    },
  };
})();
