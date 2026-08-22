/**
 * No double-encoded UTF-8 anywhere in the repo.
 *
 * `tasks/lessons.md` arrived on `main` carrying 926 mangled characters — every
 * em dash rendered as three, plus arrows, section signs and emoji — and a
 * leading BOM. Two crypto screens and a banking gauge had it too, and two of
 * those were PLAYER-VISIBLE: the DCA rule row printed "$500 a-hat-dagger-arrow
 * BTC" and the Place Order modal printed an almost-equals as three characters.
 *
 * The cause is mechanical: UTF-8 bytes decoded as cp1252 and re-encoded as
 * UTF-8, so one character becomes a run of Latin-1 lookalikes. Some editor or
 * script in the pipeline did it once, and every later merge carried it forward
 * — nothing looks at these bytes, so nothing objected.
 *
 * ── Why this checks by round trip, not by pattern ─────────────────────────
 *
 * The first sweep grepped for the common sequences and reported the repo clean
 * apart from three files. It had missed the Place Order modal, because the
 * pattern list happened to include the mangled em dash and not the mangled
 * almost-equals. A hand-maintained list of corrupt sequences is the same
 * category of mistake as the corruption itself.
 *
 * So this asks the structural question instead: take each run of non-ASCII
 * characters, re-encode it back to the bytes it was misread from, and see
 * whether those bytes are valid UTF-8 that is SHORTER than what is on disk.
 * Only genuine mojibake contracts — legitimate text does not.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'assets', 'android', 'ios', '.expo', 'dist', 'coverage',
]);
const EXTS = /\.(md|tsx?|jsx?|json|html|css)$/;

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (EXTS.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The bytes a run of characters was misread FROM.
 *
 * cp1252 where it is defined, latin-1 for the handful of slots it leaves
 * undefined (0x81, 0x8D, 0x8F, 0x90, 0x9D) — which is how the corruption arose,
 * since whatever produced it was lenient about exactly those bytes.
 */
const CP1252_SPECIALS: Record<string, number> = {
  '\u20ac': 0x80, '\u201a': 0x82, '\u0192': 0x83, '\u201e': 0x84,
  '\u2026': 0x85, '\u2020': 0x86, '\u2021': 0x87, '\u02c6': 0x88,
  '\u2030': 0x89, '\u0160': 0x8a, '\u2039': 0x8b, '\u0152': 0x8c,
  '\u017d': 0x8e, '\u2018': 0x91, '\u2019': 0x92, '\u201c': 0x93,
  '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
  '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b,
  '\u0153': 0x9c, '\u017e': 0x9e, '\u0178': 0x9f,
};

function reEncode(run: string): Buffer | null {
  const bytes: number[] = [];
  for (const ch of run) {
    const code = ch.codePointAt(0)!;
    if (ch in CP1252_SPECIALS) bytes.push(CP1252_SPECIALS[ch]);
    else if (code <= 0xff) bytes.push(code);
    else return null; // not something a single-byte misread could produce
  }
  return Buffer.from(bytes);
}

/**
 * Characters a UTF-8 LEAD byte becomes when misread (0xC2-0xDF, 0xE0-0xEF,
 * 0xF0-0xF4), and the ones a CONTINUATION byte (0x80-0xBF) becomes.
 */
const LEADS = new Set([...'\u00c2\u00c3\u00e2\u00f0\u00ef']);
const CONTINUATIONS = new Set<string>([
  ...Object.keys(CP1252_SPECIALS),
  ...Array.from({ length: 0x20 }, (_, i) => String.fromCharCode(0xa0 + i)),
]);

/**
 * Does this run LOOK like mojibake, independent of whether it re-encodes?
 *
 * Needed because the structural test alone has false positives — any two
 * adjacent non-ASCII characters whose bytes happen to form a valid two-byte
 * UTF-8 sequence will pass it. Two live examples from this repo:
 *
 *     0.40x-0.72x                multiplication sign + en dash, a real range
 *     PRESTIZ / POZICKY          Slovak, legitimately adjacent accented capitals
 *
 * Genuine mojibake always contains a lead-byte character immediately followed
 * by a continuation-byte character. Neither of those does.
 */
function looksLikeMojibake(run: string): boolean {
  const chars = [...run];
  for (let i = 0; i < chars.length - 1; i++) {
    if (LEADS.has(chars[i]) && CONTINUATIONS.has(chars[i + 1])) return true;
  }
  return false;
}

/** Runs in `src` that are structurally AND lexically double-encoded. */
function findMojibake(src: string): { run: string; fixed: string }[] {
  const found: { run: string; fixed: string }[] = [];
  for (const run of new Set(src.match(/[^\x00-\x7F]+/g) ?? [])) {
    if (!looksLikeMojibake(run)) continue;
    const raw = reEncode(run);
    if (!raw) continue;
    // NOT `raw.length === run.length` — that early-out looks like a cheap
    // "nothing to do" test and silently skips the most common case there is: a
    // two- or three-character run standing in for one multi-byte character. It
    // hid `\u00c2\u00b7` (a mangled middot) in four player-facing screens through a
    // whole sweep. The length comparison that matters is on the DECODED text.
    const fixed = raw.toString('utf8');
    // Node substitutes U+FFFD for invalid sequences rather than throwing.
    if (fixed.includes('\ufffd')) continue;
    if (fixed.length < run.length) found.push({ run, fixed });
  }
  return found;
}

/**
 * Files that CONTAIN mojibake on purpose, and must not be "fixed".
 *
 * Kept deliberately short, and each entry has to be a file whose subject IS the
 * corruption — repairing those would delete the evidence they exist to record.
 */
const QUOTES_MOJIBAKE_DELIBERATELY = [
  // The audit that first reported the mangled middot in the banking strings,
  // quoting the broken bytes as its evidence.
  path.join('tasks', 'app-audit-2026-07-19.md'),
  // This file's own planted-corruption control.
  path.join('__tests__', 'tooling', 'textEncoding.test.ts'),
];

const FILES = collect(repoRoot);

describe('text encoding', () => {
  it('the scan actually walked the repo (the control)', () => {
    // A scan that collected nothing would pass forever while checking nothing.
    expect(FILES.length).toBeGreaterThan(800);
    expect(FILES.some((f) => f.endsWith(path.join('tasks', 'lessons.md')))).toBe(true);
  });

  it('detects the exact corruption that shipped (the control)', () => {
    // The DCA rule row, verbatim as it was on disk.
    const planted = '{formatMoney(rule.amount)} â†’ {rule.cryptoId}';
    const hits = findMojibake(planted);
    expect(hits).toHaveLength(1);
    expect(hits[0].fixed).toBe('→'); // →
  });

  it('does not flag legitimate non-ASCII text (the control)', () => {
    // Real em dashes, arrows, accents and emoji must pass untouched, or the
    // guard would push authors toward ASCII-only prose.
    for (const clean of ['a — b', 'x → y', 'café', 'naïve', '✅ done', 'σ = 0.2', '≈ 5']) {
      expect(`${clean}: ${findMojibake(clean).length}`).toBe(`${clean}: 0`);
    }
  });

  it('no file is double-encoded', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const rel = path.relative(repoRoot, file);
      if (QUOTES_MOJIBAKE_DELIBERATELY.includes(rel)) continue;
      const src = fs.readFileSync(file, 'utf8');
      const hits = findMojibake(src);
      if (hits.length === 0) continue;
      offenders.push(`${rel}: ${hits.slice(0, 3).map((h) => `${JSON.stringify(h.run)} should be ${JSON.stringify(h.fixed)}`).join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('no file starts with a byte-order mark', () => {
    // `lessons.md` carried one. A BOM breaks `grep '^## '`, shifts the first
    // heading out of every markdown renderer's title detection, and is
    // invisible in a diff.
    const withBom = FILES
      .filter((f) => fs.readFileSync(f, 'utf8').charCodeAt(0) === 0xfeff)
      .map((f) => path.relative(repoRoot, f));
    expect(withBom).toEqual([]);
  });
});
