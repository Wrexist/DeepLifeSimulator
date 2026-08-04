/**
 * Hard Rule #7 — the last two side accent bars.
 *
 * The rule bans "side accent bars / one-sided colored borders on cards". Both of
 * these were the FIRST kind: a `<View style={{ width: scale(3) }}>` with a
 * semantic `backgroundColor`, rendered as the first child of a flex-row. Not a
 * border at all, which is why a `borderLeftWidth` sweep reported the app clean
 * while two of them were still shipping.
 *
 * Owner decision (2026-08-02): replace with a tinted background, no border.
 *
 * These are source-contract assertions rather than render assertions. What
 * matters is the STYLE DECLARATION — a rendered tree would let a stripe come
 * back as a differently-named view and still pass.
 *
 * Each file gets two assertions, and the second is the one worth having: it is
 * easy to satisfy "no stripe" by deleting the colour outright, which would also
 * delete the meaning the stripe was carrying. So we assert the semantic colour
 * is still computed AND still reaches the row.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const read = (rel: string) => {
  const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
  // Strip comments — every one of these files now DESCRIBES the removed stripe
  // in prose, so a naive search for `stripe` matches the explanation and the
  // test passes (or fails) on a comment rather than on code.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
};

const STOCK_ROW = read('components/stocks/StockRow.tsx');
const STOCKS_APP = read('components/mobile/StocksApp.tsx');

describe('StockRow — grouped list variant', () => {
  it('no longer renders a fixed-width accent bar', () => {
    expect(STOCK_ROW).not.toMatch(/stripe:\s*\{\s*width:/);
    expect(STOCK_ROW).not.toMatch(/styles\.stripe/);
  });

  it('still carries the sector colour, now as a row tint', () => {
    // The meaning must survive the fix. `0F` is ~6% alpha — deliberately far
    // weaker than the sector chip's `26`, because the chip in this same row
    // already names the sector in full colour.
    expect(STOCK_ROW).toMatch(/backgroundColor: `\$\{sectorColor\}0F`/);
  });

  it('keeps the hairline row divider (the control)', () => {
    // A neutral `theme.border` hairline separator is one of Hard Rule #7's
    // explicit structural exceptions. Removing it would be over-applying the
    // rule, which is its own kind of wrong.
    expect(STOCK_ROW).toMatch(/borderBottomWidth: StyleSheet\.hairlineWidth, borderBottomColor: theme\.border/);
  });

  it('and the standalone card still carries the sector on its full border (the control)', () => {
    // The standalone variant was fixed in an earlier pass. This pins it so the
    // two variants cannot drift back apart.
    expect(STOCK_ROW).toMatch(/borderColor: sectorColor/);
    expect(STOCK_ROW).toMatch(/cardOuter: \{ borderRadius: [^,]+, borderWidth: 1 \}/);
  });
});

describe('StocksApp — order rows', () => {
  it('no longer renders a fixed-width accent bar', () => {
    expect(STOCKS_APP).not.toMatch(/stripe:\s*\{\s*width:/);
    expect(STOCKS_APP).not.toMatch(/styles\.stripe/);
  });

  it('still carries the buy/sell colour, now as a row tint', () => {
    expect(STOCKS_APP).toMatch(/backgroundColor: `\$\{sideColor\}0F`/);
  });

  it('and the side is still stated in text, not only in colour (the control)', () => {
    // This is what lets the tint stay faint: colour alone would fail anyone who
    // cannot distinguish the two, and the row already says which it is.
    expect(STOCKS_APP).toMatch(/\{o\.side\.toUpperCase\(\)\} \{o\.symbol\}/);
  });

  it('keeps the hairline row divider (the control)', () => {
    expect(STOCKS_APP).toMatch(/borderBottomWidth: StyleSheet\.hairlineWidth, borderBottomColor: theme\.border/);
  });
});

describe('no side accent bar came back anywhere else', () => {
  // A narrow sweep, not an app-wide one: a general `width: scale(3)` ban would
  // fire on legitimate hairlines and dots. This checks the two files that had
  // the pattern, plus the shape itself — a fixed-width view whose only style is
  // a semantic colour, rendered as the first child of a row.
  it('neither stocks file declares a bare fixed-width coloured view', () => {
    for (const src of [STOCK_ROW, STOCKS_APP]) {
      expect(src).not.toMatch(/<View style=\{\[styles\.\w*[Ss]tripe/);
    }
  });
});
