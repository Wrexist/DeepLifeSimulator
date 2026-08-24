/**
 * Hard Rule #7 — decorative side accent bars, swept from the card surfaces.
 *
 * The rule bans a colour used as a one-sided stripe on a card. It names the
 * `borderLeftWidth`-style implementation, but the rationale it gives is about
 * the LOOK ("the product owner rejected it") and about RN curling the stripe
 * into a crescent where it meets a `borderRadius`. Every site fixed here built
 * the same look out of a sibling `<View>` with a fixed width (or, in TravelApp,
 * a `position: absolute` bar pinned across the top edge) and then clipped it
 * with `borderRadius` + `overflow: 'hidden'` — the exact artifact case.
 *
 * Each one takes the rule's own prescribed remedy: the colour moves onto a full
 * border on all four sides, keeping its meaning.
 *
 * ── What is deliberately NOT here ─────────────────────────────────────────
 *
 * Two stripes survive, in `StockRow`'s grouped variant and the order rows in
 * mobile `StocksApp`. Both are flat list rows: no border to move a colour onto
 * and no radius to curl against, so the remedy does not apply as written and
 * the alternative would mean inventing new UI. Flagged for the owner instead.
 *
 * `HealthCard.activeStripe` is also untouched and is NOT a violation despite
 * the name — it is a rounded "Active" pill with a dot and a label, positioned
 * top-right. Read it before believing the identifier.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

/** Strip comments — an explanation of the fix must not satisfy the fix. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SWEPT = {
  'components/politics/ScandalRow.tsx': 'severityStripe',
  'components/crypto/OrderRow.tsx': 'sideStripe',
  'components/computer/TravelApp.tsx': 'tileStripe',
  'components/computer/BitcoinMiningApp.tsx': 'noticeStripe',
} as const;

describe('the swept card surfaces have no side accent bar', () => {
  it('the stripe element and its style are both gone', () => {
    for (const [file, name] of Object.entries(SWEPT)) {
      expect(`${file}: ${code(read(file)).includes(name)}`).toBe(`${file}: false`);
    }
  });

  it('and none of them swapped it for a one-sided border', () => {
    // The other route to the same banned look. Hard Rule #7 permits one-sided
    // borders for STRUCTURE - row/section dividers, an active-tab underline, a
    // hairline indent guide - so a bare count would flag legitimate code.
    // TravelApp has two of them: its tab bar's divider, and the underline on
    // the selected tab.
    const ALLOWED = /hairlineWidth|tabBar|tabBtn|divider|separator/i;

    for (const file of Object.keys(SWEPT)) {
      const src = code(read(file));
      // matchAll gives the REAL index of each hit. `indexOf(hit)` would return
      // the first occurrence every time and silently judge one match N times.
      const decorative = [...src.matchAll(/border(?:Left|Right|Top|Bottom)Width/g)]
        .filter((m) => !ALLOWED.test(src.slice(Math.max(0, m.index! - 160), m.index! + 80)));

      expect(`${file}: ${decorative.length}`).toBe(`${file}: 0`);
    }
  });

  it('the allowlist is not just swallowing everything (the control)', () => {
    // If the window or the pattern above were wrong, the previous test would
    // pass on anything. TravelApp must still HAVE the two structural borders.
    const travel = code(read('components/computer/TravelApp.tsx'));
    const hits = [...travel.matchAll(/border(?:Left|Right|Top|Bottom)Width/g)];

    expect(hits.length).toBe(2);
    expect(travel).toMatch(/tabBtn, active && \{ borderBottomColor: IDENTITY, borderBottomWidth: 2 \}/);
    expect(travel).toMatch(/tabBar: \{ flexDirection: 'row', borderBottomWidth: 1 \}/);
  });

  it('the colour survives on a full four-sided border', () => {
    // Removing the stripe must not remove the MEANING.
    expect(code(read('components/politics/ScandalRow.tsx'))).toMatch(/borderColor: color/);
    expect(code(read('components/crypto/OrderRow.tsx'))).toMatch(/borderColor: sideColor/);
    expect(code(read('components/computer/TravelApp.tsx'))).toMatch(/borderColor: meta\.hue/);
    expect(code(read('components/computer/BitcoinMiningApp.tsx'))).toMatch(/borderColor: amber\.solid/);
    expect(code(read('components/stocks/StockRow.tsx'))).toMatch(/borderColor: sectorColor/);
  });

  it('StockRow has no stripe left in EITHER variant', () => {
    // This used to assert exactly one survivor: the standalone card had moved
    // its sector onto a full border, and the grouped list row was held back
    // pending a design call, because a flat row has no border to move a colour
    // onto and no radius to curl against.
    //
    // The owner made that call on 2026-08-02 - tinted background, no border -
    // so the survivor is gone and the count is zero. See
    // `__tests__/render/rule7StockRows.test.ts` for the replacement's own
    // assertions, including that the sector colour still reaches the row.
    const src = code(read('components/stocks/StockRow.tsx'));

    expect(src.match(/styles\.stripe/g) ?? []).toHaveLength(0);
    expect(src).not.toMatch(/stripe:\s*\{\s*width:/);
  });
});

describe('the colours the borders now carry are actually visible', () => {
  it('no swept surface paints its border near-black', () => {
    // A colour that only ever tinted an icon can be #0f172a; as a border on a
    // dark surface that reads as no colour at all. This caught platinum on the
    // credit cards.
    for (const file of Object.keys(SWEPT)) {
      expect(`${file}: ${/borderColor: '#0[0-9a-f]{5}'/i.test(code(read(file)))}`)
        .toBe(`${file}: false`);
    }
  });
});

describe('the exceptions Hard Rule #7 allows are left alone (the controls)', () => {
  it('HealthCard keeps its "Active" pill - a badge, not a stripe', () => {
    const src = read('components/health/HealthCard.tsx');

    expect(src).toMatch(/activeStripe/);
    // It is a positioned, rounded, labelled pill. If this ever becomes a bare
    // fixed-width bar it stops being an exception.
    expect(src).toMatch(/activeStripe: \{[\s\S]{0,240}position: 'absolute'/);
    expect(src).toMatch(/activeStripe: \{[\s\S]{0,240}borderRadius: scale\(999\)/);
    expect(src).toMatch(/activeLabel/);
  });

  it('hairline row separators survive the sweep', () => {
    // Explicitly permitted: "row/section dividers".
    expect(read('components/stocks/StockRow.tsx'))
      .toMatch(/borderBottomWidth: StyleSheet\.hairlineWidth/);
  });
});
